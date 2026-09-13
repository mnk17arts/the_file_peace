import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import {
  FiMoon,
  FiChevronLeft,
  FiChevronRight,
  FiSun,
  FiEye,
  FiCheck
} from 'react-icons/fi';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import { ToolHeroView, ToolStudioHeader, ResizableSplitPane } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { formatFileSize, validatePdfFile } from '../utils/fileUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const COLOR_MODES = [
  {
    id: 'dark',
    name: 'Night / Dark Mode',
    desc: 'Deep dark background with high-legibility crisp text for night reading',
    badge: 'Popular',
    icon: FiMoon,
    filterFn: (r, g, b) => {
      const invR = 255 - r;
      const invG = 255 - g;
      const invB = 255 - b;
      return [
        Math.min(235, Math.round(invR * 0.9 + 15)),
        Math.min(235, Math.round(invG * 0.9 + 15)),
        Math.min(245, Math.round(invB * 0.9 + 20)),
      ];
    },
  },
  {
    id: 'sepia',
    name: 'Sepia Reading Mode',
    desc: 'Warm paper parchment tones to eliminate blue light and reduce eye fatigue',
    badge: 'Eye Comfort',
    icon: FiSun,
    filterFn: (r, g, b) => {
      const tr = Math.min(255, Math.round(r * 0.393 + g * 0.769 + b * 0.189));
      const tg = Math.min(255, Math.round(r * 0.349 + g * 0.686 + b * 0.168));
      const tb = Math.min(255, Math.round(r * 0.272 + g * 0.534 + b * 0.131));
      return [tr, tg, tb];
    },
  },
  {
    id: 'grayscale',
    name: 'Grayscale / B&W',
    desc: 'Converts color documents to clean monochrome for printer ink saving',
    badge: 'Ink Saver',
    icon: FiEye,
    filterFn: (r, g, b) => {
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      return [gray, gray, gray];
    },
  },
  {
    id: 'invert',
    name: 'Full Color Negative',
    desc: 'Standard mathematical 100% RGB color inversion',
    badge: 'Negative',
    icon: FiMoon,
    filterFn: (r, g, b) => {
      return [255 - r, 255 - g, 255 - b];
    },
  },
  {
    id: 'high-contrast',
    name: 'High Contrast Dark',
    desc: 'Pure OLED black background with vibrant amber text for maximum accessibility',
    badge: 'Accessible',
    icon: FiSun,
    filterFn: (r, g, b) => {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > 180) {
        return [18, 18, 18];
      } else {
        return [255, 183, 3];
      }
    },
  },
];

export default function InvertPdf() {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Settings
  const [selectedMode, setSelectedMode] = useState('dark');

  // Result state
  const [invertedBlob, setInvertedBlob] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);

  const canvasRef = useRef(null);
  const handledIncomingRef = useRef(false);

  // Manage invertedUrl lifecycle
  const invertedUrl = useMemo(() => {
    return invertedBlob ? URL.createObjectURL(invertedBlob) : null;
  }, [invertedBlob]);

  useEffect(() => {
    return () => {
      if (invertedUrl) {
        URL.revokeObjectURL(invertedUrl);
      }
    };
  }, [invertedUrl]);

  // Render preview of current page with active color filter
  const renderPreview = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: 1.2 });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: ctx,
        viewport: viewport,
      }).promise;

      // Apply pixel color transformation
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const mode = COLOR_MODES.find((m) => m.id === selectedMode) || COLOR_MODES[0];

      for (let i = 0; i < data.length; i += 4) {
        const [nr, ng, nb] = mode.filterFn(data[i], data[i + 1], data[i + 2]);
        data[i] = nr;
        data[i + 1] = ng;
        data[i + 2] = nb;
      }

      ctx.putImageData(imgData, 0, 0);
    } catch (err) {
      console.error('Render preview error:', err);
    }
  }, [currentPage, pdfDoc, selectedMode]);

  // Load PDF into memory
  const loadPdf = useCallback(async (selectedFile) => {
    setErrorMessage('');
    setIsProcessing(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        isEvalSupported: false,
      }).promise;

      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      setCurrentPage(1);
    } catch (err) {
      console.error('Load PDF error:', err);
      setErrorMessage(err.message || 'Failed to load PDF document.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (pdfDoc) {
      const timer = setTimeout(() => {
        if (active) {
          renderPreview();
        }
      }, 50);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [pdfDoc, renderPreview]);

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
    setInvertedBlob(null);
    loadPdf(selected);
  }, [loadPdf]);

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

  // Execute full document color mode transformation
  const handleExecuteInversion = async () => {
    if (!file || !pdfDoc) return;
    setIsProcessing(true);
    setErrorMessage('');
    setInvertedBlob(null);

    try {
      const pdf = pdfDoc;
      const totalPages = pdf.numPages;
      const newPdfDoc = await PDFDocument.create();
      const mode = COLOR_MODES.find((m) => m.id === selectedMode) || COLOR_MODES[0];

      for (let i = 1; i <= totalPages; i++) {
        setProgressMsg(`Applying ${mode.name} to page ${i} of ${totalPages}...`);

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });

        const offCanvas = document.createElement('canvas');
        offCanvas.width = viewport.width;
        offCanvas.height = viewport.height;
        const ctx = offCanvas.getContext('2d');

        await page.render({
          canvasContext: ctx,
          viewport: viewport,
        }).promise;

        // Apply pixel manipulation
        const imgData = ctx.getImageData(0, 0, offCanvas.width, offCanvas.height);
        const data = imgData.data;

        for (let p = 0; p < data.length; p += 4) {
          const [nr, ng, nb] = mode.filterFn(data[p], data[p + 1], data[p + 2]);
          data[p] = nr;
          data[p + 1] = ng;
          data[p + 2] = nb;
        }

        ctx.putImageData(imgData, 0, 0);

        const jpegBlob = await new Promise((res) => offCanvas.toBlob(res, 'image/jpeg', 0.85));
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

      setProgressMsg('Compiling final document...');
      const finalBytes = await newPdfDoc.save();
      const outBlob = new Blob([finalBytes], { type: 'application/pdf' });
      setInvertedBlob(outBlob);
    } catch (err) {
      console.error('Invert error:', err);
      setErrorMessage(err.message || 'Failed to invert PDF colors.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setInvertedBlob(null);
    setPdfDoc(null);
    setErrorMessage('');
  };

  // -------------------------------------------------------------
  // VIEW 3: COMPLETION VIEW
  // -------------------------------------------------------------
  if (invertedBlob && invertedUrl && file) {
    const outFileName = `${file.name.replace(/\.[^/.]+$/, '')}-${selectedMode}.pdf`;
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="Invert PDF"
          message={`PDF transformed to ${COLOR_MODES.find((m) => m.id === selectedMode)?.name || 'Custom Theme'} successfully!`}
          fileUrl={invertedUrl}
          fileName={outFileName}
          file={new File([invertedBlob], outFileName, { type: 'application/pdf' })}
          onReset={handleReset}
          onProcessSourceAgain={() => setInvertedBlob(null)}
          sourceActionLabel="Invert Source Again"
          onProcessTarget={() => {
            const chained = new File([invertedBlob], outFileName, { type: 'application/pdf' });
            setFile(chained);
            setInvertedBlob(null);
            loadPdf(chained);
          }}
          targetActionLabel="Use Themed PDF"
          currentPath="/invert-pdf"
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
        title="Invert PDF Colors & Reading Themes"
        description="Transform PDF documents into Night / Dark Mode, warm Sepia, Ink-saving Grayscale, or Inverted colors."
        badge="PDF View & Edit"
        badgeIcon={FiMoon}
        toolPath="/invert-pdf"
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
  const controlsDesk = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem' }}>
      <div
        style={{
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '16px',
          padding: '1.25rem'
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-color)', display: 'block', marginBottom: '1rem' }}>
          Select Color Theme:
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {COLOR_MODES.map((mode) => {
            const isSelected = selectedMode === mode.id;
            const Icon = mode.icon;
            return (
              <div
                key={mode.id}
                onClick={() => setSelectedMode(mode.id)}
                style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  border: `2px solid ${isSelected ? 'var(--primary-color, #6366f1)' : 'var(--border-color, #334155)'}`,
                  background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--subtle-bg, #0f172a)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Icon style={{ color: isSelected ? 'var(--primary-color, #6366f1)' : 'var(--text-secondary, #94a3b8)' }} />
                    <span style={{ fontWeight: 600, color: 'var(--text-color)', fontSize: '0.95rem' }}>
                      {mode.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {mode.badge && (
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: isSelected ? 'var(--primary-color, #6366f1)' : 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: 600 }}>
                        {mode.badge}
                      </span>
                    )}
                    {isSelected && <FiCheck style={{ color: 'var(--primary-color, #6366f1)' }} />}
                  </div>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', margin: 0, lineHeight: 1.4 }}>
                  {mode.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Processing State */}
      {isProcessing && (
        <div style={{ padding: '1.25rem', textAlign: 'center', background: 'var(--card-bg, #1e293b)', borderRadius: '12px', border: '1px solid var(--border-color, #334155)' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border-color, #334155)', borderTopColor: 'var(--primary-color, #6366f1)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 0.5rem' }} />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <div style={{ color: 'var(--text-color)', fontWeight: 600, fontSize: '0.9rem' }}>Processing Theme</div>
          <div style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{progressMsg}</div>
        </div>
      )}
    </div>
  );

  const previewDesk = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
        height: '100%',
        minHeight: 0,
        padding: '0.25rem',
      }}
    >
      {/* Pagination Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          background: 'var(--subtle-bg, #0f172a)',
          padding: '0.35rem 0.85rem',
          borderRadius: '10px',
          border: '1px solid var(--border-color, #334155)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--text-color)',
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            opacity: currentPage <= 1 ? 0.4 : 1,
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <FiChevronLeft size={18} />
        </button>
        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-color)' }}>
          Page {currentPage} of {numPages}
        </span>
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
          disabled={currentPage >= numPages}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--text-color)',
            cursor: currentPage >= numPages ? 'not-allowed' : 'pointer',
            opacity: currentPage >= numPages ? 0.4 : 1,
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <FiChevronRight size={18} />
        </button>
      </div>

      {/* Canvas Viewport */}
      <div
        style={{
          width: '100%',
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          background: 'var(--subtle-bg, #0f172a)',
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid var(--border-color, #334155)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ maxWidth: '100%', height: 'auto', borderRadius: '6px', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}
        />
      </div>
    </div>
  );

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
        toolTitle="Invert PDF Colors"
        fileBadge={`${file.name} (${formatFileSize(file.size)}${numPages > 0 ? ` • ${numPages} pgs` : ''})`}
        onBack={handleReset}
        backLabel="Choose Another File"
        primaryAction={{
          label: isProcessing ? 'Processing...' : 'Apply Theme & Export',
          icon: FiMoon,
          onClick: handleExecuteInversion,
          disabled: isProcessing,
          loading: isProcessing
        }}
      />

      {errorMessage && (
        <div style={{ marginBottom: '0.5rem' }}>
          <AlertBanner
            message={errorMessage}
            type="error"
            onClose={() => setErrorMessage('')}
          />
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        <ResizableSplitPane
          leftPane={controlsDesk}
          rightPane={previewDesk}
          defaultSplit={40}
          minLeftWidth={320}
          minRightWidth={360}
          height="100%"
          leftTitle="Color Theme Options"
          rightTitle="Live Page Inversion Preview"
          storageKey="invert_pdf"
        />
      </div>
    </div>
  );
}
