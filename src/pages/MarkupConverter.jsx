import { useState, useEffect } from 'react';
import { marked } from 'marked';
import { FiCode, FiLayout, FiDownload, FiRefreshCw, FiEye } from 'react-icons/fi';
import FileUpload from '../components/FileUpload';

const MarkupConverter = () => {
  const [fileData, setFileData] = useState(null);
  const [viewMode, setViewMode] = useState('preview'); // 'source' or 'preview'
  const [renderedHtml, setRenderedHtml] = useState('');

  const handleFileLoad = (files) => {
    if (files.length !== 1) return;
    const file = files[0];
    const ext = file.name.split('.').pop().toLowerCase();
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      
      let htmlOutput = '';
      
      // 1. Markdown Formats: Parse with marked
      if (['md', 'markdown', 'mdx'].includes(ext)) {
        htmlOutput = marked.parse(content);
      } 
      // 2. Native Web Formats: The browser can render these directly
      else if (['html', 'htm', 'xml', 'svg'].includes(ext)) {
        htmlOutput = content;
      } 
      // 3. Graceful Fallback: Wrap unsupported/plain text formats in a clean pre-formatted block
      else {
        htmlOutput = `
          <div style="background-color: #f8f9fa; padding: 1.5rem; border-radius: 8px; border: 1px solid #e9ecef;">
            <p style="color: #6c757d; font-size: 0.85rem; margin-top: 0; margin-bottom: 1rem; border-bottom: 1px solid #dee2e6; padding-bottom: 0.5rem;">
              <em>Rendered as plain text (Native visual parsing not supported for .${ext})</em>
            </p>
            <pre style="white-space: pre-wrap; word-wrap: break-word; font-family: monospace; font-size: 14px; margin: 0; color: #333;">${
              // Escape HTML tags so they don't accidentally execute in the fallback view
              content.replace(/</g, "&lt;").replace(/>/g, "&gt;")
            }</pre>
          </div>
        `;
      }

      setFileData({ name: file.name, content, originalType: file.type || 'text/plain' });
      setRenderedHtml(htmlOutput);
    };
    reader.readAsText(file);
  };

  const downloadSource = () => {
    const blob = new Blob([fileData.content], { type: fileData.originalType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileData.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadRenderedHtml = () => {
    // Wrap the rendered content in a basic HTML boilerplate for proper offline viewing
    const fullHtmlTemplate = `
      <!DOCTYPE html>
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
        ${renderedHtml}
      </body>
      </html>
    `;

    const blob = new Blob([fullHtmlTemplate], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileData.name.split('.')[0]}_rendered.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: '85vh' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Markup Previewer & Converter</h2>

      {!fileData ? (
        <FileUpload 
          onFilesSelected={handleFileLoad} 
          accept={{ 'text/*': ['.md', '.markdown', '.mdx', '.html', '.htm', '.xml', '.svg', '.txt', '.adoc', '.rst'] }} 
          multiple={false} 
          title="Drop Markdown, HTML, XML, or Text files here"
        />
      ) : (
        <div style={styles.workspace}>
          {/* Header Controls */}
          <div style={styles.header}>
            <div style={styles.titleArea}>
              <span style={styles.fileName}>{fileData.name}</span>
              <div style={styles.toggleGroup}>
                <button 
                  onClick={() => setViewMode('source')} 
                  style={viewMode === 'source' ? styles.activeToggle : styles.inactiveToggle}
                >
                  <FiCode /> Source
                </button>
                <button 
                  onClick={() => setViewMode('preview')} 
                  style={viewMode === 'preview' ? styles.activeToggle : styles.inactiveToggle}
                >
                  <FiEye /> Rendered
                </button>
              </div>
            </div>
            
            <div style={styles.actionGroup}>
              <button onClick={downloadSource} style={styles.secondaryBtn} title="Download Original File">
                <FiDownload /> Source
              </button>
              <button onClick={downloadRenderedHtml} style={styles.primaryBtn} title="Download Compiled HTML File">
                <FiLayout /> Rendered HTML
              </button>
              <button onClick={() => setFileData(null)} style={styles.resetBtn}>
                <FiRefreshCw />
              </button>
            </div>
          </div>

          {/* Viewer Area */}
          <div style={styles.viewerContainer}>
            {viewMode === 'source' ? (
              <textarea 
                readOnly 
                value={fileData.content} 
                style={styles.sourceViewer}
              />
            ) : (
              <div 
                className="markdown-body" 
                style={styles.renderedViewer}
                dangerouslySetInnerHTML={{ __html: renderedHtml }} 
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  workspace: { display: 'flex', flexDirection: 'column', flexGrow: 1, backgroundColor: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', backgroundColor: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)' },
  titleArea: { display: 'flex', alignItems: 'center', gap: '1.5rem' },
  fileName: { fontWeight: 'bold', color: 'var(--text-color)', fontSize: '1.1rem' },
  toggleGroup: { display: 'flex', backgroundColor: 'var(--card-bg)', borderRadius: '6px', border: '1px solid var(--border-color)', overflow: 'hidden' },
  activeToggle: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' },
  inactiveToggle: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: 'transparent', color: 'var(--text-color)', border: 'none', cursor: 'pointer' },
  actionGroup: { display: 'flex', gap: '0.75rem' },
  primaryBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: '#2ed573', color: '#0f172a', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' },
  secondaryBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: 'transparent', color: 'var(--text-color)', border: '1px solid var(--border-color)', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' },
  resetBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem', backgroundColor: '#ff4757', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  viewerContainer: { flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  sourceViewer: { flexGrow: 1, padding: '1.5rem', border: 'none', backgroundColor: '#1e1e1e', color: '#d4d4d4', fontFamily: 'monospace', fontSize: '14px', resize: 'none', outline: 'none' },
  renderedViewer: { flexGrow: 1, padding: '2rem', overflowY: 'auto', backgroundColor: '#ffffff', color: '#333333' }
};

export default MarkupConverter;