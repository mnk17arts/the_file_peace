import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import {
  FiEdit3,
  FiType,
  FiSquare,
  FiCircle,
  FiArrowUpRight,
  FiTrash2,
  FiRotateCcw,
  FiRotateCw,
  FiZoomIn,
  FiZoomOut,
  FiDownload,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiMove,
  FiX,
  FiFolder,
  FiMaximize2,
  FiMinimize2,
  FiBookOpen,
  FiPenTool,
} from 'react-icons/fi';
import { ToolHeroView } from '../components/studio';
import ActionCompleted from '../components/ActionCompleted';
import Loader from '../components/Loader';
import AlertBanner from '../components/AlertBanner';
import PdfAnnotationCanvas from '../components/PdfAnnotationCanvas';
import { consumeTransferredFile } from '../utils/fileTransfer';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const COLOR_PRESETS = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#10b981' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Black', hex: '#1e293b' },
  { name: 'White', hex: '#ffffff' },
];

const STROKE_WIDTHS = [
  { label: 'Thin', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Thick', value: 8 },
  { label: 'Extra', value: 14 },
];

const FONT_SIZES = [
  { label: 'Small', value: 14 },
  { label: 'Medium', value: 18 },
  { label: 'Large', value: 26 },
  { label: 'XL', value: 36 },
];

export default function EditPdf() {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageScale, setPageScale] = useState(1.1);
  const [pageDimensions, setPageDimensions] = useState({ width: 600, height: 800 });
  const [pageThumbnails, setPageThumbnails] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Annotation Tool State
  const [activeTool, setActiveTool] = useState('pen'); // 'select' | 'pen' | 'highlighter' | 'text' | 'rectangle' | 'circle' | 'arrow' | 'eraser'
  const [strokeColor, setStrokeColor] = useState('#ef4444');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [fontSize, setFontSize] = useState(18);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null);

  // Annotations by Page: { [pageNum]: [annotations...] }
  const [annotationsByPage, setAnnotationsByPage] = useState({});
  // Undo/Redo History Stacks per page
  const [undoStackByPage, setUndoStackByPage] = useState({});
  const [redoStackByPage, setRedoStackByPage] = useState({});

  // Status & Completion
  const [isLoading, setIsLoading] = useState(false);
  const [loaderMessage, setLoaderMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [processedPdf, setProcessedPdf] = useState(null);

  const bgCanvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const containerRef = useRef(null);
  const workspaceRef = useRef(null);
  const fileInputRef = useRef(null);
  const handledIncomingRef = useRef(false);

  // Generate lightweight thumbnails for page sidebar
  const generateThumbnails = useCallback(async (doc) => {
    const thumbs = [];
    for (let i = 1; i <= Math.min(doc.numPages, 30); i++) {
      try {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 0.2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        thumbs.push({ pageNum: i, dataUrl: canvas.toDataURL('image/jpeg', 0.6) });
      } catch (e) {
        console.warn('Thumbnail render warning:', e);
      }
    }
    setPageThumbnails(thumbs);
  }, []);

  // Render current PDF page onto background canvas
  const renderCurrentPage = useCallback(async (doc, pageNum, scale) => {
    if (!doc || !bgCanvasRef.current) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = bgCanvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      setPageDimensions({ width: viewport.width, height: viewport.height });

      const renderContext = {
        canvasContext: ctx,
        viewport,
      };

      const task = page.render(renderContext);
      renderTaskRef.current = task;
      await task.promise;
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('Page render error:', err);
      }
    }
  }, []);

  // Render PDF page whenever pdfDoc, currentPage, or pageScale changes and canvas is mounted
  useEffect(() => {
    if (pdfDoc && bgCanvasRef.current) {
      renderCurrentPage(pdfDoc, currentPage, pageScale);
    }
  }, [pdfDoc, currentPage, pageScale, renderCurrentPage]);

  const handleFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    const selectedFile = files[0];
    if (!selectedFile.name.toLowerCase().endsWith('.pdf') && selectedFile.type !== 'application/pdf') {
      setErrorMessage('Please upload a valid PDF document.');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);
    setLoaderMessage('Loading PDF document...');

    try {
      const buffer = await selectedFile.arrayBuffer();
      const loadedPdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

      setFile(selectedFile);
      setPdfDoc(loadedPdf);
      setNumPages(loadedPdf.numPages);
      setCurrentPage(1);
      setAnnotationsByPage({});
      setUndoStackByPage({});
      setRedoStackByPage({});

      // Generate thumbnails for sidebar
      generateThumbnails(loadedPdf);
    } catch (err) {
      console.error('Error loading PDF:', err);
      setErrorMessage('Failed to load PDF file. The file may be password protected or corrupted.');
    } finally {
      setIsLoading(false);
    }
  }, [generateThumbnails]);

  // Handle incoming file transfer or initial upload
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

  const changePage = (newPage) => {
    if (newPage < 1 || newPage > numPages || newPage === currentPage) return;
    setCurrentPage(newPage);
    setSelectedAnnotationId(null);
  };

  const changeScale = (newScale) => {
    const clamped = Math.max(0.5, Math.min(2.5, Math.round(newScale * 10) / 10));
    setPageScale(clamped);
  };

  const handleFitWidth = useCallback(() => {
    if (!containerRef.current || !pageDimensions.width) return;
    const availableWidth = containerRef.current.clientWidth - 80;
    const baseWidth = pageDimensions.width / pageScale;
    const targetScale = Math.max(0.6, Math.min(2.0, Math.round((availableWidth / baseWidth) * 10) / 10));
    setPageScale(targetScale);
  }, [pageDimensions.width, pageScale]);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      if (workspaceRef.current?.requestFullscreen) {
        workspaceRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  // Sync fullscreen state with native browser fullscreen changes
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is currently typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen]);

  // Update annotations on current page with undo tracking
  const handleAnnotationsChange = (newAnnotations) => {
    const currentList = annotationsByPage[currentPage] || [];
    setUndoStackByPage((prev) => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] || []), currentList],
    }));
    setRedoStackByPage((prev) => ({
      ...prev,
      [currentPage]: [],
    }));
    setAnnotationsByPage((prev) => ({
      ...prev,
      [currentPage]: newAnnotations,
    }));
  };

  const handleUndo = () => {
    const stack = undoStackByPage[currentPage] || [];
    if (stack.length === 0) return;

    const previousState = stack[stack.length - 1];
    const newStack = stack.slice(0, -1);
    const currentState = annotationsByPage[currentPage] || [];

    setRedoStackByPage((prev) => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] || []), currentState],
    }));
    setUndoStackByPage((prev) => ({
      ...prev,
      [currentPage]: newStack,
    }));
    setAnnotationsByPage((prev) => ({
      ...prev,
      [currentPage]: previousState,
    }));
    setSelectedAnnotationId(null);
  };

  const handleRedo = () => {
    const stack = redoStackByPage[currentPage] || [];
    if (stack.length === 0) return;

    const nextState = stack[stack.length - 1];
    const newStack = stack.slice(0, -1);
    const currentState = annotationsByPage[currentPage] || [];

    setUndoStackByPage((prev) => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] || []), currentState],
    }));
    setRedoStackByPage((prev) => ({
      ...prev,
      [currentPage]: newStack,
    }));
    setAnnotationsByPage((prev) => ({
      ...prev,
      [currentPage]: nextState,
    }));
  };

  const handleDeleteSelected = () => {
    if (!selectedAnnotationId) return;
    const currentList = annotationsByPage[currentPage] || [];
    handleAnnotationsChange(currentList.filter((a) => a.id !== selectedAnnotationId));
    setSelectedAnnotationId(null);
  };

  const handleClearCurrentPage = () => {
    const currentList = annotationsByPage[currentPage] || [];
    if (currentList.length === 0) return;
    if (window.confirm('Clear all annotations on this page?')) {
      handleAnnotationsChange([]);
      setSelectedAnnotationId(null);
    }
  };

  // Export Flattened PDF with Annotations Baked In
  const handleExportPdf = async () => {
    if (!file) return;

    setIsLoading(true);
    setLoaderMessage('Baking annotations and exporting PDF...');

    try {
      const originalBytes = await file.arrayBuffer();
      const pdfLibDoc = await PDFDocument.load(originalBytes);
      const totalPagesInDoc = pdfLibDoc.getPageCount();

      // For every page that has annotations, create a high-res raster overlay and bake it
      for (let pageIdx = 0; pageIdx < totalPagesInDoc; pageIdx++) {
        const pageNum = pageIdx + 1;
        const pageAnnotations = annotationsByPage[pageNum] || [];
        if (pageAnnotations.length === 0) continue;

        const targetPage = pdfLibDoc.getPage(pageIdx);
        const { width: targetWidth, height: targetHeight } = targetPage.getSize();

        // Render annotations onto a high-DPI offscreen canvas at exact target page size
        const renderScale = 2.0; // 2x high-resolution rasterization for razor-sharp vector output
        const offCanvas = document.createElement('canvas');
        offCanvas.width = targetWidth * renderScale;
        offCanvas.height = targetHeight * renderScale;
        const offCtx = offCanvas.getContext('2d');
        offCtx.scale(renderScale, renderScale);

        const canvasW = targetWidth;
        const canvasH = targetHeight;

        // Draw each annotation
        pageAnnotations.forEach((ann) => {
          offCtx.save();
          if (ann.type === 'pen' || ann.type === 'highlighter') {
            if (ann.points && ann.points.length > 0) {
              offCtx.beginPath();
              offCtx.strokeStyle = ann.color;
              offCtx.lineCap = 'round';
              offCtx.lineJoin = 'round';

              if (ann.type === 'highlighter') {
                offCtx.globalAlpha = 0.45;
                offCtx.lineWidth = Math.max(12, (ann.strokeWidth || 14) * (canvasW / 800));
              } else {
                offCtx.globalAlpha = ann.opacity || 1;
                offCtx.lineWidth = (ann.strokeWidth || 3) * (canvasW / 800);
              }

              offCtx.moveTo(ann.points[0].x * canvasW, ann.points[0].y * canvasH);
              for (let i = 1; i < ann.points.length; i++) {
                offCtx.lineTo(ann.points[i].x * canvasW, ann.points[i].y * canvasH);
              }
              offCtx.stroke();
            }
          } else if (ann.type === 'rectangle') {
            const rx = ann.x * canvasW;
            const ry = ann.y * canvasH;
            const rw = ann.w * canvasW;
            const rh = ann.h * canvasH;

            offCtx.strokeStyle = ann.color;
            offCtx.lineWidth = (ann.strokeWidth || 3) * (canvasW / 800);
            offCtx.globalAlpha = ann.opacity || 1;
            if (ann.fill && ann.fill !== 'transparent') {
              offCtx.fillStyle = ann.fill;
              offCtx.fillRect(rx, ry, rw, rh);
            }
            offCtx.strokeRect(rx, ry, rw, rh);
          } else if (ann.type === 'circle') {
            const cx = (ann.x + ann.w / 2) * canvasW;
            const cy = (ann.y + ann.h / 2) * canvasH;
            const rx = Math.abs((ann.w / 2) * canvasW);
            const ry = Math.abs((ann.h / 2) * canvasH);

            offCtx.strokeStyle = ann.color;
            offCtx.lineWidth = (ann.strokeWidth || 3) * (canvasW / 800);
            offCtx.globalAlpha = ann.opacity || 1;
            offCtx.beginPath();
            offCtx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, 2 * Math.PI);
            if (ann.fill && ann.fill !== 'transparent') {
              offCtx.fillStyle = ann.fill;
              offCtx.fill();
            }
            offCtx.stroke();
          } else if (ann.type === 'arrow') {
            const x1 = ann.x1 * canvasW;
            const y1 = ann.y1 * canvasH;
            const x2 = ann.x2 * canvasW;
            const y2 = ann.y2 * canvasH;
            const sw = (ann.strokeWidth || 3) * (canvasW / 800);

            offCtx.strokeStyle = ann.color;
            offCtx.fillStyle = ann.color;
            offCtx.lineWidth = sw;
            offCtx.globalAlpha = ann.opacity || 1;

            offCtx.beginPath();
            offCtx.moveTo(x1, y1);
            offCtx.lineTo(x2, y2);
            offCtx.stroke();

            const angle = Math.atan2(y2 - y1, x2 - x1);
            const headLength = Math.max(12, sw * 3.5);
            offCtx.beginPath();
            offCtx.moveTo(x2, y2);
            offCtx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
            offCtx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
            offCtx.closePath();
            offCtx.fill();
          } else if (ann.type === 'text') {
            const tx = ann.x * canvasW;
            const ty = ann.y * canvasH;
            const calculatedFontSize = Math.max(10, (ann.fontSize || 18) * (canvasW / 800));

            offCtx.font = `${calculatedFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
            offCtx.fillStyle = ann.color;
            offCtx.globalAlpha = ann.opacity || 1;
            offCtx.textBaseline = 'top';

            const textLines = (ann.text || '').split('\n');
            textLines.forEach((line, lIdx) => {
              offCtx.fillText(line, tx, ty + lIdx * (calculatedFontSize * 1.25));
            });
          }
          offCtx.restore();
        });

        // Convert offscreen canvas to PNG image bytes
        const pngDataUrl = offCanvas.toDataURL('image/png');
        const pngImageBytes = await fetch(pngDataUrl).then((r) => r.arrayBuffer());
        const embeddedPng = await pdfLibDoc.embedPng(pngImageBytes);

        // Draw overlay onto the PDF page
        targetPage.drawImage(embeddedPng, {
          x: 0,
          y: 0,
          width: targetWidth,
          height: targetHeight,
        });
      }

      // Save the finalized PDF
      const pdfBytes = await pdfLibDoc.save();
      const outputBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const outputUrl = URL.createObjectURL(outputBlob);
      const outputName = file.name.replace(/\.[^/.]+$/, '') + '_annotated.pdf';

      setProcessedPdf({
        url: outputUrl,
        blob: outputBlob,
        name: outputName,
      });
    } catch (err) {
      console.error('Error exporting annotated PDF:', err);
      setErrorMessage('Failed to export annotated PDF. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPdfDoc(null);
    setNumPages(0);
    setCurrentPage(1);
    setAnnotationsByPage({});
    setUndoStackByPage({});
    setRedoStackByPage({});
    setProcessedPdf(null);
    setErrorMessage('');
  };

  const handleCancelWithConfirmation = () => {
    const totalAnnotationsCount = Object.values(annotationsByPage).reduce(
      (sum, arr) => sum + (arr ? arr.length : 0),
      0
    );
    if (totalAnnotationsCount > 0) {
      const confirmed = window.confirm(
        'Are you sure you want to discard your edits and cancel? All unsaved annotations will be lost.'
      );
      if (!confirmed) return;
    }
    handleReset();
  };

  const handleReselectWithConfirmation = () => {
    const totalAnnotationsCount = Object.values(annotationsByPage).reduce(
      (sum, arr) => sum + (arr ? arr.length : 0),
      0
    );
    if (totalAnnotationsCount > 0) {
      const confirmed = window.confirm(
        'Are you sure you want to select another PDF? Your current annotations will be discarded.'
      );
      if (!confirmed) return;
    }
    fileInputRef.current?.click();
  };

  if (isLoading) {
    return <Loader message={loaderMessage} />;
  }

  if (processedPdf) {
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          fileUrl={processedPdf.url}
          fileName={processedPdf.name}
          file={processedPdf.blob}
          onReset={handleReset}
          message="PDF Annotations Saved Successfully!"
          currentPath="/edit-pdf"
        />
      </div>
    );
  }

  if (!file) {
    return (
      <ToolHeroView
        title="Edit PDF Studio"
        toolPath="/edit-pdf"
        description="Add freehand drawings, highlighters, text boxes, and shapes to your PDF with live interactive canvas editing."
        badge="PDF Editor"
        badgeIcon={FiEdit3}
        acceptedFormats={['PDF']}
        allowMultiple={false}
        accept={{ 'application/pdf': ['.pdf'] }}
        onFilesSelected={handleFiles}
        alerts={errorMessage && (
          <AlertBanner
            type="error"
            message={errorMessage}
            onClose={() => setErrorMessage('')}
          />
        )}
      />
    );
  }

  return (
    <div className="edit-pdf-container">
      {errorMessage && (
        <AlertBanner
          type="error"
          message={errorMessage}
          onClose={() => setErrorMessage('')}
        />
      )}

      <div ref={workspaceRef} className={`edit-pdf-workspace ${isFullscreen ? 'is-fullscreen' : ''}`}>
          {/* Top Floating Studio Toolbar */}
          <header className="edit-pdf-toolbar">
            <div className="toolbar-group">
              <button
                className={`toolbar-btn ${activeTool === 'select' ? 'active' : ''}`}
                onClick={() => setActiveTool('select')}
                title="Select & Move (V)"
              >
                <FiMove />
                <span>Select</span>
              </button>
              <button
                className={`toolbar-btn ${activeTool === 'pen' ? 'active' : ''}`}
                onClick={() => setActiveTool('pen')}
                title="Freehand Pen (P)"
              >
                <FiEdit3 />
                <span>Pen</span>
              </button>
              <button
                className={`toolbar-btn ${activeTool === 'highlighter' ? 'active' : ''}`}
                onClick={() => setActiveTool('highlighter')}
                title="Highlighter (H)"
              >
                <FiPenTool />
                <span>Highlight</span>
              </button>
              <button
                className={`toolbar-btn ${activeTool === 'text' ? 'active' : ''}`}
                onClick={() => setActiveTool('text')}
                title="Text Box (T)"
              >
                <FiType />
                <span>Text</span>
              </button>
              <button
                className={`toolbar-btn ${activeTool === 'rectangle' ? 'active' : ''}`}
                onClick={() => setActiveTool('rectangle')}
                title="Rectangle (R)"
              >
                <FiSquare />
                <span>Box</span>
              </button>
              <button
                className={`toolbar-btn ${activeTool === 'circle' ? 'active' : ''}`}
                onClick={() => setActiveTool('circle')}
                title="Circle (C)"
              >
                <FiCircle />
                <span>Circle</span>
              </button>
              <button
                className={`toolbar-btn ${activeTool === 'arrow' ? 'active' : ''}`}
                onClick={() => setActiveTool('arrow')}
                title="Arrow (A)"
              >
                <FiArrowUpRight />
                <span>Arrow</span>
              </button>
              <button
                className={`toolbar-btn ${activeTool === 'eraser' ? 'active' : ''}`}
                onClick={() => setActiveTool('eraser')}
                title="Eraser (E)"
              >
                <FiTrash2 />
                <span>Eraser</span>
              </button>
            </div>

            <div className="toolbar-divider" />

            {/* Colors Palette */}
            <div className="toolbar-group color-palette-group">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.hex}
                  className={`color-swatch-btn ${strokeColor === preset.hex ? 'active' : ''}`}
                  style={{ backgroundColor: preset.hex }}
                  onClick={() => setStrokeColor(preset.hex)}
                  title={preset.name}
                >
                  {strokeColor === preset.hex && (
                    <FiCheck color={preset.hex === '#ffffff' ? '#000' : '#fff'} size={12} />
                  )}
                </button>
              ))}
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                className="custom-color-picker"
                title="Custom color"
              />
            </div>

            <div className="toolbar-divider" />

            {/* Stroke Width / Font Size selector */}
            {activeTool === 'text' ? (
              <div className="toolbar-group">
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="toolbar-select"
                >
                  {FONT_SIZES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label} ({f.value}px)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="toolbar-group">
                <select
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  className="toolbar-select"
                >
                  {STROKE_WIDTHS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label} ({s.value}px)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="toolbar-divider" />

            {/* Undo, Redo, Delete, Clear Page */}
            <div className="toolbar-group">
              <button
                className="toolbar-icon-btn"
                onClick={handleUndo}
                disabled={!(undoStackByPage[currentPage] && undoStackByPage[currentPage].length > 0)}
                title="Undo (Ctrl+Z)"
              >
                <FiRotateCcw />
              </button>
              <button
                className="toolbar-icon-btn"
                onClick={handleRedo}
                disabled={!(redoStackByPage[currentPage] && redoStackByPage[currentPage].length > 0)}
                title="Redo (Ctrl+Y)"
              >
                <FiRotateCw />
              </button>
              {selectedAnnotationId && (
                <button
                  className="toolbar-icon-btn delete-btn"
                  onClick={handleDeleteSelected}
                  title="Delete Selected Item"
                >
                  <FiTrash2 />
                </button>
              )}
              <button
                className="toolbar-btn clear-page-btn"
                onClick={handleClearCurrentPage}
                title="Clear Page Annotations"
              >
                <span>Clear Page</span>
              </button>
            </div>

            <div className="toolbar-divider" />

            {/* Zoom Controls & Fit */}
            <div className="toolbar-group">
              <button
                className="toolbar-icon-btn"
                onClick={() => changeScale(pageScale - 0.2)}
                title="Zoom Out"
              >
                <FiZoomOut />
              </button>
              <span className="zoom-text">{Math.round(pageScale * 100)}%</span>
              <button
                className="toolbar-icon-btn"
                onClick={() => changeScale(pageScale + 0.2)}
                title="Zoom In"
              >
                <FiZoomIn />
              </button>
              <button
                className="toolbar-btn fit-zoom-btn"
                onClick={handleFitWidth}
                title="Fit to Page Width"
              >
                <span>Fit</span>
              </button>
            </div>

            <div className="toolbar-divider" />

            {/* Fullscreen / Focus Mode */}
            <div className="toolbar-group">
              <button
                className={`toolbar-icon-btn ${isFullscreen ? 'active' : ''}`}
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit Fullscreen (F / Esc)' : 'Full Screen / Focus Mode (F)'}
              >
                {isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
              </button>
            </div>

            {/* Actions: Reselect, Cancel, Save & Export */}
            <div className="toolbar-group export-group">
              <input
                type="file"
                ref={fileInputRef}
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFiles(Array.from(e.target.files));
                    e.target.value = '';
                  }
                }}
              />
              <Link
                to="/blog/how-to-edit-and-annotate-pdf-online"
                target="_blank"
                rel="noopener noreferrer"
                className="toolbar-btn secondary-action-btn"
                title="Read guide: How to Edit and Annotate PDF Online"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <FiBookOpen size={14} />
                <span>How it works</span>
              </Link>
              <button
                className="toolbar-btn secondary-action-btn"
                onClick={handleReselectWithConfirmation}
                title="Choose another PDF file"
              >
                <FiFolder />
                <span>Reselect PDF</span>
              </button>
              <button
                className="toolbar-btn cancel-action-btn"
                onClick={handleCancelWithConfirmation}
                title="Cancel editing and return to upload"
              >
                <FiX />
                <span>Cancel</span>
              </button>
              <button className="primary-export-btn" onClick={handleExportPdf}>
                <FiDownload />
                <span>Save &amp; Export PDF</span>
              </button>
            </div>
          </header>

          {/* Main Editing Viewport */}
          <div className="edit-pdf-body">
            {/* Sidebar Thumbnails */}
            <aside className="edit-pdf-sidebar">
              <div className="sidebar-header">
                <span>Pages ({numPages})</span>
              </div>
              <div className="sidebar-thumbnails-list">
                {pageThumbnails.map((thumb) => {
                  const hasAnnotations =
                    annotationsByPage[thumb.pageNum] &&
                    annotationsByPage[thumb.pageNum].length > 0;

                  return (
                    <div
                      key={thumb.pageNum}
                      className={`thumbnail-card ${currentPage === thumb.pageNum ? 'active' : ''}`}
                      onClick={() => changePage(thumb.pageNum)}
                    >
                      <div className="thumbnail-img-wrapper">
                        <img src={thumb.dataUrl} alt={`Page ${thumb.pageNum}`} />
                        {hasAnnotations && (
                          <span className="thumbnail-annotation-indicator" title="Annotated">
                            ✏️
                          </span>
                        )}
                      </div>
                      <span className="thumbnail-number">Page {thumb.pageNum}</span>
                    </div>
                  );
                })}
              </div>
            </aside>

            {/* Center Canvas Area */}
            <main className="edit-pdf-viewport" ref={containerRef}>
              <div className="canvas-wrapper-container">
                {/* Background Rendered PDF Page */}
                <canvas
                  ref={bgCanvasRef}
                  className="pdf-bg-canvas"
                  style={{
                    width: `${pageDimensions.width}px`,
                    height: `${pageDimensions.height}px`,
                  }}
                />

                {/* Interactive Annotation Overlay */}
                <PdfAnnotationCanvas
                  width={pageDimensions.width}
                  height={pageDimensions.height}
                  activeTool={activeTool}
                  strokeColor={strokeColor}
                  strokeWidth={strokeWidth}
                  fontSize={fontSize}
                  annotations={annotationsByPage[currentPage] || []}
                  onChange={handleAnnotationsChange}
                  selectedId={selectedAnnotationId}
                  onSelect={setSelectedAnnotationId}
                />
              </div>

              {/* Bottom Floating Page Navigator */}
              <div className="bottom-page-navigator">
                <button
                  className="page-nav-btn"
                  onClick={() => changePage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  title="Previous Page"
                >
                  <FiChevronLeft />
                </button>
                <span className="page-nav-text">
                  Page {currentPage} of {numPages}
                </span>
                <button
                  className="page-nav-btn"
                  onClick={() => changePage(currentPage + 1)}
                  disabled={currentPage >= numPages}
                  title="Next Page"
                >
                  <FiChevronRight />
                </button>
              </div>
            </main>
          </div>
        </div>
    </div>
  );
}
