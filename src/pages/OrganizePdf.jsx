import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { FiTrash2, FiPlus, FiDownload, FiGrid } from 'react-icons/fi';
import Loader from '../components/Loader';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';

import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const OrganizePdf = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const [loadingText, setLoadingText] = useState('Loading...');
  
  // Array of page objects: { id, originalIndex, pdfSourceId, dataUrl }
  const [pages, setPages] = useState([]);
  const [sourcePdfs, setSourcePdfs] = useState([]); // Array of ArrayBuffers
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [organizedUrl, setOrganizedUrl] = useState(null);
  const [organizedBlob, setOrganizedBlob] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const organizedUrlRef = useRef(null);
  const handledRef = useRef(false);

  useEffect(() => {
    organizedUrlRef.current = organizedUrl;
  }, [organizedUrl]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (organizedUrlRef.current) URL.revokeObjectURL(organizedUrlRef.current);
    };
  }, []);

  const handleFileLoad = useCallback(async (files) => {
    if (loadingRef.current) return;
    setErrorMessage(null);

    const fileList = files ? Array.from(files) : [];
    if (fileList.length === 0) return;
    
    // Validate PDF files and sizes
    for (const file of fileList) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setErrorMessage(`"${file.name}" is not a PDF. Please only select PDF files.`);
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        setErrorMessage(`"${file.name}" exceeds the 100 MB file size limit.`);
        return;
      }
    }

    setOrganizedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setOrganizedBlob(null);

    setLoading(true);
    setLoadingText('Rendering page thumbnails...');

    try {
      const newSourcePdfs = [...sourcePdfs];
      const newPages = [...pages];

      for (const file of fileList) {
        const rawBuffer = await file.slice(0).arrayBuffer();
        
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
      setErrorMessage("Failed to read PDF pages. The file might be password-protected or corrupted.");
    } finally {
      setLoading(false);
    }
  }, [sourcePdfs, pages]);

  // Handle incoming file piped from another tool
  useEffect(() => {
    if (handledRef.current) return;
    const inc = consumeTransferredFile() || location.state?.incomingFile;
    if (inc) {
      handledRef.current = true;
      setTimeout(() => {
        handleFileLoad([inc]);
      }, 0);
    }
  }, [handleFileLoad, location.state]);

  const handleGeneratePdf = async () => {
    if (loading || pages.length === 0) return;
    setErrorMessage(null);
    setLoading(true);
    setLoadingText('Rebuilding reorganized PDF...');

    try {
      const newPdf = await PDFDocument.create();
      const loadedSourceDocs = {};

      for (const p of pages) {
        if (!loadedSourceDocs[p.sourceId]) {
          const bufferCopy = sourcePdfs[p.sourceId].slice(0);
          loadedSourceDocs[p.sourceId] = await PDFDocument.load(bufferCopy);
        }
        const sourceDoc = loadedSourceDocs[p.sourceId];
        const [copiedPage] = await newPdf.copyPages(sourceDoc, [p.originalIndex]);
        newPdf.addPage(copiedPage);
      }

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      if (organizedUrl) URL.revokeObjectURL(organizedUrl);
      const url = URL.createObjectURL(blob);
      
      setOrganizedBlob(blob);
      setOrganizedUrl(url);
    } catch (error) {
      console.error("Generation error:", error);
      setErrorMessage("Failed to export reorganized PDF. Please verify memory constraints.");
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e, index) => {
    if (loading) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (loading || draggedIndex === null || draggedIndex === index) return;

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
    if (loading) return;
    setErrorMessage(null);

    if (pages.length <= 1) {
      setErrorMessage("You must keep at least one page in the document.");
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
    setOrganizedBlob(null);
    setErrorMessage(null);
  };

  // -------------------------------------------------------------
  // VIEW 3: FINAL COMPLETION VIEW
  // -------------------------------------------------------------
  if (organizedUrl) {
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="Organize & Reorder PDF"
          fileUrl={organizedUrl}
          fileName="organized_document.pdf"
          file={organizedBlob}
          onReset={handleReset}
          message="Your reorganized PDF is ready!"
          currentPath="/organize-pdf"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Empty state)
  // -------------------------------------------------------------
  if (pages.length === 0) {
    return (
      <ToolHeroView
        title="Organize & Reorder PDF"
        description="Visual thumbnail manager to rearrange, delete, duplicate, and merge pages across your PDF files."
        badge="Organize PDF"
        badgeIcon={FiGrid}
        toolPath="/organize-pdf"
        acceptedFormats={['.pdf']}
        allowMultiple={true}
        maxSizeText="100 MB"
        accept={{ 'application/pdf': ['.pdf'] }}
        onFilesSelected={handleFileLoad}
        alerts={
          errorMessage ? (
            <AlertBanner
              message={errorMessage}
              type="error"
              onClose={() => setErrorMessage(null)}
            />
          ) : null
        }
      />
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: CONFIGURATION VIEW (Studio Archetype)
  // -------------------------------------------------------------
  return (
    <div
      className="studio-page-container"
      style={{
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '0.75rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 72px)',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <ToolStudioHeader
        title="Organize & Reorder PDF"
        icon={FiGrid}
        fileBadge={`${pages.length} Pages`}
        category="Organize PDF"
        toolPath="/organize-pdf"
        onReset={handleReset}
        resetLabel="Clear All"
        headerExtra={
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--subtle-bg)',
              color: 'var(--text-color)',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <FiPlus size={14} /> Append Another PDF
            <input
              type="file"
              accept=".pdf"
              multiple
              style={{ display: 'none' }}
              disabled={loading}
              onChange={(e) => handleFileLoad(e.target.files)}
            />
          </label>
        }
        actionButton={
          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={loading || pages.length === 0}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: loading || pages.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            <FiDownload size={14} /> {loading ? 'Compiling...' : 'Export Reorganized PDF'}
          </button>
        }
      />

      {errorMessage && (
        <div style={{ margin: '0.5rem 0' }}>
          <AlertBanner message={errorMessage} type="error" onClose={() => setErrorMessage(null)} />
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1rem 0' }}>
        <div style={styles.card}>
          <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            Drag and drop thumbnails to reorder pages. Click trash to delete a page.
          </p>

          <div style={styles.grid}>
            {pages.map((page, index) => (
              <div
                key={page.id}
                draggable={!loading}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                style={{
                  ...styles.thumbnailCard,
                  opacity: draggedIndex === index ? 0.4 : 1,
                  cursor: loading ? 'not-allowed' : 'grab',
                }}
              >
                <div style={styles.badge}>{index + 1}</div>
                <button
                  onClick={(e) => handleDeletePage(e, index)}
                  style={styles.deleteBtn}
                  title="Delete page"
                  disabled={loading}
                >
                  <FiTrash2 size={13} />
                </button>
                <img src={page.dataUrl} alt={`Page ${index + 1}`} style={styles.thumbnailImg} />
                <span style={styles.pageMeta}>Page {index + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Loader isLoading={loading} phrases={[loadingText, "Compiling page layouts..."]} />
    </div>
  );
};

const styles = {
  card: { backgroundColor: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', color: 'var(--text-color)' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1.5rem', justifyContent: 'center' },
  thumbnailCard: { position: 'relative', backgroundColor: 'var(--bg-color)', border: '2px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem', textAlign: 'center', transition: 'transform 0.2s ease, border-color 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  thumbnailImg: { width: '100%', maxWidth: '120px', height: '160px', objectFit: 'contain', backgroundColor: 'white', borderRadius: '4px', marginBottom: '0.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  badge: { position: 'absolute', top: '8px', left: '8px', backgroundColor: 'var(--primary-color)', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' },
  deleteBtn: { position: 'absolute', top: '8px', right: '8px', backgroundColor: '#ff4757', color: 'white', border: 'none', borderRadius: '4px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: '0.9', transition: 'opacity 0.2s' },
  pageMeta: { fontSize: '0.85rem', fontWeight: 'bold', opacity: 0.8 },
  appendBtn: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: 'transparent', color: 'var(--text-color)', border: '2px solid var(--border-color)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem' },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 'bold', cursor: 'pointer' },
};

export default OrganizePdf;
