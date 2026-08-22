import { useState } from 'react';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import * as pdfjsLib from 'pdfjs-dist';
import { FiFileText, FiDownload, FiRefreshCw } from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import Loader from '../components/Loader';

// Ensure the worker is loaded (using the same local worker from your earlier PDF tools)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const PdfToWord = () => {
  const [loading, setLoading] = useState(false);
  const [originalFile, setOriginalFile] = useState(null);
  const [wordUrl, setWordUrl] = useState(null);

  const handleFileLoad = (files) => {
    if (files.length !== 1) return;
    setOriginalFile(files[0]);
  };

  const handleConvert = async () => {
    if (!originalFile) return;
    setLoading(true);

    try {
      const arrayBuffer = await originalFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      const docxParagraphs = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Items in PDF are just floating strings. We need to group them by their Y-coordinate to form lines.
        const items = textContent.items;
        
        // Sort items: First from top to bottom (Y descending), then left to right (X ascending)
        items.sort((a, b) => {
          // pdf.js origin is bottom-left. Higher Y means higher on the page.
          const yDiff = b.transform[5] - a.transform[5];
          if (Math.abs(yDiff) > 5) return yDiff; // If they are more than 5 points apart vertically, they are different lines
          return a.transform[4] - b.transform[4]; // Otherwise, sort by X coordinate
        });

        let currentLineY = null;
        let currentLineText = [];

        for (const item of items) {
          const itemY = Math.round(item.transform[5]);

          if (currentLineY === null) {
            currentLineY = itemY;
            currentLineText.push(item.str);
          } else if (Math.abs(currentLineY - itemY) <= 5) {
            // Same line (within 5 points of variance)
            currentLineText.push(item.str);
          } else {
            // New line detected. Save the previous line to our Word paragraphs.
            const lineString = currentLineText.join(' ').replace(/\s+/g, ' ').trim();
            if (lineString) {
              docxParagraphs.push(
                new Paragraph({
                  children: [new TextRun(lineString)],
                  spacing: { after: 120 } // Add a little space after paragraphs
                })
              );
            }
            
            // Reset for the new line
            currentLineY = itemY;
            currentLineText = [item.str];
          }
        }

        // Push the final line of the page
        if (currentLineText.length > 0) {
          const lineString = currentLineText.join(' ').replace(/\s+/g, ' ').trim();
          if (lineString) {
            docxParagraphs.push(new Paragraph({ children: [new TextRun(lineString)] }));
          }
        }

        // Add a page break if it's not the last page
        if (pageNum < numPages) {
          docxParagraphs.push(new Paragraph({ pageBreakBefore: true }));
        }
      }

      // Generate the Word Document
      const doc = new Document({
        sections: [{ properties: {}, children: docxParagraphs }]
      });

      // Package the document into a Blob for downloading
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      setWordUrl(url);

    } catch (error) {
      console.error("Conversion error:", error);
      alert("Failed to convert. The file might be corrupted or image-based (scanned).");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (wordUrl) URL.revokeObjectURL(wordUrl);
    setWordUrl(null);
    setOriginalFile(null);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>PDF to Word Converter</h2>

      {!originalFile && (
        <FileUpload 
          onFilesSelected={handleFileLoad} 
          accept={{ 'application/pdf': ['.pdf'] }} 
          multiple={false} 
          title="Drop a PDF to convert it to Word (.docx)"
        />
      )}

      {originalFile && !wordUrl && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}><FiFileText /> Ready to Convert</h3>
          <p>Selected File: <strong>{originalFile.name}</strong></p>
          <p style={styles.disclaimer}>
            <em>Note: This tool extracts text structure and paragraphs. Complex multi-column layouts or embedded images may not perfectly transfer.</em>
          </p>
          
          <div style={styles.buttonGroup}>
            <button onClick={handleConvert} style={styles.primaryBtn}>
              Convert to Word
            </button>
            <button onClick={handleReset} style={styles.secondaryBtn}>Cancel</button>
          </div>
        </div>
      )}

      {wordUrl && (
        <div style={styles.card}>
          <h3 style={styles.successTitle}>Conversion Complete!</h3>
          <p style={{ marginBottom: '2rem' }}>Your document has been successfully restructured into a Word file.</p>
          
          <div style={styles.buttonGroup}>
            <a 
              href={wordUrl} 
              download={`${originalFile.name.split('.')[0]}_converted.docx`} 
              style={styles.downloadBtn}
            >
              <FiDownload style={{ fontSize: '1.2rem' }} /> Download .docx
            </a>
            <button onClick={handleReset} style={styles.secondaryBtn}>
              <FiRefreshCw style={{ fontSize: '1.2rem' }} /> Convert Another
            </button>
          </div>
        </div>
      )}

      <Loader isLoading={loading} phrases={["Analyzing PDF coordinates...", "Reconstructing paragraph structure...", "Generating Word document..."]} />
    </div>
  );
};

const styles = {
  card: { backgroundColor: 'var(--card-bg)', padding: '3rem 2rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-color)' },
  cardTitle: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: 0, marginBottom: '1rem', fontSize: '1.5rem' },
  disclaimer: { fontSize: '0.9rem', color: '#888', maxWidth: '500px', margin: '1rem auto 2rem auto', lineHeight: '1.5' },
  successTitle: { margin: '0 0 1rem 0', color: '#2ed573', fontSize: '1.75rem' },
  buttonGroup: { display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' },
  primaryBtn: { padding: '0.75rem 2rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' },
  secondaryBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', backgroundColor: 'transparent', color: 'var(--text-color)', border: '2px solid var(--border-color)', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' },
  downloadBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', backgroundColor: '#2ed573', color: '#0f172a', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', transition: 'opacity 0.2s ease' }
};

export default PdfToWord;