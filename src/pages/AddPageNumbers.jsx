import { useState } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { FiHash, FiDownload, FiRefreshCw, FiSliders } from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import Loader from '../components/Loader';

const AddPageNumbers = () => {
  const [loading, setLoading] = useState(false);
  const [originalFile, setOriginalFile] = useState(null);
  const [numberedUrl, setNumberedUrl] = useState(null);

  // Configuration State
  const [position, setPosition] = useState('bottom-center'); // bottom-center, bottom-right, bottom-left, top-right
  const [fontSize, setFontSize] = useState(10);
  const [startPage, setStartPage] = useState(1);
  const [color, setColor] = useState('#000000');

  const handleFileLoad = (files) => {
    if (files.length !== 1) return;
    setOriginalFile(files[0]);
  };

  const handleAddPageNumbers = async () => {
    if (!originalFile) return;
    setLoading(true);

    try {
      const arrayBuffer = await originalFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();
      const totalPages = pages.length;

      // Convert hex color to rgb scale (0 to 1)
      const r = parseInt(color.slice(1, 3), 16) / 255;
      const g = parseInt(color.slice(3, 5), 16) / 255;
      const b = parseInt(color.slice(5, 7), 16) / 255;

      for (let i = 0; i < totalPages; i++) {
        const page = pages[i];
        const { width, height } = page.getSize();
        const pageNumberText = `${startPage + i}`;
        
        const textWidth = font.widthOfTextAtSize(pageNumberText, Number(fontSize));
        const margin = 40; // distance from edge

        let x = width / 2 - textWidth / 2; // default bottom-center
        let y = margin; // default bottom

        if (position === 'bottom-center') {
          x = width / 2 - textWidth / 2;
          y = 30;
        } else if (position === 'bottom-right') {
          x = width - margin - textWidth;
          y = 30;
        } else if (position === 'bottom-left') {
          x = margin;
          y = 30;
        } else if (position === 'top-right') {
          x = width - margin - textWidth;
          y = height - 30;
        }

        page.drawText(pageNumberText, {
          x,
          y,
          size: Number(fontSize),
          font: font,
          color: rgb(r, g, b),
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setNumberedUrl(url);

    } catch (error) {
      console.error("Page numbers error:", error);
      alert("Failed to add page numbers. The document might be restricted.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (numberedUrl) URL.revokeObjectURL(numberedUrl);
    setOriginalFile(null);
    setNumberedUrl(null);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Add Page Numbers to PDF</h2>

      {!originalFile && (
        <FileUpload 
          onFilesSelected={handleFileLoad} 
          accept={{ 'application/pdf': ['.pdf'] }} 
          multiple={false} 
          title="Drop a PDF to add sequential page numbers"
        />
      )}

      {originalFile && !numberedUrl && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}><FiSliders /> Page Number Settings</h3>
          <p>Selected File: <strong>{originalFile.name}</strong></p>

          <div style={styles.formGrid}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Position on Page</label>
              <select 
                value={position} 
                onChange={(e) => setPosition(e.target.value)} 
                style={styles.selectInput}
              >
                <option value="bottom-center">Bottom Center</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="top-right">Top Right</option>
              </select>
            </div>

            <div style={styles.row}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Font Size ({fontSize}px)</label>
                <input 
                  type="range" 
                  min="8" 
                  max="24" 
                  value={fontSize} 
                  onChange={(e) => setFontSize(e.target.value)} 
                  style={styles.rangeInput}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Start Numbering At</label>
                <input 
                  type="number" 
                  min="1" 
                  value={startPage} 
                  onChange={(e) => setStartPage(Number(e.target.value))} 
                  style={styles.numberInput}
                />
              </div>
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

          <div style={styles.buttonGroup}>
            <button onClick={handleAddPageNumbers} style={styles.primaryBtn}>
              Insert Page Numbers
            </button>
            <button onClick={handleReset} style={styles.secondaryBtn}>Cancel</button>
          </div>
        </div>
      )}

      {numberedUrl && (
        <div style={styles.card}>
          <h3 style={styles.successTitle}>Page Numbers Added!</h3>
          <p style={{ marginBottom: '2rem' }}>Your updated PDF is ready for download.</p>
          
          <div style={styles.buttonGroup}>
            <a 
              href={numberedUrl} 
              download={`${originalFile.name.split('.')[0]}_numbered.pdf`} 
              style={styles.downloadBtn}
            >
              <FiDownload style={{ fontSize: '1.2rem' }} /> Download Numbered PDF
            </a>
            <button onClick={handleReset} style={styles.secondaryBtn}>
              <FiRefreshCw style={{ fontSize: '1.2rem' }} /> Number Another
            </button>
          </div>
        </div>
      )}

      <Loader isLoading={loading} phrases={["Analyzing document pages...", "Calculating coordinate margins...", "Stamping page numbers..."]} />
    </div>
  );
};

const styles = {
  card: { backgroundColor: 'var(--card-bg)', padding: '2.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-color)' },
  cardTitle: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: 0, marginBottom: '1.5rem', fontSize: '1.5rem' },
  formGrid: { display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '500px', margin: '0 auto', textAlign: 'left' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 },
  row: { display: 'flex', gap: '1.5rem' },
  label: { fontSize: '0.9rem', fontWeight: 'bold' },
  selectInput: { padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', fontSize: '1rem', width: '100%', outline: 'none' },
  numberInput: { padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', fontSize: '1rem', width: '100%', outline: 'none' },
  rangeInput: { width: '100%', cursor: 'pointer', marginTop: '0.5rem' },
  colorInput: { width: '100%', height: '40px', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'transparent' },
  buttonGroup: { display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem' },
  primaryBtn: { padding: '0.75rem 2rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' },
  secondaryBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', backgroundColor: 'transparent', color: 'var(--text-color)', border: '2px solid var(--border-color)', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' },
  successTitle: { margin: '0 0 1rem 0', color: '#2ed573', fontSize: '1.75rem' },
  downloadBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', backgroundColor: '#2ed573', color: '#0f172a', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', transition: 'opacity 0.2s ease' }
};

export default AddPageNumbers;