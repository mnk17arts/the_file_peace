import { useState } from 'react';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import { FiFileText, FiDownload, FiRefreshCw, FiEdit3 } from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import Loader from '../components/Loader';

const AddWatermark = () => {
  const [loading, setLoading] = useState(false);
  const [originalFile, setOriginalFile] = useState(null);
  const [watermarkedUrl, setWatermarkedUrl] = useState(null);

  // Watermark Settings State
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [fontSize, setFontSize] = useState(50);
  const [opacity, setOpacity] = useState(0.3);
  const [rotation, setRotation] = useState(45);
  const [color, setColor] = useState('#ff4757');

  const handleFileLoad = (files) => {
    if (files.length !== 1) return;
    setOriginalFile(files[0]);
  };

  const handleWatermark = async () => {
    if (!originalFile || !watermarkText) return;
    setLoading(true);

    try {
      const arrayBuffer = await originalFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();

      // Convert hex color string to rgb scale (0 to 1)
      const r = parseInt(color.slice(1, 3), 16) / 255;
      const g = parseInt(color.slice(3, 5), 16) / 255;
      const b = parseInt(color.slice(5, 7), 16) / 255;

      for (const page of pages) {
        const { width, height } = page.getSize();
        
        // Draw centered watermark text with rotation and opacity
        page.drawText(watermarkText, {
          x: width / 4,
          y: height / 2,
          size: Number(fontSize),
          color: rgb(r, g, b),
          opacity: Number(opacity),
          rotate: degrees(Number(rotation)),
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setWatermarkedUrl(url);

    } catch (error) {
      console.error("Watermark error:", error);
      alert("Failed to apply watermark. The PDF might be restricted or corrupted.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (watermarkedUrl) URL.revokeObjectURL(watermarkedUrl);
    setOriginalFile(null);
    setWatermarkedUrl(null);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Add PDF Watermark</h2>

      {!originalFile && (
        <FileUpload 
          onFilesSelected={handleFileLoad} 
          accept={{ 'application/pdf': ['.pdf'] }} 
          multiple={false} 
          title="Drop a PDF to stamp a watermark onto it"
        />
      )}

      {originalFile && !watermarkedUrl && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}><FiEdit3 /> Watermark Configuration</h3>
          <p>Selected File: <strong>{originalFile.name}</strong></p>

          <div style={styles.formGrid}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Watermark Text</label>
              <input 
                type="text" 
                value={watermarkText} 
                onChange={(e) => setWatermarkText(e.target.value)} 
                style={styles.textInput}
                placeholder="e.g. CONFIDENTIAL"
              />
            </div>

            <div style={styles.row}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Font Size ({fontSize}px)</label>
                <input 
                  type="range" 
                  min="20" 
                  max="100" 
                  value={fontSize} 
                  onChange={(e) => setFontSize(e.target.value)} 
                  style={styles.rangeInput}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Opacity ({Math.round(opacity * 100)}%)</label>
                <input 
                  type="range" 
                  min="0.1" 
                  max="1" 
                  step="0.1" 
                  value={opacity} 
                  onChange={(e) => setOpacity(e.target.value)} 
                  style={styles.rangeInput}
                />
              </div>
            </div>

            <div style={styles.row}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Rotation Angle ({rotation}°)</label>
                <input 
                  type="range" 
                  min="0" 
                  max="90" 
                  value={rotation} 
                  onChange={(e) => setRotation(e.target.value)} 
                  style={styles.rangeInput}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Text Color</label>
                <input 
                  type="color" 
                  value={color} 
                  onChange={(e) => setColor(e.target.value)} 
                  style={styles.colorInput}
                />
              </div>
            </div>
          </div>

          <div style={styles.buttonGroup}>
            <button onClick={handleWatermark} style={styles.primaryBtn}>
              Apply Watermark
            </button>
            <button onClick={handleReset} style={styles.secondaryBtn}>Cancel</button>
          </div>
        </div>
      )}

      {watermarkedUrl && (
        <div style={styles.card}>
          <h3 style={styles.successTitle}>Watermark Added Successfully!</h3>
          <p style={{ marginBottom: '2rem' }}>Your stamped document is ready for download.</p>
          
          <div style={styles.buttonGroup}>
            <a 
              href={watermarkedUrl} 
              download={`${originalFile.name.split('.')[0]}_watermarked.pdf`} 
              style={styles.downloadBtn}
            >
              <FiDownload style={{ fontSize: '1.2rem' }} /> Download Watermarked PDF
            </a>
            <button onClick={handleReset} style={styles.secondaryBtn}>
              <FiRefreshCw style={{ fontSize: '1.2rem' }} /> Watermark Another
            </button>
          </div>
        </div>
      )}

      <Loader isLoading={loading} phrases={["Reading PDF pages...", "Stamping typography...", "Flattening document security..."]} />
    </div>
  );
};

const styles = {
  card: { backgroundColor: 'var(--card-bg)', padding: '2.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-color)' },
  cardTitle: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: 0, marginBottom: '1.5rem', fontSize: '1.5rem' },
  formGrid: { display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '500px', margin: '2 auto', textAlign: 'left' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '0.5kt', flex: 1 },
  row: { display: 'flex', gap: '1.5rem' },
  label: { fontSize: '0.9rem', fontWeight: 'bold' },
  textInput: { padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', fontSize: '1rem', width: '100%', outline: 'none' },
  rangeInput: { width: '100%', cursor: 'pointer' },
  colorInput: { width: '100%', height: '40px', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'transparent' },
  buttonGroup: { display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem' },
  primaryBtn: { padding: '0.75rem 2rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' },
  secondaryBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', backgroundColor: 'transparent', color: 'var(--text-color)', border: '2px solid var(--border-color)', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' },
  successTitle: { margin: '0 0 1rem 0', color: '#2ed573', fontSize: '1.75rem' },
  downloadBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', backgroundColor: '#2ed573', color: '#0f172a', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', transition: 'opacity 0.2s ease' }
};

export default AddWatermark;