import { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  FiColumns,
  FiEye,
  FiFileText,
  FiChevronLeft,
  FiChevronRight,
  FiCheckCircle,
} from 'react-icons/fi';
import AlertBanner from '../components/AlertBanner';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import { validatePdfFile } from '../utils/fileUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export default function ComparePdf() {
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [numPagesA, setNumPagesA] = useState(0);
  const [numPagesB, setNumPagesB] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Compare mode: 'visual' | 'split' | 'text'
  const [compareMode, setCompareMode] = useState('visual');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Loaded PDF document instances
  const [docA, setDocA] = useState(null);
  const [docB, setDocB] = useState(null);

  // Extracted text for text diff
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');
  const [diffStats, setDiffStats] = useState({ addedLines: 0, removedLines: 0, unchangedLines: 0 });

  const diffCanvasRef = useRef(null);
  const canvasARef = useRef(null);
  const canvasBRef = useRef(null);

  // Load PDF A
  const loadPdfA = async (selected) => {
    const val = validatePdfFile(selected);
    if (!val.valid) {
      setErrorMessage(val.error);
      return;
    }
    setFileA(selected);
    setErrorMessage('');
    try {
      const buffer = await selected.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        isEvalSupported: false,
      }).promise;
      setDocA(pdf);
      setNumPagesA(pdf.numPages);
    } catch (err) {
      setErrorMessage('Failed to load Document A: ' + err.message);
    }
  };

  // Load PDF B
  const loadPdfB = async (selected) => {
    const val = validatePdfFile(selected);
    if (!val.valid) {
      setErrorMessage(val.error);
      return;
    }
    setFileB(selected);
    setErrorMessage('');
    try {
      const buffer = await selected.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        isEvalSupported: false,
      }).promise;
      setDocB(pdf);
      setNumPagesB(pdf.numPages);
    } catch (err) {
      setErrorMessage('Failed to load Document B: ' + err.message);
    }
  };

  // Render Visual Comparison & Split View
  const renderComparison = useCallback(async () => {
    if (!docA || !docB) return;
    setIsProcessing(true);

    try {
      const pageNumA = Math.min(currentPage, numPagesA);
      const pageNumB = Math.min(currentPage, numPagesB);

      const pageA = await docA.getPage(pageNumA);
      const pageB = await docB.getPage(pageNumB);

      const scale = 1.3;
      const viewportA = pageA.getViewport({ scale });
      const viewportB = pageB.getViewport({ scale });

      const w = Math.max(viewportA.width, viewportB.width);
      const h = Math.max(viewportA.height, viewportB.height);

      // Render Page A offscreen
      const offA = document.createElement('canvas');
      offA.width = w;
      offA.height = h;
      const ctxA = offA.getContext('2d');
      ctxA.fillStyle = '#ffffff';
      ctxA.fillRect(0, 0, w, h);
      await pageA.render({ canvasContext: ctxA, viewport: viewportA }).promise;

      // Render Page B offscreen
      const offB = document.createElement('canvas');
      offB.width = w;
      offB.height = h;
      const ctxB = offB.getContext('2d');
      ctxB.fillStyle = '#ffffff';
      ctxB.fillRect(0, 0, w, h);
      await pageB.render({ canvasContext: ctxB, viewport: viewportB }).promise;

      // If Split View canvas refs exist, render to them
      if (canvasARef.current) {
        canvasARef.current.width = w;
        canvasARef.current.height = h;
        const cA = canvasARef.current.getContext('2d');
        cA.drawImage(offA, 0, 0);
      }
      if (canvasBRef.current) {
        canvasBRef.current.width = w;
        canvasBRef.current.height = h;
        const cB = canvasBRef.current.getContext('2d');
        cB.drawImage(offB, 0, 0);
      }

      // Compute Pixel Overlay Diff
      if (diffCanvasRef.current) {
        const diffCanvas = diffCanvasRef.current;
        diffCanvas.width = w;
        diffCanvas.height = h;
        const diffCtx = diffCanvas.getContext('2d');

        const imgDataA = ctxA.getImageData(0, 0, w, h);
        const imgDataB = ctxB.getImageData(0, 0, w, h);
        const diffData = diffCtx.createImageData(w, h);

        const dataA = imgDataA.data;
        const dataB = imgDataB.data;
        const out = diffData.data;

        for (let i = 0; i < dataA.length; i += 4) {
          const lumA = 0.299 * dataA[i] + 0.587 * dataA[i + 1] + 0.114 * dataA[i + 2];
          const lumB = 0.299 * dataB[i] + 0.587 * dataB[i + 1] + 0.114 * dataB[i + 2];
          const diff = Math.abs(lumA - lumB);

          if (diff > 25) {
            if (lumA < lumB) {
              // Deleted in B (present in A): Highlight Red
              out[i] = 255;
              out[i + 1] = 60;
              out[i + 2] = 60;
              out[i + 3] = 255;
            } else {
              // Added in B (absent in A): Highlight Emerald Green
              out[i] = 46;
              out[i + 1] = 213;
              out[i + 2] = 115;
              out[i + 3] = 255;
            }
          } else {
            // Unchanged: Faded grayscale
            const faded = Math.round(lumA * 0.5 + 110);
            out[i] = faded;
            out[i + 1] = faded;
            out[i + 2] = faded;
            out[i + 3] = 255;
          }
        }

        diffCtx.putImageData(diffData, 0, 0);
      }

      // Extract text for text diff if not done for this page
      const contentA = await pageA.getTextContent();
      const contentB = await pageB.getTextContent();
      const rawA = contentA.items.map((it) => it.str).join(' ');
      const rawB = contentB.items.map((it) => it.str).join(' ');
      setTextA(rawA);
      setTextB(rawB);

      // Compute simple word diff stats
      const wordsA = new Set(rawA.split(/\s+/));
      const wordsB = new Set(rawB.split(/\s+/));
      let added = 0;
      let removed = 0;
      wordsB.forEach((w) => { if (!wordsA.has(w)) added++; });
      wordsA.forEach((w) => { if (!wordsB.has(w)) removed++; });
      setDiffStats({ addedLines: added, removedLines: removed, unchangedLines: wordsA.size });

    } catch (err) {
      console.error('Diff render error:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [currentPage, docA, docB, numPagesA, numPagesB]);

  useEffect(() => {
    let active = true;
    if (docA && docB) {
      const timer = setTimeout(() => {
        if (active) {
          renderComparison();
        }
      }, 50);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [docA, docB, compareMode, currentPage, renderComparison]);

  const maxPages = Math.max(numPagesA, numPagesB) || 1;

  const handleReset = () => {
    setFileA(null);
    setFileB(null);
    setDocA(null);
    setDocB(null);
    setErrorMessage('');
    setCurrentPage(1);
  };

  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    const fileList = Array.isArray(files) ? files : Array.from(files);
    if (fileList.length >= 2) {
      loadPdfA(fileList[0]);
      loadPdfB(fileList[1]);
    } else if (fileList.length === 1) {
      if (!fileA) {
        loadPdfA(fileList[0]);
      } else {
        loadPdfB(fileList[0]);
      }
    }
  };

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Upload stage)
  // -------------------------------------------------------------
  if (!fileA || !fileB) {
    return (
      <ToolHeroView
        title="Compare & Diff PDF Documents"
        description="Side-by-side synchronized review, visual pixel diff overlay, and text comparison between two PDF revisions."
        badge="View PDF"
        badgeIcon={FiColumns}
        toolPath="/compare-pdf"
        acceptedFormats={['Two PDF files (.pdf)']}
        accept={{ 'application/pdf': ['.pdf'] }}
        allowMultiple={true}
        onFilesSelected={handleFiles}
        alerts={
          <div>
            {errorMessage && (
              <div style={{ marginBottom: '0.75rem' }}>
                <AlertBanner
                  message={errorMessage}
                  type="error"
                  onClose={() => setErrorMessage('')}
                />
              </div>
            )}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '0.75rem',
                margin: '0 auto 0.75rem auto',
                maxWidth: '600px',
              }}
            >
              {/* Document A Status Card */}
              <div
                style={{
                  background: 'var(--card-bg)',
                  border: `2px solid ${fileA ? '#10b981' : 'var(--border-color)'}`,
                  borderRadius: '10px',
                  padding: '0.65rem 0.85rem',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                  Document A (Original)
                </span>
                {fileA ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#10b981', fontWeight: 700, fontSize: '0.88rem' }}>
                    <FiCheckCircle size={16} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{fileA.name}</span>
                  </div>
                ) : (
                  <label style={{ cursor: 'pointer', fontSize: '0.84rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                    Select Document A
                    <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && loadPdfA(e.target.files[0])} />
                  </label>
                )}
              </div>

              {/* Document B Status Card */}
              <div
                style={{
                  background: 'var(--card-bg)',
                  border: `2px solid ${fileB ? '#10b981' : 'var(--border-color)'}`,
                  borderRadius: '10px',
                  padding: '0.65rem 0.85rem',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                  Document B (Revision)
                </span>
                {fileB ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#10b981', fontWeight: 700, fontSize: '0.88rem' }}>
                    <FiCheckCircle size={16} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{fileB.name}</span>
                  </div>
                ) : (
                  <label style={{ cursor: 'pointer', fontSize: '0.84rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                    Select Document B
                    <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && loadPdfB(e.target.files[0])} />
                  </label>
                )}
              </div>
            </div>
          </div>
        }
      />
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: ACTIVE STUDIO VIEW
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
      {/* Studio Header */}
      <ToolStudioHeader
        title="Compare & Diff PDF Documents"
        icon={FiColumns}
        category="View PDF"
        fileBadge="2 Revisions"
        toolPath="/compare-pdf"
        onReset={handleReset}
        resetLabel="New Comparison"
        actionsSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* View Mode Switcher */}
            <div style={{ display: 'flex', background: 'var(--subtle-bg)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={() => setCompareMode('visual')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: compareMode === 'visual' ? 'var(--primary-color)' : 'transparent',
                  color: compareMode === 'visual' ? '#fff' : 'var(--text-color)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                <FiEye size={13} /> Visual Diff
              </button>
              <button
                type="button"
                onClick={() => setCompareMode('split')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: compareMode === 'split' ? 'var(--primary-color)' : 'transparent',
                  color: compareMode === 'split' ? '#fff' : 'var(--text-color)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                <FiColumns size={13} /> Side-by-Side
              </button>
              <button
                type="button"
                onClick={() => setCompareMode('text')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: compareMode === 'text' ? 'var(--primary-color)' : 'transparent',
                  color: compareMode === 'text' ? '#fff' : 'var(--text-color)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                <FiFileText size={13} /> Text Diff
              </button>
            </div>

            {/* Pagination Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--subtle-bg)', padding: '0.2rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || isProcessing}
                style={{ border: 'none', background: 'transparent', color: 'var(--text-color)', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', padding: '0.2rem' }}
              >
                <FiChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-color)', minWidth: '95px', textAlign: 'center' }}>
                {isProcessing ? 'Comparing...' : `Page ${currentPage} of ${maxPages}`}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(maxPages, p + 1))}
                disabled={currentPage >= maxPages || isProcessing}
                style={{ border: 'none', background: 'transparent', color: 'var(--text-color)', cursor: currentPage >= maxPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', padding: '0.2rem' }}
              >
                <FiChevronRight size={16} />
              </button>
            </div>
          </div>
        }
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

      {/* Main Studio Body */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem',
          boxSizing: 'border-box',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Mode 1: Visual Overlay Diff */}
        {compareMode === 'visual' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, alignItems: 'center' }}>
            {/* Legend */}
            <div style={{ display: 'inline-flex', gap: '1.25rem', background: 'var(--subtle-bg)', padding: '0.4rem 1rem', borderRadius: '20px', border: '1px solid var(--border-color)', marginBottom: '0.85rem', fontSize: '0.82rem', flexShrink: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#2ed573', fontWeight: 700 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ed573' }} /> Added Content (Green)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ff4757', fontWeight: 700 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff4757' }} /> Removed Content (Red)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#888' }} /> Unchanged (Gray)
              </span>
            </div>

            <div style={{ flex: 1, width: '100%', minHeight: 0, overflow: 'auto', background: 'var(--subtle-bg)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <canvas ref={diffCanvasRef} style={{ maxWidth: '100%', maxHeight: '100%', height: 'auto', borderRadius: '6px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }} />
            </div>
          </div>
        )}

        {/* Mode 2: Side-by-Side Synchronized View */}
        {compareMode === 'split' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', height: '100%', minHeight: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--subtle-bg)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.5rem', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Document A: {fileA.name}
              </span>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <canvas ref={canvasARef} style={{ maxWidth: '100%', maxHeight: '100%', height: 'auto', borderRadius: '6px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--subtle-bg)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.5rem', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Document B: {fileB.name}
              </span>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <canvas ref={canvasBRef} style={{ maxWidth: '100%', height: 'auto', borderRadius: '6px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }} />
              </div>
            </div>
          </div>
        )}

        {/* Mode 3: Text Difference View */}
        {compareMode === 'text' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexShrink: 0 }}>
              <span style={{ fontSize: '0.82rem', padding: '0.25rem 0.6rem', borderRadius: '6px', background: 'rgba(46, 213, 115, 0.12)', color: '#2ed573', fontWeight: 600 }}>
                +{diffStats.addedLines} Added Terms
              </span>
              <span style={{ fontSize: '0.82rem', padding: '0.25rem 0.6rem', borderRadius: '6px', background: 'rgba(255, 71, 87, 0.12)', color: '#ff4757', fontWeight: 600 }}>
                -{diffStats.removedLines} Removed Terms
              </span>
            </div>

            <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--subtle-bg)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.4rem', flexShrink: 0 }}>
                  Document A Text:
                </span>
                <pre style={{ flex: 1, minHeight: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 1.55, color: 'var(--text-color)', margin: 0, overflowY: 'auto' }}>
                  {textA || '[No text extracted on this page]'}
                </pre>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--subtle-bg)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.4rem', flexShrink: 0 }}>
                  Document B Text:
                </span>
                <pre style={{ flex: 1, minHeight: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 1.55, color: 'var(--text-color)', margin: 0, overflowY: 'auto' }}>
                  {textB || '[No text extracted on this page]'}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
