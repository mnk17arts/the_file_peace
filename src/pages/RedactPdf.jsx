import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, PDFName } from 'pdf-lib';
import {
  FiShield,
  FiChevronLeft,
  FiChevronRight,
  FiSearch,
  FiTrash2,
  FiLock
} from 'react-icons/fi';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import { ToolHeroView, ToolStudioHeader, ResizableSplitPane } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { formatFileSize, validatePdfFile } from '../utils/fileUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const PATTERNS = [
  { id: 'ssn', label: 'SSN (XXX-XX-XXXX)', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { id: 'email', label: 'Email Addresses', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
  { id: 'phone', label: 'Phone Numbers', regex: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  { id: 'creditcard', label: 'Credit Cards', regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g },
];

export default function RedactPdf() {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Redaction boxes by page: { [pageNum]: [ { x: 0..1, y: 0..1, w: 0..1, h: 0..1 } ] }
  const [redactions, setRedactions] = useState({});

  // Search text
  const [searchText, setSearchText] = useState('');

  // Mouse drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragCurrent, setDragCurrent] = useState(null);

  // Result state
  const [redactedBlob, setRedactedBlob] = useState(null);

  const canvasRef = useRef(null);
  const handledIncomingRef = useRef(false);

  const redactedUrl = useMemo(() => {
    return redactedBlob ? URL.createObjectURL(redactedBlob) : null;
  }, [redactedBlob]);

  useEffect(() => {
    return () => {
      if (redactedUrl) URL.revokeObjectURL(redactedUrl);
    };
  }, [redactedUrl]);

  // Render current page with redaction boxes overlay
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;
    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: ctx,
        viewport: viewport,
      }).promise;

      // Draw active redactions for current page
      const pageRedactions = redactions[currentPage] || [];
      pageRedactions.forEach((box) => {
        const bx = box.x * viewport.width;
        const by = box.y * viewport.height;
        const bw = box.w * viewport.width;
        const bh = box.h * viewport.height;

        // Draw solid blackout box
        ctx.fillStyle = '#000000';
        ctx.fillRect(bx, by, bw, bh);

        // Draw redaction label if large enough
        if (bw > 40 && bh > 14) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.fillText('REDACTED', bx + 4, by + Math.min(bh - 3, 11));
        }
      });

      // Draw active drag box preview
      if (isDragging && dragCurrent) {
        const sx = Math.min(dragStart.x, dragCurrent.x) * viewport.width;
        const sy = Math.min(dragStart.y, dragCurrent.y) * viewport.height;
        const sw = Math.abs(dragCurrent.x - dragStart.x) * viewport.width;
        const sh = Math.abs(dragCurrent.y - dragStart.y) * viewport.height;

        ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
        ctx.fillRect(sx, sy, sw, sh);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx, sy, sw, sh);
      }
    } catch (err) {
      console.error('Render page error:', err);
    }
  }, [currentPage, dragCurrent, dragStart, isDragging, pdfDoc, redactions]);

  useEffect(() => {
    let active = true;
    if (pdfDoc) {
      const timer = setTimeout(() => {
        if (active) renderPage();
      }, 30);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [currentPage, pdfDoc, redactions, isDragging, dragCurrent, renderPage]);

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
      setRedactions({});
    } catch (err) {
      console.error('Load PDF error:', err);
      setErrorMessage(err.message || 'Failed to load PDF document.');
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
    setRedactedBlob(null);
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

  // Pointer Handlers for Manual Redaction Area Drag
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handlePointerDown = (e) => {
    const coords = getCanvasCoords(e);
    setIsDragging(true);
    setDragStart(coords);
    setDragCurrent(coords);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const coords = getCanvasCoords(e);
    setDragCurrent(coords);
  };

  const handlePointerUp = () => {
    if (!isDragging || !dragCurrent) return;
    setIsDragging(false);

    const x = Math.min(dragStart.x, dragCurrent.x);
    const y = Math.min(dragStart.y, dragCurrent.y);
    const w = Math.abs(dragCurrent.x - dragStart.x);
    const h = Math.abs(dragCurrent.y - dragStart.y);

    if (w > 0.005 && h > 0.005) {
      setRedactions((prev) => {
        const curList = prev[currentPage] || [];
        return {
          ...prev,
          [currentPage]: [...curList, { x, y, w, h }],
        };
      });
    }
    setDragCurrent(null);
  };

  // Search & Auto-Find Redaction Patterns
  const handleFindAndMark = async (searchPattern, isRegex = false) => {
    if (!pdfDoc) return;
    setIsProcessing(true);
    setStatusMsg('Scanning document text...');
    let totalMatches = 0;
    const newRedactions = { ...redactions };

    try {
      for (let p = 1; p <= numPages; p++) {
        const page = await pdfDoc.getPage(p);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });

        textContent.items.forEach((item) => {
          const str = item.str || '';
          const hasMatch = isRegex
            ? new RegExp(searchPattern).test(str)
            : str.toLowerCase().includes(searchPattern.toLowerCase());

          if (hasMatch) {
            totalMatches++;
            const tx = item.transform[4];
            const ty = item.transform[5];
            const width = item.width || 30;
            const height = item.height || 12;

            const normX = Math.max(0, tx / viewport.width);
            const normY = Math.max(0, (viewport.height - ty - height) / viewport.height);
            const normW = Math.min(1 - normX, (width + 4) / viewport.width);
            const normH = Math.min(1 - normY, (height + 4) / viewport.height);

            const curList = newRedactions[p] || [];
            newRedactions[p] = [...curList, { x: normX, y: normY, w: normW, h: normH }];
          }
        });
      }

      setRedactions(newRedactions);
      setStatusMsg(`Found and marked ${totalMatches} instances across document.`);
      setTimeout(() => setStatusMsg(''), 4000);
    } catch (err) {
      console.error('Search text error:', err);
      setErrorMessage('Failed to search text.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearCurrentPage = () => {
    setRedactions((prev) => {
      const next = { ...prev };
      delete next[currentPage];
      return next;
    });
  };

  const handleClearAll = () => {
    setRedactions({});
  };

  // Execute True Destructive Redaction
  const handleApplyRedaction = async () => {
    if (!file || !pdfDoc || isProcessing) return;
    setIsProcessing(true);
    setErrorMessage('');
    setStatusMsg('Applying permanent destructive redactions...');

    try {
      const originalBytes = await file.arrayBuffer();
      const destPdf = await PDFDocument.create();
      const srcPdf = await PDFDocument.load(originalBytes, { ignoreEncryption: true, updateMetadata: false });

      const destInfo = destPdf.getInfoDict();
      if (destInfo && typeof destInfo.delete === 'function') {
        destInfo.delete(PDFName.of('Producer'));
        destInfo.delete(PDFName.of('Creator'));
      }

      const totalCount = Object.values(redactions).reduce((acc, list) => acc + list.length, 0);
      if (totalCount === 0) {
        setErrorMessage('Please mark at least one area or text pattern for redaction.');
        setIsProcessing(false);
        return;
      }

      for (let p = 1; p <= numPages; p++) {
        const pageRedactions = redactions[p] || [];

        if (pageRedactions.length === 0) {
          const [copiedPage] = await destPdf.copyPages(srcPdf, [p - 1]);
          destPdf.addPage(copiedPage);
        } else {
          const page = await pdfDoc.getPage(p);
          const viewport = page.getViewport({ scale: 2.5 });

          const offCanvas = document.createElement('canvas');
          offCanvas.width = viewport.width;
          offCanvas.height = viewport.height;
          const offCtx = offCanvas.getContext('2d');

          await page.render({
            canvasContext: offCtx,
            viewport: viewport,
          }).promise;

          offCtx.fillStyle = '#000000';
          pageRedactions.forEach((box) => {
            const bx = box.x * viewport.width;
            const by = box.y * viewport.height;
            const bw = box.w * viewport.width;
            const bh = box.h * viewport.height;
            offCtx.fillRect(bx, by, bw, bh);
          });

          const imgBlob = await new Promise((res) => offCanvas.toBlob(res, 'image/png'));
          const imgBuffer = await imgBlob.arrayBuffer();
          const embeddedImg = await destPdf.embedPng(imgBuffer);

          const origPage = srcPdf.getPage(p - 1);
          const { width: origW, height: origH } = origPage.getSize();
          const newPage = destPdf.addPage([origW, origH]);
          newPage.drawImage(embeddedImg, {
            x: 0,
            y: 0,
            width: origW,
            height: origH,
          });
        }
      }

      const outBytes = await destPdf.save({ updateMetadata: false });
      const outBlob = new Blob([outBytes], { type: 'application/pdf' });
      setRedactedBlob(outBlob);
    } catch (err) {
      console.error('Redaction error:', err);
      setErrorMessage(err.message || 'Failed to redact PDF document.');
    } finally {
      setIsProcessing(false);
      setStatusMsg('');
    }
  };

  const handleReset = () => {
    setFile(null);
    setPdfDoc(null);
    setRedactedBlob(null);
    setRedactions({});
    setErrorMessage('');
    setStatusMsg('');
  };

  const totalMarkedCount = Object.values(redactions).reduce((acc, list) => acc + list.length, 0);

  // -------------------------------------------------------------
  // VIEW 3: COMPLETION VIEW
  // -------------------------------------------------------------
  if (redactedBlob && redactedUrl && file) {
    const outFileName = `${file.name.replace(/\.[^/.]+$/, '')}-redacted.pdf`;
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="Redact PDF"
          message="PDF successfully redacted! Sensitive data destroyed permanently."
          fileUrl={redactedUrl}
          fileName={outFileName}
          file={new File([redactedBlob], outFileName, { type: 'application/pdf' })}
          onReset={handleReset}
          onProcessSourceAgain={() => setRedactedBlob(null)}
          sourceActionLabel="Redact Source Again"
          onProcessTarget={() => {
            const chained = new File([redactedBlob], outFileName, { type: 'application/pdf' });
            setFile(chained);
            setRedactedBlob(null);
            loadPdf(chained);
          }}
          targetActionLabel="Use Redacted PDF"
          currentPath="/redact-pdf"
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
        title="Redact PDF & Blackout Data"
        description="Permanently destroy confidential text, SSNs, credit cards, and sensitive boxes 100% offline in your browser."
        badge="PDF Security"
        badgeIcon={FiShield}
        toolPath="/redact-pdf"
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
      {/* Pattern Finder */}
      <div
        style={{
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '16px',
          padding: '1.25rem'
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.75rem' }}>
          Auto-Find & Mark Sensitive Patterns:
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
          {PATTERNS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleFindAndMark(p.regex, true)}
              disabled={isProcessing}
              style={{
                padding: '0.55rem 0.5rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #334155)',
                background: 'var(--subtle-bg, #0f172a)',
                color: 'var(--text-color)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                textAlign: 'left'
              }}
            >
              🛡️ {p.label}
            </button>
          ))}
        </div>

        {/* Keyword Search */}
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', display: 'block', marginBottom: '0.35rem' }}>
          Search Specific Keyword:
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="e.g. Confidential, John Doe..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchText.trim()) handleFindAndMark(searchText.trim(), false);
            }}
            style={{
              flex: 1,
              padding: '0.55rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #334155)',
              background: 'var(--subtle-bg, #0f172a)',
              color: 'var(--text-color)',
              fontSize: '0.88rem'
            }}
          />
          <button
            type="button"
            onClick={() => searchText.trim() && handleFindAndMark(searchText.trim(), false)}
            disabled={isProcessing || !searchText.trim()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.55rem 0.85rem',
              borderRadius: '8px',
              background: 'var(--primary-color, #6366f1)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              cursor: !searchText.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            <FiSearch /> Find
          </button>
        </div>
      </div>

      {/* Redaction Status & Clear Options */}
      <div
        style={{
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '16px',
          padding: '1.25rem'
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.5rem' }}>
          Marked Redactions ({totalMarkedCount} total):
        </span>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.45, marginBottom: '0.75rem' }}>
          Current Page has <strong>{(redactions[currentPage] || []).length}</strong> blackout box(es). Drag anywhere on the page to blackout custom areas.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={handleClearCurrentPage}
            disabled={(redactions[currentPage] || []).length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #334155)',
              background: 'var(--subtle-bg, #0f172a)',
              color: (redactions[currentPage] || []).length === 0 ? 'var(--text-secondary, #94a3b8)' : '#ef4444',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: (redactions[currentPage] || []).length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <FiTrash2 /> Clear Page
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={totalMarkedCount === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #334155)',
              background: 'var(--subtle-bg, #0f172a)',
              color: totalMarkedCount === 0 ? 'var(--text-secondary, #94a3b8)' : '#ef4444',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: totalMarkedCount === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <FiTrash2 /> Clear All ({totalMarkedCount})
          </button>
        </div>
      </div>

      {/* True Redaction Guarantee */}
      <div
        style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          padding: '1rem',
          borderRadius: '12px'
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
          <FiShield /> True Vector Destruction
        </span>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', margin: 0, lineHeight: 1.4 }}>
          Unlike simple PDF annotators that just draw a black box over selectable text, The File Peace flattens and destroys underlying text streams so sensitive data cannot be searched or recovered.
        </p>
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
      {/* Pagination */}
      {numPages > 1 && (
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
      )}

      {/* Canvas with Pointer Events */}
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
          alignItems: 'center',
          touchAction: 'none'
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            maxWidth: '100%',
            height: 'auto',
            borderRadius: '4px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            cursor: 'crosshair',
            display: 'block'
          }}
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
        toolTitle="Redact PDF"
        fileBadge={`${file.name} (${formatFileSize(file.size)}${numPages > 0 ? ` • ${numPages} pgs` : ''})`}
        onBack={handleReset}
        backLabel="Choose Another File"
        primaryAction={{
          label: isProcessing
            ? 'Applying Redaction...'
            : `Apply Redaction (${totalMarkedCount})`,
          icon: FiLock,
          onClick: handleApplyRedaction,
          disabled: isProcessing || totalMarkedCount === 0,
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

      {statusMsg && (
        <div
          style={{
            maxWidth: '1240px',
            margin: '0 auto 0.5rem auto',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid var(--primary-color, #6366f1)',
            color: 'var(--primary-color, #6366f1)',
            padding: '0.5rem 1rem',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '0.85rem',
            textAlign: 'center'
          }}
        >
          {statusMsg}
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
          leftTitle="Redaction Tools"
          rightTitle="Document Redaction Canvas"
          storageKey="redact_pdf"
        />
      </div>
    </div>
  );
}
