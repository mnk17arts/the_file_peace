import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Interactive canvas overlay for drawing annotations (pen, highlighter, shapes, text).
 * Stores annotations in normalized (0..1) coordinates relative to page width and height
 * so scaling and zoom changes do not distort or offset annotations.
 */
export default function PdfAnnotationCanvas({
  width,
  height,
  activeTool = 'pen', // 'select' | 'pen' | 'highlighter' | 'text' | 'rectangle' | 'circle' | 'arrow' | 'eraser'
  strokeColor = '#ff0000',
  strokeWidth = 3,
  fontSize = 18,
  annotations = [],
  onChange = () => {},
  selectedId = null,
  onSelect = () => {}
}) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState(null);
  const [editingTextId, setEditingTextId] = useState(null);
  const [textInputVal, setTextInputVal] = useState('');
  const [textPos, setTextPos] = useState({ x: 0, y: 0 });

  // Redraw all annotations whenever width, height, or annotations change
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    // Draw all saved annotations
    annotations.forEach((ann) => {
      ctx.save();
      const isSel = ann.id === selectedId;

      if (ann.type === 'pen' || ann.type === 'highlighter') {
        if (ann.points && ann.points.length > 0) {
          ctx.beginPath();
          ctx.strokeStyle = ann.color;
          ctx.lineWidth = (ann.strokeWidth || 3) * (width / 800);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          if (ann.type === 'highlighter') {
            ctx.globalAlpha = 0.45;
            ctx.lineWidth = Math.max(12, (ann.strokeWidth || 14) * (width / 800));
          } else {
            ctx.globalAlpha = ann.opacity || 1;
          }

          const startX = ann.points[0].x * width;
          const startY = ann.points[0].y * height;
          ctx.moveTo(startX, startY);

          for (let i = 1; i < ann.points.length; i++) {
            ctx.lineTo(ann.points[i].x * width, ann.points[i].y * height);
          }
          ctx.stroke();

          // Selection indicator for path
          if (isSel) {
            ctx.globalAlpha = 0.8;
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
          }
        }
      } else if (ann.type === 'rectangle') {
        const rx = ann.x * width;
        const ry = ann.y * height;
        const rw = ann.w * width;
        const rh = ann.h * height;

        ctx.strokeStyle = ann.color;
        ctx.lineWidth = (ann.strokeWidth || 3) * (width / 800);
        ctx.globalAlpha = ann.opacity || 1;

        if (ann.fill && ann.fill !== 'transparent') {
          ctx.fillStyle = ann.fill;
          ctx.fillRect(rx, ry, rw, rh);
        }
        ctx.strokeRect(rx, ry, rw, rh);

        if (isSel) {
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(rx - 3, ry - 3, rw + 6, rh + 6);
        }
      } else if (ann.type === 'circle') {
        const cx = (ann.x + ann.w / 2) * width;
        const cy = (ann.y + ann.h / 2) * height;
        const rx = Math.abs((ann.w / 2) * width);
        const ry = Math.abs((ann.h / 2) * height);

        ctx.strokeStyle = ann.color;
        ctx.lineWidth = (ann.strokeWidth || 3) * (width / 800);
        ctx.globalAlpha = ann.opacity || 1;

        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, 2 * Math.PI);
        if (ann.fill && ann.fill !== 'transparent') {
          ctx.fillStyle = ann.fill;
          ctx.fill();
        }
        ctx.stroke();

        if (isSel) {
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(ann.x * width - 3, ann.y * height - 3, ann.w * width + 6, ann.h * height + 6);
        }
      } else if (ann.type === 'arrow') {
        const x1 = ann.x1 * width;
        const y1 = ann.y1 * height;
        const x2 = ann.x2 * width;
        const y2 = ann.y2 * height;
        const sw = (ann.strokeWidth || 3) * (width / 800);

        ctx.strokeStyle = ann.color;
        ctx.fillStyle = ann.color;
        ctx.lineWidth = sw;
        ctx.globalAlpha = ann.opacity || 1;

        // Draw arrow line
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Draw arrow head
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLength = Math.max(12, sw * 3.5);
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();

        if (isSel) {
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
        }
      } else if (ann.type === 'text') {
        const tx = ann.x * width;
        const ty = ann.y * height;
        const calculatedFontSize = Math.max(10, (ann.fontSize || 18) * (width / 800));

        ctx.font = `${calculatedFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
        ctx.fillStyle = ann.color;
        ctx.globalAlpha = ann.opacity || 1;
        ctx.textBaseline = 'top';

        // Draw multi-line text
        const textLines = (ann.text || '').split('\n');
        textLines.forEach((line, lIdx) => {
          ctx.fillText(line, tx, ty + lIdx * (calculatedFontSize * 1.25));
        });

        if (isSel) {
          const metrics = ctx.measureText(ann.text || '');
          const th = textLines.length * (calculatedFontSize * 1.25);
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(tx - 4, ty - 4, metrics.width + 8, th + 8);
        }
      }

      ctx.restore();
    });

    // Draw active in-progress path
    if (currentPath) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = currentPath.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (currentPath.type === 'highlighter') {
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = Math.max(12, (currentPath.strokeWidth || 14) * (width / 800));
      } else {
        ctx.globalAlpha = 1;
        ctx.lineWidth = (currentPath.strokeWidth || 3) * (width / 800);
      }

      if (currentPath.type === 'pen' || currentPath.type === 'highlighter') {
        if (currentPath.points && currentPath.points.length > 0) {
          ctx.moveTo(currentPath.points[0].x * width, currentPath.points[0].y * height);
          for (let i = 1; i < currentPath.points.length; i++) {
            ctx.lineTo(currentPath.points[i].x * width, currentPath.points[i].y * height);
          }
          ctx.stroke();
        }
      } else if (currentPath.type === 'rectangle') {
        const rx = currentPath.x * width;
        const ry = currentPath.y * height;
        const rw = currentPath.w * width;
        const rh = currentPath.h * height;
        ctx.strokeRect(rx, ry, rw, rh);
      } else if (currentPath.type === 'circle') {
        const cx = (currentPath.x + currentPath.w / 2) * width;
        const cy = (currentPath.y + currentPath.h / 2) * height;
        const rx = Math.abs((currentPath.w / 2) * width);
        const ry = Math.abs((currentPath.h / 2) * height);
        ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (currentPath.type === 'arrow') {
        const x1 = currentPath.x1 * width;
        const y1 = currentPath.y1 * height;
        const x2 = currentPath.x2 * width;
        const y2 = currentPath.y2 * height;
        const sw = (currentPath.strokeWidth || 3) * (width / 800);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLength = Math.max(12, sw * 3.5);
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = currentPath.color;
        ctx.fill();
      }

      ctx.restore();
    }
  }, [width, height, annotations, selectedId, currentPath]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Pointer coordinate calculation relative to canvas [0..1]
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / height)),
    };
  };

  // Find annotation at click coordinates for Selection or Eraser
  const findAnnotationAt = (normX, normY) => {
    // Check backwards from top-most to bottom-most
    for (let i = annotations.length - 1; i >= 0; i--) {
      const a = annotations[i];
      if (a.type === 'rectangle' || a.type === 'circle') {
        const minX = Math.min(a.x, a.x + a.w);
        const maxX = Math.max(a.x, a.x + a.w);
        const minY = Math.min(a.y, a.y + a.h);
        const maxY = Math.max(a.y, a.y + a.h);
        if (normX >= minX - 0.02 && normX <= maxX + 0.02 && normY >= minY - 0.02 && normY <= maxY + 0.02) {
          return a;
        }
      } else if (a.type === 'text') {
        if (normX >= a.x - 0.02 && normX <= a.x + 0.25 && normY >= a.y - 0.02 && normY <= a.y + 0.06) {
          return a;
        }
      } else if (a.type === 'pen' || a.type === 'highlighter') {
        if (a.points && a.points.some((p) => Math.hypot(p.x - normX, p.y - normY) < 0.03)) {
          return a;
        }
      } else if (a.type === 'arrow') {
        const midX = (a.x1 + a.x2) / 2;
        const midY = (a.y1 + a.y2) / 2;
        if (Math.hypot(midX - normX, midY - normY) < 0.05 || Math.hypot(a.x1 - normX, a.y1 - normY) < 0.05 || Math.hypot(a.x2 - normX, a.y2 - normY) < 0.05) {
          return a;
        }
      }
    }
    return null;
  };

  const handlePointerDown = (e) => {
    if (e.button && e.button !== 0) return; // Only primary mouse button
    const coords = getCanvasCoords(e);

    if (activeTool === 'select') {
      const hit = findAnnotationAt(coords.x, coords.y);
      onSelect(hit ? hit.id : null);
      return;
    }

    if (activeTool === 'eraser') {
      const hit = findAnnotationAt(coords.x, coords.y);
      if (hit) {
        onChange(annotations.filter((a) => a.id !== hit.id));
      }
      return;
    }

    if (activeTool === 'text') {
      // Place new text box
      const newId = 'text_' + Date.now();
      setEditingTextId(newId);
      setTextInputVal('');
      setTextPos({ x: coords.x, y: coords.y });
      return;
    }

    // Starting a drawing stroke or shape
    setIsDrawing(true);
    const startPoint = { x: coords.x, y: coords.y };

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      setCurrentPath({
        id: 'stroke_' + Date.now(),
        type: activeTool,
        color: strokeColor,
        strokeWidth: activeTool === 'highlighter' ? 14 : strokeWidth,
        points: [startPoint],
      });
    } else if (activeTool === 'rectangle' || activeTool === 'circle') {
      setCurrentPath({
        id: 'shape_' + Date.now(),
        type: activeTool,
        color: strokeColor,
        strokeWidth: strokeWidth,
        fill: 'transparent',
        x: coords.x,
        y: coords.y,
        w: 0,
        h: 0,
      });
    } else if (activeTool === 'arrow') {
      setCurrentPath({
        id: 'arrow_' + Date.now(),
        type: 'arrow',
        color: strokeColor,
        strokeWidth: strokeWidth,
        x1: coords.x,
        y1: coords.y,
        x2: coords.x,
        y2: coords.y,
      });
    }
  };

  const handlePointerMove = (e) => {
    if (!isDrawing || !currentPath) return;
    const coords = getCanvasCoords(e);

    if (currentPath.type === 'pen' || currentPath.type === 'highlighter') {
      setCurrentPath((prev) => ({
        ...prev,
        points: [...prev.points, coords],
      }));
    } else if (currentPath.type === 'rectangle' || currentPath.type === 'circle') {
      setCurrentPath((prev) => ({
        ...prev,
        w: coords.x - prev.x,
        h: coords.y - prev.y,
      }));
    } else if (currentPath.type === 'arrow') {
      setCurrentPath((prev) => ({
        ...prev,
        x2: coords.x,
        y2: coords.y,
      }));
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing || !currentPath) return;
    setIsDrawing(false);

    // Filter out accidental micro-clicks for shapes
    let shouldSave = true;
    if (currentPath.type === 'pen' || currentPath.type === 'highlighter') {
      if (currentPath.points.length < 2) shouldSave = false;
    } else if (currentPath.type === 'rectangle' || currentPath.type === 'circle') {
      if (Math.abs(currentPath.w) < 0.005 && Math.abs(currentPath.h) < 0.005) shouldSave = false;
    } else if (currentPath.type === 'arrow') {
      if (Math.hypot(currentPath.x2 - currentPath.x1, currentPath.y2 - currentPath.y1) < 0.01) shouldSave = false;
    }

    if (shouldSave) {
      onChange([...annotations, currentPath]);
    }
    setCurrentPath(null);
  };

  const handleSaveText = () => {
    if (textInputVal.trim() && editingTextId) {
      const newTextAnnotation = {
        id: editingTextId,
        type: 'text',
        x: textPos.x,
        y: textPos.y,
        text: textInputVal,
        color: strokeColor,
        fontSize: fontSize,
      };
      onChange([...annotations, newTextAnnotation]);
    }
    setEditingTextId(null);
    setTextInputVal('');
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: 'auto',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          cursor:
            activeTool === 'select'
              ? 'default'
              : activeTool === 'text'
              ? 'text'
              : activeTool === 'eraser'
              ? 'crosshair'
              : 'crosshair',
          display: 'block',
        }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      />

      {/* Floating Inline Text Input Box */}
      {editingTextId && (
        <div
          style={{
            position: 'absolute',
            left: `${textPos.x * width}px`,
            top: `${textPos.y * height}px`,
            zIndex: 100,
            background: 'var(--card-bg, #ffffff)',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            padding: '6px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          }}
        >
          <textarea
            autoFocus
            rows={2}
            value={textInputVal}
            placeholder="Type annotation text..."
            onChange={(e) => setTextInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                handleSaveText();
              } else if (e.key === 'Escape') {
                setEditingTextId(null);
              }
            }}
            style={{
              fontFamily: 'inherit',
              fontSize: `${fontSize}px`,
              color: strokeColor,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              resize: 'both',
              minWidth: '180px',
              minHeight: '40px',
            }}
          />
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              onClick={() => setEditingTextId(null)}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                background: 'transparent',
                border: '1px solid var(--border-color, #ccc)',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveText}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Done (Ctrl+↵)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
