import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import FileUpload from '../components/FileUpload';
import Loader from '../components/Loader';
import ActionCompleted from '../components/ActionCompleted';

const SplitPdf = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  
  const [loading, setLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [resultFileUrl, setResultFileUrl] = useState(null);

  const splitPhrases = [
    "Locating the scissors...",
    "Carefully slicing pages...",
    "Repackaging your new PDF..."
  ];

  // Step 1: Handle the initial file upload and count the pages
  const handleFileLoad = async (files) => {
    if (files.length !== 1) {
      alert("Please upload exactly one PDF to split.");
      return;
    }

    const file = files[0];
    setLoading(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const pagesCount = pdf.getPageCount();

      setTotalPages(pagesCount);
      setEndPage(pagesCount); // Default the end page to the last page
      setSelectedFile({ file, arrayBuffer });
    } catch (error) {
      console.error("Error reading PDF:", error);
      alert("Could not read this PDF.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Handle the actual splitting process
  const handleSplit = async () => {
    if (startPage < 1 || endPage > totalPages || startPage > endPage) {
      alert("Invalid page range.");
      return;
    }

    setLoading(true);

    try {
      // Load the original PDF
      const originalPdf = await PDFDocument.load(selectedFile.arrayBuffer);
      
      // Create a new empty PDF
      const newPdf = await PDFDocument.create();

      // pdf-lib uses 0-based indexing (Page 1 is index 0)
      const pageIndicesToCopy = [];
      for (let i = startPage - 1; i < endPage; i++) {
        pageIndicesToCopy.push(i);
      }

      // Copy the specific pages
      const copiedPages = await newPdf.copyPages(originalPdf, pageIndicesToCopy);
      copiedPages.forEach((page) => newPdf.addPage(page));

      // Save and generate URL
      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      setResultFileUrl(URL.createObjectURL(blob));
      setIsCompleted(true);

    } catch (error) {
      console.error("Error splitting PDF:", error);
      alert("Failed to split the document.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (resultFileUrl) URL.revokeObjectURL(resultFileUrl);
    setIsCompleted(false);
    setSelectedFile(null);
    setResultFileUrl(null);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Split PDF</h2>

      {/* State 1: Upload File */}
      {!selectedFile && !isCompleted && (
        <FileUpload 
          onFilesSelected={handleFileLoad} 
          accept={{ 'application/pdf': ['.pdf'] }} 
          multiple={false} 
          title="Drop one PDF here"
        />
      )}

      {/* State 2: Select Range */}
      {selectedFile && !isCompleted && (
        <div style={styles.rangeContainer}>
          <h3 style={{ marginTop: 0 }}>Extract Pages</h3>
          <p>This document has <strong>{totalPages}</strong> pages.</p>
          
          <div style={styles.inputGroup}>
            <div>
              <label style={styles.label}>From page:</label>
              <input 
                type="number" 
                min="1" 
                max={endPage} 
                value={startPage} 
                onChange={(e) => setStartPage(Number(e.target.value))}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>To page:</label>
              <input 
                type="number" 
                min={startPage} 
                max={totalPages} 
                value={endPage} 
                onChange={(e) => setEndPage(Number(e.target.value))}
                style={styles.input}
              />
            </div>
          </div>

          <button onClick={handleSplit} style={styles.splitBtn}>
            Split PDF
          </button>
          
          <button onClick={handleReset} style={styles.cancelBtn}>
            Cancel
          </button>
        </div>
      )}

      {/* State 3: Success */}
      {isCompleted && (
        <ActionCompleted 
          fileUrl={resultFileUrl} 
          fileName={`Split_Pages_${startPage}_to_${endPage}.pdf`}
          onReset={handleReset}
          message="Your PDF has been split!"
        />
      )}

      <Loader isLoading={loading} phrases={splitPhrases} />
    </div>
  );
};

const styles = {
  rangeContainer: {
    backgroundColor: 'var(--card-bg)',
    padding: '2rem',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    textAlign: 'center',
  },
  inputGroup: {
    display: 'flex',
    justifyContent: 'center',
    gap: '2rem',
    margin: '1.5rem 0 2rem 0',
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: 'bold',
    color: 'var(--text-color)'
  },
  input: {
    padding: '0.5rem',
    width: '80px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    fontSize: '1.1rem',
    textAlign: 'center',
    backgroundColor: 'var(--bg-color)',
    color: 'var(--text-color)'
  },
  splitBtn: {
    padding: '0.75rem 2rem',
    backgroundColor: 'var(--secondary-color)', /* Orange for splitting */
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginRight: '1rem',
  },
  cancelBtn: {
    padding: '0.75rem 2rem',
    backgroundColor: 'transparent',
    color: 'var(--text-color)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    fontSize: '1.1rem',
    cursor: 'pointer',
  }
};

export default SplitPdf;