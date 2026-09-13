import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import {
  FiShield,
  FiInfo,
  FiCheckCircle,
  FiLayers
} from 'react-icons/fi';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { formatFileSize, validatePdfFile } from '../utils/fileUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export default function FlattenPdf() {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Mode: 'lossless' (vector form flattening) vs 'raster' (tamper-proof rasterization)
  const [flattenMode, setFlattenMode] = useState('lossless');
  const [flattenedBlob, setFlattenedBlob] = useState(null);

  const handledIncomingRef = useRef(false);

  // Manage flattenedUrl lifecycle
  const flattenedUrl = useMemo(() => {
    return flattenedBlob ? URL.createObjectURL(flattenedBlob) : null;
  }, [flattenedBlob]);

  useEffect(() => {
    return () => {
      if (flattenedUrl) {
        URL.revokeObjectURL(flattenedUrl);
      }
    };
  }, [flattenedUrl]);

  // Load PDF info
  const loadPdfInfo = useCallback(async (selectedFile) => {
    setIsProcessing(true);
    setErrorMessage('');
    try {
      const buffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        isEvalSupported: false,
      }).promise;
      setNumPages(pdf.numPages);
    } catch (err) {
      console.error('Load PDF info error:', err);
      setErrorMessage(err.message || 'Failed to inspect PDF.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handle file drop
  const handleFiles = useCallback((files) => {
    if (!files || files.length === 0) return;
    const selected = Array.isArray(files) ? files[0] : files;
    const validation = validatePdfFile(selected);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      return;
    }

    setFile(selected);
    setFlattenedBlob(null);
    loadPdfInfo(selected);
  }, [loadPdfInfo]);

  // Handle incoming transfer file
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

  // Execute Flatten
  const handleExecuteFlatten = async () => {
    if (!file) return;
    setIsProcessing(true);
    setErrorMessage('');
    setFlattenedBlob(null);

    try {
      const buffer = await file.arrayBuffer();

      if (flattenMode === 'lossless') {
        setProgressMsg('Baking form fields and annotations into vector content...');
        const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });

        // Flatten AcroForms if present
        try {
          const form = pdfDoc.getForm();
          form.flatten();
        } catch {
          // Document may not have interactive AcroForm fields
        }

        const outBytes = await pdfDoc.save();
        const outBlob = new Blob([outBytes], { type: 'application/pdf' });
        setFlattenedBlob(outBlob);
      } else {
        // High-Security Raster Flattening
        setProgressMsg('Loading PDF pages for security rasterization...');
        const pdf = await pdfjsLib.getDocument({
          data: new Uint8Array(buffer),
          useWorkerFetch: false,
          isEvalSupported: false,
        }).promise;

        const totalPages = pdf.numPages;
        const newPdfDoc = await PDFDocument.create();

        for (let i = 1; i <= totalPages; i++) {
          setProgressMsg(`Rasterizing and flattening page ${i} of ${totalPages}...`);
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 }); // High DPI 300 equivalent

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');

          await page.render({
            canvasContext: ctx,
            viewport: viewport,
          }).promise;

          const jpegBlob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.90));
          const jpegBytes = await jpegBlob.arrayBuffer();
          const embeddedImg = await newPdfDoc.embedJpg(jpegBytes);

          const origViewport = page.getViewport({ scale: 1.0 });
          const newPage = newPdfDoc.addPage([origViewport.width, origViewport.height]);
          newPage.drawImage(embeddedImg, {
            x: 0,
            y: 0,
            width: origViewport.width,
            height: origViewport.height,
          });
        }

        setProgressMsg('Finalizing tamper-proof document...');
        const finalBytes = await newPdfDoc.save();
        const outBlob = new Blob([finalBytes], { type: 'application/pdf' });
        setFlattenedBlob(outBlob);
      }
    } catch (err) {
      console.error('Flatten error:', err);
      setErrorMessage(err.message || 'Failed to flatten PDF document.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setFlattenedBlob(null);
    setErrorMessage('');
  };

  // -------------------------------------------------------------
  // VIEW 3: COMPLETION VIEW
  // -------------------------------------------------------------
  if (flattenedBlob && flattenedUrl && file) {
    const outFileName = `${file.name.replace(/\.[^/.]+$/, '')}-flattened.pdf`;
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="Flatten PDF"
          message="PDF baked and tamper-proofed successfully!"
          fileUrl={flattenedUrl}
          fileName={outFileName}
          file={new File([flattenedBlob], outFileName, { type: 'application/pdf' })}
          onReset={handleReset}
          onProcessSourceAgain={() => setFlattenedBlob(null)}
          sourceActionLabel="Flatten Source Again"
          onProcessTarget={() => {
            const chained = new File([flattenedBlob], outFileName, { type: 'application/pdf' });
            setFile(chained);
            setFlattenedBlob(null);
            loadPdfInfo(chained);
          }}
          targetActionLabel="Use Flattened File"
          currentPath="/flatten-pdf"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Empty State)
  // -------------------------------------------------------------
  if (!file) {
    return (
      <ToolHeroView
        title="Flatten & Tamper-Proof PDF"
        description="Bake form fields, digital signatures, and annotations permanently into non-editable pages to prevent unauthorized modifications."
        badge="PDF Security"
        badgeIcon={FiShield}
        toolPath="/flatten-pdf"
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
  // VIEW 2: STUDIO CONFIGURATION VIEW
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
        toolTitle="Flatten PDF"
        fileBadge={`${file.name} (${formatFileSize(file.size)}${numPages > 0 ? ` • ${numPages} pgs` : ''})`}
        onBack={handleReset}
        backLabel="Choose Another File"
        primaryAction={{
          label: isProcessing ? 'Flattening...' : 'Flatten PDF Document',
          icon: FiShield,
          onClick: handleExecuteFlatten,
          disabled: isProcessing,
          loading: isProcessing
        }}
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.5rem 0' }}>
        <div style={{ maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {errorMessage && (
            <AlertBanner
              message={errorMessage}
              type="error"
              onClose={() => setErrorMessage('')}
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
                <FiLayers />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Select Flattening Method</h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.875rem', opacity: 0.75 }}>
                  Choose how form fields and annotations will be converted.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {/* Option 1: Lossless Vector */}
              <div
                onClick={() => setFlattenMode('lossless')}
                style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: `2px solid ${flattenMode === 'lossless' ? 'var(--primary-color, #6366f1)' : 'var(--border-color, #334155)'}`,
                  background: flattenMode === 'lossless' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-color, #0f172a)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-color)', fontSize: '1rem' }}>
                    Lossless Vector
                  </span>
                  <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: '6px', background: flattenMode === 'lossless' ? 'var(--primary-color, #6366f1)' : 'var(--border-color, #334155)', color: '#fff', fontWeight: 600 }}>
                    Recommended
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)', margin: 0, lineHeight: 1.45 }}>
                  Bakes interactive form inputs, dropdowns, and checkboxes directly into page vector content. Text remains 100% searchable and crisp with zero quality loss.
                </p>
              </div>

              {/* Option 2: High-Security Raster */}
              <div
                onClick={() => setFlattenMode('raster')}
                style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: `2px solid ${flattenMode === 'raster' ? 'var(--primary-color, #6366f1)' : 'var(--border-color, #334155)'}`,
                  background: flattenMode === 'raster' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-color, #0f172a)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-color)', fontSize: '1rem' }}>
                    Tamper-Proof Raster
                  </span>
                  <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: '6px', background: flattenMode === 'raster' ? 'var(--primary-color, #6366f1)' : 'var(--border-color, #334155)', color: '#fff', fontWeight: 600 }}>
                    Max Security
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)', margin: 0, lineHeight: 1.45 }}>
                  Renders pages into high-DPI raster layers. Strips all interactive scripts, underlying layers, and hidden metadata. Makes document 100% un-editable.
                </p>
              </div>
            </div>

            {/* Info Box */}
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
                marginBottom: '1.5rem'
              }}
            >
              <FiInfo style={{ color: 'var(--primary-color, #6366f1)', fontSize: '1.25rem', flexShrink: 0, marginTop: '2px' }} />
              <div>
                Flattening is permanent in the exported document. The original file on your computer remains untouched.
              </div>
            </div>

            {/* Processing Progress */}
            {isProcessing && (
              <div style={{ padding: '1.5rem 1rem', textAlign: 'center', background: 'var(--bg-color, #0f172a)', borderRadius: '12px', border: '1px solid var(--border-color, #334155)', marginBottom: '1.5rem' }}>
                <div style={{ width: '36px', height: '36px', border: '3px solid var(--border-color, #334155)', borderTopColor: 'var(--primary-color, #6366f1)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 0.75rem' }} />
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                <div style={{ color: 'var(--text-color)', fontWeight: 600, fontSize: '0.95rem' }}>Processing Document</div>
                <div style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.85rem', marginTop: '0.25rem' }}>{progressMsg}</div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={handleReset}
                disabled={isProcessing}
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
                onClick={handleExecuteFlatten}
                disabled={isProcessing}
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
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  opacity: isProcessing ? 0.6 : 1
                }}
              >
                <FiCheckCircle /> Flatten PDF Document
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
