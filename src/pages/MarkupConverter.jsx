import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { marked } from 'marked';
import { FiCode, FiEye, FiDownload } from 'react-icons/fi';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { formatFileSize } from '../utils/fileUtils';

const imagePlaceholderUrl =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180" fill="none"><rect width="320" height="180" rx="8" fill="%231e293b"/><path d="M48 132L108 72L168 132" stroke="%2338bdf8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M148 132L188 92L236 132" stroke="%2338bdf8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="212" cy="68" r="14" fill="%2338bdf8"/><text x="160" y="156" fill="%2394a3b8" font-family="sans-serif" font-size="12" text-anchor="middle">External Image Preview Blocked (Privacy)</text></svg>';

const preparePreviewHtml = (htmlContent) => {
  if (typeof window === 'undefined' || !htmlContent) {
    return htmlContent || '';
  }

  const parser = new DOMParser();
  const documentFragment = parser.parseFromString(htmlContent, 'text/html');

  // Strip inline active executable content from markup preview
  documentFragment.querySelectorAll('script, iframe, object, embed').forEach((node) => node.remove());

  // Replace external images with privacy-preserving SVG placeholder in preview only
  documentFragment.querySelectorAll('img').forEach((image) => {
    const originalAlt = image.getAttribute('alt') || '';
    image.setAttribute('src', imagePlaceholderUrl);
    image.removeAttribute('srcset');
    image.setAttribute('alt', originalAlt ? `${originalAlt} (preview unavailable)` : 'Image preview unavailable');
    image.setAttribute('width', image.getAttribute('width') || '320');
    image.setAttribute('height', image.getAttribute('height') || '180');
    image.style.maxWidth = '100%';
    image.style.height = 'auto';
  });

  return documentFragment.body.innerHTML;
};

export default function MarkupConverter() {
  const location = useLocation();
  const handledRef = useRef(false);
  const [fileData, setFileData] = useState(null);
  const [viewMode, setViewMode] = useState('preview'); // 'source' or 'preview'
  const [renderedHtml, setRenderedHtml] = useState('');
  const [rawHtml, setRawHtml] = useState('');

  const handleFileLoad = useCallback((files) => {
    if (!files || files.length !== 1) return;
    const file = files[0];
    const ext = file.name.split('.').pop().toLowerCase();

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      let htmlOutput;

      // 1. Markdown Formats: Parse with marked
      if (['md', 'markdown', 'mdx'].includes(ext)) {
        htmlOutput = marked.parse(content);
      }
      // 2. Native Web Formats: The browser can render these directly
      else if (['html', 'htm', 'xml', 'svg'].includes(ext)) {
        htmlOutput = content;
      }
      // 3. Graceful Fallback: Wrap plain text in a clean pre-formatted block
      else {
        htmlOutput = `
          <div style="background-color: #f8f9fa; padding: 1.5rem; border-radius: 8px; border: 1px solid #e9ecef;">
            <p style="color: #6c757d; font-size: 0.85rem; margin-top: 0; margin-bottom: 1rem; border-bottom: 1px solid #dee2e6; padding-bottom: 0.5rem;">
              <em>Rendered as plain text (Native visual parsing not supported for .${ext})</em>
            </p>
            <pre style="white-space: pre-wrap; word-wrap: break-word; font-family: monospace; font-size: 14px; margin: 0; color: #333;">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
          </div>
        `;
      }

      setFileData({ name: file.name, size: file.size, content, originalType: file.type || 'text/plain' });
      setRawHtml(htmlOutput);
      setRenderedHtml(preparePreviewHtml(htmlOutput));
    };
    reader.readAsText(file);
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

  // Uploaded markup is rendered in an opaque-origin, script-free document for privacy
  const previewDocument = `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src 'none'; connect-src 'none'; media-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'">
        <style>body { margin: 0; padding: 2rem; font-family: system-ui, sans-serif; color: #333; } img { max-width: 100%; height: auto; } pre { white-space: pre-wrap; overflow-wrap: anywhere; }</style>
      </head>
      <body>${renderedHtml}</body>
    </html>`;

  const downloadSource = () => {
    if (!fileData) return;
    const blob = new Blob([fileData.content], { type: fileData.originalType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileData.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadRenderedHtml = () => {
    if (!fileData) return;
    const fullHtmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileData.name.split('.')[0]} - Rendered</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 2rem; color: #333; }
    img { max-width: 100%; height: auto; }
    pre, code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; }
    pre { padding: 1rem; overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
  </style>
</head>
<body>
  ${rawHtml}
</body>
</html>`;

    const blob = new Blob([fullHtmlTemplate], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileData.name.split('.')[0]}_rendered.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFileData(null);
    setRenderedHtml('');
    setRawHtml('');
    setViewMode('preview');
  };

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Empty state)
  // -------------------------------------------------------------
  if (!fileData) {
    return (
      <ToolHeroView
        title="Markup & Document Converter"
        description="Render, preview, and convert Markdown, HTML, XML, and SVG formats directly in your browser with privacy sandboxing."
        badge="Markup Studio"
        badgeIcon={FiCode}
        toolPath="/markup-converter"
        onFilesSelected={handleFileLoad}
        accept={{
          'text/markdown': ['.md', '.markdown', '.mdx'],
          'text/html': ['.html', '.htm'],
          'text/xml': ['.xml', '.svg'],
          'text/plain': ['.txt'],
        }}
        multiple={false}
        uploadTitle="Drop any Markdown, HTML, XML, or SVG file here"
        uploadDescription="Converts and formats documents client-side"
        formatBadges={['.MD', '.HTML', '.XML', '.SVG', '.TXT']}
        acceptedFormats={['.md', '.html', '.xml', '.svg', '.txt']}
        singleFileOnly={true}
      />
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: TYPE-B SINGLE-COLUMN FOCUS STUDIO
  // -------------------------------------------------------------
  return (
    <div
      style={{
        height: 'calc(100vh - 72px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg-color)',
      }}
    >
      {/* Top 48px Micro Bar */}
      <ToolStudioHeader
        icon={FiCode}
        title="Markup & Document Converter"
        fileBadge={`${fileData.name} • ${formatFileSize(fileData.size || 0)}`}
        onReset={handleReset}
        resetLabel="Change File"
        headerExtra={
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--subtle-bg)',
              padding: '0.2rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              gap: '0.25rem',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'preview' ? 'var(--primary-color)' : 'transparent',
                color: viewMode === 'preview' ? '#fff' : 'var(--text-color)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <FiEye size={13} /> Visual Preview
            </button>
            <button
              type="button"
              onClick={() => setViewMode('source')}
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'source' ? 'var(--primary-color)' : 'transparent',
                color: viewMode === 'source' ? '#fff' : 'var(--text-color)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <FiCode size={13} /> Raw Source
            </button>
          </div>
        }
        actionButton={
          <button
            type="button"
            className="btn-primary studio-header-action-btn"
            onClick={downloadRenderedHtml}
          >
            <FiDownload size={14} />
            <span>Download HTML</span>
          </button>
        }
      />

      {/* Main Single-Column Document Viewport (100% height, zero outer window scroll) */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--card-bg)',
        }}
      >
        {viewMode === 'preview' ? (
          <iframe
            title="Secure Rendered Preview"
            srcDoc={previewDocument}
            sandbox="allow-same-origin"
            referrerPolicy="no-referrer"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: '#ffffff',
            }}
          />
        ) : (
          <pre
            style={{
              margin: 0,
              padding: '1.5rem',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              color: 'var(--text-color)',
              background: 'var(--subtle-bg)',
              height: '100%',
              overflowY: 'auto',
            }}
          >
            {fileData.content}
          </pre>
        )}
      </div>

      {/* Bottom Quick Action Ribbon */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.65rem 1.25rem',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-color)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          Format: <strong>{fileData.name.split('.').pop().toUpperCase()}</strong> • 🔒 Content-Security-Policy Sandboxed
        </span>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={downloadSource}
            className="btn-secondary"
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <FiDownload size={13} /> Download Original
          </button>
          <button
            type="button"
            onClick={downloadRenderedHtml}
            className="btn-primary"
            style={{
              padding: '0.4rem 1rem',
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <FiDownload size={13} /> Download Rendered HTML
          </button>
        </div>
      </div>
    </div>
  );
}
