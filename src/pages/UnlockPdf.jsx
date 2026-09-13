import { useState, useEffect, useRef, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  FiUnlock,
  FiLock,
  FiEye,
  FiEyeOff,
  FiShield,
  FiKey,
  FiCheckCircle
} from 'react-icons/fi';
import Loader from '../components/Loader';
import ActionCompleted from '../components/ActionCompleted';
import AlertBanner from '../components/AlertBanner';
import FileActionMenu from '../components/FileActionMenu';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const UnlockPdf = () => {
  const [loading, setLoading] = useState(false);
  const [loadingPhrases, setLoadingPhrases] = useState([]);
  const [fileData, setFileData] = useState(null);
  const [fileBytes, setFileBytes] = useState(null);

  const [isEncrypted, setIsEncrypted] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);

  // Decrypted output state
  const [unlockedUrl, setUnlockedUrl] = useState(null);
  const [unlockedFile, setUnlockedFile] = useState(null);
  const [pageCount, setPageCount] = useState(0);

  const passwordInputRef = useRef(null);
  const handledRef = useRef(false);

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileLoad = useCallback(async (files) => {
    if (!files || files.length !== 1) return;
    const file = files[0];

    setLoading(true);
    setLoadingPhrases([
      'Analyzing PDF structure...',
      'Checking document encryption...',
      'Inspecting security handlers...'
    ]);
    setError(null);
    setUnlockedUrl(null);
    setUnlockedFile(null);
    setPassword('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      setFileBytes(arrayBuffer);
      setFileData({ name: file.name, size: file.size, rawFile: file });

      // Detect if file is encrypted using both pdf-lib and pdfjs-dist
      let encrypted = false;

      try {
        await PDFDocument.load(arrayBuffer);
        // If pdf-lib loaded without error, verify with pdfjs
        const testTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
        const doc = await testTask.promise;
        setPageCount(doc.numPages);
        encrypted = false;
      } catch (loadErr) {
        const msg = (loadErr.message || '').toLowerCase();
        const errName = loadErr.name || '';
        if (msg.includes('encrypted') || msg.includes('password') || errName === 'PasswordException') {
          encrypted = true;
        } else {
          // Attempt pdfjs load to confirm
          try {
            const testTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
            const doc = await testTask.promise;
            setPageCount(doc.numPages);
            encrypted = false;
          } catch (pdfjsErr) {
            if (pdfjsErr.name === 'PasswordException' || (pdfjsErr.message || '').toLowerCase().includes('password')) {
              encrypted = true;
            } else {
              throw loadErr;
            }
          }
        }
      }

      setIsEncrypted(encrypted);

      if (!encrypted) {
        setError(null);
      }
    } catch (err) {
      console.error('File Analysis Error:', err);
      setError('Unable to read this PDF file. The document may be corrupted or in an unsupported format.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Check for piped file from another tool
  useEffect(() => {
    if (handledRef.current) return;
    const transferred = consumeTransferredFile();
    if (transferred && (transferred.type === 'application/pdf' || transferred.name?.toLowerCase().endsWith('.pdf'))) {
      handledRef.current = true;
      setTimeout(() => {
        handleFileLoad([transferred]);
      }, 0);
    }
  }, [handleFileLoad]);

  // Auto focus password input when encrypted file is loaded
  useEffect(() => {
    if (isEncrypted && !unlockedUrl && passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [isEncrypted, unlockedUrl]);

  const handleUnlock = async () => {
    if (!password) {
      setError('Please enter the password for this PDF.');
      return;
    }

    setLoading(true);
    setLoadingPhrases([
      'Verifying document password...',
      'Decrypting document streams...',
      'Stripping security restrictions...',
      'Reconstructing unrestricted PDF...',
      'Generating clean document...'
    ]);
    setError(null);

    try {
      // Step 1: Validate password with pdfjs-dist
      let pdfDoc;
      try {
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(fileBytes.slice(0)),
          password: password
        });
        pdfDoc = await loadingTask.promise;
      } catch (authErr) {
        if (authErr.name === 'PasswordException' || (authErr.message || '').toLowerCase().includes('password')) {
          setError('Incorrect password. Please verify the password and try again.');
          setLoading(false);
          return;
        }
        throw authErr;
      }

      const totalPages = pdfDoc.numPages;
      setPageCount(totalPages);

      // Step 2: High-fidelity clean PDF reconstruction with pdf-lib
      const unlockedPdfDoc = await PDFDocument.create();

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const origViewport = page.getViewport({ scale: 1.0 });
        const renderViewport = page.getViewport({ scale: 2.0 }); // 2x for sharp HiDPI clarity

        const canvas = document.createElement('canvas');
        canvas.width = renderViewport.width;
        canvas.height = renderViewport.height;
        const ctx = canvas.getContext('2d');

        await page.render({
          canvasContext: ctx,
          viewport: renderViewport
        }).promise;

        const imgDataUrl = canvas.toDataURL('image/jpeg', 0.94);
        const embeddedImg = await unlockedPdfDoc.embedJpg(imgDataUrl);
        const newPage = unlockedPdfDoc.addPage([origViewport.width, origViewport.height]);

        newPage.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: origViewport.width,
          height: origViewport.height
        });
      }

      // Step 3: Save clean, unrestricted PDF
      const unlockedBytes = await unlockedPdfDoc.save();
      const blob = new Blob([unlockedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const baseName = fileData.name.replace(/\.[^/.]+$/, '');
      const newFileName = `${baseName}_unlocked.pdf`;
      const readyFile = new File([blob], newFileName, { type: 'application/pdf' });

      setUnlockedUrl(url);
      setUnlockedFile(readyFile);
      setIsEncrypted(false);
    } catch (err) {
      console.error('Decryption Error:', err);
      setError('Failed to decrypt document. The file might use an incompatible cryptographic scheme or is damaged.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (unlockedUrl) URL.revokeObjectURL(unlockedUrl);
    handledRef.current = false;
    setFileData(null);
    setFileBytes(null);
    setIsEncrypted(false);
    setPassword('');
    setShowPassword(false);
    setError(null);
    setUnlockedUrl(null);
    setUnlockedFile(null);
    setPageCount(0);
  };

  const baseFileName = fileData?.name.replace(/\.[^/.]+$/, '') || 'document';
  const downloadFileName = `${baseFileName}_unlocked.pdf`;

  // -------------------------------------------------------------
  // VIEW 3: COMPLETION VIEW
  // -------------------------------------------------------------
  if (unlockedUrl && unlockedFile && fileData) {
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="Unlock PDF"
          message="All password security and permission restrictions have been permanently removed."
          fileUrl={unlockedUrl}
          fileName={downloadFileName}
          file={unlockedFile}
          onReset={handleReset}
          onProcessSourceAgain={() => {
            if (unlockedUrl) URL.revokeObjectURL(unlockedUrl);
            setUnlockedUrl(null);
            setUnlockedFile(null);
            setPassword('');
          }}
          sourceActionLabel="Unlock Source Again"
          onProcessTarget={() => {
            handleFileLoad([unlockedFile]);
          }}
          targetActionLabel="Use Unlocked PDF"
          currentPath="/unlock-pdf"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Empty state)
  // -------------------------------------------------------------
  if (!fileData) {
    return (
      <ToolHeroView
        title="Unlock PDF"
        description="Remove password protection and security restrictions permanently from your PDF documents. Processed 100% locally in your browser for total privacy."
        badge="PDF Security"
        badgeIcon={FiUnlock}
        toolPath="/unlock-pdf"
        acceptedFormats={['.pdf']}
        allowMultiple={false}
        maxSizeText="100 MB"
        accept={{ 'application/pdf': ['.pdf'] }}
        onFilesSelected={handleFileLoad}
        alerts={
          error ? (
            <AlertBanner
              message={error}
              type="error"
              onClose={() => setError(null)}
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
        toolTitle="Unlock PDF"
        fileBadge={`${fileData.name} (${formatFileSize(fileData.size)}${pageCount > 0 ? ` • ${pageCount} pgs` : ''})`}
        onBack={handleReset}
        backLabel="Choose Another File"
        primaryAction={
          isEncrypted
            ? {
                label: 'Unlock Document',
                icon: FiUnlock,
                onClick: handleUnlock,
                disabled: loading || !password.trim(),
                loading
              }
            : null
        }
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.5rem 0' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {error && (
            <AlertBanner
              message={error}
              type="error"
              onClose={() => setError(null)}
            />
          )}

          {/* Case 1: File is already unencrypted */}
          {!isEncrypted ? (
            <div
              style={{
                background: 'var(--card-bg, #1e293b)',
                border: '1px solid var(--border-color, #334155)',
                borderRadius: '16px',
                padding: '2.5rem 2rem',
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  margin: '0 auto 1.25rem auto'
                }}
              >
                <FiCheckCircle />
              </div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.3rem', fontWeight: 600 }}>
                This PDF is Already Unlocked!
              </h3>
              <p style={{ margin: '0 0 2rem 0', fontSize: '0.9rem', opacity: 0.8, lineHeight: 1.5 }}>
                No password protection or encryption was detected on <strong>{fileData.name}</strong>.
                You can use it directly in other tools in the suite or choose another file.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <FileActionMenu
                  file={fileData.rawFile}
                  fileName={fileData.name}
                  currentPath="/unlock-pdf"
                />
                <button
                  type="button"
                  onClick={handleReset}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'transparent',
                    border: '1px solid var(--border-color, #334155)',
                    borderRadius: '10px',
                    color: 'var(--text-color)',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Choose Another File
                </button>
              </div>
            </div>
          ) : (
            /* Case 2: File is password encrypted */
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
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.3rem'
                  }}
                >
                  <FiLock />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Password Required</h3>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.875rem', opacity: 0.75 }}>
                    Enter the document password to strip all protection and restrictions.
                  </p>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleUnlock();
                }}
              >
                <div style={{ marginBottom: '1.5rem' }}>
                  <label
                    htmlFor="unlock-password-input"
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: 'var(--text-color)'
                    }}
                  >
                    Document Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="unlock-password-input"
                      ref={passwordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="Enter the PDF password..."
                      disabled={loading}
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '0.85rem 3rem 0.85rem 2.75rem',
                        background: 'var(--bg-color, #0f172a)',
                        border: '1px solid var(--border-color, #334155)',
                        borderRadius: '10px',
                        color: 'var(--text-color, #fff)',
                        fontSize: '1rem',
                        outline: 'none',
                        boxSizing: 'border-box'
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
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      style={{
                        position: 'absolute',
                        right: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-color)',
                        opacity: 0.6,
                        cursor: 'pointer',
                        padding: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '1rem',
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    color: 'var(--text-color)',
                    marginBottom: '1.75rem'
                  }}
                >
                  <FiShield style={{ color: 'var(--primary-color, #6366f1)', fontSize: '1.25rem', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>100% Client-Side Decryption:</strong> Your password is used strictly inside your browser to render and reconstruct an unrestricted PDF. No data is transmitted to any external server.
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
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
                    type="submit"
                    disabled={loading || !password.trim()}
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
                      cursor: (loading || !password.trim()) ? 'not-allowed' : 'pointer',
                      opacity: (loading || !password.trim()) ? 0.6 : 1
                    }}
                  >
                    <FiUnlock /> Unlock Document
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      <Loader isLoading={loading} phrases={loadingPhrases} />
    </div>
  );
};

export default UnlockPdf;