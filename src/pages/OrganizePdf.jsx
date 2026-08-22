import { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { FiLayers, FiTrash2, FiPlus, FiDownload, FiRefreshCw } from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import Loader from '../components/Loader';

import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const OrganizePdf = () => {
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Processing PDF...');
  
  // Array of page objects: { id, originalIndex, pdfSourceId, dataUrl }
  const [pages, setPages] = useState([]);
  const [sourcePdfs, setSourcePdfs] = useState([]); // Array of ArrayBuffers
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [organizedUrl, setOrganizedUrl] = useState(null);

  const handleFileLoad = async (files) => {
    if (files.length === 0) return;
    setLoading(true);
    setLoadingText('Rendering page thumbnails...');

    try {
      const newSourcePdfs = [...sourcePdfs];
      const newPages = [...pages];

      for (const file of files) {
        const rawBuffer = await file.arrayBuffer();
        
        // Create two independent clones: one for pdf.js rendering, one for pdf-lib final export
        const renderBuffer = rawBuffer.slice(0);
        const exportBuffer = rawBuffer.slice(0);

        const sourceId = newSourcePdfs.length;
        newSourcePdfs.push(exportBuffer);

        const loadingTask = pdfjsLib.getDocument({ data: renderBuffer });
        const pdfDoc = await loadingTask.promise;

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 0.3 });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({ canvasContext: context, viewport }).promise;
          const dataUrl = canvas.toDataURL();

          newPages.push({
            id: `${sourceId}-${i}-${Math.random()}`,
            sourceId: sourceId,
            originalIndex: i - 1,
            dataUrl: dataUrl,
            fileName: file.name
          });
        }
      }

      setSourcePdfs(newSourcePdfs);
      setPages(newPages);
    } catch (error) {
      console.error("Error loading PDF pages:", error);
      alert("Failed to read PDF pages. The file might be corrupted or encrypted.");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (pages.length === 0) return;
    setLoading(true);
    setLoadingText('Rebuilding reorganized PDF...');

    try {
      const newPdf = await PDFDocument.create();
      const loadedSourceDocs = {};

      for (const p of pages) {
        if (!loadedSourceDocs[p.sourceId]) {
          // Clone the export buffer again just in case a document is referenced multiple times
          const bufferCopy = sourcePdfs[p.sourceId].slice(0);
          loadedSourceDocs[p.sourceId] = await PDFDocument.load(bufferCopy);
        }
        const sourceDoc = loadedSourceDocs[p.sourceId];
        const [copiedPage] = await newPdf.copyPages(sourceDoc, [p.originalIndex]);
        newPdf.addPage(copiedPage);
      }

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setOrganizedUrl(url);
    } catch (error) {
      console.error("Generation error:", error);
      alert("Failed to export reorganized PDF.");
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const updatedPages = [...pages];
    const draggedItem = updatedPages[draggedIndex];
    updatedPages.splice(draggedIndex, 1);
    updatedPages.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    setPages(updatedPages);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleDeletePage = (e, index) => {
    e.stopPropagation();
    if (pages.length <= 1) {
      alert("You must keep at least one page in the document.");
      return;
    }
    const updated = pages.filter((_, i) => i !== index);
    setPages(updated);
  };

  const handleReset = () => {
    if (organizedUrl) URL.revokeObjectURL(organizedUrl);
    setPages([]);
    setSourcePdfs([]);
    setOrganizedUrl(null);
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Organize & Reorder PDF</h2>

      {pages.length === 0 && !organizedUrl && (
        <FileUpload 
          onFilesSelected={handleFileLoad} 
          accept={{ 'application/pdf': ['.pdf'] }} 
          multiple={true} 
          title="Drop one or more PDFs to organize pages"
        />
      )}

      {pages.length > 0 && !organizedUrl && (
        <div style={styles.card}>
          <div style={styles.topBar}>
            <p style={{ margin: 0 }}>Drag and drop thumbnails to reordering pages. Hover to delete.</p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={styles.appendBtn}>
                <FiPlus /> Append Another PDF
                <input type="file" accept=".pdf" multiple style={{ display: 'none' }} onChange={(e) => handleFileLoad(e.target.files)} />
              </label>
              <button onClick={handleGeneratePdf} style={styles.primaryBtn}>
                <FiDownload /> Export Reorganized PDF
              </button>
            </div>
          </div>

          <div style={styles.grid}>
            {pages.map((page, index) => (
              <div 
                key={page.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                style={{
                  ...styles.thumbnailCard,
                  opacity: draggedIndex === index ? 0.4 : 1
                }}
              >
                <div style={styles.badge}>{index + 1}</div>
                <button 
                  onClick={(e) => handleDeletePage(e, index)} 
                  style={styles.deleteBtn}
                  title="Delete page"
                >
                  <FiTrash2 />
                </button>
                <img src={page.dataUrl} alt={`Page ${index + 1}`} style={styles.thumbnailImg} />
                <span style={styles.pageMeta}>Page {index + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {organizedUrl && (
        <div style={styles.card}>
          <h3 style={styles.successTitle}>Organization Complete!</h3>
          <p style={{ marginBottom: '2rem' }}>Your customized document is ready for download.</p>
          
          <div style={styles.buttonGroup}>
            <a 
              href={organizedUrl} 
              download="organized_document.pdf" 
              style={styles.downloadBtn}
            >
              <FiDownload style={{ fontSize: '1.2rem' }} /> Download Organized PDF
            </a>
            <button onClick={handleReset} style={styles.secondaryBtn}>
              <FiRefreshCw style={{ fontSize: '1.2rem' }} /> Organize Another
            </button>
          </div>
        </div>
      )}

      <Loader isLoading={loading} phrases={[loadingText, "Compiling page layouts..."]} />
    </div>
  );
};

const styles = {
  card: { backgroundColor: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', color: 'var(--text-color)' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1.5rem', justifyContent: 'center' },
  thumbnailCard: { position: 'relative', backgroundColor: 'var(--bg-color)', border: '2px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem', textAlign: 'center', cursor: 'grab', transition: 'transform 0.2s ease, border-color 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  thumbnailImg: { width: '100%vh', maxWidth: '120px', height: '160px', objectFit: 'contain', backgroundColor: 'white', borderRadius: '4px', marginBottom: '0.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  badge: { position: 'absolute', top: '8px', left: '8px', backgroundColor: 'var(--primary-color)', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' },
  deleteBtn: { position: 'absolute', top: '8px', right: '8px', backgroundColor: '#ff4757', color: 'white', border: 'none', borderRadius: '4px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: '0.9', transition: 'opacity 0.2s' },
  pageMeta: { fontSize: '0.85rem', fontWeight: 'bold', opacity: 0.8 },
  appendBtn: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: 'transparent', color: 'var(--text-color)', border: '2px solid var(--border-color)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem' },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 'bold', cursor: 'pointer' },
  buttonGroup: { display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem' },
  secondaryBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', backgroundColor: 'transparent', color: 'var(--text-color)', border: '2px solid var(--border-color)', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' },
  successTitle: { margin: '0 0 1rem 0', color: '#2ed573', fontSize: '1.75rem', textAlign: 'center' },
  downloadBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', backgroundColor: '#2ed573', color: '#0f172a', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem' }
};

export default OrganizePdf;