import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { PDFDocument, PDFName } from 'pdf-lib';
import {
  FiSave,
  FiTrash2,
  FiCheck,
  FiAlertTriangle,
  FiShield,
} from 'react-icons/fi';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { validatePdfFile } from '../utils/fileUtils';

export default function PdfMetadata() {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Extracted Original Metadata
  const [originalMeta, setOriginalMeta] = useState(null);

  // Editable Form Fields
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [subject, setSubject] = useState('');
  const [keywords, setKeywords] = useState('');
  const [creator, setCreator] = useState('');
  const [producer, setProducer] = useState('');
  const [creationDate, setCreationDate] = useState('');
  const [modDate, setModDate] = useState('');
  const [hasXmp, setHasXmp] = useState(false);

  // Result state
  const [savedBlob, setSavedBlob] = useState(null);
  const handledIncomingRef = useRef(false);

  const savedUrl = useMemo(() => {
    return savedBlob ? URL.createObjectURL(savedBlob) : null;
  }, [savedBlob]);

  useEffect(() => {
    return () => {
      if (savedUrl) URL.revokeObjectURL(savedUrl);
    };
  }, [savedUrl]);

  // Load PDF and extract metadata fields
  const loadPdfMetadata = useCallback(async (selectedFile) => {
    setErrorMessage('');
    setIsProcessing(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });

      const rawKeywords = pdfDoc.getKeywords();
      const formattedKeywords = Array.isArray(rawKeywords)
        ? rawKeywords.join(', ')
        : (typeof rawKeywords === 'string' ? rawKeywords : '');

      const meta = {
        title: pdfDoc.getTitle() || '',
        author: pdfDoc.getAuthor() || '',
        subject: pdfDoc.getSubject() || '',
        keywords: formattedKeywords,
        creator: pdfDoc.getCreator() || '',
        producer: pdfDoc.getProducer() || '',
        creationDate: pdfDoc.getCreationDate() ? pdfDoc.getCreationDate().toLocaleString() : '',
        modificationDate: pdfDoc.getModificationDate() ? pdfDoc.getModificationDate().toLocaleString() : '',
      };

      // Check for XMP stream
      let xmpFound = false;
      try {
        const root = pdfDoc.context.lookup(pdfDoc.context.trailerInfo.Root);
        if (root && typeof root.has === 'function' && root.has(PDFName.of('Metadata'))) {
          xmpFound = true;
        }
      } catch {
        xmpFound = false;
      }

      setOriginalMeta(meta);
      setTitle(meta.title);
      setAuthor(meta.author);
      setSubject(meta.subject);
      setKeywords(meta.keywords);
      setCreator(meta.creator);
      setProducer(meta.producer);
      setCreationDate(meta.creationDate);
      setModDate(meta.modificationDate);
      setHasXmp(xmpFound);
    } catch (err) {
      console.error('Load PDF metadata error:', err);
      setErrorMessage(err.message || 'Failed to parse PDF metadata.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleFiles = useCallback((files) => {
    if (!files || files.length === 0) return;
    const selected = Array.isArray(files) ? files[0] : files;
    const validation = validatePdfFile(selected);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      return;
    }
    setFile(selected);
    setSavedBlob(null);
    loadPdfMetadata(selected);
  }, [loadPdfMetadata]);

  // Handle incoming transferred file
  useEffect(() => {
    if (handledIncomingRef.current) return;
    const incoming = consumeTransferredFile() || location.state?.incomingFile;
    if (incoming) {
      handledIncomingRef.current = true;
      setTimeout(() => {
        handleFiles([incoming]);
      }, 0);
    }
  }, [handleFiles, location.state]);

  // 1-Click Complete Metadata Scrub
  const handleWipeAllMetadata = async () => {
    if (!file || isProcessing) return;
    setIsProcessing(true);
    setErrorMessage('');

    try {
      const buffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });

      // Completely delete all standard Info dictionary keys
      const info = pdfDoc.getInfoDict();
      if (info && typeof info.delete === 'function') {
        info.delete(PDFName.of('Title'));
        info.delete(PDFName.of('Author'));
        info.delete(PDFName.of('Subject'));
        info.delete(PDFName.of('Keywords'));
        info.delete(PDFName.of('Creator'));
        info.delete(PDFName.of('Producer'));
        info.delete(PDFName.of('CreationDate'));
        info.delete(PDFName.of('ModDate'));
        info.delete(PDFName.of('Trapped'));
      }

      // Strip XMP Metadata stream from root catalog
      try {
        const root = pdfDoc.context.lookup(pdfDoc.context.trailerInfo.Root);
        if (root && typeof root.delete === 'function') {
          root.delete(PDFName.of('Metadata'));
        }
      } catch (e) {
        console.warn('Could not delete XMP metadata stream:', e);
      }

      const outBytes = await pdfDoc.save({ updateMetadata: false });
      const outBlob = new Blob([outBytes], { type: 'application/pdf' });
      setSavedBlob(outBlob);
      setSuccessMessage('All metadata wiped clean!');
    } catch (err) {
      console.error('Wipe metadata error:', err);
      setErrorMessage(err.message || 'Failed to sanitize PDF metadata.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Save Custom Modified Metadata
  const handleSaveCustomMetadata = async () => {
    if (!file || isProcessing) return;
    setIsProcessing(true);
    setErrorMessage('');

    try {
      const buffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
      const info = pdfDoc.getInfoDict();

      // Title
      if (title.trim()) {
        pdfDoc.setTitle(title.trim());
      } else if (info && typeof info.delete === 'function') {
        info.delete(PDFName.of('Title'));
      }

      // Author
      if (author.trim()) {
        pdfDoc.setAuthor(author.trim());
      } else if (info && typeof info.delete === 'function') {
        info.delete(PDFName.of('Author'));
      }

      // Subject
      if (subject.trim()) {
        pdfDoc.setSubject(subject.trim());
      } else if (info && typeof info.delete === 'function') {
        info.delete(PDFName.of('Subject'));
      }

      // Keywords
      const kwList = keywords.split(',').map((k) => k.trim()).filter(Boolean);
      if (kwList.length > 0) {
        pdfDoc.setKeywords(kwList);
      } else if (info && typeof info.delete === 'function') {
        info.delete(PDFName.of('Keywords'));
      }

      // Creator
      if (creator.trim()) {
        pdfDoc.setCreator(creator.trim());
      } else if (info && typeof info.delete === 'function') {
        info.delete(PDFName.of('Creator'));
      }

      // Producer
      if (producer.trim()) {
        pdfDoc.setProducer(producer.trim());
      } else if (info && typeof info.delete === 'function') {
        info.delete(PDFName.of('Producer'));
      }

      pdfDoc.setModificationDate(new Date());

      const outBytes = await pdfDoc.save({ updateMetadata: false });
      const outBlob = new Blob([outBytes], { type: 'application/pdf' });
      setSavedBlob(outBlob);
      setSuccessMessage('Metadata updated successfully!');
    } catch (err) {
      console.error('Save metadata error:', err);
      setErrorMessage(err.message || 'Failed to update metadata.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setOriginalMeta(null);
    setSavedBlob(null);
    setErrorMessage('');
    setSuccessMessage('');
  };

  // -------------------------------------------------------------
  // VIEW 3: FINAL COMPLETION VIEW
  // -------------------------------------------------------------
  if (savedBlob && savedUrl && file) {
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="PDF Metadata Scrub & Editor"
          message={successMessage || "PDF metadata successfully sanitized!"}
          fileUrl={savedUrl}
          fileName={`${file.name.replace(/\.[^/.]+$/, '')}-clean.pdf`}
          file={new File([savedBlob], `${file.name.replace(/\.[^/.]+$/, '')}-clean.pdf`, { type: 'application/pdf' })}
          onReset={handleReset}
          onProcessSourceAgain={() => setSavedBlob(null)}
          sourceActionLabel="Edit Metadata Settings"
          onProcessTarget={() => {
            const chained = new File([savedBlob], `${file.name.replace(/\.[^/.]+$/, '')}-clean.pdf`, { type: 'application/pdf' });
            setFile(chained);
            setSavedBlob(null);
            loadPdfMetadata(chained);
          }}
          targetActionLabel="Inspect Cleaned File Again"
          currentPath="/pdf-metadata"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Empty state)
  // -------------------------------------------------------------
  if (!file) {
    return (
      <ToolHeroView
        title="PDF Metadata Scrub & Editor"
        description="Inspect, edit, or completely wipe hidden author tags, software traces, timestamps, and XMP streams 100% offline."
        badge="PDF Security"
        badgeIcon={FiShield}
        toolPath="/pdf-metadata"
        acceptedFormats={['.pdf']}
        allowMultiple={false}
        maxSizeText="100 MB"
        accept={{ 'application/pdf': ['.pdf'] }}
        onFilesSelected={handleFiles}
        alerts={
          errorMessage ? (
            <AlertBanner
              message={errorMessage}
              type="error"
              onClose={() => setErrorMessage('')}
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
        title="PDF Metadata Scrub & Editor"
        icon={FiShield}
        file={file}
        category="PDF Security"
        toolPath="/pdf-metadata"
        onReset={handleReset}
        resetLabel="Change PDF"
        headerExtra={
          <button
            type="button"
            onClick={handleWipeAllMetadata}
            disabled={isProcessing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.35)',
            }}
          >
            <FiTrash2 size={14} /> 1-Click Sanitize All
          </button>
        }
        actionButton={
          <button
            type="button"
            onClick={handleSaveCustomMetadata}
            disabled={isProcessing}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
            }}
          >
            <FiSave size={14} /> {isProcessing ? 'Saving...' : 'Save Changes'}
          </button>
        }
      />

      {errorMessage && (
        <div style={{ margin: '0.5rem 0' }}>
          <AlertBanner message={errorMessage} type="error" onClose={() => setErrorMessage('')} />
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.5rem 0' }}>
        {/* Privacy Alert Summary */}
        {originalMeta && (
          <div style={{ background: hasXmp || originalMeta.author || originalMeta.producer ? 'rgba(255, 165, 2, 0.08)' : 'rgba(46, 213, 115, 0.08)', border: `1px solid ${hasXmp || originalMeta.author || originalMeta.producer ? 'rgba(255, 165, 2, 0.3)' : 'rgba(46, 213, 115, 0.3)'}`, padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              {hasXmp || originalMeta.author || originalMeta.producer ? (
                <FiAlertTriangle color="#ffa502" size={18} />
              ) : (
                <FiCheck color="#2ed573" size={18} />
              )}
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: hasXmp || originalMeta.author || originalMeta.producer ? '#ffa502' : '#2ed573' }}>
                {hasXmp || originalMeta.author || originalMeta.producer ? 'Privacy Traces Detected' : 'Clean Document Profile'}
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
              {originalMeta.author ? `• Author identified as: "${originalMeta.author}". ` : ''}
              {originalMeta.producer ? `• Generated with software: "${originalMeta.producer}". ` : ''}
              {hasXmp ? '• Embedded Adobe/Word XMP Metadata Stream present. ' : ''}
              Click <strong>"1-Click Sanitize All"</strong> to permanently strip these tags before sharing.
            </p>
          </div>
        )}

        {/* Metadata Fields Form */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 1rem 0', color: 'var(--text-color)' }}>
            Document Properties & Identity Headers
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {/* Title */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Document Title:
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="None"
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.9rem' }}
              />
            </div>

            {/* Author */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Author / Creator Identity:
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="None"
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.9rem' }}
              />
            </div>

            {/* Subject */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Subject / Description:
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="None"
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.9rem' }}
              />
            </div>

            {/* Keywords */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Keywords (Comma-separated):
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. report, private, invoice"
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.9rem' }}
              />
            </div>

            {/* Software Creator */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Software Creator:
              </label>
              <input
                type="text"
                value={creator}
                onChange={(e) => setCreator(e.target.value)}
                placeholder="None"
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.9rem' }}
              />
            </div>

            {/* PDF Producer */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                PDF Producer / Engine:
              </label>
              <input
                type="text"
                value={producer}
                onChange={(e) => setProducer(e.target.value)}
                placeholder="None"
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.9rem' }}
              />
            </div>

            {/* Creation Date Read-Only */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Original Creation Date:
              </label>
              <input
                type="text"
                value={creationDate || 'Not Recorded'}
                disabled
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'not-allowed' }}
              />
            </div>

            {/* Modification Date Read-Only */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Original Modification Date:
              </label>
              <input
                type="text"
                value={modDate || 'Not Recorded'}
                disabled
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'not-allowed' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
