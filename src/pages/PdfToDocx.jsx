import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx';
import {
  FiDownload,
  FiCheckCircle,
  FiCopy,
  FiEye,
  FiList,
  FiFileText,
  FiSliders,
} from 'react-icons/fi';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import AlertBanner from '../components/AlertBanner';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { formatFileSize, validatePdfFile } from '../utils/fileUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfToDocx() {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Conversion Options
  const [includePageBreaks, setIncludePageBreaks] = useState(true);
  const [detectHeadings, setDetectHeadings] = useState(true);
  const [fontFamily, setFontFamily] = useState('Calibri'); // Calibri, Arial, Times New Roman, Georgia

  // Result state
  const [docxBlob, setDocxBlob] = useState(null);
  const [extractedPages, setExtractedPages] = useState([]);
  const [totalWordCount, setTotalWordCount] = useState(0);
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'raw'
  const [copied, setCopied] = useState(false);

  const handledIncomingRef = useRef(false);

  // Compute object URL when docxBlob changes
  const docxUrl = useMemo(() => {
    return docxBlob ? URL.createObjectURL(docxBlob) : null;
  }, [docxBlob]);

  useEffect(() => {
    return () => {
      if (docxUrl) {
        URL.revokeObjectURL(docxUrl);
      }
    };
  }, [docxUrl]);

  // Extract structured paragraphs from PDF
  const processPdfToDocx = useCallback(async (selectedFile, options) => {
    setIsProcessing(true);
    setProgressMsg('Parsing PDF structure and extracting text...');
    setErrorMessage('');

    try {
      const buffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        isEvalSupported: false,
      }).promise;

      const pagesResult = [];
      let totalWords = 0;

      for (let p = 1; p <= pdf.numPages; p++) {
        setProgressMsg(`Extracting text from page ${p} of ${pdf.numPages}...`);
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent();
        const items = textContent.items || [];

        if (items.length === 0) continue;

        // Group text items by Y-coordinate
        const linesMap = new Map();
        const yTolerance = 5;

        items.forEach((item) => {
          if (!item.str || !item.str.trim()) return;
          const y = Math.round(item.transform[5]);
          let foundKey = null;

          for (const key of linesMap.keys()) {
            if (Math.abs(key - y) <= yTolerance) {
              foundKey = key;
              break;
            }
          }

          const targetKey = foundKey !== null ? foundKey : y;
          if (!linesMap.has(targetKey)) linesMap.set(targetKey, []);
          linesMap.get(targetKey).push({
            text: item.str,
            x: item.transform[4],
            height: item.height || 12,
            fontName: item.fontName,
          });
        });

        // Sort descending by Y (top to bottom)
        const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a);
        const pageLines = [];

        sortedY.forEach((y) => {
          const lineItems = linesMap.get(y).sort((a, b) => a.x - b.x);
          const fullLineText = lineItems.map((i) => i.text).join(' ').trim();
          if (fullLineText) {
            const maxH = Math.max(...lineItems.map((i) => i.height));
            pageLines.push({ text: fullLineText, height: maxH });
            totalWords += fullLineText.split(/\s+/).length;
          }
        });

        pagesResult.push({
          pageNum: p,
          lines: pageLines,
          text: pageLines.map((l) => l.text).join('\n'),
        });
      }

      setExtractedPages(pagesResult);
      setTotalWordCount(totalWords);

      // Assemble Word Document
      setProgressMsg('Building Microsoft Word (.docx) document...');
      const docChildren = [];

      pagesResult.forEach((page, pageIdx) => {
        if (pageIdx > 0 && options.includePageBreaks) {
          docChildren.push(
            new Paragraph({
              pageBreakBefore: true,
            })
          );
        }

        page.lines.forEach((line) => {
          const isHeading = options.detectHeadings && line.height >= 16;
          const isSubheading = options.detectHeadings && line.height >= 14 && line.height < 16;

          if (isHeading) {
            docChildren.push(
              new Paragraph({
                text: line.text,
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 240, after: 120 },
              })
            );
          } else if (isSubheading) {
            docChildren.push(
              new Paragraph({
                text: line.text,
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 180, after: 80 },
              })
            );
          } else {
            docChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: line.text,
                    font: options.fontFamily,
                    size: 22, // 11pt
                  }),
                ],
                spacing: { after: 120, line: 276 },
              })
            );
          }
        });
      });

      const doc = new Document({
        creator: 'The File Peace',
        title: selectedFile.name.replace(/\.[^/.]+$/, ''),
        description: 'Converted from PDF with 100% private in-browser vector processing.',
        sections: [
          {
            properties: {},
            children: docChildren,
          },
        ],
      });

      const docxData = await Packer.toBlob(doc);
      setDocxBlob(docxData);
    } catch (err) {
      console.error('PDF to DOCX error:', err);
      setErrorMessage(err.message || 'Failed to convert PDF to Word document.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handle file select
  const handleFiles = useCallback((files) => {
    if (!files || files.length === 0) return;
    const selected = Array.isArray(files) ? files[0] : files;
    const validation = validatePdfFile(selected);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      return;
    }

    setFile(selected);
    processPdfToDocx(selected, { includePageBreaks, detectHeadings, fontFamily });
  }, [detectHeadings, fontFamily, includePageBreaks, processPdfToDocx]);

  // Re-generate DOCX with updated settings
  const handleReconvert = () => {
    if (!file) return;
    processPdfToDocx(file, { includePageBreaks, detectHeadings, fontFamily });
  };

  // Handle incoming transfer file
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

  // Download converted docx
  const handleDownloadDocx = () => {
    if (!docxBlob || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const outName = `${baseName}-converted.docx`;
    const url = URL.createObjectURL(docxBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyText = () => {
    const allText = extractedPages.map((p) => p.text).join('\n\n');
    navigator.clipboard.writeText(allText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setFile(null);
    setDocxBlob(null);
    setExtractedPages([]);
    setErrorMessage('');
  };

  if (!file) {
    return (
      <ToolHeroView
        title="PDF to Word (.docx)"
        toolPath="/pdf-to-docx"
        badge="Editable Office Document"
        badgeIcon={FiFileText}
        description="Convert PDF documents into editable Microsoft Word (.docx) files with preserved headings, paragraphs, and formatting. 100% private in-browser conversion."
        acceptedFormats={['PDF']}
        allowMultiple={false}
        accept={{ 'application/pdf': ['.pdf'] }}
        onFilesSelected={handleFiles}
        alerts={errorMessage && (
          <AlertBanner
            message={errorMessage}
            type="error"
            onClose={() => setErrorMessage('')}
          />
        )}
      />
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
        toolTitle="PDF to Word Studio"
        toolPath="/pdf-to-docx"
        fileCount={1}
        primaryAction={{
          label: isProcessing ? (progressMsg || 'Processing...') : 'Download Word (.docx)',
          icon: <FiDownload size={16} />,
          onClick: handleDownloadDocx,
          disabled: isProcessing || !docxBlob,
          loading: isProcessing,
        }}
        onReset={handleReset}
        resetLabel="Change File"
      />

      {errorMessage && (
        <div style={{ marginBottom: '0.75rem' }}>
          <AlertBanner
            message={errorMessage}
            type="error"
            onClose={() => setErrorMessage('')}
          />
        </div>
      )}

      {/* Two-column studio grid */}
      <div
        className="studio-grid"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          gap: '1.25rem',
          overflow: 'hidden',
        }}
      >
        {/* Left Pane: Document Viewer */}
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
          {/* Toolbar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              paddingBottom: '0.65rem',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'inline-flex', background: 'var(--subtle-bg)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', gap: '0.25rem' }}>
              <button
                onClick={() => setActiveTab('preview')}
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTab === 'preview' ? 'var(--primary-color)' : 'transparent',
                  color: activeTab === 'preview' ? '#fff' : 'var(--text-color)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <FiEye size={13} /> Formatted View
              </button>
              <button
                onClick={() => setActiveTab('raw')}
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTab === 'raw' ? 'var(--primary-color)' : 'transparent',
                  color: activeTab === 'raw' ? '#fff' : 'var(--text-color)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <FiList size={13} /> Raw Text
              </button>
            </div>

            <button
              onClick={handleCopyText}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.3rem 0.65rem',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: 'var(--subtle-bg)',
                border: '1px solid var(--border-color)',
                color: copied ? '#10b981' : 'var(--text-color)',
              }}
            >
              {copied ? <FiCheckCircle color="#10b981" /> : <FiCopy />}
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>
          </div>

          {/* Content Body */}
          <div style={{ flex: 1, minHeight: 0, marginTop: '0.75rem', display: 'flex', flexDirection: 'column' }}>
            {isProcessing ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'var(--text-secondary)' }}>
                <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{progressMsg}</span>
              </div>
            ) : activeTab === 'preview' ? (
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  overflowY: 'auto',
                  padding: '1rem',
                  background: 'var(--subtle-bg)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                }}
              >
                {extractedPages.map((page) => (
                  <div
                    key={page.pageNum}
                    style={{
                      background: '#ffffff',
                      color: '#1a1a1a',
                      padding: '2rem',
                      borderRadius: '8px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                      fontFamily: fontFamily,
                      width: '100%',
                      boxSizing: 'border-box',
                      position: 'relative',
                    }}
                  >
                    <div style={{ position: 'absolute', top: '10px', right: '15px', fontSize: '0.75rem', color: '#888', fontWeight: 600 }}>
                      Page {page.pageNum}
                    </div>

                    {page.lines.map((line, lIdx) => {
                      const isHeading = detectHeadings && line.height >= 16;
                      const isBullet = line.text.startsWith('•') || line.text.startsWith('-') || line.text.startsWith('*');

                      if (isHeading) {
                        return (
                          <h3 key={lIdx} style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.85rem 0 0.4rem', color: '#111', lineHeight: 1.3 }}>
                            {line.text}
                          </h3>
                        );
                      }
                      if (isBullet) {
                        return (
                          <div key={lIdx} style={{ paddingLeft: '1rem', margin: '0.3rem 0', color: '#333', lineHeight: 1.5 }}>
                            {line.text}
                          </div>
                        );
                      }
                      return (
                        <p key={lIdx} style={{ margin: '0.4rem 0', lineHeight: 1.6, color: '#333', fontSize: '0.92rem' }}>
                          {line.text}
                        </p>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <textarea
                readOnly
                value={extractedPages.map((p) => `--- PAGE ${p.pageNum} ---\n${p.text}`).join('\n\n')}
                style={{
                  flex: 1,
                  minHeight: 0,
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--subtle-bg)',
                  color: 'var(--text-color)',
                  fontFamily: 'monospace',
                  fontSize: '0.84rem',
                  lineHeight: 1.5,
                  resize: 'none',
                }}
              />
            )}
          </div>
        </div>

        {/* Right Pane: Settings & Forwarding */}
        <div
          style={{
            height: '100%',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.25rem',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FiSliders /> Word Options
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(28, 153, 255, 0.12)', color: 'var(--primary-color)' }}>
              DOCX Builder
            </span>
          </div>

          {/* File Info */}
          <div style={{ background: 'var(--subtle-bg)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-color)', wordBreak: 'break-all', marginBottom: '0.25rem' }}>
              {file.name}
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <span>{formatFileSize(file.size)}</span>
              <span>•</span>
              <span>{extractedPages.length} Pages</span>
              <span>•</span>
              <span>{totalWordCount} Words</span>
            </div>
          </div>

          {/* Conversion Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: 'var(--text-color)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={detectHeadings}
                onChange={(e) => setDetectHeadings(e.target.checked)}
              />
              Auto-Detect Headings &amp; Hierarchy
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: 'var(--text-color)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includePageBreaks}
                onChange={(e) => setIncludePageBreaks(e.target.checked)}
              />
              Preserve Page Breaks
            </label>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Word Document Font:
              </label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-color)',
                  fontSize: '0.84rem',
                }}
              >
                <option value="Calibri">Calibri (Standard Word)</option>
                <option value="Arial">Arial (Clean Sans)</option>
                <option value="Times New Roman">Times New Roman (Classic Serif)</option>
                <option value="Georgia">Georgia (Editorial)</option>
              </select>
            </div>

            <button
              onClick={handleReconvert}
              disabled={isProcessing}
              className="btn-secondary"
              style={{
                padding: '0.45rem 0.8rem',
                borderRadius: '6px',
                border: '1px solid var(--primary-color)',
                background: 'transparent',
                color: 'var(--primary-color)',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                marginTop: '0.25rem',
              }}
            >
              Reapply Settings
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
