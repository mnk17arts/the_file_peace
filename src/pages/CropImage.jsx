import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  FiCrop,
  FiRotateCw,
  FiMaximize,
  FiUser
} from 'react-icons/fi';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import { ToolHeroView, ToolStudioHeader, ResizableSplitPane } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { formatFileSize, validateImageFile } from '../utils/fileUtils';

const ASPECT_RATIOS = [
  { id: 'free', label: 'Freeform', ratio: null },
  { id: '1:1', label: '1:1 Square', ratio: 1 },
  { id: '4:5', label: '4:5 Portrait', ratio: 4 / 5 },
  { id: '16:9', label: '16:9 Banner', ratio: 16 / 9 },
  { id: '9:16', label: '9:16 Story', ratio: 9 / 16 },
  { id: '4:3', label: '4:3 Standard', ratio: 4 / 3 },
  { id: '3:2', label: '3:2 Photo', ratio: 3 / 2 },
];

export default function CropImage() {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [imageObj, setImageObj] = useState(null);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [aspectRatioId, setAspectRatioId] = useState('free');
  const [isCircle, setIsCircle] = useState(false);
  const [outputFormat, setOutputFormat] = useState('image/png'); // 'image/png' | 'image/jpeg' | 'image/webp'
  const [quality, setQuality] = useState(92);
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Result state
  const [croppedBlob, setCroppedBlob] = useState(null);

  // Crop box in image-relative coordinates (0 to 1 percentage)
  const [cropBox, setCropBox] = useState({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState(null); // 'move' | 'nw' | 'ne' | 'se' | 'sw'
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, box: null });

  const previewCanvasRef = useRef(null);
  const handledIncomingRef = useRef(false);

  const croppedUrl = useMemo(() => {
    return croppedBlob ? URL.createObjectURL(croppedBlob) : null;
  }, [croppedBlob]);

  useEffect(() => {
    return () => {
      if (croppedUrl) URL.revokeObjectURL(croppedUrl);
    };
  }, [croppedUrl]);

  // Load image into Image element
  const loadImage = useCallback((selectedFile) => {
    setErrorMessage('');
    const url = URL.createObjectURL(selectedFile);
    const img = new Image();
    img.onload = () => {
      setImageObj(img);
      setCropBox({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setErrorMessage('Failed to decode image file.');
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
    setCroppedBlob(null);
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

  // Adjust cropBox when aspect ratio changes
  const handleSetRatio = (ratioItem) => {
    setAspectRatioId(ratioItem.id);
    if (!ratioItem.ratio || !imageObj) return;

    const imgAspect = (rotation === 90 || rotation === 270)
      ? imageObj.height / imageObj.width
      : imageObj.width / imageObj.height;

    let w = 0.8;
    let h = (w * imgAspect) / ratioItem.ratio;
    if (h > 0.9) {
      h = 0.8;
      w = (h * ratioItem.ratio) / imgAspect;
    }

    setCropBox({
      x: (1 - w) / 2,
      y: (1 - h) / 2,
      w: Math.max(0.1, Math.min(1, w)),
      h: Math.max(0.1, Math.min(1, h)),
    });
  };

  // Render interactive canvas preview
  const drawPreview = useCallback(() => {
    if (!imageObj || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isRotated = rotation === 90 || rotation === 270;
    const dispW = isRotated ? imageObj.height : imageObj.width;
    const dispH = isRotated ? imageObj.width : imageObj.height;

    const maxDispWidth = 750;
    const scale = Math.min(1, maxDispWidth / dispW);
    const canvasW = Math.round(dispW * scale);
    const canvasH = Math.round(dispH * scale);

    canvas.width = canvasW;
    canvas.height = canvasH;

    // Draw rotated image
    ctx.save();
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    const drawW = isRotated ? canvasH : canvasW;
    const drawH = isRotated ? canvasW : canvasH;
    ctx.drawImage(imageObj, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Dim outer areas
    const bx = cropBox.x * canvasW;
    const by = cropBox.y * canvasH;
    const bw = cropBox.w * canvasW;
    const bh = cropBox.h * canvasH;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, canvasW, by); // Top
    ctx.fillRect(0, by + bh, canvasW, canvasH - (by + bh)); // Bottom
    ctx.fillRect(0, by, bx, bh); // Left
    ctx.fillRect(bx + bw, by, canvasW - (bx + bw), bh); // Right

    // Draw crop border
    if (isCircle) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(bx + bw / 2, by + bh / 2, Math.min(bw, bh) / 2, 0, Math.PI * 2);
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);

      // Draw rule-of-thirds grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + bw / 3, by);
      ctx.lineTo(bx + bw / 3, by + bh);
      ctx.moveTo(bx + (bw * 2) / 3, by);
      ctx.lineTo(bx + (bw * 2) / 3, by + bh);
      ctx.moveTo(bx, by + bh / 3);
      ctx.lineTo(bx + bw, by + bh / 3);
      ctx.moveTo(bx, by + (bh * 2) / 3);
      ctx.lineTo(bx + bw, by + (bh * 2) / 3);
      ctx.stroke();

      // Draw corner handles
      const handleSize = 10;
      ctx.fillStyle = '#6366f1';
      ctx.fillRect(bx - handleSize / 2, by - handleSize / 2, handleSize, handleSize); // NW
      ctx.fillRect(bx + bw - handleSize / 2, by - handleSize / 2, handleSize, handleSize); // NE
      ctx.fillRect(bx + bw - handleSize / 2, by + bh - handleSize / 2, handleSize, handleSize); // SE
      ctx.fillRect(bx - handleSize / 2, by + bh - handleSize / 2, handleSize, handleSize); // SW
    }
  }, [cropBox, imageObj, isCircle, rotation]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  // Pointer interaction for dragging / resizing crop box
  const handlePointerDown = (e) => {
    if (!previewCanvasRef.current) return;
    const rect = previewCanvasRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;

    const bx = cropBox.x;
    const by = cropBox.y;
    const bw = cropBox.w;
    const bh = cropBox.h;
    const threshold = 0.04;

    let type = null;
    if (Math.hypot(px - bx, py - by) < threshold) type = 'nw';
    else if (Math.hypot(px - (bx + bw), py - by) < threshold) type = 'ne';
    else if (Math.hypot(px - (bx + bw), py - (by + bh)) < threshold) type = 'se';
    else if (Math.hypot(px - bx, py - (by + bh)) < threshold) type = 'sw';
    else if (px >= bx && px <= bx + bw && py >= by && py <= by + bh) type = 'move';

    if (type) {
      setIsDragging(true);
      setDragType(type);
      setDragStart({ x: px, y: py, box: { ...cropBox } });
      e.target.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e) => {
    if (!isDragging || !dragStart.box || !previewCanvasRef.current) return;
    const rect = previewCanvasRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;

    const dx = px - dragStart.x;
    const dy = py - dragStart.y;
    const b = dragStart.box;

    let nx = b.x;
    let ny = b.y;
    let nw = b.w;
    let nh = b.h;

    if (dragType === 'move') {
      nx = Math.max(0, Math.min(1 - b.w, b.x + dx));
      ny = Math.max(0, Math.min(1 - b.h, b.y + dy));
    } else if (dragType === 'se') {
      nw = Math.max(0.08, Math.min(1 - b.x, b.w + dx));
      nh = Math.max(0.08, Math.min(1 - b.y, b.h + dy));
    } else if (dragType === 'nw') {
      nx = Math.max(0, Math.min(b.x + b.w - 0.08, b.x + dx));
      ny = Math.max(0, Math.min(b.y + b.h - 0.08, b.y + dy));
      nw = b.w - (nx - b.x);
      nh = b.h - (ny - b.y);
    } else if (dragType === 'ne') {
      ny = Math.max(0, Math.min(b.y + b.h - 0.08, b.y + dy));
      nw = Math.max(0.08, Math.min(1 - b.x, b.w + dx));
      nh = b.h - (ny - b.y);
    } else if (dragType === 'sw') {
      nx = Math.max(0, Math.min(b.x + b.w - 0.08, b.x + dx));
      nw = b.w - (nx - b.x);
      nh = Math.max(0.08, Math.min(1 - b.y, b.h + dy));
    }

    setCropBox({ x: nx, y: ny, w: nw, h: nh });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setDragType(null);
  };

  // Perform Final Crop
  const handleExecuteCrop = async () => {
    if (!imageObj || !file) return;
    setIsProcessing(true);
    setErrorMessage('');

    try {
      const isRotated = rotation === 90 || rotation === 270;
      const fullW = isRotated ? imageObj.height : imageObj.width;
      const fullH = isRotated ? imageObj.width : imageObj.height;

      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = fullW;
      srcCanvas.height = fullH;
      const srcCtx = srcCanvas.getContext('2d');

      srcCtx.translate(fullW / 2, fullH / 2);
      srcCtx.rotate((rotation * Math.PI) / 180);
      const drawW = (rotation === 90 || rotation === 270) ? fullH : fullW;
      const drawH = (rotation === 90 || rotation === 270) ? fullW : fullH;
      srcCtx.drawImage(imageObj, -drawW / 2, -drawH / 2, drawW, drawH);

      const cropX = Math.round(cropBox.x * fullW);
      const cropY = Math.round(cropBox.y * fullH);
      const cropW = Math.round(cropBox.w * fullW);
      const cropH = Math.round(cropBox.h * fullH);

      const outCanvas = document.createElement('canvas');
      outCanvas.width = cropW;
      outCanvas.height = cropH;
      const outCtx = outCanvas.getContext('2d');

      if (isCircle) {
        outCtx.beginPath();
        outCtx.arc(cropW / 2, cropH / 2, Math.min(cropW, cropH) / 2, 0, Math.PI * 2);
        outCtx.clip();
      }

      outCtx.drawImage(srcCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      const q = outputFormat === 'image/jpeg' ? quality / 100 : undefined;
      const blob = await new Promise((res) => outCanvas.toBlob(res, outputFormat, q));
      if (!blob) throw new Error('Failed to generate cropped image.');

      setCroppedBlob(blob);
    } catch (err) {
      console.error('Crop error:', err);
      setErrorMessage(err.message || 'Failed to crop image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setImageObj(null);
    setCroppedBlob(null);
    setRotation(0);
    setErrorMessage('');
  };

  const isRot = rotation === 90 || rotation === 270;
  const curW = imageObj ? (isRot ? imageObj.height : imageObj.width) : 0;
  const curH = imageObj ? (isRot ? imageObj.width : imageObj.height) : 0;
  const liveCropW = Math.round(cropBox.w * curW);
  const liveCropH = Math.round(cropBox.h * curH);

  const getExtension = () => {
    if (outputFormat === 'image/jpeg') return '.jpg';
    if (outputFormat === 'image/webp') return '.webp';
    return '.png';
  };

  // -------------------------------------------------------------
  // VIEW 3: COMPLETION VIEW
  // -------------------------------------------------------------
  if (croppedBlob && croppedUrl && file) {
    const outFileName = `${file.name.replace(/\.[^/.]+$/, '')}-cropped${getExtension()}`;
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="Crop Image"
          message={`Image cropped successfully to ${liveCropW} × ${liveCropH} px!`}
          fileUrl={croppedUrl}
          fileName={outFileName}
          file={new File([croppedBlob], outFileName, { type: outputFormat })}
          onReset={handleReset}
          onProcessSourceAgain={() => setCroppedBlob(null)}
          sourceActionLabel="Crop Source Again"
          onProcessTarget={() => {
            const chained = new File([croppedBlob], outFileName, { type: outputFormat });
            setFile(chained);
            setCroppedBlob(null);
            setRotation(0);
            loadImage(chained);
          }}
          targetActionLabel="Use Cropped Image"
          currentPath="/crop-image"
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
        title="Crop Image"
        description="Interactive freeform and aspect-ratio cropping, circular avatar mode, rotation, and multi-format export."
        badge="Image Studio"
        badgeIcon={FiCrop}
        toolPath="/crop-image"
        acceptedFormats={['.jpg', '.jpeg', '.png', '.webp']}
        allowMultiple={false}
        maxSizeText="50 MB"
        accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }}
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
      {/* Aspect Ratios */}
      <div
        style={{
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '16px',
          padding: '1.25rem'
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.75rem' }}>
          Aspect Ratio:
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.5rem' }}>
          {ASPECT_RATIOS.map((item) => {
            const isSelected = aspectRatioId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSetRatio(item)}
                style={{
                  padding: '0.5rem',
                  borderRadius: '8px',
                  border: `1px solid ${isSelected ? 'var(--primary-color, #6366f1)' : 'var(--border-color, #334155)'}`,
                  background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'var(--subtle-bg, #0f172a)',
                  color: isSelected ? 'var(--primary-color, #6366f1)' : 'var(--text-color)',
                  fontSize: '0.82rem',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer'
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Shape & Export Settings */}
      <div
        style={{
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '16px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        {/* Circle Avatar Toggle */}
        <div>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.5rem' }}>
            Crop Shape:
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setIsCircle(false)}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: '8px',
                border: `1px solid ${!isCircle ? 'var(--primary-color, #6366f1)' : 'var(--border-color, #334155)'}`,
                background: !isCircle ? 'rgba(99, 102, 241, 0.15)' : 'var(--subtle-bg, #0f172a)',
                color: !isCircle ? 'var(--primary-color, #6366f1)' : 'var(--text-color)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem'
              }}
            >
              <FiMaximize /> Rectangle
            </button>
            <button
              type="button"
              onClick={() => setIsCircle(true)}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: '8px',
                border: `1px solid ${isCircle ? 'var(--primary-color, #6366f1)' : 'var(--border-color, #334155)'}`,
                background: isCircle ? 'rgba(99, 102, 241, 0.15)' : 'var(--subtle-bg, #0f172a)',
                color: isCircle ? 'var(--primary-color, #6366f1)' : 'var(--text-color)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem'
              }}
            >
              <FiUser /> Circular Avatar
            </button>
          </div>
        </div>

        {/* Output Format */}
        <div>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.5rem' }}>
            Export Format:
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {[
              { label: 'PNG', value: 'image/png' },
              { label: 'JPG', value: 'image/jpeg' },
              { label: 'WebP', value: 'image/webp' }
            ].map((fmt) => {
              const isSelected = outputFormat === fmt.value;
              return (
                <button
                  key={fmt.value}
                  type="button"
                  onClick={() => setOutputFormat(fmt.value)}
                  style={{
                    padding: '0.45rem',
                    borderRadius: '8px',
                    border: `1px solid ${isSelected ? 'var(--primary-color, #6366f1)' : 'var(--border-color, #334155)'}`,
                    background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'var(--subtle-bg, #0f172a)',
                    color: isSelected ? 'var(--primary-color, #6366f1)' : 'var(--text-color)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {fmt.label}
                </button>
              );
            })}
          </div>
        </div>

        {outputFormat === 'image/jpeg' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem', color: 'var(--text-secondary, #94a3b8)' }}>
              <span>JPEG Quality</span>
              <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>{quality}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--primary-color, #6366f1)' }}
            />
          </div>
        )}
      </div>
    </div>
  );

  const previewDesk = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: '100%',
        minHeight: 0,
        padding: '0.25rem',
      }}
    >
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
          ref={previewCanvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            maxWidth: '100%',
            height: 'auto',
            borderRadius: '4px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            cursor: isDragging ? 'grabbing' : 'crosshair',
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
        toolTitle="Crop Image"
        fileBadge={`${file.name} (${curW} × ${curH} px • ${formatFileSize(file.size)})`}
        onBack={handleReset}
        backLabel="Choose Another Image"
        headerExtra={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #334155)',
                background: 'var(--subtle-bg, #0f172a)',
                color: 'var(--text-color)',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              <FiRotateCw /> Rotate 90°
            </button>
          </div>
        }
        primaryAction={{
          label: isProcessing ? 'Cropping...' : `Apply Crop (${liveCropW} × ${liveCropH})`,
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
          defaultSplit={38}
          minLeftWidth={300}
          minRightWidth={360}
          height="100%"
          leftTitle="Crop Presets & Output"
          rightTitle="Interactive Crop Canvas"
          storageKey="crop_image"
        />
      </div>
    </div>
  );
}
