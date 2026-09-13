import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite';
import { FiLock, FiShield, FiKey } from 'react-icons/fi';
import Loader from '../components/Loader';
import ActionCompleted from '../components/ActionCompleted';
import AlertBanner from '../components/AlertBanner';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';

const ProtectPdf = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const [isCompleted, setIsCompleted] = useState(false);
  const [originalFile, setOriginalFile] = useState(null);
  const [protectedFileUrl, setProtectedFileUrl] = useState(null);
  const [protectedBlob, setProtectedBlob] = useState(null);
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  const protectedUrlRef = useRef(null);
  const handledRef = useRef(false);

  const protectPhrases = [
    "Generating encryption keys...",
    "Locking down the document...",
    "Securing your data...",
    "Finalizing protection..."
  ];

  useEffect(() => {
    protectedUrlRef.current = protectedFileUrl;
  }, [protectedFileUrl]);

  // Clean up object URLs only when unmounting the tool
  useEffect(() => {
    return () => {
      if (protectedUrlRef.current) URL.revokeObjectURL(protectedUrlRef.current);
    };
  }, []);

  const handleFileLoad = useCallback((files) => {
    if (loadingRef.current) return;
    setErrorMessage(null);

    if (!files || files.length !== 1) {
      setErrorMessage("Please upload exactly one PDF to protect.");
      return;
    }

    const file = files[0];
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage("Please select a valid PDF file (.pdf).");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setErrorMessage("File size exceeds 100 MB limit. Please select a smaller PDF.");
      return;
    }

    setProtectedFileUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setProtectedBlob(null);
    setIsCompleted(false);
    setOriginalFile(file);
  }, []);

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

  const handleProtect = async () => {
    if (loading || !originalFile) return;
    setErrorMessage(null);

    if (!password || password.length < 3) {
      setErrorMessage("Please enter a password with at least 3 characters.");
      return;
    }

    setLoading(true);

    try {
      // Use slice(0) to get an isolated ArrayBuffer copy
      const arrayBuffer = await originalFile.slice(0).arrayBuffer();
      const existingPdfBytes = new Uint8Array(arrayBuffer);
      
      // Encrypt the PDF using client-side library
      const encryptedBytes = await encryptPDF(existingPdfBytes, password);
      
      const blob = new Blob([encryptedBytes], { type: 'application/pdf' });
      if (protectedFileUrl) URL.revokeObjectURL(protectedFileUrl);
      const url = URL.createObjectURL(blob);
      
      setProtectedBlob(blob);
      setProtectedFileUrl(url);
      setIsCompleted(true);
    } catch (error) {
      console.error("Error protecting PDF:", error);
      setErrorMessage("Failed to encrypt the document. Make sure the file isn't already encrypted or corrupted.");
    } finally {
      setLoading(false);
    }
  };

  const handleProtectSourceAgain = () => {
    if (protectedFileUrl) URL.revokeObjectURL(protectedFileUrl);
    setProtectedFileUrl(null);
    setProtectedBlob(null);
    setIsCompleted(false);
    setPassword('');
    setErrorMessage(null);
  };

  const handleReset = () => {
    if (protectedFileUrl) URL.revokeObjectURL(protectedFileUrl);
    setIsCompleted(false);
    setOriginalFile(null);
    setProtectedFileUrl(null);
    setProtectedBlob(null);
    setPassword('');
    setErrorMessage(null);
  };

  // -------------------------------------------------------------
  // VIEW 3: FINAL COMPLETION VIEW
  // -------------------------------------------------------------
  if (isCompleted && protectedFileUrl && originalFile) {
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="Protect PDF"
          message="Your document has been encrypted with password protection!"
          fileUrl={protectedFileUrl}
          fileName={`protected_${originalFile.name}`}
          file={protectedBlob}
          onReset={handleReset}
          onProcessSourceAgain={handleProtectSourceAgain}
          sourceActionLabel="Protect Source Again"
          onProcessTarget={() => {
            const chained = new File([protectedBlob], `protected_${originalFile.name}`, { type: 'application/pdf' });
            setOriginalFile(chained);
            setIsCompleted(false);
            setProtectedFileUrl(null);
            setProtectedBlob(null);
            setPassword('');
          }}
          targetActionLabel="Use Protected File"
          currentPath="/protect-pdf"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Empty state)
  // -------------------------------------------------------------
  if (!originalFile && !isCompleted) {
    return (
      <ToolHeroView
        title="Protect PDF"
        description="Encrypt your PDF with standard password protection directly in your browser with zero server uploads."
        badge="PDF Security"
        badgeIcon={FiLock}
        toolPath="/protect-pdf"
        acceptedFormats={['.pdf']}
        allowMultiple={false}
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
        overflow: 'hidden'
      }}
    >
      <ToolStudioHeader
        toolTitle="Protect PDF"
        fileBadge={originalFile.name}
        onBack={handleReset}
        backLabel="Choose Another File"
        primaryAction={{
          label: 'Encrypt PDF',
          icon: FiLock,
          onClick: handleProtect,
          disabled: loading || !password || password.length < 3,
          loading
        }}
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.5rem 0' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {errorMessage && (
            <AlertBanner
              message={errorMessage}
              type="error"
              onClose={() => setErrorMessage(null)}
            />
          )}

          <div
            style={{
              background: 'var(--card-bg, #1e293b)',
              border: '1px solid var(--border-color, #334155)',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--primary-color, #6366f1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.3rem'
                }}
              >
                <FiLock />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Set Document Password</h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.875rem', opacity: 0.75 }}>
                  This password will be required every time someone opens the PDF.
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="pdf-password-input"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'var(--text-color)'
                }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="pdf-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter a strong password (min 3 chars)..."
                  disabled={loading}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '0.85rem 1rem 0.85rem 2.75rem',
                    background: 'var(--bg-color, #0f172a)',
                    border: '1px solid var(--border-color, #334155)',
                    borderRadius: '10px',
                    color: 'var(--text-color, #fff)',
                    fontSize: '1rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && password.length >= 3 && !loading) {
                      handleProtect();
                    }
                  }}
                />
                <FiKey
                  style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '1.1rem',
                    opacity: 0.5,
                    pointerEvents: 'none'
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '0.5rem',
                  fontSize: '0.8rem',
                  opacity: 0.7
                }}
              >
                <span>Minimum 3 characters</span>
                <span>{password.length} characters</span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '1rem',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '10px',
                fontSize: '0.85rem',
                color: 'var(--text-color)'
              }}
            >
              <FiShield style={{ color: '#10b981', fontSize: '1.25rem', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>100% Client-Side Encryption:</strong> Your document is encrypted entirely in your browser using standard PDF encryption algorithms. The password and document never leave your machine.
              </div>
            </div>

            <div style={{ marginTop: '1.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                style={{
                  padding: '0.75rem 1.25rem',
                  background: 'transparent',
                  border: '1px solid var(--border-color, #334155)',
                  borderRadius: '10px',
                  color: 'var(--text-color)',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProtect}
                disabled={loading || !password || password.length < 3}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--primary-color, #6366f1)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: (loading || !password || password.length < 3) ? 'not-allowed' : 'pointer',
                  opacity: (loading || !password || password.length < 3) ? 0.6 : 1
                }}
              >
                <FiLock /> Encrypt PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <Loader isLoading={loading} phrases={protectPhrases} />
    </div>
  );
};

export default ProtectPdf;