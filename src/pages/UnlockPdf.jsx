import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FiUnlock, FiDownload, FiRefreshCw, FiLock, FiAlertCircle } from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import Loader from '../components/Loader';

const UnlockPdf = () => {
  const [loading, setLoading] = useState(false);
  const [fileData, setFileData] = useState(null);
  const [fileBytes, setFileBytes] = useState(null);
  
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  
  const [unlockedUrl, setUnlockedUrl] = useState(null);

  const handleFileLoad = async (files) => {
    if (files.length !== 1) return;
    const file = files[0];
    
    setLoading(true);
    setError(null);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      setFileBytes(arrayBuffer);
      setFileData({ name: file.name, size: file.size });

      // Check if encrypted by trying to load normally. 
      // If it throws an EncryptedPDFError, we flag it as locked.
      try {
        await PDFDocument.load(arrayBuffer);
        setIsEncrypted(false);
        setError("This PDF is not password protected. No unlocking needed!");
      } catch (loadErr) {
        if (loadErr.message.toLowerCase().includes('encrypted')) {
          setIsEncrypted(true);
        } else {
          throw loadErr;
        }
      }
    } catch (err) {
      setError("Failed to read the PDF. The file might be corrupted.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!password) {
      setError("Please enter a password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Pass the password correctly into the load options object
      const pdfDoc = await PDFDocument.load(fileBytes, { password });
      
      // Saving the document automatically strips the encryption layer
      const unlockedBytes = await pdfDoc.save();
      
      const blob = new Blob([unlockedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setUnlockedUrl(url);
      setIsEncrypted(false);
      
    } catch (err) {
      console.error("Unlock Error:", err);
      setError("Incorrect password, or the encryption format is unsupported.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (unlockedUrl) URL.revokeObjectURL(unlockedUrl);
    setFileData(null);
    setFileBytes(null);
    setIsEncrypted(false);
    setPassword('');
    setError(null);
    setUnlockedUrl(null);
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Unlock PDF</h2>

      {!fileData && (
        <FileUpload 
          onFilesSelected={handleFileLoad} 
          accept={{ 'application/pdf': ['.pdf'] }} 
          multiple={false} 
          title="Drop an encrypted PDF here to unlock it"
        />
      )}

      {fileData && (
        <div style={styles.card}>
          {/* Status Header */}
          <div style={styles.header}>
            <h3 style={styles.cardTitle}>
              {unlockedUrl ? <FiUnlock style={{ color: '#2ed573' }}/> : <FiLock style={{ color: '#ff4757' }}/>} 
              {fileData.name}
            </h3>
            <button onClick={handleReset} style={styles.secondaryBtn}>
              <FiRefreshCw /> Start Over
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div style={styles.errorBanner}>
              <FiAlertCircle /> {error}
            </div>
          )}

          {/* State 1: Needs Password */}
          {isEncrypted && !unlockedUrl && (
            <div style={styles.actionPanel}>
              <p style={{ marginBottom: '1.5rem', color: 'var(--text-color)' }}>
                This document is protected. Please enter the correct password to remove its encryption and security restrictions permanently.
              </p>
              
              <div style={styles.inputGroup}>
                <input 
                  type="password" 
                  placeholder="Enter PDF password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={styles.input}
                  onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                />
                <button onClick={handleUnlock} style={styles.primaryBtn} disabled={loading}>
                  Unlock File
                </button>
              </div>
            </div>
          )}

          {/* State 2: Success */}
          {unlockedUrl && (
            <div style={styles.successPanel}>
              <h3 style={{ color: '#2ed573', marginTop: 0 }}>Successfully Unlocked!</h3>
              <p style={{ color: 'var(--text-color)', marginBottom: '2rem' }}>
                All password protection and restrictive permissions have been stripped from this file.
              </p>
              
              <a 
                href={unlockedUrl} 
                download={`${fileData.name.split('.')[0]}_unlocked.pdf`} 
                style={styles.downloadBtn}
              >
                <FiDownload style={{ fontSize: '1.2rem' }} /> Download Unlocked PDF
              </a>
            </div>
          )}
        </div>
      )}

      <Loader isLoading={loading} phrases={["Analyzing encryption...", "Decrypting document...", "Rewriting PDF without restrictions..."]} />
    </div>
  );
};

const styles = {
  card: { backgroundColor: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' },
  cardTitle: { display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, color: 'var(--text-color)', fontSize: '1.2rem', wordBreak: 'break-all' },
  errorBanner: { display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(255, 71, 87, 0.1)', color: '#ff4757', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: 'bold' },
  actionPanel: { textAlign: 'center', padding: '1rem' },
  inputGroup: { display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' },
  input: { padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', fontSize: '1rem', minWidth: '250px', outline: 'none' },
  successPanel: { textAlign: 'center', padding: '2rem 1rem' },
  primaryBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' },
  secondaryBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: 'transparent', color: 'var(--text-color)', border: '2px solid var(--border-color)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
  downloadBtn: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', backgroundColor: '#2ed573', color: '#0f172a', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', transition: 'opacity 0.2s ease' }
};

export default UnlockPdf;