import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import {
  FiFileText,
  FiChevronLeft,
  FiChevronRight,
  FiCheck,
  FiSliders,
  FiType,
  FiEye,
  FiDownload
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

// Format chips
const NUMBER_FORMATS = [
  { id: 'numbers', label: '1, 2, 3', desc: 'Standard sequential numbers' },
  { id: 'page_n_of_total', label: 'Page 1 of N', desc: 'Formal document reference' },
  { id: 'n_slash_total', label: '1 / N', desc: 'Compact fractional index' },
  { id: 'roman_lower', label: 'i, ii, iii', desc: 'Roman numerals (lowercase)' },
  { id: 'roman_upper', label: 'I, II, III', desc: 'Roman numerals (uppercase)' },
  { id: 'alpha', label: 'A, B, C', desc: 'Alphabetical series' },
];

// 6 standard document placement points
const POSITIONS = [
  { id: 'top-left', label: 'Top Left', row: 'top', col: 'left' },
  { id: 'top-center', label: 'Top Center', row: 'top', col: 'center' },
  { id: 'top-right', label: 'Top Right', row: 'top', col: 'right' },
  { id: 'bottom-left', label: 'Bottom Left', row: 'bottom', col: 'left' },
  { id: 'bottom-center', label: 'Bottom Center', row: 'bottom', col: 'center' },
  { id: 'bottom-right', label: 'Bottom Right', row: 'bottom', col: 'right' },
];

// The File Peace signature color palette
const BRAND_SWATCHES = [
  { name: 'Stealth Dark', hex: '#0f172a' },
  { name: 'Slate Grey', hex: '#64748b' },
  { name: 'Electric Cyan (Brand)', hex: '#1c99ff' },
  { name: 'Security Red', hex: '#ef4444' },
  { name: 'Amber Orange', hex: '#ff991c' },
  { name: 'Neon Mint', hex: '#10b981' },
];

// Conversion helpers
const toRoman = (num) => {
  if (num <= 0) return `${num}`;
  const romanMap = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let res = '';
  let n = num;
  for (const [val, char] of romanMap) {
    while (n >= val) {
      res += char;
      n -= val;
    }
  }
  return res || 'I';
};

const toAlpha = (num) => {
  if (num <= 0) return `${num}`;
  let res = '';
  let n = num;
  while (n > 0) {
    const rem = (n - 1) % 26;
    res = String.fromCharCode(65 + rem) + res;
    n = Math.floor((n - 1) / 26);
  }
  return res || 'A';
};

const formatPageNumber = (pageIndex, totalPages, format, startAt, skipCover) => {
  if (skipCover && pageIndex === 0) {
    return null;
  }
  const offset = skipCover ? pageIndex - 1 : pageIndex;
  const num = Number(startAt) + offset;
  const effectiveTotal = skipCover ? Math.max(1, totalPages - 1) : totalPages;

  switch (format) {
    case 'numbers':
      return `${num}`;
    case 'page_n_of_total':
      return `Page ${num} of ${effectiveTotal}`;
    case 'n_slash_total':
      return `${num} / ${effectiveTotal}`;
    case 'roman_lower':
      return toRoman(num).toLowerCase();
    case 'roman_upper':
      return toRoman(num);
    case 'alpha':
      return toAlpha(num);
    default:
      return `${num}`;
  }
};

const AddPageNumbers = () => {
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
  const [pageAspectRatio, setPageAspectRatio] = useState('1 / 1.414');
  const [nativePageDimensions, setNativePageDimensions] = useState({ width: 595, height: 842 });
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);

  const [numberedUrl, setNumberedUrl] = useState(null);
  const [numberedBlob, setNumberedBlob] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Configuration State
  const [position, setPosition] = useState('bottom-center');
  const [numberFormat, setNumberFormat] = useState('numbers');
  const [startPage, setStartPage] = useState(1);
  const [skipCoverPage, setSkipCoverPage] = useState(false);
  const [excludeLastPage, setExcludeLastPage] = useState(false);
  const [fontSize, setFontSize] = useState(10);
  const [fontWeight, setFontWeight] = useState('regular'); // 'regular' | 'bold'
  const [color, setColor] = useState('#0f172a');
  const [marginOffset, setMarginOffset] = useState(32); // distance from edge in pt

  const pdfJsDocRef = useRef(null);
  const numberedUrlRef = useRef(null);
  const handledRef = useRef(false);

  useEffect(() => {
    numberedUrlRef.current = numberedUrl;
  }, [numberedUrl]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (numberedUrlRef.current) URL.revokeObjectURL(numberedUrlRef.current);
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
      if (viewport.width && viewport.height) {
        setPageAspectRatio(`${viewport.width} / ${viewport.height}`);
        setNativePageDimensions({ width: viewport.width, height: viewport.height });
      }
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
      setErrorMessage("Please upload exactly one PDF to add page numbers.");
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

    setNumberedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setNumberedBlob(null);
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

  const handleAddPageNumbers = async () => {
    if (loading || !originalFile) return;
    setErrorMessage(null);
    setLoading(true);

    try {
      const arrayBuffer = await originalFile.slice(0).arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const font = fontWeight === 'bold'
        ? await pdfDoc.embedFont(StandardFonts.HelveticaBold)
        : await pdfDoc.embedFont(StandardFonts.Helvetica);

      const pages = pdfDoc.getPages();
      const { r, g, b } = hexToRgbNormalized(color);
      const numFontSize = Number(fontSize);
      const margin = Number(marginOffset);

      for (let i = 0; i < pages.length; i++) {
        // Skip cover page if enabled
        if (skipCoverPage && i === 0) continue;
        // Skip last page if enabled
        if (excludeLastPage && i === pages.length - 1) continue;

        const pageText = formatPageNumber(i, pages.length, numberFormat, startPage, skipCoverPage);
        if (!pageText) continue;

        const page = pages[i];
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(pageText, numFontSize);
        const textHeight = font.heightAtSize(numFontSize);

        let x = (width - textWidth) / 2;
        let y = margin;

        if (position === 'top-left') {
          x = margin;
          y = height - margin - textHeight;
        } else if (position === 'top-center') {
          x = (width - textWidth) / 2;
          y = height - margin - textHeight;
        } else if (position === 'top-right') {
          x = width - margin - textWidth;
          y = height - margin - textHeight;
        } else if (position === 'bottom-left') {
          x = margin;
          y = margin;
        } else if (position === 'bottom-center') {
          x = (width - textWidth) / 2;
          y = margin;
        } else if (position === 'bottom-right') {
          x = width - margin - textWidth;
          y = margin;
        }

        page.drawText(pageText, {
          x,
          y,
          size: numFontSize,
          font,
          color: rgb(r, g, b),
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      if (numberedUrl) URL.revokeObjectURL(numberedUrl);
      const url = URL.createObjectURL(blob);
      setNumberedBlob(blob);
      setNumberedUrl(url);

    } catch (error) {
      console.error("Page numbers error:", error);
      setErrorMessage("Failed to add page numbers. The document might be password-protected or corrupted.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (numberedUrl) URL.revokeObjectURL(numberedUrl);
    pdfJsDocRef.current = null;
    setOriginalFile(null);
    setPreviewPageDataUrl(null);
    setTotalPages(1);
    setCurrentPage(1);
    setNumberedUrl(null);
    setNumberedBlob(null);
    setErrorMessage(null);
  };

  // Preview formatting calculation
  const previewPageText = formatPageNumber(currentPage - 1, totalPages, numberFormat, startPage, skipCoverPage);
  const isExcludedPage = (skipCoverPage && currentPage === 1) || (excludeLastPage && currentPage === totalPages);

  // Determine overlay coordinates based on active position and native page dimensions
  const getOverlayStyle = () => {
    const isTop = position.startsWith('top');
    const isLeft = position.endsWith('left');
    const isRight = position.endsWith('right');

    const nativeH = nativePageDimensions?.height || 842;
    const nativeW = nativePageDimensions?.width || 595;
    const verticalPercent = Math.max(1.5, Math.min(45, (marginOffset / nativeH) * 100));
    const horizontalPercent = Math.max(1.5, Math.min(45, (marginOffset / nativeW) * 100));

    const style = {
      position: 'absolute',
      color: color,
      fontSize: `${Math.max(10, Math.round(fontSize * 0.85))}px`,
      fontWeight: fontWeight === 'bold' ? '700' : '500',
      fontFamily: 'inherit',
      pointerEvents: 'none',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      zIndex: 3,
      padding: '2px 4px',
    };

    if (isTop) {
      style.top = `${verticalPercent}%`;
    } else {
      style.bottom = `${verticalPercent}%`;
    }

    if (isLeft) {
      style.left = `${horizontalPercent}%`;
    } else if (isRight) {
      style.right = `${horizontalPercent}%`;
    } else {
      style.left = '50%';
      style.transform = 'translateX(-50%)';
    }

    return style;
  };

  // -------------------------------------------------------------
  // VIEW 3: FINAL COMPLETION VIEW
  // -------------------------------------------------------------
  if (numberedUrl && originalFile) {
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="Add Page Numbers to PDF"
          fileUrl={numberedUrl}
          fileName={`${originalFile.name.replace(/\.[^/.]+$/, "")}_numbered.pdf`}
          file={numberedBlob}
          onReset={handleReset}
          message="Page Numbers Added Successfully!"
          currentPath="/page-numbers"
          onProcessSourceAgain={() => setNumberedBlob(null)}
          sourceActionLabel="Adjust Numbering Settings"
          onProcessTarget={() => {
            const chained = new File([numberedBlob], `${originalFile.name.replace(/\.[^/.]+$/, "")}_numbered.pdf`, { type: 'application/pdf' });
            setOriginalFile(chained);
            setNumberedBlob(null);
            handleFileLoad([chained]);
          }}
          targetActionLabel="Number Output Again"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Empty state)
  // -------------------------------------------------------------
  if (!originalFile) {
    return (
      <ToolHeroView
        title="Add Page Numbers to PDF"
        description="Insert sequential, customized page numbers with real-time dynamic document preview and precision placement."
        badge="Pagination Studio"
        badgeIcon={FiFileText}
        toolPath="/page-numbers"
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
  // VIEW 2: CONFIGURATION VIEW (Studio Archetype)
  // -------------------------------------------------------------
  const previewDesk = (
    <div style={{ ...styles.stageCard, height: '100%', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ ...styles.stageHeader, flexShrink: 0 }}>
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
        <div style={{ ...styles.documentSheet, aspectRatio: pageAspectRatio }}>
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
            <div style={styles.fallbackDoc}>
              <FiFileText size={48} style={{ opacity: 0.25 }} />
              <span style={{ fontSize: '0.9rem', opacity: 0.5 }}>Loading document layout...</span>
            </div>
          )}

          {/* Reactive Dynamic Page Number Overlay */}
          {isExcludedPage ? (
            <div style={{
              ...getOverlayStyle(),
              opacity: 0.5,
              fontStyle: 'italic',
              backgroundColor: 'rgba(255,255,255,0.85)',
              border: '1px dashed #cbd5e1',
              borderRadius: '4px',
              fontSize: '0.75rem',
            }}>
              Cover Page (No Number)
            </div>
          ) : previewPageText ? (
            <div style={getOverlayStyle()}>
              {previewPageText}
            </div>
          ) : null}
        </div>
      </div>

      <div style={styles.stageFooter}>
        <FiEye size={13} />
        <span>Page number position and typography update dynamically</span>
      </div>
    </div>
  );

  const controlsDesk = (
    <div style={{ ...styles.controlsCard, height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
      {/* Number Format Selector */}
      <div style={styles.controlGroup}>
        <label style={styles.controlLabel}>
          <FiType size={14} style={{ color: 'var(--primary-color)' }} />
          NUMBER FORMAT
        </label>
        <div style={styles.formatChipGrid}>
          {NUMBER_FORMATS.map((fmt) => {
            const isSelected = numberFormat === fmt.id;
            return (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setNumberFormat(fmt.id)}
                style={{
                  ...styles.formatChipBtn,
                  borderColor: isSelected ? 'var(--primary-color)' : 'var(--border-color)',
                  backgroundColor: isSelected ? 'rgba(28, 153, 255, 0.12)' : 'var(--bg-color)',
                  color: isSelected ? 'var(--primary-color)' : 'inherit',
                  fontWeight: isSelected ? '700' : '600',
                }}
                disabled={loading}
              >
                {fmt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive 6-Point Placement Matrix */}
      <div style={styles.controlGroup}>
        <div style={styles.sliderHeader}>
          <label style={styles.controlLabel}>
            <FiSliders size={14} style={{ color: 'var(--secondary-color)' }} />
            PLACEMENT POSITION
          </label>
          <span style={styles.activePosBadge}>
            {POSITIONS.find((p) => p.id === position)?.label || 'Bottom Center'}
          </span>
        </div>

        {/* Tactile Mini Document Layout Matrix */}
        <div style={styles.miniDocCard}>
          {/* Top Row Positions */}
          <div style={styles.miniDocRow}>
            <button
              type="button"
              onClick={() => setPosition('top-left')}
              style={{
                ...styles.anchorDotBtn,
                ...(position === 'top-left' ? styles.anchorDotActive : {}),
              }}
              title="Top Left"
              disabled={loading}
            >
              <span style={styles.anchorInnerDot} />
            </button>
            <button
              type="button"
              onClick={() => setPosition('top-center')}
              style={{
                ...styles.anchorDotBtn,
                ...(position === 'top-center' ? styles.anchorDotActive : {}),
              }}
              title="Top Center"
              disabled={loading}
            >
              <span style={styles.anchorInnerDot} />
            </button>
            <button
              type="button"
              onClick={() => setPosition('top-right')}
              style={{
                ...styles.anchorDotBtn,
                ...(position === 'top-right' ? styles.anchorDotActive : {}),
              }}
              title="Top Right"
              disabled={loading}
            >
              <span style={styles.anchorInnerDot} />
            </button>
          </div>

          {/* Simulated Content Lines */}
          <div style={styles.miniDocContentLines}>
            <div style={{ width: '45%', height: '4px', backgroundColor: 'var(--border-color)', borderRadius: '2px' }} />
            <div style={{ width: '80%', height: '3px', backgroundColor: 'var(--border-color)', borderRadius: '2px', opacity: 0.7 }} />
            <div style={{ width: '65%', height: '3px', backgroundColor: 'var(--border-color)', borderRadius: '2px', opacity: 0.7 }} />
          </div>

          {/* Bottom Row Positions */}
          <div style={styles.miniDocRow}>
            <button
              type="button"
              onClick={() => setPosition('bottom-left')}
              style={{
                ...styles.anchorDotBtn,
                ...(position === 'bottom-left' ? styles.anchorDotActive : {}),
              }}
              title="Bottom Left"
              disabled={loading}
            >
              <span style={styles.anchorInnerDot} />
            </button>
            <button
              type="button"
              onClick={() => setPosition('bottom-center')}
              style={{
                ...styles.anchorDotBtn,
                ...(position === 'bottom-center' ? styles.anchorDotActive : {}),
              }}
              title="Bottom Center"
              disabled={loading}
            >
              <span style={styles.anchorInnerDot} />
            </button>
            <button
              type="button"
              onClick={() => setPosition('bottom-right')}
              style={{
                ...styles.anchorDotBtn,
                ...(position === 'bottom-right' ? styles.anchorDotActive : {}),
              }}
              title="Bottom Right"
              disabled={loading}
            >
              <span style={styles.anchorInnerDot} />
            </button>
          </div>
        </div>
      </div>

      {/* Page Numbering Rules */}
      <div style={styles.controlGroup}>
        <label style={styles.controlLabel}>
          <FiSliders size={14} style={{ color: 'var(--accent-color, #10b981)' }} />
          DOCUMENT RULES
        </label>
        <div style={styles.rulesContainer}>
          {/* Start At */}
          <div style={styles.ruleItem}>
            <label style={{ fontSize: '0.82rem', fontWeight: '600' }}>First Number:</label>
            <input
              type="number"
              min="1"
              value={startPage}
              onChange={(e) => setStartPage(Math.max(1, parseInt(e.target.value, 10) || 1))}
              style={styles.numberInput}
              disabled={loading}
            />
          </div>

          {/* Skip Cover Page */}
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={skipCoverPage}
              onChange={(e) => setSkipCoverPage(e.target.checked)}
              disabled={loading}
              style={styles.checkboxInput}
            />
            <span style={{ fontSize: '0.82rem', fontWeight: '500' }}>Skip first page (cover)</span>
          </label>

          {/* Exclude Last Page */}
          {totalPages > 2 && (
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={excludeLastPage}
                onChange={(e) => setExcludeLastPage(e.target.checked)}
                disabled={loading}
                style={styles.checkboxInput}
              />
              <span style={{ fontSize: '0.82rem', fontWeight: '500' }}>Exclude last page</span>
            </label>
          )}
        </div>
      </div>

      {/* Sliders Grid: Font Size & Margin Offset */}
      <div style={styles.sliderGrid}>
        {/* Font Size */}
        <div style={styles.sliderBox}>
          <div style={styles.sliderHeader}>
            <span style={styles.sliderTitle}>FONT SIZE</span>
            <span style={styles.sliderBadge}>{fontSize}PT</span>
          </div>
          <input
            type="range"
            min="8"
            max="24"
            step="1"
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
            style={styles.rangeInput}
            disabled={loading}
          />
        </div>

        {/* Margin Offset */}
        <div style={styles.sliderBox}>
          <div style={styles.sliderHeader}>
            <span style={styles.sliderTitle}>MARGIN</span>
            <span style={styles.sliderBadge}>{marginOffset}PT</span>
          </div>
          <input
            type="range"
            min="18"
            max="54"
            step="2"
            value={marginOffset}
            onChange={(e) => setMarginOffset(parseInt(e.target.value, 10))}
            style={styles.rangeInput}
            disabled={loading}
          />
        </div>
      </div>

      {/* Font Weight & Color Studio */}
      <div style={styles.controlGroup}>
        <div style={styles.sliderHeader}>
          <label style={styles.controlLabel}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
            TYPOGRAPHY & COLOR
          </label>
          <span style={{ fontSize: '0.8rem', opacity: 0.7, fontFamily: 'monospace' }}>{color}</span>
        </div>

        {/* Weight Selector */}
        <div style={styles.weightButtonGroup}>
          <button
            type="button"
            onClick={() => setFontWeight('regular')}
            style={{
              ...styles.weightBtn,
              ...(fontWeight === 'regular' ? styles.weightBtnActive : {}),
            }}
            disabled={loading}
          >
            Regular
          </button>
          <button
            type="button"
            onClick={() => setFontWeight('bold')}
            style={{
              ...styles.weightBtn,
              ...(fontWeight === 'bold' ? styles.weightBtnActive : {}),
            }}
            disabled={loading}
          >
            Bold
          </button>
        </div>

        {/* Color Swatches */}
        <div style={styles.colorPalette}>
          {BRAND_SWATCHES.map((preset) => {
            const isSelected = color.toLowerCase() === preset.hex.toLowerCase();
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => setColor(preset.hex)}
                title={preset.name}
                style={{
                  ...styles.colorCircle,
                  backgroundColor: preset.hex,
                  boxShadow: isSelected ? '0 0 0 2px var(--card-bg), 0 0 0 4px var(--primary-color)' : 'none',
                }}
                disabled={loading}
              >
                {isSelected && <FiCheck size={14} color="#ffffff" />}
              </button>
            );
          })}
          {/* Custom color picker */}
          <label
            style={styles.customColorLabel}
            title="Choose custom color"
          >
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={styles.colorHiddenInput}
              disabled={loading}
            />
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>+</span>
          </label>
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
        title="Add Page Numbers to PDF"
        icon={FiFileText}
        file={originalFile}
        category="Edit PDF"
        toolPath="/page-numbers"
        onReset={handleReset}
        resetLabel="Change PDF"
        actionButton={
          <button
            type="button"
            onClick={handleAddPageNumbers}
            disabled={loading}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <FiDownload size={14} /> {loading ? 'Applying...' : 'Apply Page Numbers'}
          </button>
        }
      />

      {errorMessage && (
        <div style={{ margin: '0.5rem 0' }}>
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
          storageKey="add_page_numbers"
        />
      </div>

      <Loader
        isLoading={loading}
        phrases={[
          "Reading PDF document pages...",
          "Calculating geometric page coordinates...",
          "Stamping formatted page numbers...",
          "Finalizing pagination output..."
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
    flex: 1,
    minHeight: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '0.5rem',
    width: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  documentSheet: {
    height: '100%',
    maxHeight: '100%',
    maxWidth: '100%',
    width: 'auto',
    backgroundColor: '#ffffff',
    borderRadius: '6px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
    position: 'relative',
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
  formatChipGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  formatChipBtn: {
    flex: '1 1 calc(33.333% - 0.45rem)',
    minWidth: '85px',
    padding: '0.5rem 0.35rem',
    borderRadius: '8px',
    border: '1.5px solid var(--border-color)',
    fontSize: '0.76rem',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    boxSizing: 'border-box',
  },
  activePosBadge: {
    fontSize: '0.76rem',
    fontWeight: '700',
    color: 'var(--primary-color)',
  },
  miniDocCard: {
    width: '100%',
    maxWidth: '240px',
    height: '120px',
    backgroundColor: 'var(--bg-color)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    margin: '0.25rem auto 0 auto',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '0.6rem 0.75rem',
    boxSizing: 'border-box',
    position: 'relative',
    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)',
  },
  miniDocRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  miniDocContentLines: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    width: '100%',
  },
  anchorDotBtn: {
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    border: '1.5px solid var(--border-color)',
    backgroundColor: 'var(--card-bg)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    transition: 'all 0.15s ease',
  },
  anchorDotActive: {
    borderColor: 'var(--primary-color)',
    backgroundColor: 'var(--primary-color)',
    boxShadow: '0 0 8px rgba(28, 153, 255, 0.4)',
  },
  anchorInnerDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'currentColor',
    opacity: 0.6,
  },
  rulesContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
    backgroundColor: 'var(--bg-color)',
    padding: '0.75rem 0.9rem',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    width: '100%',
    boxSizing: 'border-box',
  },
  ruleItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '0.4rem',
  },
  numberInput: {
    width: '70px',
    padding: '0.35rem 0.5rem',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--card-bg)',
    color: 'var(--text-color)',
    fontSize: '0.85rem',
    fontWeight: '600',
    textAlign: 'center',
    boxSizing: 'border-box',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    flexWrap: 'wrap',
  },
  checkboxInput: {
    cursor: 'pointer',
    accentColor: 'var(--primary-color)',
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
    boxSizing: 'border-box',
  },
  weightButtonGroup: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
    marginBottom: '0.2rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  weightBtn: {
    padding: '0.5rem',
    borderRadius: '8px',
    border: '1.5px solid var(--border-color)',
    backgroundColor: 'var(--bg-color)',
    color: 'var(--text-color)',
    fontSize: '0.82rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    textAlign: 'center',
    boxSizing: 'border-box',
  },
  weightBtnActive: {
    backgroundColor: 'var(--primary-color)',
    color: '#ffffff',
    borderColor: 'var(--primary-color)',
  },
  colorPalette: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    flexWrap: 'wrap',
    marginTop: '0.2rem',
    width: '100%',
    boxSizing: 'border-box',
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
    flexShrink: 0,
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
    flexShrink: 0,
  },
  colorHiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: '100%',
    height: '100%',
    cursor: 'pointer',
  },
};

export default AddPageNumbers;
