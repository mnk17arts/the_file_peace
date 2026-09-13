import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import {
  FiRepeat,
  FiChevronLeft,
  FiChevronRight,
  FiSliders,
} from 'react-icons/fi';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import {
  ToolHeroView,
  ToolStudioHeader,
  ResizableSplitPane,
  StudioControlPanel,
} from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { validatePdfFile } from '../utils/fileUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export default function FlipPdf() {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Flip options
  const [flipDirection, setFlipDirection] = useState('horizontal'); // 'horizontal' | 'vertical' | 'both'
  const [applyScope, setApplyScope] = useState('all'); // 'all' | 'current' | 'odd' | 'even' | 'custom'
  const [customRange, setCustomRange] = useState('');

  // Result state
  const [flippedBlob, setFlippedBlob] = useState(null);

  const canvasRef = useRef(null);
  const handledIncomingRef = useRef(false);

  // Managed output blob URL
  const flippedUrl = useMemo(() => {
    return flippedBlob ? URL.createObjectURL(flippedBlob) : null;
  }, [flippedBlob]);

  useEffect(() => {
    return () => {
      if (flippedUrl) URL.revokeObjectURL(flippedUrl);
    };
  }, [flippedUrl]);

  // Render preview of current page onto canvas
  const renderPreview = useCallback(async (doc = pdfDoc, pageNum = currentPage) => {
    if (!doc || !canvasRef.current) return;

    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.25 });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: ctx,
        viewport: viewport,
      }).promise;
    } catch (err) {
      console.error('Render preview error:', err);
    }
  }, [pdfDoc, currentPage]);

  // Trigger preview immediately on mount/update of pdfDoc or currentPage
  useEffect(() => {
    if (pdfDoc) {
      // Small timeout ensures canvas element has completed its layout pass
      const timer = setTimeout(() => {
        renderPreview(pdfDoc, currentPage);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [pdfDoc, currentPage, renderPreview]);

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

  // Handle file selection
  const handleFiles = useCallback((files) => {
    if (!files || files.length === 0) return;
    const selected = Array.isArray(files) ? files[0] : files;
    const validation = validatePdfFile(selected);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      return;
    }

    setFile(selected);
    setFlippedBlob(null);
    loadPdf(selected);
  }, [loadPdf]);

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

  // Execute Flip / Mirror with vector transformation via pdf-lib
  const handleExecuteFlip = async () => {
    if (!file) return;
    setIsProcessing(true);
    setErrorMessage('');

    try {
      const buffer = await file.arrayBuffer();
      const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const dstDoc = await PDFDocument.create();

      const pageCount = srcDoc.getPageCount();

      // Determine target pages
      let targetSet = new Set();
      if (applyScope === 'all') {
        for (let i = 0; i < pageCount; i++) targetSet.add(i);
      } else if (applyScope === 'current') {
        targetSet.add(currentPage - 1);
      } else if (applyScope === 'odd') {
        for (let i = 0; i < pageCount; i += 2) targetSet.add(i);
      } else if (applyScope === 'even') {
        for (let i = 1; i < pageCount; i += 2) targetSet.add(i);
      } else if (applyScope === 'custom') {
        const parts = customRange.split(',').map((p) => p.trim());
        parts.forEach((part) => {
          if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            if (!isNaN(start) && !isNaN(end)) {
              for (let i = start; i <= end; i++) {
                if (i >= 1 && i <= pageCount) targetSet.add(i - 1);
              }
            }
          } else {
            const num = Number(part);
            if (!isNaN(num) && num >= 1 && num <= pageCount) {
              targetSet.add(num - 1);
            }
          }
        });
      }

      for (let i = 0; i < pageCount; i++) {
        const srcPage = srcDoc.getPage(i);
        const { width, height } = srcPage.getSize();
        const rotation = srcPage.getRotation().angle || 0;

        const [embeddedPage] = await dstDoc.embedPages([srcPage]);
        const newPage = dstDoc.addPage([width, height]);
        newPage.setRotation({ angle: rotation, type: 'degrees' });

        const shouldFlip = targetSet.has(i);

        if (!shouldFlip) {
          newPage.drawPage(embeddedPage, {
            x: 0,
            y: 0,
            width,
            height,
          });
        } else {
          if (flipDirection === 'horizontal') {
            newPage.drawPage(embeddedPage, {
              x: width,
              y: 0,
              xScale: -1,
              yScale: 1,
            });
          } else if (flipDirection === 'vertical') {
            newPage.drawPage(embeddedPage, {
              x: 0,
              y: height,
              xScale: 1,
              yScale: -1,
            });
          } else if (flipDirection === 'both') {
            newPage.drawPage(embeddedPage, {
              x: width,
              y: height,
              xScale: -1,
              yScale: -1,
            });
          }
        }
      }

      const flippedBytes = await dstDoc.save();
      const outBlob = new Blob([flippedBytes], { type: 'application/pdf' });
      setFlippedBlob(outBlob);
    } catch (err) {
      console.error('Flip error:', err);
      setErrorMessage(err.message || 'Failed to flip PDF document.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPdfDoc(null);
    setFlippedBlob(null);
    setErrorMessage('');
  };

  // Preview CSS transform
  const getPreviewTransform = () => {
    if (flipDirection === 'horizontal') return 'scaleX(-1)';
    if (flipDirection === 'vertical') return 'scaleY(-1)';
    if (flipDirection === 'both') return 'scale(-1, -1)';
    return 'none';
  };

  const outFileName = file
    ? `${file.name.replace(/\.[^/.]+$/, '')}-${flipDirection}-flipped.pdf`
    : 'flipped_document.pdf';

  // -------------------------------------------------------------
  // VIEW 3: FINAL COMPLETION VIEW
  // -------------------------------------------------------------
  if (flippedBlob && flippedUrl) {
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="Flip & Mirror PDF"
          message="PDF Mirrored & Flipped Successfully!"
          fileUrl={flippedUrl}
          fileName={outFileName}
          file={flippedBlob}
          onReset={handleReset}
          onProcessSourceAgain={() => setFlippedBlob(null)}
          sourceActionLabel="Adjust Flip Settings"
          onProcessTarget={() => {
            const chainedFile = new File([flippedBlob], outFileName, { type: 'application/pdf' });
            setFile(chainedFile);
            setFlippedBlob(null);
            loadPdf(chainedFile);
          }}
          targetActionLabel="Flip Output Again"
          currentPath="/flip-pdf"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Upload stage)
  // -------------------------------------------------------------
  if (!file) {
    return (
      <ToolHeroView
        title="Flip & Mirror PDF"
        description="Mirror PDF pages horizontally or vertically for heat transfers, printing transparencies, or layout corrections with 100% in-memory vector preservation."
        badge="Page Geometry"
        badgeIcon={FiRepeat}
        toolPath="/flip-pdf"
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
  // VIEW 2: CONFIGURATION VIEW (TYPE-A Draggable Two-Column Studio)
  // -------------------------------------------------------------
  const leftControlsPane = (
    <StudioControlPanel
      title="Flip Orientation & Scope"
      icon={FiSliders}
      badge="Vector Transform"
      actionLabel="Apply Flip & Download"
      actionIcon={FiRepeat}
      onAction={handleExecuteFlip}
      actionLoading={isProcessing}
      actionDisabled={isProcessing}
      progressMessage="Mirroring PDF geometry in-memory..."
    >
      {/* Flip Orientation */}
      <div style={{ marginBottom: '1.1rem' }}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.45rem' }}>
          Flip Orientation:
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
          {[
            { id: 'horizontal', label: 'Horizontal (X)' },
            { id: 'vertical', label: 'Vertical (Y)' },
            { id: 'both', label: 'Both (XY)' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFlipDirection(opt.id)}
              style={{
                padding: '0.6rem 0.4rem',
                borderRadius: '8px',
                border: flipDirection === opt.id ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                background: flipDirection === opt.id ? 'rgba(28, 153, 255, 0.12)' : 'var(--subtle-bg)',
                color: flipDirection === opt.id ? 'var(--primary-color)' : 'var(--text-color)',
                cursor: 'pointer',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '0.82rem',
                transition: 'all 0.15s ease',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Target Page Scope */}
      <div>
        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.45rem' }}>
          Target Pages:
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginBottom: '0.45rem' }}>
          {[
            { id: 'all', label: `All (${numPages})` },
            { id: 'current', label: `Page ${currentPage}` },
            { id: 'custom', label: 'Custom' },
          ].map((scope) => (
            <button
              key={scope.id}
              type="button"
              onClick={() => setApplyScope(scope.id)}
              style={{
                padding: '0.5rem 0.4rem',
                borderRadius: '8px',
                border: applyScope === scope.id ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                background: applyScope === scope.id ? 'rgba(28, 153, 255, 0.12)' : 'var(--subtle-bg)',
                color: applyScope === scope.id ? 'var(--primary-color)' : 'var(--text-color)',
                cursor: 'pointer',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '0.82rem',
                transition: 'all 0.15s ease',
              }}
            >
              {scope.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.45rem' }}>
          {[
            { id: 'odd', label: 'Odd Pages Only' },
            { id: 'even', label: 'Even Pages Only' },
          ].map((scope) => (
            <button
              key={scope.id}
              type="button"
              onClick={() => setApplyScope(scope.id)}
              style={{
                flex: 1,
                padding: '0.35rem 0.4rem',
                borderRadius: '6px',
                border: applyScope === scope.id ? '1.5px solid var(--primary-color)' : '1px solid var(--border-color)',
                background: applyScope === scope.id ? 'rgba(28, 153, 255, 0.1)' : 'transparent',
                color: applyScope === scope.id ? 'var(--primary-color)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'center',
                fontSize: '0.78rem',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
            >
              {scope.label}
            </button>
          ))}
        </div>

        {applyScope === 'custom' && (
          <input
            type="text"
            value={customRange}
            onChange={(e) => setCustomRange(e.target.value)}
            placeholder="e.g. 1-3, 5"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '0.45rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'var(--card-bg)',
              color: 'var(--text-color)',
              fontSize: '0.84rem',
            }}
          />
        )}
      </div>
    </StudioControlPanel>
  );

  const rightPreviewPane = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '0.85rem',
        boxSizing: 'border-box',
      }}
    >
      {/* Pagination & Status Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '0.65rem',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '0.75rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-color)' }}>
          Live Flip Preview
        </span>

        {/* Page Switcher */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'var(--subtle-bg)',
            padding: '0.2rem 0.6rem',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
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
              opacity: currentPage <= 1 ? 0.3 : 1,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Previous Page"
          >
            <FiChevronLeft size={16} />
          </button>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-color)' }}>
            {currentPage} / {numPages || 1}
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
              opacity: currentPage >= numPages ? 0.3 : 1,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Next Page"
          >
            <FiChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--subtle-bg)',
          borderRadius: '8px',
          padding: '1rem',
          overflow: 'auto',
          minHeight: '380px',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: '6px',
            boxShadow: '0 6px 24px rgba(0,0,0,0.15)',
            transform: getPreviewTransform(),
            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            background: '#ffffff',
          }}
        />
      </div>

      {/* Live orientation tag */}
      <div style={{ textAlign: 'center', fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
        ⚡ Live vector preview ({flipDirection === 'horizontal' ? 'Mirror Horizontal' : flipDirection === 'vertical' ? 'Flip Vertical' : '180° Invert'}) on page {currentPage}
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
        overflow: 'hidden',
      }}
    >
      {/* 1. Ultra-compact 48px Micro-Header */}
      <ToolStudioHeader
        title="Flip & Mirror PDF"
        icon={FiRepeat}
        file={file}
        category="Organize PDF"
        toolPath="/flip-pdf"
        onReset={handleReset}
        resetLabel="Change PDF"
      />

      {/* Error alert banner */}
      {errorMessage && (
        <div style={{ marginBottom: '0.5rem' }}>
          <AlertBanner message={errorMessage} type="error" onClose={() => setErrorMessage('')} />
        </div>
      )}

      {/* 2. Draggable Two-Column Split Pane Studio */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResizableSplitPane
          leftPane={leftControlsPane}
          rightPane={rightPreviewPane}
          defaultSplit={38}
          minLeftWidth={320}
          minRightWidth={360}
          height="100%"
          leftTitle="Settings"
          rightTitle="Preview"
          storageKey="flip_pdf"
        />
      </div>
    </div>
  );
}
