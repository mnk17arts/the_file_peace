import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  FiDownload,
  FiCopy,
  FiCheckCircle,
  FiSearch,
  FiX,
  FiCode,
  FiGrid,
  FiFileText,
} from 'react-icons/fi';
import AlertBanner from '../components/AlertBanner';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { validatePdfFile } from '../utils/fileUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfToText() {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Results
  const [pagesData, setPagesData] = useState([]);
  const [totalStats, setTotalStats] = useState({ words: 0, characters: 0, pages: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPageFilter, setSelectedPageFilter] = useState('all'); // 'all' or page number string
  const [copied, setCopied] = useState(false);

  const handledIncomingRef = useRef(false);

  // Extract plain text from PDF
  const extractPdfText = useCallback(async (selectedFile) => {
    setIsProcessing(true);
    setProgressMsg('Loading PDF text layers...');
    setErrorMessage('');
    setPagesData([]);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        isEvalSupported: false,
      }).promise;

      const numPages = pdf.numPages;
      const pages = [];
      let totalWords = 0;
      let totalChars = 0;

      for (let i = 1; i <= numPages; i++) {
        setProgressMsg(`Extracting text from page ${i} of ${numPages}...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Sort items by Y descending, then X ascending to preserve visual reading order
        const items = textContent.items || [];
        const lineBuckets = [];
        const yTolerance = 4;

        items.forEach((item) => {
          if (!item.str || !item.str.trim()) return;
          const y = item.transform[5];
          const x = item.transform[4];

          let bucket = lineBuckets.find((b) => Math.abs(b.y - y) <= yTolerance);
          if (!bucket) {
            bucket = { y, items: [] };
            lineBuckets.push(bucket);
          }
          bucket.items.push({ x, str: item.str });
        });

        lineBuckets.sort((a, b) => b.y - a.y);
        const lines = lineBuckets.map((b) => {
          b.items.sort((a, b) => a.x - b.x);
          return b.items.map((it) => it.str).join(' ').trim();
        }).filter(Boolean);

        const pageText = lines.join('\n');
        const words = pageText.split(/\s+/).filter(Boolean).length;
        const chars = pageText.length;

        totalWords += words;
        totalChars += chars;

        pages.push({
          pageNum: i,
          lines,
          text: pageText,
          words,
          characters: chars,
        });
      }

      setPagesData(pages);
      setTotalStats({
        words: totalWords,
        characters: totalChars,
        pages: numPages,
      });
    } catch (err) {
      console.error('Text extraction error:', err);
      setErrorMessage(err.message || 'Failed to extract text from PDF.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handle file drop
  const handleFiles = useCallback((files) => {
    if (!files || files.length === 0) return;
    const selected = Array.isArray(files) ? files[0] : files;
    const validation = validatePdfFile(selected);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      return;
    }

    setFile(selected);
    extractPdfText(selected);
  }, [extractPdfText]);

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

  // Filtered pages
  const displayedPages = pagesData.filter((p) => {
    if (selectedPageFilter !== 'all' && p.pageNum !== Number(selectedPageFilter)) {
      return false;
    }
    if (searchQuery.trim()) {
      return p.text.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const handleCopyAll = () => {
    const combined = displayedPages.map((p) => `--- PAGE ${p.pageNum} ---\n${p.text}`).join('\n\n');
    navigator.clipboard.writeText(combined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!file || pagesData.length === 0) return;
    const allText = pagesData.map((p) => `=== PAGE ${p.pageNum} ===\n\n${p.text}`).join('\n\n');
    const blob = new Blob([allText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name.replace(/\.[^/.]+$/, '')}-text.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    if (!file || pagesData.length === 0) return;
    const exportData = {
      filename: file.name,
      extractedAt: new Date().toISOString(),
      stats: totalStats,
      pages: pagesData.map((p) => ({
        page: p.pageNum,
        wordCount: p.words,
        characterCount: p.characters,
        lines: p.lines,
        text: p.text,
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name.replace(/\.[^/.]+$/, '')}-structured.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    if (!file || pagesData.length === 0) return;
    const csvRows = ['"Page","LineNumber","Content"'];
    pagesData.forEach((p) => {
      p.lines.forEach((line, idx) => {
        const escaped = line.replace(/"/g, '""');
        csvRows.push(`${p.pageNum},${idx + 1},"${escaped}"`);
      });
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name.replace(/\.[^/.]+$/, '')}-lines.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFile(null);
    setPagesData([]);
    setErrorMessage('');
    setSearchQuery('');
  };

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Upload Stage)
  // -------------------------------------------------------------
  if (!file) {
    return (
      <ToolHeroView
        title="PDF to Text & Structured Data"
        description="Extract plain text, structured JSON data, and line-by-line CSV from PDF documents instantly with zero server uploads."
        badge="Convert"
        badgeIcon={FiCode}
        toolPath="/pdf-to-text"
        acceptedFormats={['PDF documents (.pdf)']}
        accept={{ 'application/pdf': ['.pdf'] }}
        allowMultiple={false}
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
      <ToolStudioHeader
        title="PDF to Text & Structured Data"
        icon={FiFileText}
        file={file}
        category="Convert"
        toolPath="/pdf-to-text"
        onReset={handleReset}
        resetLabel="Change PDF"
        actionsSlot={
          pagesData.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleDownloadTxt}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.9rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                <FiDownload size={14} /> Download TXT
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <FiCode size={14} /> JSON
              </button>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <FiGrid size={14} /> CSV
              </button>
            </div>
          )
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

      {/* Processing State */}
      {isProcessing && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ width: '42px', height: '42px', border: '4px solid var(--border-color)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <h4 style={{ color: 'var(--text-color)', marginBottom: '0.35rem' }}>Extracting Document Text</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>{progressMsg}</p>
        </div>
      )}

      {/* Main Studio Body */}
      {!isProcessing && pagesData.length > 0 && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 320px',
            gap: '1rem',
            overflow: 'hidden',
          }}
        >
          {/* Left Column: Search & Text Stream */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '1rem',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            {/* Toolbar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center', background: 'var(--subtle-bg)', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '0.85rem', flexShrink: 0 }}>
              <div style={{ display: 'flex', flex: 1, minWidth: '180px', alignItems: 'center', gap: '0.5rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.35rem 0.65rem' }}>
                <FiSearch style={{ color: 'var(--text-secondary)' }} size={14} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in extracted text..."
                  style={{ border: 'none', background: 'transparent', color: 'var(--text-color)', width: '100%', outline: 'none', fontSize: '0.85rem' }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    <FiX size={14} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select
                  value={selectedPageFilter}
                  onChange={(e) => setSelectedPageFilter(e.target.value)}
                  style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', fontSize: '0.82rem' }}
                >
                  <option value="all">All Pages ({pagesData.length})</option>
                  {pagesData.map((p) => (
                    <option key={p.pageNum} value={p.pageNum}>
                      Page {p.pageNum} ({p.words} words)
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleCopyAll}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {copied ? <FiCheckCircle style={{ color: '#2ed573' }} size={14} /> : <FiCopy size={14} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Pages Text Stream */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingRight: '0.35rem' }}>
              {displayedPages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  No matching text found for "{searchQuery}".
                </div>
              )}

              {displayedPages.map((page) => (
                <div
                  key={page.pageNum}
                  style={{
                    background: 'var(--subtle-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--primary-color)' }}>
                      Page {page.pageNum}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {page.words} words • {page.characters} chars
                    </span>
                  </div>

                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: 'inherit',
                      fontSize: '0.88rem',
                      lineHeight: 1.55,
                      color: 'var(--text-color)',
                    }}
                  >
                    {page.text || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>[No text content detected on this page]</span>}
                  </pre>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Inspector & Export Settings */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '1.2rem',
              boxSizing: 'border-box',
              overflowY: 'auto',
              gap: '1rem',
            }}
          >
            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              Document Summary
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                <span>Total Pages:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-color)' }}>{totalStats.pages}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                <span>Word Count:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-color)' }}>{totalStats.words.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                <span>Character Count:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-color)' }}>{totalStats.characters.toLocaleString()}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-color)' }}>
                Export Options
              </span>

              <button
                type="button"
                onClick={handleDownloadTxt}
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.65rem 1rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                <FiDownload size={15} /> Download Plain Text (.txt)
              </button>

              <button
                type="button"
                onClick={handleDownloadJson}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 1rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                <FiCode size={15} /> Export JSON Data (.json)
              </button>

              <button
                type="button"
                onClick={handleDownloadCsv}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 1rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                <FiGrid size={15} /> Export Line-by-Line CSV (.csv)
              </button>
            </div>

            <div style={{ marginTop: 'auto', background: 'var(--subtle-bg)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              🔒 Extracted in browser memory using WebAssembly PDF.js. Zero bytes transmitted over network.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
