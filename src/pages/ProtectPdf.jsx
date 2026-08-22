import { useState } from 'react';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite';
import { FiLock, FiDownload, FiRefreshCw } from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import Loader from '../components/Loader';

const ProtectPdf = () => {
  const [loading, setLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [originalFile, setOriginalFile] = useState(null);
  const [protectedFileUrl, setProtectedFileUrl] = useState(null);
  const [password, setPassword] = useState('');

  const protectPhrases = [
    "Generating encryption keys...",
    "Locking down the document...",
    "Securing your data...",
    "Finalizing protection..."
  ];

  const handleFileLoad = (files) => {
    if (files.length !== 1) {
      alert("Please upload exactly one PDF to protect.");
      return;
    }
    setOriginalFile(files[0]);
  };

  const handleProtect = async () => {
    if (!password || password.length < 3) {
      alert("Please enter a password with at least 3 characters.");
      return;
    }

    setLoading(true);

    try {
      const arrayBuffer = await originalFile.arrayBuffer();
      const existingPdfBytes = new Uint8Array(arrayBuffer);
      
      // Encrypt the PDF using our lightweight client-side library
      const encryptedBytes = await encryptPDF(existingPdfBytes, password);
      
      const blob = new Blob([encryptedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      setProtectedFileUrl(url);
      setIsCompleted(true);
    } catch (error) {
      console.error("Error protecting PDF:", error);
      alert("Failed to encrypt the document. Make sure the file isn't corrupted.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (protectedFileUrl) URL.revokeObjectURL(protectedFileUrl);
    setIsCompleted(false);
    setOriginalFile(null);
    setProtectedFileUrl(null);
    setPassword('');
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Protect PDF</h2>

      {/* State 1: Upload File */}
      {!originalFile && !isCompleted && (
        <FileUpload 
          onFilesSelected={handleFileLoad} 
          accept={{ 'application/pdf': ['.pdf'] }} 
          multiple={false} 
          title="Drop a PDF to lock it with a password"
        />
      )}

      {/* State 2: Enter Password */}
      {originalFile && !isCompleted && (
        <div style={styles.settingsContainer}>
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-color)' }}>
            <FiLock /> Secure Document
          </h3>
          <p style={{ color: 'var(--text-color)' }}>Selected file: <strong>{originalFile.name}</strong></p>
          
          <div style={styles.inputGroup}>
            <label style={styles.label}>Set Document Password:</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="Enter a strong password..."
            />
          </div>

          <div style={styles.buttonGroup}>
            <button onClick={handleProtect} style={styles.protectBtn}>
              Encrypt PDF
            </button>
            <button onClick={handleReset} style={styles.cancelBtn}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* State 3: Success */}
      {isCompleted && (
        <div style={styles.resultsContainer}>
          <h3 style={styles.successTitle}>PDF Successfully Protected!</h3>
          <p style={{ marginBottom: '2rem', color: 'var(--text-color)' }}>
            Your document is now encrypted. You will need the password to open it.
          </p>

          <div style={styles.buttonGroup}>
            <a 
              href={protectedFileUrl} 
              download={`protected_${originalFile.name}`} 
              style={styles.downloadBtn}
            >
              <FiDownload style={{ fontSize: '1.2rem' }} /> Download Locked PDF
            </a>
            <button onClick={handleReset} style={styles.cancelBtn}>
              <FiRefreshCw style={{ fontSize: '1.2rem' }} /> Protect Another
            </button>
          </div>
        </div>
      )}

      <Loader isLoading={loading} phrases={protectPhrases} />
    </div>
  );
};

const styles = {
  settingsContainer: {
    backgroundColor: 'var(--card-bg)',
    padding: '2.5rem 2rem',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    textAlign: 'center',
  },
  inputGroup: {
    margin: '2rem auto',
    maxWidth: '350px',
    textAlign: 'left',
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    color: 'var(--text-color)',
    fontWeight: 'bold',
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-color)',
    color: 'var(--text-color)',
    fontSize: '1rem',
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  protectBtn: {
    padding: '0.75rem 2rem',
    backgroundColor: '#2ed573',
    color: '#0f172a',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  cancelBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    backgroundColor: 'transparent',
    color: 'var(--text-color)',
    border: '2px solid var(--border-color)',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer',
  },
  resultsContainer: {
    backgroundColor: 'var(--card-bg)',
    padding: '3rem 2rem',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    textAlign: 'center',
  },
  successTitle: {
    margin: '0 0 1rem 0',
    color: 'var(--text-color)',
    fontSize: '1.75rem',
  },
  downloadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    backgroundColor: 'var(--primary-color)',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '1rem',
    transition: 'opacity 0.2s ease',
  }
};

export default ProtectPdf;