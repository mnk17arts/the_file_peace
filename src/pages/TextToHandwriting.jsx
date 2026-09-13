import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import {
  FiDownload,
  FiChevronLeft,
  FiChevronRight,
  FiEdit3,
} from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import { ToolStudioHeader, ResizableSplitPane } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { validatePdfFile } from '../utils/fileUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// Handwriting Font Presets with Web Font fallbacks
const HANDWRITING_FONTS = [
  { id: 'caveat', name: 'Casual Cursive', fontFamily: "'Caveat', cursive", url: 'https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&display=swap' },
  { id: 'architect', name: 'Architect Draft', fontFamily: "'Architects Daughter', cursive", url: 'https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap' },
  { id: 'shadows', name: 'Student Script', fontFamily: "'Shadows Into Light', cursive", url: 'https://fonts.googleapis.com/css2?family=Shadows+Into+Light&display=swap' },
  { id: 'patrick', name: 'Clean Print', fontFamily: "'Patrick Hand', cursive", url: 'https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap' },
  { id: 'sacramento', name: 'Vintage Quill', fontFamily: "'Sacramento', cursive", url: 'https://fonts.googleapis.com/css2?family=Sacramento&display=swap' },
];

const PAPER_TEMPLATES = [
  { id: 'ruled', name: 'Ruled Notebook' },
  { id: 'grid', name: 'Graph / Grid' },
  { id: 'parchment', name: 'Vintage Parchment' },
  { id: 'blank', name: 'Clean Blank' },
];

const INK_COLORS = [
  { id: 'blue', label: 'Blue Ballpoint', color: '#1a3b8b' },
  { id: 'black', label: 'Dark Gel Ink', color: '#1a1a1a' },
  { id: 'red', label: 'Teacher Red', color: '#c0392b' },
  { id: 'pencil', label: 'Pencil Graphite', color: '#4a4a4a' },
];

const SAMPLE_TEXT = `Dear Friend,

I wanted to send you these handwritten notes from today's discussion. 
Technology moves fast, but there is still an undeniable charm and personal warmth in handwritten letters and notes on lined paper.

Here are the key takeaways we reviewed:
1. Every byte of this document was processed directly in your browser's memory.
2. No data was uploaded to any remote server or cloud AI provider.
3. You can customize the ink color, paper ruling, line spacing, and organic human jitter.

Feel free to try pasting your own assignment or extracting text from a PDF!

Warm regards,
The File Peace Team`;

export default function TextToHandwriting() {
  const location = useLocation();

  // Input state
  const [inputText, setInputText] = useState(SAMPLE_TEXT);
  const [activeInputMode, setActiveInputMode] = useState('text'); // 'text' | 'pdf'
  const [layoutMode, setLayoutMode] = useState('notebook'); // 'notebook' | 'original'
  const [preserveBackground, setPreserveBackground] = useState(true);
  const [pdfLayoutPages, setPdfLayoutPages] = useState([]);

  // Styling Options
  const [selectedFont, setSelectedFont] = useState(HANDWRITING_FONTS[0].id);
  const [selectedPaper, setSelectedPaper] = useState('ruled');
  const [selectedInk, setSelectedInk] = useState(INK_COLORS[0].color);
  const [fontSize, setFontSize] = useState(24);
  const [lineSpacing, setLineSpacing] = useState(42);
  const [marginOffset, setMarginOffset] = useState(80);
  const [humanJitter, setHumanJitter] = useState(1.5); // 0 (none) to 3 (heavy)

  // Pagination & Canvas
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageCanvases, setPageCanvases] = useState([]);
  const [isRendering, setIsRendering] = useState(false);

  // Result state
  const [savedBlob, setSavedBlob] = useState(null);
  const [savedFileName, setSavedFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const canvasRef = useRef(null);
  const handledIncomingRef = useRef(false);

  // Load Google Fonts dynamically
  useEffect(() => {
    HANDWRITING_FONTS.forEach((f) => {
      if (!document.getElementById(`font-${f.id}`)) {
        const link = document.createElement('link');
        link.id = `font-${f.id}`;
        link.rel = 'stylesheet';
        link.href = f.url;
        document.head.appendChild(link);
      }
    });
  }, []);

  const savedUrl = useMemo(() => {
    return savedBlob ? URL.createObjectURL(savedBlob) : null;
  }, [savedBlob]);

  useEffect(() => {
    return () => {
      if (savedUrl) URL.revokeObjectURL(savedUrl);
    };
  }, [savedUrl]);

  // Extract text and spatial layout from uploaded PDF
  const handlePdfUpload = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    const selected = Array.isArray(files) ? files[0] : files;
    const validation = validatePdfFile(selected);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      return;
    }

    setErrorMessage('');

    try {
      const buffer = await selected.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        isEvalSupported: false,
      }).promise;

      let fullText = '';
      const parsedPages = [];
      const PAGE_WIDTH = 1240;

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const scale = PAGE_WIDTH / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        // Render base original PDF page with images, backgrounds, logos to an offscreen canvas
        const baseCanvas = document.createElement('canvas');
        baseCanvas.width = PAGE_WIDTH;
        baseCanvas.height = Math.round(viewport.height);
        const baseCtx = baseCanvas.getContext('2d');
        await page.render({ canvasContext: baseCtx, viewport }).promise;

        const textContent = await page.getTextContent();
        const items = textContent.items || [];
        const lineBuckets = [];
        const yTolerance = 5 * scale;

        items.forEach((item) => {
          if (!item.str || !item.str.trim()) return;
          const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
          const canvasX = tx[4];
          const canvasY = tx[5];
          const itemWidth = item.width * scale;
          const itemHeight = Math.hypot(item.transform[0], item.transform[1]) * scale;

          let bucket = lineBuckets.find((b) => Math.abs(b.canvasY - canvasY) <= yTolerance);
          if (!bucket) {
            bucket = { canvasY, items: [] };
            lineBuckets.push(bucket);
          }
          bucket.items.push({
            canvasX,
            canvasY,
            str: item.str,
            width: itemWidth,
            height: itemHeight,
          });
        });

        lineBuckets.sort((a, b) => a.canvasY - b.canvasY);

        const pageLines = lineBuckets.map((b) => {
          b.items.sort((a, b) => a.canvasX - b.canvasX);
          const text = b.items.map((it) => it.str).join(' ').trim();
          const firstItem = b.items[0];
          const lastItem = b.items[b.items.length - 1];
          const totalWidth = (lastItem.canvasX + lastItem.width) - firstItem.canvasX;
          const avgHeight = b.items.reduce((s, it) => s + it.height, 0) / b.items.length;

          return {
            text,
            canvasX: Math.round(firstItem.canvasX),
            canvasY: Math.round(b.canvasY),
            width: Math.round(totalWidth),
            height: Math.round(avgHeight),
            fontSizeScale: Math.max(0.7, Math.min(2.5, avgHeight / 16)),
          };
        }).filter((l) => Boolean(l.text));

        parsedPages.push({
          pageNum: p,
          lines: pageLines,
          baseCanvas,
          pageWidth: PAGE_WIDTH,
          pageHeight: Math.round(viewport.height),
        });

        const pageText = pageLines.map((l) => l.text).join('\n');
        if (pageText) {
          fullText += (fullText ? '\n\n' : '') + pageText;
        }
      }

      if (!fullText) {
        throw new Error('No selectable text found in this PDF.');
      }

      setPdfLayoutPages(parsedPages);
      setLayoutMode('original');
      setInputText(fullText);
      setActiveInputMode('text');
    } catch (err) {
      console.error('PDF extraction error:', err);
      setErrorMessage(err.message || 'Failed to extract text from PDF document.');
    }
  }, []);

  // Handle incoming transferred file
  useEffect(() => {
    if (handledIncomingRef.current) return;
    const incoming = consumeTransferredFile() || location.state?.incomingFile;
    if (incoming) {
      handledIncomingRef.current = true;
      setTimeout(() => {
        setActiveInputMode('pdf');
        handlePdfUpload([incoming]);
      }, 0);
    }
  }, [handlePdfUpload, location.state]);

  // Render Paper Background
  const drawPaperBackground = useCallback((ctx, width, height, template) => {
    if (template === 'parchment') {
      ctx.fillStyle = '#fbf5e6';
      ctx.fillRect(0, 0, width, height);

      // Subtle vintage texture noise
      ctx.fillStyle = 'rgba(180, 140, 90, 0.04)';
      for (let i = 0; i < 400; i++) {
        ctx.fillRect(Math.random() * width, Math.random() * height, Math.random() * 4, Math.random() * 4);
      }
      return;
    }

    // Default white background for ruled, grid, blank
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    if (template === 'blank') return;

    if (template === 'grid') {
      ctx.strokeStyle = 'rgba(70, 130, 180, 0.15)';
      ctx.lineWidth = 1;
      const gridSize = 25;

      ctx.beginPath();
      for (let x = 0; x <= width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y <= height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
      return;
    }

    if (template === 'ruled') {
      const topPadding = 120;
      const lineStep = lineSpacing;

      // Horizontal blue ruled lines
      ctx.strokeStyle = 'rgba(65, 105, 225, 0.28)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let y = topPadding; y < height - 60; y += lineStep) {
        ctx.moveTo(40, y);
        ctx.lineTo(width - 40, y);
      }
      ctx.stroke();

      // Vertical pink/red left margin line
      ctx.strokeStyle = 'rgba(255, 99, 71, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(marginOffset, 40);
      ctx.lineTo(marginOffset, height - 40);
      ctx.stroke();

      // Top header margin double line
      ctx.strokeStyle = 'rgba(255, 99, 71, 0.25)';
      ctx.beginPath();
      ctx.moveTo(40, topPadding - 10);
      ctx.lineTo(width - 40, topPadding - 10);
      ctx.stroke();
    }
  }, [lineSpacing, marginOffset]);

  // Main Multi-Page Generation Engine
  const generateHandwrittenPages = useCallback(async () => {
    setIsRendering(true);

    // Canvas Dimensions: Standard high-DPI A4 (1240 x 1754 px)
    const PAGE_WIDTH = 1240;
    const PAGE_HEIGHT = 1754;
    const topMargin = 135;
    const bottomMargin = 80;
    const leftMargin = selectedPaper === 'ruled' ? marginOffset + 25 : 80;
    const rightMargin = 80;
    const maxContentWidth = PAGE_WIDTH - leftMargin - rightMargin;

    const fontObj = HANDWRITING_FONTS.find((f) => f.id === selectedFont) || HANDWRITING_FONTS[0];

    // Wait for document font readiness
    try {
      await document.fonts.load(`${fontSize}px ${fontObj.fontFamily}`);
    } catch {
      // ignore
    }

    if (layoutMode === 'original' && pdfLayoutPages && pdfLayoutPages.length > 0) {
      // MODE 2: Keep Original PDF Structure, Background & Graphics
      const renderedCanvases = pdfLayoutPages.map((pdfPage) => {
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = pdfPage.pageWidth || PAGE_WIDTH;
        pageCanvas.height = pdfPage.pageHeight || PAGE_HEIGHT;
        const ctx = pageCanvas.getContext('2d');

        if (preserveBackground && pdfPage.baseCanvas) {
          // 1. Draw original PDF background, images, logos, headers, shapes
          ctx.drawImage(pdfPage.baseCanvas, 0, 0);

          // 2. Clean/whiten original typed text boxes
          ctx.fillStyle = '#ffffff';
          pdfPage.lines.forEach((l) => {
            const padX = 3;
            const padY = 2;
            ctx.fillRect(
              l.canvasX - padX,
              l.canvasY - l.height + padY,
              l.width + padX * 2,
              l.height + padY * 2
            );
          });
        } else {
          // Clean paper template background
          drawPaperBackground(ctx, pageCanvas.width, pageCanvas.height, selectedPaper === 'ruled' ? 'blank' : selectedPaper);
        }

        ctx.fillStyle = selectedInk;
        ctx.textBaseline = 'alphabetic';

        pdfPage.lines.forEach((l) => {
          const scaledFont = Math.max(12, Math.min(54, Math.round(fontSize * (l.fontSizeScale || 1))));
          ctx.font = `${scaledFont}px ${fontObj.fontFamily}`;

          const posX = l.canvasX;
          const posY = l.canvasY;

          const words = l.text.split(' ');
          let currentX = posX;

          words.forEach((w) => {
            const jitterX = humanJitter > 0 ? (Math.random() - 0.5) * humanJitter * 1.5 : 0;
            const jitterY = humanJitter > 0 ? (Math.random() - 0.5) * humanJitter * 1.8 : 0;
            const slantAngle = humanJitter > 0 ? ((Math.random() - 0.5) * humanJitter * 0.015) : 0;

            ctx.save();
            ctx.translate(currentX + jitterX, posY + jitterY);
            if (slantAngle !== 0) ctx.rotate(slantAngle);

            if (humanJitter > 0) {
              ctx.globalAlpha = 0.9 + Math.random() * 0.1;
            }

            ctx.fillText(w, 0, 0);
            ctx.restore();

            const wordMetrics = ctx.measureText(w + ' ');
            currentX += wordMetrics.width;
          });
        });

        return pageCanvas;
      });

      setTotalPages(renderedCanvases.length);
      if (currentPage > renderedCanvases.length) setCurrentPage(1);
      setPageCanvases(renderedCanvases);

      const activeCanvas = renderedCanvases[Math.min(currentPage - 1, renderedCanvases.length - 1)];
      if (canvasRef.current && activeCanvas) {
        canvasRef.current.width = activeCanvas.width;
        canvasRef.current.height = activeCanvas.height;
        const mainCtx = canvasRef.current.getContext('2d');
        mainCtx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
        mainCtx.drawImage(activeCanvas, 0, 0);
      }

      setIsRendering(false);
      return;
    }

    // MODE 1: Notebook Paper Flow Mode
    const dummyCanvas = document.createElement('canvas');
    dummyCanvas.width = PAGE_WIDTH;
    dummyCanvas.height = PAGE_HEIGHT;
    const dummyCtx = dummyCanvas.getContext('2d');
    dummyCtx.font = `${fontSize}px ${fontObj.fontFamily}`;

    const paragraphs = inputText.split('\n');
    const pages = [];
    let currentLines = [];
    let currentY = topMargin;

    paragraphs.forEach((para) => {
      if (!para.trim()) {
        currentY += lineSpacing * 0.8;
        if (currentY > PAGE_HEIGHT - bottomMargin) {
          pages.push(currentLines);
          currentLines = [];
          currentY = topMargin;
        }
        return;
      }

      const words = para.split(' ');
      let line = '';

      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const metrics = dummyCtx.measureText(testLine);

        if (metrics.width > maxContentWidth && i > 0) {
          currentLines.push({ text: line.trim(), y: currentY });
          line = words[i] + ' ';
          currentY += lineSpacing;

          if (currentY > PAGE_HEIGHT - bottomMargin) {
            pages.push(currentLines);
            currentLines = [];
            currentY = topMargin;
          }
        } else {
          line = testLine;
        }
      }

      if (line.trim()) {
        currentLines.push({ text: line.trim(), y: currentY });
        currentY += lineSpacing;

        if (currentY > PAGE_HEIGHT - bottomMargin) {
          pages.push(currentLines);
          currentLines = [];
          currentY = topMargin;
        }
      }
    });

    if (currentLines.length > 0 || pages.length === 0) {
      pages.push(currentLines);
    }

    setTotalPages(pages.length);
    if (currentPage > pages.length) setCurrentPage(1);

    // Render individual canvases
    const renderedCanvases = pages.map((pageLines) => {
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = PAGE_WIDTH;
      pageCanvas.height = PAGE_HEIGHT;
      const ctx = pageCanvas.getContext('2d');

      // Draw paper background
      drawPaperBackground(ctx, PAGE_WIDTH, PAGE_HEIGHT, selectedPaper);

      // Draw handwriting text with human jitter
      ctx.font = `${fontSize}px ${fontObj.fontFamily}`;
      ctx.fillStyle = selectedInk;
      ctx.textBaseline = 'bottom';

      pageLines.forEach((l) => {
        let currentX = leftMargin;
        const words = l.text.split(' ');

        words.forEach((w) => {
          // Calculate subtle organic word-level jitter
          const jitterX = humanJitter > 0 ? (Math.random() - 0.5) * humanJitter * 2 : 0;
          const jitterY = humanJitter > 0 ? (Math.random() - 0.5) * humanJitter * 2.5 : 0;
          const slantAngle = humanJitter > 0 ? ((Math.random() - 0.5) * humanJitter * 0.02) : 0;

          ctx.save();
          ctx.translate(currentX + jitterX, l.y + jitterY);
          if (slantAngle !== 0) ctx.rotate(slantAngle);

          // Variable ink pressure
          if (humanJitter > 0) {
            ctx.globalAlpha = 0.88 + Math.random() * 0.12;
          }

          ctx.fillText(w, 0, 0);
          ctx.restore();

          const wordMetrics = ctx.measureText(w + ' ');
          currentX += wordMetrics.width;
        });
      });

      return pageCanvas;
    });

    setPageCanvases(renderedCanvases);

    // Draw active page to visible canvas
    const activeCanvas = renderedCanvases[Math.min(currentPage - 1, renderedCanvases.length - 1)];
    if (canvasRef.current && activeCanvas) {
      canvasRef.current.width = PAGE_WIDTH;
      canvasRef.current.height = PAGE_HEIGHT;
      const mainCtx = canvasRef.current.getContext('2d');
      mainCtx.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
      mainCtx.drawImage(activeCanvas, 0, 0);
    }

    setIsRendering(false);
  }, [inputText, selectedFont, selectedPaper, selectedInk, fontSize, lineSpacing, marginOffset, humanJitter, currentPage, drawPaperBackground, layoutMode, pdfLayoutPages, preserveBackground]);

  // Update visible canvas when active page changes
  useEffect(() => {
    if (pageCanvases.length > 0 && canvasRef.current) {
      const active = pageCanvases[Math.min(currentPage - 1, pageCanvases.length - 1)];
      if (active) {
        canvasRef.current.width = active.width;
        canvasRef.current.height = active.height;
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, active.width, active.height);
        ctx.drawImage(active, 0, 0);
      }
    }
  }, [currentPage, pageCanvases]);

  // Debounced auto-render on input changes
  useEffect(() => {
    const timer = setTimeout(() => {
      generateHandwrittenPages();
    }, 250);
    return () => clearTimeout(timer);
  }, [generateHandwrittenPages]);

  // Export Single Page as PNG
  const handleExportPng = () => {
    const active = pageCanvases[currentPage - 1];
    if (!active) return;
    active.toBlob((blob) => {
      if (blob) {
        setSavedBlob(blob);
        setSavedFileName(`handwritten-page-${currentPage}.png`);
      }
    }, 'image/png');
  };

  // Export All Pages as Multi-Page PDF
  const handleExportPdf = async () => {
    if (pageCanvases.length === 0) return;
    try {
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < pageCanvases.length; i++) {
        const canvas = pageCanvases[i];
        const pngBlob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        const pngBuffer = await pngBlob.arrayBuffer();
        const pngImage = await pdfDoc.embedPng(pngBuffer);

        const page = pdfDoc.addPage([595.28, 841.89]); // A4
        page.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: 595.28,
          height: 841.89,
        });
      }

      const pdfBytes = await pdfDoc.save({ updateMetadata: false });
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      setSavedBlob(blob);
      setSavedFileName(`handwritten-document-${Date.now()}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      setErrorMessage('Failed to generate multi-page PDF.');
    }
  };

  const handleReset = () => {
    setInputText(SAMPLE_TEXT);
    setActiveInputMode('text');
    setSavedBlob(null);
    setCurrentPage(1);
  };

  if (savedBlob && savedUrl) {
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          fileUrl={savedUrl}
          fileName={savedFileName}
          file={new File([savedBlob], savedFileName, { type: savedBlob.type })}
          onReset={handleReset}
          onProcessSourceAgain={() => setSavedBlob(null)}
          sourceActionLabel="Back to Handwriting Studio"
          message="Handwritten document successfully exported!"
          currentPath="/text-to-handwriting"
        />
      </div>
    );
  }

  const controlsDesk = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem' }}>
      {/* Source Content Card */}
      <div className="workspace-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-color)' }}>
            Source Content:
          </span>
          <div style={{ display: 'flex', background: 'var(--subtle-bg)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setActiveInputMode('text')}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: '6px',
                border: 'none',
                background: activeInputMode === 'text' ? 'var(--primary-color)' : 'transparent',
                color: activeInputMode === 'text' ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Type Text
            </button>
            <button
              type="button"
              onClick={() => setActiveInputMode('pdf')}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: '6px',
                border: 'none',
                background: activeInputMode === 'pdf' ? 'var(--primary-color)' : 'transparent',
                color: activeInputMode === 'pdf' ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Extract from PDF
            </button>
          </div>
        </div>

        {activeInputMode === 'pdf' && (
          <div style={{ marginBottom: '0.85rem' }}>
            <FileUpload
              onFilesSelected={handlePdfUpload}
              accept={{ 'application/pdf': ['.pdf'] }}
              multiple={false}
              title="Upload PDF to Extract Text"
              description="Text will be extracted directly into the editor below"
            />
          </div>
        )}

        <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
            Text to Synthesize (Editable):
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type or paste your text here..."
            rows={7}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--subtle-bg)',
              color: 'var(--text-color)',
              fontSize: '0.86rem',
              lineHeight: 1.5,
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Layout Mode Selector Card */}
      <div className="workspace-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.1rem' }}>
        <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.65rem' }}>
          Layout Format Mode:
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
          <button
            type="button"
            onClick={() => setLayoutMode('notebook')}
            style={{
              padding: '0.65rem 0.75rem',
              borderRadius: '8px',
              border: `2px solid ${layoutMode === 'notebook' ? 'var(--primary-color)' : 'var(--border-color)'}`,
              background: layoutMode === 'notebook' ? 'rgba(28, 153, 255, 0.12)' : 'var(--subtle-bg)',
              color: 'var(--text-color)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.15rem' }}>
              📓 Notebook Paper
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Sequential flow with lined paper & margins.
            </div>
          </button>

          <button
            type="button"
            onClick={() => setLayoutMode('original')}
            disabled={!pdfLayoutPages || pdfLayoutPages.length === 0}
            style={{
              padding: '0.65rem 0.75rem',
              borderRadius: '8px',
              border: `2px solid ${layoutMode === 'original' ? 'var(--primary-color)' : 'var(--border-color)'}`,
              background: layoutMode === 'original' ? 'rgba(28, 153, 255, 0.12)' : 'var(--subtle-bg)',
              color: 'var(--text-color)',
              cursor: pdfLayoutPages && pdfLayoutPages.length > 0 ? 'pointer' : 'not-allowed',
              opacity: pdfLayoutPages && pdfLayoutPages.length > 0 ? 1 : 0.6,
              textAlign: 'left',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.15rem' }}>
              📑 Keep PDF Layout
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              {pdfLayoutPages && pdfLayoutPages.length > 0
                ? 'Preserves exact PDF positions.'
                : 'Upload PDF to enable.'}
            </div>
          </button>
        </div>

        {/* Preserve Background & Graphics Toggle */}
        {layoutMode === 'original' && pdfLayoutPages && pdfLayoutPages.length > 0 && (
          <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.75rem', background: 'rgba(28, 153, 255, 0.07)', borderRadius: '8px', border: '1px solid rgba(28, 153, 255, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-color)', display: 'block' }}>
                🖼️ Preserve Background & Graphics
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Keep original PDF logos, images, borders, and colors while replacing text with handwriting.
              </span>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={preserveBackground}
                onChange={(e) => setPreserveBackground(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary-color)', cursor: 'pointer' }}
              />
            </label>
          </div>
        )}
      </div>

      {/* Handwriting & Paper Styling Card */}
      <div className="workspace-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.1rem' }}>
        <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-color)', display: 'block', marginBottom: '1rem' }}>
          Handwriting & Paper Styling:
        </span>

        {/* Font Style */}
        <div style={{ marginBottom: '0.85rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
            Handwriting Font Style:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.45rem' }}>
            {HANDWRITING_FONTS.map((font) => (
              <button
                key={font.id}
                type="button"
                onClick={() => setSelectedFont(font.id)}
                style={{
                  padding: '0.45rem 0.4rem',
                  borderRadius: '6px',
                  border: `1px solid ${selectedFont === font.id ? 'var(--primary-color)' : 'var(--border-color)'}`,
                  background: selectedFont === font.id ? 'rgba(28, 153, 255, 0.12)' : 'var(--subtle-bg)',
                  color: 'var(--text-color)',
                  fontFamily: font.fontFamily,
                  fontSize: '0.98rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                {font.name}
              </button>
            ))}
          </div>
        </div>

        {/* Paper Template Buttons */}
        <div style={{ marginBottom: '0.85rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
            Paper Background Template:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.45rem' }}>
            {PAPER_TEMPLATES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPaper(p.id)}
                style={{
                  padding: '0.45rem 0.4rem',
                  borderRadius: '6px',
                  border: `1px solid ${selectedPaper === p.id ? 'var(--primary-color)' : 'var(--border-color)'}`,
                  background: selectedPaper === p.id ? 'rgba(28, 153, 255, 0.12)' : 'var(--subtle-bg)',
                  color: 'var(--text-color)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Ink Color Picker */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
            Pen Ink Color:
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {INK_COLORS.map((ink) => (
              <button
                key={ink.id}
                type="button"
                onClick={() => setSelectedInk(ink.color)}
                style={{
                  padding: '0.35rem 0.7rem',
                  borderRadius: '16px',
                  border: `2px solid ${selectedInk === ink.color ? 'var(--primary-color)' : 'var(--border-color)'}`,
                  background: 'var(--subtle-bg)',
                  color: 'var(--text-color)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: ink.color, display: 'inline-block' }} />
                {ink.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>
              Font Size: {fontSize}px
            </label>
            <input
              type="range"
              min="18"
              max="34"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>
              Line Spacing: {lineSpacing}px
            </label>
            <input
              type="range"
              min="32"
              max="56"
              value={lineSpacing}
              onChange={(e) => setLineSpacing(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>
              Human Randomness: {humanJitter === 0 ? 'None' : humanJitter < 2 ? 'Natural' : 'Heavy'}
            </label>
            <input
              type="range"
              min="0"
              max="3"
              step="0.5"
              value={humanJitter}
              onChange={(e) => setHumanJitter(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>
              Left Margin: {marginOffset}px
            </label>
            <input
              type="range"
              min="40"
              max="140"
              value={marginOffset}
              onChange={(e) => setMarginOffset(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
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
        height: '100%',
        minHeight: 0,
        padding: '0.25rem',
      }}
    >
      {/* Top Toolbar */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}
      >
        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            style={{
              border: '1px solid var(--border-color)',
              background: 'var(--subtle-bg)',
              color: 'var(--text-color)',
              padding: '0.25rem 0.6rem',
              borderRadius: '6px',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            }}
          >
            <FiChevronLeft size={16} />
          </button>
          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-color)' }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            style={{
              border: '1px solid var(--border-color)',
              background: 'var(--subtle-bg)',
              color: 'var(--text-color)',
              padding: '0.25rem 0.6rem',
              borderRadius: '6px',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            <FiChevronRight size={16} />
          </button>
        </div>

        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {isRendering ? 'Rendering handwritten strokes...' : 'Live Realistic Canvas Preview'}
        </span>
      </div>

      {/* Interactive Canvas Sheet Container */}
      <div
        style={{
          flex: 1,
          width: '100%',
          minHeight: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          background: 'var(--subtle-bg)',
          padding: '1rem',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          overflow: 'auto',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
            borderRadius: '4px',
            display: 'block',
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
        overflow: 'hidden',
      }}
    >
      <ToolStudioHeader
        title="Text & PDF to Handwriting Synthesizer"
        icon={FiEdit3}
        category="Convert"
        toolPath="/text-to-handwriting"
        fileBadge={totalPages > 1 ? `${totalPages} Pages` : '1 Page'}
        onReset={handleReset}
        resetLabel="Reset Text"
        headerExtra={
          <button
            type="button"
            onClick={handleExportPng}
            disabled={isRendering || !inputText.trim()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--subtle-bg)',
              color: 'var(--text-color)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: isRendering || !inputText.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            <FiDownload size={13} /> Export Page PNG
          </button>
        }
        primaryAction={{
          label: isRendering ? 'Generating...' : `Export PDF (${totalPages} pgs)`,
          icon: FiDownload,
          onClick: handleExportPdf,
          disabled: isRendering || !inputText.trim(),
          loading: isRendering,
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
          defaultSplit={44}
          minLeftWidth={340}
          minRightWidth={360}
          height="100%"
          leftTitle="Handwriting Settings & Input"
          rightTitle="Live Handwritten Sheet"
          storageKey="text_to_handwriting"
        />
      </div>
    </div>
  );
}
