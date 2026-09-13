import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import {
  FiCrop,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import { ToolHeroView, ToolStudioHeader, ResizableSplitPane } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { formatFileSize, validatePdfFile } from '../utils/fileUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export default function CropPdf() {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Margins in percentage from edge (0 to 45%)
  const [marginTop, setMarginTop] = useState(5);
  const [marginBottom, setMarginBottom] = useState(5);
  const [marginLeft, setMarginLeft] = useState(5);
  const [marginRight, setMarginRight] = useState(5);

  // Apply scope
  const [applyScope, setApplyScope] = useState('all'); // 'all' | 'current' | 'custom'
  const [customRange, setCustomRange] = useState('');

  // Result state
  const [croppedBlob, setCroppedBlob] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);

  const canvasRef = useRef(null);
  const handledIncomingRef = useRef(false);

  // Manage croppedUrl lifecycle
  const croppedUrl = useMemo(() => {
    return croppedBlob ? URL.createObjectURL(croppedBlob) : null;
  }, [croppedBlob]);

  useEffect(() => {
    return () => {
      if (croppedUrl) {
        URL.revokeObjectURL(croppedUrl);
      }
    };
  }, [croppedUrl]);

  // Render current page with crop preview
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

      // Draw crop overlay
      const cropX = (marginLeft / 100) * viewport.width;
      const cropY = (marginTop / 100) * viewport.height;
      const cropW = viewport.width - cropX - ((marginRight / 100) * viewport.width);
      const cropH = viewport.height - cropY - ((marginBottom / 100) * viewport.height);

      // Dim outer areas
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, viewport.width, cropY); // Top
      ctx.fillRect(0, cropY + cropH, viewport.width, viewport.height - (cropY + cropH)); // Bottom
      ctx.fillRect(0, cropY, cropX, cropH); // Left
      ctx.fillRect(cropX + cropW, cropY, viewport.width - (cropX + cropW), cropH); // Right

      // Draw border
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(cropX, cropY, cropW, cropH);
      ctx.setLineDash([]);
    } catch (err) {
      console.error('Render preview error:', err);
    }
  }, [currentPage, marginBottom, marginLeft, marginRight, marginTop, pdfDoc]);

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
    setCroppedBlob(null);
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

  // Execute Lossless PDF Crop via pdf-lib CropBox mutation
  const handleExecuteCrop = async () => {
    if (!file) return;
    setIsProcessing(true);
    setErrorMessage('');

    try {
      const buffer = await file.arrayBuffer();
      const loadedDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const pages = loadedDoc.getPages();

      // Determine which pages to crop
      let targetIndices = [];
      if (applyScope === 'all') {
        targetIndices = pages.map((_, idx) => idx);
      } else if (applyScope === 'current') {
        targetIndices = [currentPage - 1];
      } else if (applyScope === 'custom') {
        const parts = customRange.split(',').map((p) => p.trim());
        parts.forEach((part) => {
          if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            if (!isNaN(start) && !isNaN(end)) {
              for (let i = start; i <= end; i++) {
                if (i >= 1 && i <= pages.length) targetIndices.push(i - 1);
              }
            }
          } else {
            const num = Number(part);
            if (!isNaN(num) && num >= 1 && num <= pages.length) {
              targetIndices.push(num - 1);
            }
          }
        });
        targetIndices = [...new Set(targetIndices)];
      }

      targetIndices.forEach((idx) => {
        const page = pages[idx];
        const { width, height } = page.getSize();

        const x = (marginLeft / 100) * width;
        const y = (marginBottom / 100) * height;
        const w = width - x - ((marginRight / 100) * width);
        const h = height - y - ((marginTop / 100) * height);

        if (w > 10 && h > 10) {
          page.setCropBox(x, y, w, h);
          page.setMediaBox(x, y, w, h);
        }
      });

      const croppedBytes = await loadedDoc.save();
      const outBlob = new Blob([croppedBytes], { type: 'application/pdf' });
      setCroppedBlob(outBlob);
    } catch (err) {
      console.error('Crop error:', err);
      setErrorMessage(err.message || 'Failed to crop PDF document.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyPreset = (top, right, bottom, left) => {
    setMarginTop(top);
    setMarginRight(right);
    setMarginBottom(bottom);
    setMarginLeft(left);
  };

  const handleReset = () => {
    setFile(null);
    setCroppedBlob(null);
    setPdfDoc(null);
    setErrorMessage('');
  };

  // -------------------------------------------------------------
  // VIEW 3: COMPLETION VIEW
  // -------------------------------------------------------------
  if (croppedBlob && croppedUrl && file) {
    const outFileName = `${file.name.replace(/\.[^/.]+$/, '')}-cropped.pdf`;
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="Crop PDF"
          message="PDF cropped and trimmed successfully!"
          fileUrl={croppedUrl}
          fileName={outFileName}
          file={new File([croppedBlob], outFileName, { type: 'application/pdf' })}
          onReset={handleReset}
          onProcessSourceAgain={() => setCroppedBlob(null)}
          sourceActionLabel="Crop Source Again"
          onProcessTarget={() => {
            const chained = new File([croppedBlob], outFileName, { type: 'application/pdf' });
            setFile(chained);
            setCroppedBlob(null);
            loadPdf(chained);
          }}
          targetActionLabel="Use Cropped PDF"
          currentPath="/crop-pdf"
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
        title="Crop & Trim PDF Margins"
        description="Trim excess white margins or crop custom page regions losslessly without losing vector text quality."
        badge="Organize PDF"
        badgeIcon={FiCrop}
        toolPath="/crop-pdf"
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

  const controlsDesk = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem' }}>
      {/* Presets */}
      <div
        style={{
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '12px',
          padding: '1.25rem'
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.75rem' }}>
          Margin Trim Presets:
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {[
            { label: 'Standard (5%)', values: [5, 5, 5, 5] },
            { label: 'Moderate (10%)', values: [10, 10, 10, 10] },
            { label: 'Deep (15%)', values: [15, 15, 15, 15] },
            { label: 'Reset (0%)', values: [0, 0, 0, 0] }
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handleApplyPreset(...preset.values)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #334155)',
                background: 'var(--subtle-bg, #0f172a)',
                color: 'var(--text-color)',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'border-color 0.2s'
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Margin Sliders */}
      <div
        style={{
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '12px',
          padding: '1.25rem'
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-color)', display: 'block', marginBottom: '1rem' }}>
          Custom Margins (% of page):
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {[
            { label: 'Top Margin', value: marginTop, setter: setMarginTop },
            { label: 'Bottom Margin', value: marginBottom, setter: setMarginBottom },
            { label: 'Left Margin', value: marginLeft, setter: setMarginLeft },
            { label: 'Right Margin', value: marginRight, setter: setMarginRight }
          ].map((item) => (
            <div key={item.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem', color: 'var(--text-secondary, #94a3b8)' }}>
                <span>{item.label}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>{item.value}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                value={item.value}
                onChange={(e) => item.setter(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--primary-color, #6366f1)' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Scope Selection */}
      <div
        style={{
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '12px',
          padding: '1.25rem'
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.75rem' }}>
          Apply Crop Scope:
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', color: 'var(--text-color)', cursor: 'pointer' }}>
            <input
              type="radio"
              name="scope"
              value="all"
              checked={applyScope === 'all'}
              onChange={() => setApplyScope('all')}
            />
            <span>All Pages</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', color: 'var(--text-color)', cursor: 'pointer' }}>
            <input
              type="radio"
              name="scope"
              value="current"
              checked={applyScope === 'current'}
              onChange={() => setApplyScope('current')}
            />
            <span>Current Page Only (Page {currentPage})</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', color: 'var(--text-color)', cursor: 'pointer' }}>
            <input
              type="radio"
              name="scope"
              value="custom"
              checked={applyScope === 'custom'}
              onChange={() => setApplyScope('custom')}
            />
            <span>Custom Page Range</span>
          </label>
          {applyScope === 'custom' && (
            <input
              type="text"
              value={customRange}
              onChange={(e) => setCustomRange(e.target.value)}
              placeholder="e.g. 1-5, 8"
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #334155)',
                background: 'var(--subtle-bg, #0f172a)',
                color: 'var(--text-color)',
                fontSize: '0.88rem',
                marginTop: '0.35rem'
              }}
            />
          )}
        </div>
      </div>
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
        toolTitle="Crop PDF"
        fileBadge={`${file.name} (${formatFileSize(file.size)}${numPages > 0 ? ` • ${numPages} pgs` : ''})`}
        onBack={handleReset}
        backLabel="Choose Another File"
        primaryAction={{
          label: isProcessing ? 'Cropping...' : 'Apply Crop',
          icon: FiCrop,
          onClick: handleExecuteCrop,
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
          leftTitle="Crop Margins & Scope"
          rightTitle="Live Page Preview"
          storageKey="crop_pdf"
        />
      </div>
    </div>
  );
}
