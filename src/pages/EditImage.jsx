import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  FiEdit2,
  FiSliders,
  FiType,
  FiSquare,
  FiCircle,
  FiArrowUpRight,
  FiEyeOff,
  FiCornerUpLeft,
  FiCornerUpRight,
  FiDownload,
  FiRefreshCw,
  FiTrash2,
} from 'react-icons/fi';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import { ToolHeroView, ToolStudioHeader, ResizableSplitPane } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { formatFileSize, validateImageFile } from '../utils/fileUtils';

export default function EditImage() {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [imageObj, setImageObj] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Active Tool Mode
  // 'adjust' | 'draw' | 'text' | 'rect' | 'circle' | 'arrow' | 'redact'
  const [activeTool, setActiveTool] = useState('adjust');

  // Adjustments (Filters)
  const [brightness, setBrightness] = useState(100); // 0 to 200%
  const [contrast, setContrast] = useState(100); // 0 to 200%
  const [saturation, setSaturation] = useState(100); // 0 to 200%
  const [blur, setBlur] = useState(0); // 0 to 20px
  const [grayscale, setGrayscale] = useState(0); // 0 to 100%
  const [sepia, setSepia] = useState(0); // 0 to 100%
  const [invert, setInvert] = useState(0); // 0 to 100%
  const [rotation, setRotation] = useState(0);

  // Drawing & Annotation State
  const [brushColor, setBrushColor] = useState('#ff4757');
  const [brushSize, setBrushSize] = useState(6);
  const [textInput, setTextInput] = useState('Sample Text');
  const [fontSize, setFontSize] = useState(24);

  // Result state
  const [editedBlob, setEditedBlob] = useState(null);
  const [outputFormat, setOutputFormat] = useState('image/png'); // 'image/png' | 'image/jpeg' | 'image/webp'
  const [quality, setQuality] = useState(92);

  // Main Canvas & Offscreen Drawing Layer
  const canvasRef = useRef(null);
  const drawingCanvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const handledIncomingRef = useRef(false);

  // Undo / Redo history for drawing overlay (ImageData snapshots)
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Manage editedUrl lifecycle with useMemo
  const editedUrl = useMemo(() => {
    return editedBlob ? URL.createObjectURL(editedBlob) : null;
  }, [editedBlob]);

  useEffect(() => {
    return () => {
      if (editedUrl) URL.revokeObjectURL(editedUrl);
    };
  }, [editedUrl]);

  // Composite: Renders base image with active filters + draws overlay annotations on top
  const renderComposite = useCallback(() => {
    if (!imageObj || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isRot = rotation === 90 || rotation === 270;
    const w = isRot ? imageObj.height : imageObj.width;
    const h = isRot ? imageObj.width : imageObj.height;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.clearRect(0, 0, w, h);

    // 1. Draw base photo with CSS filters & rotation
    ctx.save();
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px) grayscale(${grayscale}%) sepia(${sepia}%) invert(${invert}%)`;
    ctx.translate(w / 2, h / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    const dw = isRot ? h : w;
    const dh = isRot ? w : h;
    ctx.drawImage(imageObj, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    // 2. Draw user annotations (pencil, shapes, text, redaction) on top
    if (drawingCanvasRef.current) {
      ctx.drawImage(drawingCanvasRef.current, 0, 0);
    }
  }, [imageObj, rotation, brightness, contrast, saturation, blur, grayscale, sepia, invert]);

  // Load Image & Initialize Layer
  const loadImage = useCallback((selectedFile) => {
    setErrorMessage('');
    const url = URL.createObjectURL(selectedFile);
    const img = new Image();
    img.onload = () => {
      setImageObj(img);

      // Create transparent offscreen drawing layer matching image resolution
      const offCanvas = document.createElement('canvas');
      offCanvas.width = img.width;
      offCanvas.height = img.height;
      const offCtx = offCanvas.getContext('2d');
      const initialSnapshot = offCtx.getImageData(0, 0, img.width, img.height);
      drawingCanvasRef.current = offCanvas;

      setHistory([initialSnapshot]);
      setHistoryIndex(0);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setErrorMessage('Failed to decode image.');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const handleFiles = useCallback((files) => {
    if (!files || files.length === 0) return;
    const selected = Array.isArray(files) ? files[0] : files;
    const validation = validateImageFile(selected);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      return;
    }
    setFile(selected);
    setEditedBlob(null);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setBlur(0);
    setGrayscale(0);
    setSepia(0);
    setInvert(0);
    setRotation(0);
    loadImage(selected);
  }, [loadImage]);

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

  // Re-composite when filter state or image changes
  useEffect(() => {
    let active = true;
    if (imageObj) {
      const timer = setTimeout(() => {
        if (active) renderComposite();
      }, 20);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [imageObj, renderComposite]);

  // Push new snapshot to drawing history
  const pushSnapshot = () => {
    if (!drawingCanvasRef.current) return;
    const offCanvas = drawingCanvasRef.current;
    const offCtx = offCanvas.getContext('2d');
    const snapshot = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
    const newHist = history.slice(0, historyIndex + 1);
    newHist.push(snapshot);
    setHistory(newHist);
    setHistoryIndex(newHist.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex <= 0 || !drawingCanvasRef.current) return;
    const newIdx = historyIndex - 1;
    const offCtx = drawingCanvasRef.current.getContext('2d');
    offCtx.putImageData(history[newIdx], 0, 0);
    setHistoryIndex(newIdx);
    renderComposite();
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1 || !drawingCanvasRef.current) return;
    const newIdx = historyIndex + 1;
    const offCtx = drawingCanvasRef.current.getContext('2d');
    offCtx.putImageData(history[newIdx], 0, 0);
    setHistoryIndex(newIdx);
    renderComposite();
  };

  const handleResetFilters = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setBlur(0);
    setGrayscale(0);
    setSepia(0);
    setInvert(0);
    setRotation(0);
  };

  const handleClearDrawings = () => {
    if (!drawingCanvasRef.current) return;
    const offCanvas = drawingCanvasRef.current;
    const offCtx = offCanvas.getContext('2d');
    offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
    pushSnapshot();
    renderComposite();
  };

  // Canvas Drawing Pointer Events
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e) => {
    if (activeTool === 'adjust' || !canvasRef.current || !drawingCanvasRef.current) return;
    const pos = getCanvasCoords(e);
    isDrawingRef.current = true;
    startPosRef.current = pos;

    const offCtx = drawingCanvasRef.current.getContext('2d');

    if (activeTool === 'draw') {
      offCtx.beginPath();
      offCtx.moveTo(pos.x, pos.y);
      offCtx.strokeStyle = brushColor;
      offCtx.lineWidth = brushSize;
      offCtx.lineCap = 'round';
      offCtx.lineJoin = 'round';
    } else if (activeTool === 'text') {
      // Stamp text directly on overlay
      offCtx.font = `bold ${fontSize}px sans-serif`;
      offCtx.fillStyle = brushColor;
      offCtx.fillText(textInput, pos.x, pos.y);
      pushSnapshot();
      renderComposite();
      isDrawingRef.current = false;
    }
  };

  const handlePointerMove = (e) => {
    if (!isDrawingRef.current || !drawingCanvasRef.current) return;
    const pos = getCanvasCoords(e);
    const offCtx = drawingCanvasRef.current.getContext('2d');

    if (activeTool === 'draw') {
      offCtx.lineTo(pos.x, pos.y);
      offCtx.stroke();
      renderComposite();
    } else if (activeTool === 'rect' || activeTool === 'circle' || activeTool === 'arrow' || activeTool === 'redact') {
      // Restore previous state for smooth drag outline preview
      if (history[historyIndex]) {
        offCtx.putImageData(history[historyIndex], 0, 0);
      }
      const sx = startPosRef.current.x;
      const sy = startPosRef.current.y;
      const w = pos.x - sx;
      const h = pos.y - sy;

      if (activeTool === 'rect') {
        offCtx.strokeStyle = brushColor;
        offCtx.lineWidth = brushSize;
        offCtx.strokeRect(sx, sy, w, h);
      } else if (activeTool === 'circle') {
        offCtx.strokeStyle = brushColor;
        offCtx.lineWidth = brushSize;
        offCtx.beginPath();
        const rx = Math.abs(w / 2);
        const ry = Math.abs(h / 2);
        offCtx.ellipse(sx + w / 2, sy + h / 2, rx, ry, 0, 0, Math.PI * 2);
        offCtx.stroke();
      } else if (activeTool === 'arrow') {
        offCtx.strokeStyle = brushColor;
        offCtx.fillStyle = brushColor;
        offCtx.lineWidth = brushSize;
        offCtx.beginPath();
        offCtx.moveTo(sx, sy);
        offCtx.lineTo(pos.x, pos.y);
        offCtx.stroke();

        // Arrow head
        const angle = Math.atan2(pos.y - sy, pos.x - sx);
        const headLen = Math.max(12, brushSize * 2.5);
        offCtx.beginPath();
        offCtx.moveTo(pos.x, pos.y);
        offCtx.lineTo(pos.x - headLen * Math.cos(angle - Math.PI / 6), pos.y - headLen * Math.sin(angle - Math.PI / 6));
        offCtx.lineTo(pos.x - headLen * Math.cos(angle + Math.PI / 6), pos.y - headLen * Math.sin(angle + Math.PI / 6));
        offCtx.closePath();
        offCtx.fill();
      } else if (activeTool === 'redact') {
        // Redaction box (solid black censorship bar)
        offCtx.fillStyle = '#000000';
        offCtx.fillRect(sx, sy, w, h);
      }

      renderComposite();
    }
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    pushSnapshot();
    renderComposite();
  };

  // Export Edited Image
  const handleExport = async () => {
    if (!canvasRef.current || !file) return;
    setIsProcessing(true);
    setErrorMessage('');

    try {
      const q = outputFormat === 'image/jpeg' || outputFormat === 'image/webp' ? quality / 100 : undefined;
      const blob = await new Promise((res) => canvasRef.current.toBlob(res, outputFormat, q));
      if (!blob) throw new Error('Failed to generate image file.');
      setEditedBlob(blob);
    } catch (err) {
      console.error('Export error:', err);
      setErrorMessage(err.message || 'Failed to export image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setImageObj(null);
    setEditedBlob(null);
    setErrorMessage('');
  };

  const getExtension = () => {
    if (outputFormat === 'image/jpeg') return '.jpg';
    if (outputFormat === 'image/webp') return '.webp';
    return '.png';
  };

  // -------------------------------------------------------------
  // VIEW 3: ACTION COMPLETED
  // -------------------------------------------------------------
  if (editedBlob && editedUrl && file) {
    const outFileName = `${file.name.replace(/\.[^/.]+$/, '')}-edited${getExtension()}`;
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="Edit Image Studio"
          fileUrl={editedUrl}
          fileName={outFileName}
          file={new File([editedBlob], outFileName, { type: outputFormat })}
          onReset={handleReset}
          onProcessSourceAgain={() => setEditedBlob(null)}
          sourceActionLabel="Edit Source Again"
          onProcessTarget={() => {
            const chained = new File([editedBlob], outFileName, { type: outputFormat });
            setFile(chained);
            setEditedBlob(null);
            loadImage(chained);
          }}
          targetActionLabel="Use Edited Image"
          message="Image edited and exported successfully!"
          currentPath="/edit-image"
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
        title="Edit Image Studio"
        description="Filters, annotations, shapes, and privacy redactions in your browser with zero server uploads."
        badge="Image Studio"
        badgeIcon={FiEdit2}
        toolPath="/edit-image"
        acceptedFormats={['.png', '.jpg', '.jpeg', '.webp', '.bmp']}
        allowMultiple={false}
        maxSizeText="50 MB"
        accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.bmp'] }}
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
  // -------------------------------------------------------------
  // VIEW 2: STUDIO CONFIGURATION VIEW
  // -------------------------------------------------------------
  const controlsDesk = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem' }}>
      {/* Tool Mode Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', background: 'var(--subtle-bg)', padding: '0.35rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
        {[
          { id: 'adjust', label: 'Filters & Adjust', icon: FiSliders },
          { id: 'draw', label: 'Pencil Brush', icon: FiEdit2 },
          { id: 'text', label: 'Text Stamp', icon: FiType },
          { id: 'rect', label: 'Rectangle', icon: FiSquare },
          { id: 'circle', label: 'Circle', icon: FiCircle },
          { id: 'arrow', label: 'Arrow', icon: FiArrowUpRight },
          { id: 'redact', label: 'Privacy Blackout', icon: FiEyeOff },
        ].map((t) => {
          const Icon = t.icon;
          const isSel = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.4rem 0.7rem',
                borderRadius: '8px',
                border: 'none',
                background: isSel ? 'var(--primary-color)' : 'transparent',
                color: isSel ? '#fff' : 'var(--text-color)',
                fontWeight: isSel ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Mode 1: Adjustments */}
      {activeTool === 'adjust' && (
        <div style={{ background: 'var(--card-bg)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-color)' }}>
              Photo Enhancements:
            </span>
            <button
              onClick={handleResetFilters}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--primary-color)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <FiRefreshCw size={12} /> Reset Filters
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Brightness */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                <span>Brightness</span>
                <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>{brightness}%</span>
              </div>
              <input type="range" min="20" max="200" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            {/* Contrast */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                <span>Contrast</span>
                <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>{contrast}%</span>
              </div>
              <input type="range" min="20" max="200" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            {/* Saturation */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                <span>Saturation</span>
                <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>{saturation}%</span>
              </div>
              <input type="range" min="0" max="200" value={saturation} onChange={(e) => setSaturation(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            {/* Grayscale */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                <span>Grayscale (B&W)</span>
                <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>{grayscale}%</span>
              </div>
              <input type="range" min="0" max="100" value={grayscale} onChange={(e) => setGrayscale(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            {/* Sepia */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                <span>Sepia Vintage</span>
                <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>{sepia}%</span>
              </div>
              <input type="range" min="0" max="100" value={sepia} onChange={(e) => setSepia(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            {/* Invert */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                <span>Invert Colors</span>
                <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>{invert}%</span>
              </div>
              <input type="range" min="0" max="100" value={invert} onChange={(e) => setInvert(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            {/* Blur */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                <span>Soft Blur</span>
                <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>{blur}px</span>
              </div>
              <input type="range" min="0" max="20" value={blur} onChange={(e) => setBlur(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            {/* Rotation */}
            <div style={{ marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                Orientation:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                {[0, 90, 180, 270].map((deg) => (
                  <button
                    key={deg}
                    onClick={() => setRotation(deg)}
                    style={{
                      padding: '0.45rem',
                      borderRadius: '6px',
                      border: `1px solid ${rotation === deg ? 'var(--primary-color)' : 'var(--border-color)'}`,
                      background: rotation === deg ? 'rgba(28, 153, 255, 0.12)' : 'var(--card-bg)',
                      color: rotation === deg ? 'var(--primary-color)' : 'var(--text-color)',
                      fontWeight: rotation === deg ? 700 : 500,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: Drawing / Text / Shapes / Redact Settings */}
      {activeTool !== 'adjust' && (
        <div style={{ background: 'var(--card-bg)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-color)' }}>
              Tool Options:
            </span>
            <button
              onClick={handleClearDrawings}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                background: 'transparent',
                border: 'none',
                color: '#ff4757',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <FiTrash2 size={12} /> Clear Drawings
            </button>
          </div>

          {activeTool === 'text' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Text to Stamp (Click image to stamp):
              </label>
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.9rem', marginBottom: '0.75rem' }}
              />
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                  <span>Font Size</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>{fontSize}px</span>
                </div>
                <input type="range" min="12" max="96" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
            </div>
          )}

          {activeTool !== 'redact' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                Color:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {['#ff4757', '#1c99ff', '#2ed573', '#ffa502', '#ffffff', '#000000', '#9b59b6'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setBrushColor(c)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: c,
                      border: `2px solid ${brushColor === c ? 'var(--primary-color)' : 'var(--border-color)'}`,
                      cursor: 'pointer',
                      boxShadow: brushColor === c ? '0 0 0 2px rgba(28,153,255,0.4)' : 'none',
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={brushColor}
                  onChange={(e) => setBrushColor(e.target.value)}
                  style={{ width: '32px', height: '32px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                />
              </div>
            </div>
          )}

          {activeTool !== 'text' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                <span>Stroke Width</span>
                <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>{brushSize}px</span>
              </div>
              <input type="range" min="1" max="40" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
          )}

          {activeTool === 'redact' && (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.75rem', lineHeight: 1.45 }}>
              🔒 <strong>Blackout Censorship:</strong> Click & drag a rectangle over sensitive text, account numbers, or faces to permanently blackout the pixels.
            </p>
          )}
        </div>
      )}

      {/* Format & Quality Picker */}
      <div style={{ background: 'var(--card-bg)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.75rem' }}>
          Export Settings:
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: outputFormat !== 'image/png' ? '1rem' : 0 }}>
          {[
            { id: 'image/png', label: 'PNG' },
            { id: 'image/jpeg', label: 'JPEG' },
            { id: 'image/webp', label: 'WebP' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setOutputFormat(f.id)}
              style={{
                padding: '0.5rem 0.2rem',
                borderRadius: '8px',
                border: `1px solid ${outputFormat === f.id ? 'var(--primary-color)' : 'var(--border-color)'}`,
                background: outputFormat === f.id ? 'rgba(28, 153, 255, 0.12)' : 'var(--subtle-bg)',
                color: outputFormat === f.id ? 'var(--primary-color)' : 'var(--text-color)',
                fontWeight: outputFormat === f.id ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {outputFormat !== 'image/png' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
              <span>Quality</span>
              <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>{quality}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        )}
      </div>
    </div>
  );

  const previewDesk = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--subtle-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', height: '100%', minHeight: 0, overflow: 'auto', touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          borderRadius: '6px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
          cursor: activeTool === 'adjust' ? 'default' : activeTool === 'text' ? 'text' : 'crosshair',
          display: 'block',
        }}
      />
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
        toolTitle="Edit Image Studio"
        fileBadge={`${file.name} (${imageObj ? `${imageObj.width} × ${imageObj.height} px • ` : ''}${formatFileSize(file.size)})`}
        onBack={handleReset}
        backLabel="Choose Another Image"
        headerExtra={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              title="Undo Drawing (Ctrl+Z)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #334155)',
                background: 'var(--subtle-bg, #0f172a)',
                color: historyIndex <= 0 ? 'var(--text-secondary, #94a3b8)' : 'var(--text-color)',
                cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer',
                opacity: historyIndex <= 0 ? 0.4 : 1,
                fontWeight: 600,
                fontSize: '0.85rem'
              }}
            >
              <FiCornerUpLeft /> Undo
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Redo Drawing (Ctrl+Y)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #334155)',
                background: 'var(--subtle-bg, #0f172a)',
                color: historyIndex >= history.length - 1 ? 'var(--text-secondary, #94a3b8)' : 'var(--text-color)',
                cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer',
                opacity: historyIndex >= history.length - 1 ? 0.4 : 1,
                fontWeight: 600,
                fontSize: '0.85rem'
              }}
            >
              <FiCornerUpRight /> Redo
            </button>
          </div>
        }
        primaryAction={{
          label: isProcessing ? 'Exporting...' : 'Export Image',
          icon: FiDownload,
          onClick: handleExport,
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
          leftTitle="Editing Tools & Controls"
          rightTitle="Live Canvas"
          storageKey="edit_image"
        />
      </div>
    </div>
  );
}
