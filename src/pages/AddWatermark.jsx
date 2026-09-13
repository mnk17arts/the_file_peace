import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import {
  FiChevronLeft,
  FiChevronRight,
  FiCheck,
  FiSliders,
  FiType,
  FiEye,
  FiDownload,
  FiDroplet,
} from 'react-icons/fi';
import Loader from '../components/Loader';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import {
  ToolHeroView,
  ToolStudioHeader,
  ResizableSplitPane,
} from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';

import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// Brand-tailored preset chips
const PRESET_CHIPS = ['CONFIDENTIAL', 'RESTRICTED', 'DRAFT', 'COPY', 'SAMPLE', '© 2026'];

// The File Peace signature color palette
const BRAND_SWATCHES = [
  { name: 'Electric Cyan (Brand)', hex: '#1c99ff' },
  { name: 'Security Red', hex: '#ef4444' },
  { name: 'Amber Orange', hex: '#ff991c' },
  { name: 'Neon Mint', hex: '#10b981' },
  { name: 'Stealth Slate', hex: '#64748b' },
  { name: 'Midnight Pitch', hex: '#0f172a' },
];

const PATTERNS = [
  { id: 'single', label: 'Single Center' },
  { id: 'diagonal', label: 'Tiled Matrix' },
  { id: 'grid', label: '3×3 Grid' },
];

const AddWatermark = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const [originalFile, setOriginalFile] = useState(null);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewPageDataUrl, setPreviewPageDataUrl] = useState(null);
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);

  const [watermarkedUrl, setWatermarkedUrl] = useState(null);
  const [watermarkedBlob, setWatermarkedBlob] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Watermark Customization State
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [fontFamily, setFontFamily] = useState('helvetica'); // 'helvetica' | 'times' | 'courier'
  const [pattern, setPattern] = useState('diagonal'); // 'single' | 'diagonal' | 'grid'
  const [fontSize, setFontSize] = useState(48);
  const [opacity, setOpacity] = useState(0.25);
  const [rotation, setRotation] = useState(45);
  const [color, setColor] = useState('#1c99ff'); // The File Peace brand electric blue default

  const pdfJsDocRef = useRef(null);
  const watermarkedUrlRef = useRef(null);
  const handledRef = useRef(false);

  useEffect(() => {
    watermarkedUrlRef.current = watermarkedUrl;
  }, [watermarkedUrl]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (watermarkedUrlRef.current) URL.revokeObjectURL(watermarkedUrlRef.current);
    };
  }, []);

  const renderPdfPage = async (pdfDoc, pageNum) => {
    if (!pdfDoc) return;
    setIsRenderingPreview(true);
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPreviewPageDataUrl(dataUrl);
      setCurrentPage(pageNum);
    } catch (err) {
      console.warn("Could not render page preview:", err);
    } finally {
      setIsRenderingPreview(false);
    }
  };

  const handleFileLoad = useCallback(async (files) => {
    if (loadingRef.current) return;
    setErrorMessage(null);

    if (!files || files.length !== 1) {
      setErrorMessage("Please upload exactly one PDF to watermark.");
      return;
    }

    const file = files[0];
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage("Please select a valid PDF file (.pdf).");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setErrorMessage("File size exceeds 100 MB limit. Please select a smaller PDF.");
      return;
    }

    setWatermarkedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setWatermarkedBlob(null);
    setOriginalFile(file);

    try {
      setIsRenderingPreview(true);
      const buffer = await file.slice(0).arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: buffer });
      const doc = await loadingTask.promise;
      pdfJsDocRef.current = doc;
      setTotalPages(doc.numPages);
      await renderPdfPage(doc, 1);
    } catch (err) {
      console.warn("Error opening PDF for preview:", err);
      setErrorMessage("Could not render PDF preview. The file might be password-protected.");
    } finally {
      setIsRenderingPreview(false);
    }
  }, []);

  // Handle incoming file piped from another tool
  useEffect(() => {
    if (handledRef.current) return;
    const inc = consumeTransferredFile() || location.state?.incomingFile;
    if (inc) {
      handledRef.current = true;
      setTimeout(() => {
        handleFileLoad([inc]);
      }, 0);
    }
  }, [handleFileLoad, location.state]);

  const handleNextPage = () => {
    if (currentPage < totalPages && pdfJsDocRef.current) {
      renderPdfPage(pdfJsDocRef.current, currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1 && pdfJsDocRef.current) {
      renderPdfPage(pdfJsDocRef.current, currentPage - 1);
    }
  };

  const hexToRgbNormalized = (hex) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    return { r, g, b };
  };

  const handleWatermark = async () => {
    if (loading || !originalFile) return;
    setErrorMessage(null);

    const trimmedText = watermarkText.trim();
    if (!trimmedText) {
      setErrorMessage("Please enter a watermark text phrase.");
      return;
    }

    setLoading(true);

    try {
      const arrayBuffer = await originalFile.slice(0).arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();
      const fontMap = {
        helvetica: StandardFonts.HelveticaBold,
        times: StandardFonts.TimesRomanBold,
        courier: StandardFonts.CourierBold,
      };
      const font = await pdfDoc.embedFont(fontMap[fontFamily] || StandardFonts.HelveticaBold);
      const { r, g, b } = hexToRgbNormalized(color);
      const numFontSize = Number(fontSize);
      const numOpacity = Number(opacity);
      const numRotation = Number(rotation);

      // Sanitize text to standard ASCII for Helvetica compatibility
      const safeText = trimmedText.replace(/[^\x20-\x7E]/g, '');
      const displayText = safeText || trimmedText;

      for (const page of pages) {
        const { width, height } = page.getSize();

        if (pattern === 'single') {
          const textWidth = font.widthOfTextAtSize(displayText, numFontSize);
          const textHeight = font.heightAtSize(numFontSize);
          const rad = (numRotation * Math.PI) / 180;

          const x = (width - textWidth * Math.cos(rad) + textHeight * Math.sin(rad)) / 2;
          const y = (height - textWidth * Math.sin(rad) - textHeight * Math.cos(rad)) / 2;

          page.drawText(displayText, {
            x,
            y,
            size: numFontSize,
            font,
            color: rgb(r, g, b),
            opacity: numOpacity,
            rotate: degrees(numRotation),
          });
        } else if (pattern === 'diagonal') {
          const cols = 3;
          const rows = 4;
          const stepX = width / cols;
          const stepY = height / rows;
          const scaledSize = Math.max(12, Math.round(numFontSize * 0.65));
          const tWidth = font.widthOfTextAtSize(displayText, scaledSize);
          const tHeight = font.heightAtSize(scaledSize);
          const rad = (numRotation * Math.PI) / 180;

          for (let c = 0; c < cols; c++) {
            for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
              const cx = (c + 0.5) * stepX;
              const cy = (rowIdx + 0.5) * stepY;
              const x = cx - (tWidth * Math.cos(rad) - tHeight * Math.sin(rad)) / 2;
              const y = cy - (tWidth * Math.sin(rad) + tHeight * Math.cos(rad)) / 2;
              page.drawText(displayText, {
                x,
                y,
                size: scaledSize,
                font,
                color: rgb(r, g, b),
                opacity: numOpacity,
                rotate: degrees(numRotation),
              });
            }
          }
        } else if (pattern === 'grid') {
          const cols = 3;
          const rows = 3;
          const stepX = width / cols;
          const stepY = height / rows;
          const scaledSize = Math.max(12, Math.round(numFontSize * 0.6));
          const tWidth = font.widthOfTextAtSize(displayText, scaledSize);
          const tHeight = font.heightAtSize(scaledSize);

          for (let c = 0; c < cols; c++) {
            for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
              const cx = (c + 0.5) * stepX;
              const cy = (rowIdx + 0.5) * stepY;
              const x = cx - tWidth / 2;
              const y = cy - tHeight / 2;
              page.drawText(displayText, {
                x,
                y,
                size: scaledSize,
                font,
                color: rgb(r, g, b),
                opacity: numOpacity,
                rotate: degrees(0),
              });
            }
          }
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      if (watermarkedUrl) URL.revokeObjectURL(watermarkedUrl);
      const url = URL.createObjectURL(blob);
      setWatermarkedBlob(blob);
      setWatermarkedUrl(url);

    } catch (error) {
      console.error("Watermark error:", error);
      setErrorMessage("Failed to apply watermark. The PDF might be password-protected or corrupted.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (watermarkedUrl) URL.revokeObjectURL(watermarkedUrl);
    pdfJsDocRef.current = null;
    setOriginalFile(null);
    setPreviewPageDataUrl(null);
    setTotalPages(1);
    setCurrentPage(1);
    setWatermarkedUrl(null);
    setWatermarkedBlob(null);
    setErrorMessage(null);
  };

  // Font size scaled for the preview sheet display (~400px preview width vs ~595pt A4 width)
  const previewFontSize = Math.max(10, Math.round(fontSize * 0.65));

  // -------------------------------------------------------------
  // VIEW 3: FINAL COMPLETION VIEW
  // -------------------------------------------------------------
  if (watermarkedUrl && originalFile) {
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="Add Watermark to PDF"
          message="Watermark Added Successfully!"
          fileUrl={watermarkedUrl}
          fileName={`${originalFile.name.replace(/\.[^/.]+$/, '')}_watermarked.pdf`}
          file={watermarkedBlob}
          onReset={handleReset}
          onProcessSourceAgain={() => setWatermarkedBlob(null)}
          sourceActionLabel="Adjust Watermark Settings"
          onProcessTarget={() => {
            const chained = new File([watermarkedBlob], `${originalFile.name.replace(/\.[^/.]+$/, '')}_watermarked.pdf`, { type: 'application/pdf' });
            setOriginalFile(chained);
            setWatermarkedBlob(null);
            setPreviewPageDataUrl(null);
            setTotalPages(1);
            setCurrentPage(1);
            handleFileLoad([chained]);
          }}
          targetActionLabel="Watermark Output Again"
          currentPath="/add-watermark"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Upload stage)
  // -------------------------------------------------------------
  if (!originalFile) {
    return (
      <ToolHeroView
        title="Add Watermark to PDF"
        description="Stamp high-resolution vector text watermarks onto PDF pages with live real-time preview, custom angles, and repeating security matrices."
        badge="Watermark Studio"
        badgeIcon={FiDroplet}
        toolPath="/add-watermark"
        acceptedFormats={['.pdf']}
        allowMultiple={false}
        maxSizeText="100 MB"
        accept={{ 'application/pdf': ['.pdf'] }}
        onFilesSelected={handleFileLoad}
        alerts={
          errorMessage ? (
            <AlertBanner
              message={errorMessage}
              type="error"
              onClose={() => setErrorMessage(null)}
            />
          ) : null
        }
      />
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: CONFIGURATION VIEW (TYPE-A Draggable Two-Column Studio)
  // -------------------------------------------------------------
  const previewDesk = (
    <div style={{ ...styles.stageCard, height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
      <div style={styles.stageHeader}>
        <div style={styles.liveBadge}>
          <span style={styles.livePulseDot} />
          <span style={{ fontWeight: '700', fontSize: '0.8rem', letterSpacing: '0.05em' }}>
            LIVE PREVIEW
          </span>
        </div>

        {/* Multi-page Pager */}
        {totalPages > 1 && (
          <div style={styles.pagerContainer}>
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={currentPage <= 1 || isRenderingPreview}
              style={styles.pagerBtn}
              title="Previous page"
            >
              <FiChevronLeft size={16} />
            </button>
            <span style={styles.pagerText}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages || isRenderingPreview}
              style={styles.pagerBtn}
              title="Next page"
            >
              <FiChevronRight size={16} />
            </button>
          </div>
        )}
        {totalPages <= 1 && (
          <span style={{ fontSize: '0.82rem', opacity: 0.7 }}>
            Page 1 of 1
          </span>
        )}
      </div>

      {/* Realistic Document Canvas Sheet */}
      <div style={styles.canvasContainer}>
        <div style={styles.documentSheet}>
          {isRenderingPreview && (
            <div style={styles.renderLoader}>
              <div className="spinner" style={{ width: 28, height: 28, border: '3px solid #e2e8f0', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Rendering page...</span>
            </div>
          )}

          {previewPageDataUrl ? (
            <img
              src={previewPageDataUrl}
              alt={`Document page ${currentPage}`}
              style={styles.renderedPageImg}
            />
          ) : (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              Preparing canvas sheet...
            </div>
          )}

          {/* Reactive Watermark Layer */}
          <div style={styles.watermarkLayer}>
            {pattern === 'single' && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: `translate(-50%, -50%) rotate(-${rotation}deg)`,
                  color: color,
                  opacity: opacity,
                  fontSize: `${previewFontSize}px`,
                  fontWeight: '800',
                  fontFamily: fontFamily === 'times' ? "'Times New Roman', serif" : fontFamily === 'courier' ? "'Courier New', monospace" : 'sans-serif',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  pointerEvents: 'none',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  textShadow: '0 0 1px rgba(0,0,0,0.06)',
                }}
              >
                {watermarkText || 'WATERMARK'}
              </div>
            )}

            {pattern === 'diagonal' && (
              <div style={styles.diagonalGrid}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} style={styles.diagonalCell}>
                    <span
                      style={{
                        transform: `rotate(-${rotation}deg)`,
                        color: color,
                        opacity: opacity,
                        fontSize: `${Math.max(10, Math.round(previewFontSize * 0.65))}px`,
                        fontWeight: '800',
                        fontFamily: fontFamily === 'times' ? "'Times New Roman', serif" : fontFamily === 'courier' ? "'Courier New', monospace" : 'sans-serif',
                        whiteSpace: 'nowrap',
                        userSelect: 'none',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                      }}
                    >
                      {watermarkText || 'WATERMARK'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {pattern === 'grid' && (
              <div style={styles.alignedGrid}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} style={styles.alignedCell}>
                    <span
                      style={{
                        color: color,
                        opacity: opacity,
                        fontSize: `${Math.max(10, Math.round(previewFontSize * 0.6))}px`,
                        fontWeight: '800',
                        fontFamily: fontFamily === 'times' ? "'Times New Roman', serif" : fontFamily === 'courier' ? "'Courier New', monospace" : 'sans-serif',
                        whiteSpace: 'nowrap',
                        userSelect: 'none',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                      }}
                    >
                      {watermarkText || 'WATERMARK'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={styles.stageFooter}>
        <FiEye size={13} />
        <span>Watermark updates in real time on this live canvas</span>
      </div>
    </div>
  );

  const controlsDesk = (
    <div style={{ ...styles.controlsCard, height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>

      {/* Watermark Phrase & Preset Chips */}
      <div style={styles.controlGroup}>
        <label style={styles.controlLabel}>
          <FiType size={14} style={{ color: 'var(--primary-color)' }} />
          WATERMARK TEXT
        </label>
        <input
          type="text"
          value={watermarkText}
          onChange={(e) => setWatermarkText(e.target.value)}
          placeholder="Enter custom watermark text"
          style={styles.textInput}
          disabled={loading}
        />
        <div style={styles.chipRow}>
          {PRESET_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setWatermarkText(chip)}
              style={{
                ...styles.chipBtn,
                borderColor: watermarkText === chip ? 'var(--primary-color)' : 'var(--border-color)',
                backgroundColor: watermarkText === chip ? 'rgba(28, 153, 255, 0.12)' : 'transparent',
                color: watermarkText === chip ? 'var(--primary-color)' : 'inherit',
              }}
              disabled={loading}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Font Family Selector */}
      <div style={styles.controlGroup}>
        <label style={styles.controlLabel}>
          <FiType size={14} style={{ color: 'var(--primary-color)' }} />
          FONT STYLE
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
          {[
            { id: 'helvetica', label: 'Helvetica', font: 'sans-serif' },
            { id: 'times', label: 'Times', font: 'serif' },
            { id: 'courier', label: 'Courier', font: 'monospace' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFontFamily(f.id)}
              style={{
                padding: '0.5rem 0.4rem',
                borderRadius: '8px',
                border: fontFamily === f.id ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                backgroundColor: fontFamily === f.id ? 'rgba(28, 153, 255, 0.12)' : 'var(--card-bg)',
                color: fontFamily === f.id ? 'var(--primary-color)' : 'var(--text-color)',
                fontFamily: f.font,
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
              }}
              disabled={loading}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pattern Selector */}
      <div style={styles.controlGroup}>
        <label style={styles.controlLabel}>
          <FiSliders size={14} style={{ color: 'var(--secondary-color)' }} />
          WATERMARK PATTERN
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
          {PATTERNS.map((p) => {
            const isSelected = pattern === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPattern(p.id)}
                style={{
                  padding: '0.55rem 0.4rem',
                  borderRadius: '8px',
                  border: isSelected ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                  backgroundColor: isSelected ? 'rgba(28, 153, 255, 0.12)' : 'var(--card-bg)',
                  color: isSelected ? 'var(--primary-color)' : 'var(--text-color)',
                  fontWeight: '700',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.25rem',
                  transition: 'all 0.15s ease',
                }}
                disabled={loading}
              >
                {isSelected && <FiCheck size={12} />}
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders Grid */}
      <div style={styles.sliderGrid}>
        {/* Opacity */}
        <div style={styles.sliderBox}>
          <div style={styles.sliderHeader}>
            <span style={styles.sliderTitle}>OPACITY</span>
            <span style={styles.sliderBadge}>{Math.round(opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.05"
            max="0.9"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            style={styles.rangeInput}
            disabled={loading}
          />
        </div>

        {/* Font Size */}
        <div style={styles.sliderBox}>
          <div style={styles.sliderHeader}>
            <span style={styles.sliderTitle}>FONT SIZE</span>
            <span style={styles.sliderBadge}>{fontSize}PT</span>
          </div>
          <input
            type="range"
            min="16"
            max="96"
            step="2"
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
            style={styles.rangeInput}
            disabled={loading}
          />
        </div>

        {/* Rotation Angle */}
        {pattern !== 'grid' && (
          <div style={{ ...styles.sliderBox, gridColumn: '1 / -1' }}>
            <div style={styles.sliderHeader}>
              <span style={styles.sliderTitle}>ROTATION ANGLE</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setRotation(0)}
                  style={styles.anglePresetBtn}
                  disabled={loading}
                >
                  0°
                </button>
                <button
                  type="button"
                  onClick={() => setRotation(45)}
                  style={styles.anglePresetBtn}
                  disabled={loading}
                >
                  45°
                </button>
                <button
                  type="button"
                  onClick={() => setRotation(90)}
                  style={styles.anglePresetBtn}
                  disabled={loading}
                >
                  90°
                </button>
                <span style={{ ...styles.sliderBadge, marginLeft: '0.3rem' }}>{rotation}°</span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="5"
              value={rotation}
              onChange={(e) => setRotation(parseInt(e.target.value, 10))}
              style={styles.rangeInput}
              disabled={loading}
            />
          </div>
        )}
      </div>

      {/* Signature Color Swatches & Custom Picker */}
      <div style={styles.controlGroup}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={styles.controlLabel}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color }} />
            WATERMARK COLOR
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{
                width: '75px',
                padding: '0.2rem 0.4rem',
                fontSize: '0.78rem',
                fontFamily: 'monospace',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-color)',
                textAlign: 'center',
              }}
              disabled={loading}
            />
            <input
              type="color"
              value={color.startsWith('#') && color.length === 7 ? color : '#1c99ff'}
              onChange={(e) => setColor(e.target.value)}
              style={{
                width: '28px',
                height: '28px',
                padding: 0,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: 'transparent',
              }}
              disabled={loading}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
          {BRAND_SWATCHES.map((swatch) => (
            <button
              key={swatch.hex}
              type="button"
              onClick={() => setColor(swatch.hex)}
              title={swatch.name}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: swatch.hex,
                border: color === swatch.hex ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.15)',
                boxShadow: color === swatch.hex ? '0 0 0 2px var(--primary-color)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'all 0.15s ease',
              }}
              disabled={loading}
            >
              {color === swatch.hex && <FiCheck size={14} color="#ffffff" />}
            </button>
          ))}
        </div>
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
      <ToolStudioHeader
        title="Add Watermark to PDF"
        icon={FiDroplet}
        file={originalFile}
        category="Edit PDF"
        toolPath="/add-watermark"
        onReset={handleReset}
        resetLabel="Change PDF"
        actionButton={
          <button
            type="button"
            onClick={handleWatermark}
            disabled={loading || !watermarkText.trim()}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: loading || !watermarkText.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            <FiDownload size={14} />
            <span>{loading ? 'Stamping...' : 'Stamp & Apply Watermark'}</span>
          </button>
        }
      />

      {errorMessage && (
        <div style={{ marginBottom: '0.5rem' }}>
          <AlertBanner message={errorMessage} type="error" onClose={() => setErrorMessage(null)} />
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        <ResizableSplitPane
          leftPane={controlsDesk}
          rightPane={previewDesk}
          defaultSplit={44}
          minLeftWidth={340}
          minRightWidth={360}
          height="100%"
          leftTitle="Settings"
          rightTitle="Live Preview"
          storageKey="add_watermark"
        />
      </div>

      <Loader
        isLoading={loading}
        phrases={[
          "Reading PDF document structure...",
          "Calculating typography bounding matrices...",
          "Stamping watermark across all pages...",
          "Finalizing flattened security..."
        ]}
      />
    </div>
  );
};

const styles = {
  studioTopBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.85rem 1.25rem',
    borderRadius: '12px',
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    gap: '1rem',
    flexWrap: 'wrap',
    width: '100%',
    boxSizing: 'border-box',
    minWidth: 0,
  },
  filePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    minWidth: 0,
    overflow: 'hidden',
  },
  fileIconBadge: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: 'var(--primary-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  filePillName: {
    fontWeight: '700',
    fontSize: '0.95rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '260px',
  },
  filePillMeta: {
    fontSize: '0.78rem',
    opacity: 0.7,
    marginTop: '2px',
  },
  ghostBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.5rem 0.9rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'transparent',
    color: 'var(--text-color)',
    fontSize: '0.82rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  studioGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1.5rem',
    alignItems: 'start',
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  },
  stageCard: {
    backgroundColor: 'var(--card-bg)',
    borderRadius: '16px',
    border: '1px solid var(--border-color)',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    minWidth: 0,
    width: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  stageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '0.75rem',
    borderBottom: '1px solid var(--border-color)',
    minWidth: 0,
  },
  liveBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  livePulseDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-color, #10b981)',
    display: 'inline-block',
    boxShadow: '0 0 8px var(--accent-color, #10b981)',
  },
  pagerContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: 'var(--bg-color)',
    padding: '0.2rem 0.4rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
  },
  pagerBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-color)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.25rem',
    borderRadius: '4px',
  },
  pagerText: {
    fontSize: '0.78rem',
    fontWeight: '600',
    padding: '0 0.4rem',
  },
  canvasContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '0.75rem 0',
    width: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  documentSheet: {
    width: '100%',
    maxWidth: '420px',
    aspectRatio: '1 / 1.414',
    backgroundColor: '#ffffff',
    borderRadius: '6px',
    boxShadow: '0 14px 40px rgba(0, 0, 0, 0.18)',
    position: 'relative',
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
  },
  renderLoader: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    backgroundColor: 'rgba(255,255,255,0.92)',
    zIndex: 4,
  },
  renderedPageImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
    userSelect: 'none',
  },
  fallbackDoc: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '0.75rem',
    color: '#0f172a',
  },
  watermarkLayer: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 3,
    overflow: 'hidden',
  },
  diagonalGrid: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gridTemplateRows: 'repeat(4, 1fr)',
  },
  diagonalCell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  alignedGrid: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gridTemplateRows: 'repeat(3, 1fr)',
  },
  alignedCell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stageFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    fontSize: '0.78rem',
    opacity: 0.65,
    borderTop: '1px solid var(--border-color)',
    paddingTop: '0.75rem',
  },
  controlsCard: {
    backgroundColor: 'var(--card-bg)',
    borderRadius: '16px',
    border: '1px solid var(--border-color)',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem',
    minWidth: 0,
    width: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  primaryActionSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  stampActionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.65rem',
    width: '100%',
    padding: '0.9rem 1rem',
    backgroundColor: 'var(--primary-color)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '1rem',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(28, 153, 255, 0.35)',
    transition: 'all 0.15s ease',
    boxSizing: 'border-box',
    textAlign: 'center',
  },
  actionNote: {
    textAlign: 'center',
    fontSize: '0.76rem',
    opacity: 0.7,
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--border-color)',
    margin: '0.2rem 0',
  },
  controlGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    width: '100%',
    boxSizing: 'border-box',
    minWidth: 0,
  },
  controlLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '0.78rem',
    fontWeight: '700',
    letterSpacing: '0.05em',
    opacity: 0.85,
  },
  textInput: {
    width: '100%',
    padding: '0.75rem 0.85rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-color)',
    color: 'var(--text-color)',
    fontSize: '0.95rem',
    fontWeight: '600',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
    marginTop: '0.2rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  chipBtn: {
    padding: '0.3rem 0.65rem',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    fontSize: '0.74rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxSizing: 'border-box',
  },
  patternCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '0.5rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  patternCardBtn: {
    padding: '0.75rem 0.85rem',
    borderRadius: '10px',
    border: '1.5px solid var(--border-color)',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.15s ease',
    color: 'var(--text-color)',
    boxSizing: 'border-box',
    minWidth: 0,
  },
  patternCardDesc: {
    fontSize: '0.72rem',
    opacity: 0.65,
    lineHeight: 1.3,
    wordBreak: 'break-word',
  },
  sliderGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '0.85rem',
    width: '100%',
    boxSizing: 'border-box',
    minWidth: 0,
  },
  sliderBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    minWidth: 0,
    width: '100%',
    boxSizing: 'border-box',
  },
  sliderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    minWidth: 0,
  },
  sliderTitle: {
    fontSize: '0.74rem',
    fontWeight: '700',
    letterSpacing: '0.05em',
    opacity: 0.8,
  },
  sliderBadge: {
    fontSize: '0.76rem',
    fontWeight: '700',
    fontFamily: 'monospace',
    color: 'var(--primary-color)',
  },
  rangeInput: {
    width: '100%',
    cursor: 'pointer',
    accentColor: 'var(--primary-color)',
  },
  anglePresetBtn: {
    padding: '0.15rem 0.35rem',
    fontSize: '0.7rem',
    borderRadius: '4px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'transparent',
    color: 'var(--text-color)',
    cursor: 'pointer',
    fontWeight: '600',
  },
  colorPalette: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    flexWrap: 'wrap',
    marginTop: '0.2rem',
  },
  colorCircle: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    transition: 'transform 0.15s ease',
  },
  customColorLabel: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '2px dashed var(--border-color)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    color: 'var(--text-color)',
  },
  colorHiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: '100%',
    height: '100%',
    cursor: 'pointer',
  },
};

export default AddWatermark;
