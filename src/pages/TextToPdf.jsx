import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import Prism from 'prismjs';
import 'prismjs/themes/prism.css';
import { FiDownload, FiSettings, FiFileText, FiEye, FiCode, FiCopy, FiCheckCircle } from 'react-icons/fi';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import Loader from '../components/Loader';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import { consumeTransferredFile } from '../utils/fileTransfer';

const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612.00, 792.00],
  legal: [612.00, 1008.00],
};

const TextToPdf = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const [fileData, setFileData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState(null);
  const [generatedPdfBlob, setGeneratedPdfBlob] = useState(null);
  const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'source'
  const [copied, setCopied] = useState(false);
  const handledRef = useRef(false);

  // PDF Configurations
  const [pageSize, setPageSize] = useState('a4');
  const [orientation, setOrientation] = useState('portrait');
  const [margin, setMargin] = useState(15);
  const [fontSize, setFontSize] = useState(11);
  const [includeHeaderFooter, setIncludeHeaderFooter] = useState(true);

  const documentRef = useRef(null);
  const generatedUrlRef = useRef(null);

  useEffect(() => {
    generatedUrlRef.current = generatedPdfUrl;
  }, [generatedPdfUrl]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (generatedUrlRef.current) URL.revokeObjectURL(generatedUrlRef.current);
    };
  }, []);

  const handleFileLoad = useCallback((files) => {
    if (loading) return;
    setErrorMessage(null);

    if (!files || files.length !== 1) {
      setErrorMessage("Please upload exactly one text or source code file.");
      return;
    }

    const file = files[0];

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("File is too large for client-side PDF rendering. Please choose a file smaller than 10 MB.");
      return;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    const langMap = {
      'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
      'py': 'python', 'html': 'html', 'css': 'css', 'json': 'json', 'c': 'c', 'cpp': 'cpp', 'java': 'java',
      'md': 'markdown', 'csv': 'none', 'txt': 'none'
    };

    const reader = new FileReader();
    reader.onload = (e) => {
      setGeneratedPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setGeneratedPdfBlob(null);
      setIsCompleted(false);

      setFileData({
        name: file.name,
        content: e.target.result,
        language: langMap[ext] || 'none'
      });
    };
    reader.onerror = () => {
      setErrorMessage("Failed to read the file. Please check file permissions.");
    };
    reader.readAsText(file);
  }, [loading]);

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

  // Trigger syntax highlighting whenever fileData or viewMode changes
  useEffect(() => {
    if (fileData && viewMode === 'preview') {
      setTimeout(() => Prism.highlightAll(), 0);
    }
  }, [fileData, fontSize, viewMode]);

  const handleCopySource = () => {
    if (!fileData?.content) return;
    navigator.clipboard.writeText(fileData.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const generatePDF = async () => {
    if (loading || !fileData) return;
    setErrorMessage(null);
    setLoading(true);

    try {
      const pdfDoc = await PDFDocument.create();
      const isCode = fileData.language !== 'none' && fileData.language !== 'markdown';

      const font = isCode
        ? await pdfDoc.embedFont(StandardFonts.Courier)
        : await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = isCode
        ? await pdfDoc.embedFont(StandardFonts.CourierBold)
        : await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const baseDimensions = PAGE_SIZES[pageSize] || PAGE_SIZES.a4;
      const pageWidth = orientation === 'landscape' ? baseDimensions[1] : baseDimensions[0];
      const pageHeight = orientation === 'landscape' ? baseDimensions[0] : baseDimensions[1];

      const marginPt = Math.max(20, margin * 2.83465); // mm to pt
      const contentWidth = pageWidth - marginPt * 2;
      const effectiveFontSize = fontSize;
      const lineHeight = effectiveFontSize * 1.35;

      let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      let yOffset = pageHeight - marginPt;

      if (includeHeaderFooter) {
        // Document Header
        currentPage.drawText(`File: ${fileData.name}`, {
          x: marginPt,
          y: yOffset,
          size: 10,
          font: fontBold,
          color: rgb(0.2, 0.25, 0.35),
        });

        currentPage.drawLine({
          start: { x: marginPt, y: yOffset - 8 },
          end: { x: pageWidth - marginPt, y: yOffset - 8 },
          thickness: 1,
          color: rgb(0.8, 0.84, 0.88),
        });

        yOffset -= 26;
      }

      // Wrap lines according to page width
      const rawLines = fileData.content.replace(/\r\n/g, '\n').split('\n');

      const wrapLine = (text, maxWidth) => {
        if (!text) return [''];
        const words = text.split(' ');
        const lines = [];
        let cur = '';

        for (const w of words) {
          const testStr = cur ? `${cur} ${w}` : w;
          const width = font.widthOfTextAtSize(testStr, effectiveFontSize);
          if (width > maxWidth && cur) {
            lines.push(cur);
            cur = w;
          } else {
            cur = testStr;
          }
        }
        if (cur) lines.push(cur);
        return lines.length > 0 ? lines : [''];
      };

      for (let lIdx = 0; lIdx < rawLines.length; lIdx++) {
        const line = rawLines[lIdx];
        // Clean ASCII/Latin for Standard 14 PDF fonts
        const sanitized = line.replace(/[^\x20-\x7E\t\r\n]/g, '?');
        const wrapped = wrapLine(sanitized, contentWidth);

        for (const subLine of wrapped) {
          if (yOffset < marginPt + 25) {
            currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
            yOffset = pageHeight - marginPt;
          }

          if (subLine) {
            currentPage.drawText(subLine, {
              x: marginPt,
              y: yOffset,
              size: effectiveFontSize,
              font: font,
              color: rgb(0.12, 0.15, 0.2),
            });
          }

          yOffset -= lineHeight;
        }
      }

      const pdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

      if (generatedPdfUrl) URL.revokeObjectURL(generatedPdfUrl);
      const url = URL.createObjectURL(pdfBlob);

      setGeneratedPdfBlob(pdfBlob);
      setGeneratedPdfUrl(url);
      setIsCompleted(true);
    } catch (error) {
      console.error("PDF generation failed:", error);
      setErrorMessage("Failed to generate PDF document. Please check content encoding.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (loading) return;
    if (generatedPdfUrl) URL.revokeObjectURL(generatedPdfUrl);
    setFileData(null);
    setGeneratedPdfUrl(null);
    setGeneratedPdfBlob(null);
    setIsCompleted(false);
    setErrorMessage(null);
  };

  if (isCompleted && fileData && generatedPdfUrl) {
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          fileUrl={generatedPdfUrl}
          fileName={`${fileData.name.split('.')[0]}_formatted.pdf`}
          file={generatedPdfBlob}
          onReset={handleReset}
          message="Your document has been successfully formatted and converted to PDF!"
          currentPath="/text-to-pdf"
        />
        <Loader isLoading={loading} phrases={["Applying syntax highlighting...", "Calculating pagination...", "Generating PDF..."]} />
      </div>
    );
  }

  if (!fileData) {
    return (
      <>
        <ToolHeroView
          title="Text & Code to PDF"
          toolPath="/text-to-pdf"
          badge="Code & Text Converter"
          badgeIcon={FiFileText}
          description="Convert plain text and syntax-highlighted source code files into clean, paginated PDF documents."
          acceptedFormats={['TXT', 'MD', 'CSV', 'JSON', 'JS', 'TS', 'PY', 'HTML', 'CSS', 'JAVA', 'CPP']}
          allowMultiple={false}
          accept={{ 'text/plain': ['.txt', '.csv', '.json', '.md', '.html', '.css', '.js', '.ts', '.py', '.java', '.c', '.cpp'] }}
          onFilesSelected={handleFileLoad}
          alerts={errorMessage && (
            <AlertBanner
              message={errorMessage}
              onClose={() => setErrorMessage(null)}
            />
          )}
        />
        <Loader isLoading={loading} phrases={["Applying syntax highlighting...", "Calculating pagination...", "Generating PDF..."]} />
      </>
    );
  }

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
        toolTitle="Text to PDF Studio"
        toolPath="/text-to-pdf"
        fileCount={1}
        primaryAction={{
          label: loading ? 'Formatting...' : 'Format & Generate PDF',
          icon: <FiDownload size={16} />,
          onClick: generatePDF,
          disabled: loading,
          loading: loading,
        }}
        onReset={handleReset}
        resetLabel="Change File"
      />

      {errorMessage && (
        <div style={{ marginBottom: '0.75rem' }}>
          <AlertBanner message={errorMessage} onClose={() => setErrorMessage(null)} />
        </div>
      )}

      {/* 2-column studio layout */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 340px',
          gap: '1.25rem',
          overflow: 'hidden',
        }}
      >
        {/* Left: Code Preview */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.25rem',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '0.75rem',
              marginBottom: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--text-color)' }}>
              <FiFileText /> {fileData.name}
              <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'var(--subtle-bg)', color: 'var(--primary-color)' }}>
                {fileData.language.toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'inline-flex', background: 'var(--subtle-bg)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', gap: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  style={{
                    padding: '0.28rem 0.65rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: viewMode === 'preview' ? 'var(--primary-color)' : 'transparent',
                    color: viewMode === 'preview' ? '#fff' : 'var(--text-color)',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <FiEye size={12} /> Formatted View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('source')}
                  style={{
                    padding: '0.28rem 0.65rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: viewMode === 'source' ? 'var(--primary-color)' : 'transparent',
                    color: viewMode === 'source' ? '#fff' : 'var(--text-color)',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <FiCode size={12} /> Raw Source
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopySource}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: 'var(--subtle-bg)',
                  border: '1px solid var(--border-color)',
                  color: copied ? '#10b981' : 'var(--text-color)',
                }}
                title="Copy source text"
              >
                {copied ? <FiCheckCircle color="#10b981" size={13} /> : <FiCopy size={13} />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {viewMode === 'preview' ? (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                background: 'var(--subtle-bg)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                padding: '1rem',
                fontSize: `${fontSize}px`,
                lineHeight: 1.5,
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: 'var(--text-color)',
              }}
            >
              <code className={`language-${fileData.language}`}>{fileData.content}</code>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <textarea
                value={fileData.content}
                onChange={(e) => setFileData((prev) => ({ ...prev, content: e.target.value }))}
                spellCheck={false}
                style={{
                  flex: 1,
                  minHeight: 0,
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--subtle-bg)',
                  color: 'var(--text-color)',
                  fontFamily: 'Consolas, Monaco, monospace',
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.5,
                  resize: 'none',
                  outline: 'none',
                  whiteSpace: 'pre',
                  overflowWrap: 'normal',
                  overflowX: 'auto',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.2rem 0', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                <span>{fileData.content.split('\n').length} lines • {fileData.content.length.toLocaleString()} characters</span>
                <span style={{ fontStyle: 'italic' }}>Editable raw source text</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: PDF Settings */}
        <div
          style={{
            height: '100%',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.25rem',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FiSettings /> Layout &amp; Typography
            </span>
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-color)', display: 'block', marginBottom: '0.35rem' }}>Page Format:</label>
            <select value={pageSize} onChange={(e) => setPageSize(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', background: 'var(--subtle-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} disabled={loading}>
              <option value="a4">A4 (Standard)</option>
              <option value="letter">US Letter</option>
              <option value="legal">US Legal</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-color)', display: 'block', marginBottom: '0.35rem' }}>Page Orientation:</label>
            <select value={orientation} onChange={(e) => setOrientation(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', background: 'var(--subtle-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} disabled={loading}>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-color)', marginBottom: '0.35rem' }}>
              <span>Page Margin:</span>
              <span style={{ color: 'var(--primary-color)' }}>{margin} mm</span>
            </div>
            <input type="range" min="0" max="30" value={margin} onChange={(e) => setMargin(Number(e.target.value))} style={{ width: '100%' }} disabled={loading} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-color)', marginBottom: '0.35rem' }}>
              <span>Font Size:</span>
              <span style={{ color: 'var(--primary-color)' }}>{fontSize} pt</span>
            </div>
            <input type="range" min="8" max="24" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} style={{ width: '100%' }} disabled={loading} />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-color)', cursor: 'pointer' }}>
              <input type="checkbox" checked={includeHeaderFooter} onChange={(e) => setIncludeHeaderFooter(e.target.checked)} disabled={loading} />
              Include Document Header Banner
            </label>
          </div>
        </div>
      </div>

      {/* Offscreen Print Template */}
      <div style={styles.offscreenPrintContainer}>
        <div 
          ref={documentRef} 
          style={{
            width: orientation === 'landscape' ? '1060px' : '750px',
            padding: '16px',
            backgroundColor: '#ffffff',
            color: '#1e293b',
            boxSizing: 'border-box',
            wordBreak: 'break-all',
            overflowWrap: 'anywhere',
          }}
        >
          {includeHeaderFooter && (
            <div style={{ borderBottom: '2px solid #cbd5e1', paddingBottom: '10px', marginBottom: '16px', fontFamily: 'sans-serif' }}>
              <strong>File:</strong> {fileData.name}
            </div>
          )}
          <pre 
            style={{ 
              margin: 0, 
              padding: 0, 
              background: 'transparent', 
              border: 'none', 
              fontSize: `${fontSize}px`, 
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-all',
              overflowWrap: 'anywhere',
              boxSizing: 'border-box',
              width: '100%',
              maxWidth: '100%',
            }}
          >
            <code 
              className={`language-${fileData.language}`}
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                overflowWrap: 'anywhere',
                boxSizing: 'border-box',
                display: 'block',
                width: '100%',
                maxWidth: '100%',
              }}
            >
              {fileData.content}
            </code>
          </pre>
        </div>
      </div>

      <Loader isLoading={loading} phrases={["Applying syntax highlighting...", "Calculating pagination...", "Generating PDF..."]} />
    </div>
  );
};

const styles = {
  dashboard: { backgroundColor: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '2rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' },
  title: { display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, color: 'var(--text-color)' },
  configPanel: { backgroundColor: 'var(--bg-color)', padding: '1.5rem', borderRadius: '8px', border: '1px dashed var(--border-color)', color: 'var(--text-color)' },
  settingsGrid: { display: 'flex', flexWrap: 'wrap', gap: '2rem' },
  settingGroup: { display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: '1 1 150px' },
  label: { fontWeight: 'bold', fontSize: '0.9rem' },
  select: { padding: '0.5rem', borderRadius: '4px', backgroundColor: 'var(--card-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)' },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' },
  secondaryBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: 'transparent', color: 'var(--text-color)', border: '2px solid var(--border-color)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
  offscreenPrintContainer: {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: -1,
  }
};

export default TextToPdf;