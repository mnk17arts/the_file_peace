import { useState, useEffect } from 'react';
import { FiBookOpen, FiX } from 'react-icons/fi';
import FileUpload from '../components/FileUpload';

const PdfReader = () => {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [fileName, setFileName] = useState('');

  const handleFileLoad = (files) => {
    if (files.length !== 1) {
      alert("Please upload exactly one PDF to read.");
      return;
    }
    const file = files[0];
    setFileName(file.name);
    setPdfUrl(URL.createObjectURL(file));
  };

  const handleClose = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setFileName('');
  };

  // Clean up memory to prevent memory leaks when navigating away
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', height: '100%' }}>
      
      {/* State 1: Upload */}
      {!pdfUrl && (
        <>
          <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>PDF Reader</h2>
          <FileUpload 
            onFilesSelected={handleFileLoad} 
            accept={{ 'application/pdf': ['.pdf'] }} 
            multiple={false} 
            title="Drop a PDF document to read it"
          />
        </>
      )}

      {/* State 2: Reading View */}
      {pdfUrl && (
        <div style={styles.readerContainer}>
          <div style={styles.header}>
            <div style={styles.titleInfo}>
              <FiBookOpen style={styles.icon} />
              <span style={styles.fileName}>{fileName}</span>
            </div>
            <button onClick={handleClose} style={styles.closeBtn} title="Close PDF">
              <FiX /> Close
            </button>
          </div>
          
          <div style={styles.iframeWrapper}>
            {/* The magic native viewer */}
            <iframe 
              src={`${pdfUrl}#toolbar=0&navpanes=0`} 
              style={styles.iframe}
              title="PDF Reader"
            />
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  readerContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '80vh', // Takes up most of the viewport
    backgroundColor: 'var(--card-bg)',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    overflow: 'hidden',
    boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.5rem',
    backgroundColor: 'var(--bg-color)',
    borderBottom: '1px solid var(--border-color)'
  },
  titleInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    color: 'var(--text-color)',
  },
  icon: {
    fontSize: '1.25rem',
    color: 'var(--primary-color)'
  },
  fileName: {
    fontWeight: 'bold',
    fontSize: '1.1rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '400px'
  },
  closeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    backgroundColor: '#ff4757',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  iframeWrapper: {
    flexGrow: 1,
    width: '100%',
    backgroundColor: '#525659' // Standard PDF viewer background color
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    display: 'block'
  }
};

export default PdfReader;