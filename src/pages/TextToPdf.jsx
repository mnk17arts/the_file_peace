import { useState, useRef, useEffect } from 'react';
import html2pdf from 'html2pdf.js';
import Prism from 'prismjs';
import 'prismjs/themes/prism.css'; // Import the default Prism theme
import { FiDownload, FiRefreshCw, FiSettings, FiFileText } from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import Loader from '../components/Loader';

const TextToPdf = () => {
  const [loading, setLoading] = useState(false);
  const [fileData, setFileData] = useState(null);
  
  // PDF Configurations
  const [pageSize, setPageSize] = useState('a4');
  const [orientation, setOrientation] = useState('portrait');
  const [margin, setMargin] = useState(15);
  const [fontSize, setFontSize] = useState(12);
  const [includeHeaderFooter, setIncludeHeaderFooter] = useState(true);

  const documentRef = useRef(null);

  const handleFileLoad = (files) => {
    if (files.length !== 1) return;
    const file = files[0];
    
    // Map common extensions to PrismJS language aliases
    const ext = file.name.split('.').pop().toLowerCase();
    const langMap = {
      'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
      'py': 'python', 'html': 'html', 'css': 'css', 'json': 'json', 'c': 'c', 'cpp': 'cpp', 'java': 'java'
    };
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setFileData({
        name: file.name,
        content: e.target.result,
        language: langMap[ext] || 'none'
      });
    };
    reader.readAsText(file);
  };

  // Trigger syntax highlighting whenever fileData changes
  useEffect(() => {
    if (fileData) {
      Prism.highlightAll();
    }
  }, [fileData, fontSize]);

  const generatePDF = async () => {
    if (!documentRef.current) return;
    setLoading(true);

    const opt = {
      margin:       margin,
      filename:     `${fileData.name.split('.')[0]}_formatted.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: pageSize, orientation: orientation }
    };

    try {
      // html2pdf automatically handles pagination for long documents
      await html2pdf().set(opt).from(documentRef.current).save();
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Failed to generate PDF. Ensure the file isn't overly massive.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => setFileData(null);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Text & Code to PDF</h2>

      {!fileData && (
        <FileUpload 
          onFilesSelected={handleFileLoad} 
          accept={{ 'text/plain': ['.txt', '.csv', '.json', '.md', '.html', '.css', '.js', '.ts', '.py', '.java', '.c', '.cpp'] }} 
          multiple={false} 
          title="Drop any text or source code file here"
        />
      )}

      {fileData && (
        <div style={styles.dashboard}>
          <div style={styles.header}>
            <h3 style={styles.title}><FiFileText /> {fileData.name}</h3>
            <button onClick={handleReset} style={styles.secondaryBtn}><FiRefreshCw /> Start Over</button>
          </div>

          <div style={styles.configPanel}>
            <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FiSettings /> PDF Configuration</h4>
            <div style={styles.settingsGrid}>
              <div style={styles.settingGroup}>
                <label style={styles.label}>Format:</label>
                <select value={pageSize} onChange={(e) => setPageSize(e.target.value)} style={styles.select}>
                  <option value="a4">A4</option>
                  <option value="letter">Letter</option>
                  <option value="legal">Legal</option>
                </select>
              </div>
              <div style={styles.settingGroup}>
                <label style={styles.label}>Orientation:</label>
                <select value={orientation} onChange={(e) => setOrientation(e.target.value)} style={styles.select}>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
              <div style={styles.settingGroup}>
                <label style={styles.label}>Margin (mm): {margin}</label>
                <input type="range" min="0" max="30" value={margin} onChange={(e) => setMargin(Number(e.target.value))} />
              </div>
              <div style={styles.settingGroup}>
                <label style={styles.label}>Font Size (px): {fontSize}</label>
                <input type="range" min="8" max="24" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
              </div>
              <div style={styles.settingGroup}>
                <label style={styles.label}>
                  <input type="checkbox" checked={includeHeaderFooter} onChange={(e) => setIncludeHeaderFooter(e.target.checked)} />
                  Include Header
                </label>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <button onClick={generatePDF} style={styles.primaryBtn}>
              <FiDownload /> Download Formatted PDF
            </button>
          </div>

          {/* Hidden Print Template */}
          <div style={{ display: 'none' }}>
            <div ref={documentRef} style={{ padding: '10px', backgroundColor: '#fff', color: '#000' }}>
              {includeHeaderFooter && (
                <div style={{ borderBottom: '2px solid #ccc', paddingBottom: '10px', marginBottom: '20px', fontFamily: 'sans-serif' }}>
                  <strong>File:</strong> {fileData.name}
                </div>
              )}
              <pre style={{ margin: 0, padding: 0, background: 'transparent', border: 'none', fontSize: `${fontSize}px`, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                <code className={`language-${fileData.language}`}>{fileData.content}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
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
  secondaryBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: 'transparent', color: 'var(--text-color)', border: '2px solid var(--border-color)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }
};

export default TextToPdf;