import { useState, useEffect, useRef } from 'react';
import { FiDownload, FiRefreshCw, FiSettings, FiImage } from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import Loader from '../components/Loader';

const ConvertImage = () => {
  const [loading, setLoading] = useState(false);
  const [originalFile, setOriginalFile] = useState(null);
  const [originalPreview, setOriginalPreview] = useState(null);
  
  // Settings State
  const [targetFormat, setTargetFormat] = useState('image/png');
  const [quality, setQuality] = useState(0.9);
  
  // Result State
  const [convertedFileUrl, setConvertedFileUrl] = useState(null);
  const [convertedSize, setConvertedSize] = useState(0);

  const canvasRef = useRef(null);

  const formatOptions = [
    { label: 'PNG', value: 'image/png', ext: '.png', supportsQuality: false },
    { label: 'JPG', value: 'image/jpeg', ext: '.jpg', supportsQuality: true },
    { label: 'WebP', value: 'image/webp', ext: '.webp', supportsQuality: true },
    { label: 'BMP', value: 'image/bmp', ext: '.bmp', supportsQuality: false },
  ];

  const selectedFormatConfig = formatOptions.find(f => f.value === targetFormat);

  const handleFileLoad = (files) => {
    if (files.length !== 1) {
      alert("Please upload exactly one image.");
      return;
    }
    const file = files[0];
    setOriginalFile(file);
    setOriginalPreview(URL.createObjectURL(file));
  };

  const handleConvert = () => {
    setLoading(true);

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // Preserve dimensions
      canvas.width = img.width;
      canvas.height = img.height;

      // Handle transparency for formats that don't support it (like JPG and BMP)
      // If we don't do this, transparent PNG backgrounds turn pitch black.
      if (targetFormat === 'image/jpeg' || targetFormat === 'image/bmp') {
        ctx.fillStyle = '#FFFFFF'; // Fill with white first
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      // Draw the original image onto the canvas
      ctx.drawImage(img, 0, 0);

      // Convert the canvas to the new format
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            alert("Conversion failed. Your browser might not natively support encoding this format.");
            setLoading(false);
            return;
          }

          // Check if the browser silently fell back to PNG (common for BMP on unsupported browsers)
          if (blob.type !== targetFormat && targetFormat === 'image/bmp') {
            console.warn("Browser does not support native BMP encoding. Falling back to PNG.");
          }

          const url = URL.createObjectURL(blob);
          setConvertedFileUrl(url);
          setConvertedSize((blob.size / 1024 / 1024).toFixed(2));
          setLoading(false);
        },
        targetFormat,
        selectedFormatConfig.supportsQuality ? quality : undefined
      );
    };

    img.onerror = () => {
      alert("Failed to load the image into the canvas. It might be corrupted.");
      setLoading(false);
    };

    img.src = originalPreview;
  };

  const handleReset = () => {
    if (convertedFileUrl) URL.revokeObjectURL(convertedFileUrl);
    if (originalPreview) URL.revokeObjectURL(originalPreview);
    setOriginalFile(null);
    setOriginalPreview(null);
    setConvertedFileUrl(null);
    setTargetFormat('image/png');
    setQuality(0.9);
  };

  // Cleanup object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (originalPreview) URL.revokeObjectURL(originalPreview);
      if (convertedFileUrl) URL.revokeObjectURL(convertedFileUrl);
    };
  }, [originalPreview, convertedFileUrl]);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Convert Image Format</h2>

      {/* Hidden canvas used for the actual rendering math */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* State 1: Upload */}
      {!originalFile && !convertedFileUrl && (
        <FileUpload 
          onFilesSelected={handleFileLoad} 
          accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.bmp'] }} 
          multiple={false} 
          title="Drop an image to convert its format"
        />
      )}

      {/* State 2: Configuration */}
      {originalFile && !convertedFileUrl && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}><FiSettings /> Conversion Settings</h3>
          <p>Original: <strong>{originalFile.name}</strong> ({(originalFile.size / 1024 / 1024).toFixed(2)} MB)</p>
          
          <div style={styles.settingsGrid}>
            <div style={styles.settingGroup}>
              <label style={styles.label}>Target Format</label>
              <div style={styles.radioGroup}>
                {formatOptions.map(fmt => (
                  <label key={fmt.value} style={styles.radioLabel}>
                    <input 
                      type="radio" 
                      name="format" 
                      value={fmt.value}
                      checked={targetFormat === fmt.value}
                      onChange={(e) => setTargetFormat(e.target.value)}
                    />
                    {fmt.label}
                  </label>
                ))}
              </div>
            </div>

            {selectedFormatConfig.supportsQuality && (
              <div style={styles.settingGroup}>
                <label style={styles.label}>
                  Quality: {Math.round(quality * 100)}%
                </label>
                <input 
                  type="range" 
                  min="0.1" max="1.0" step="0.1" 
                  value={quality} 
                  onChange={(e) => setQuality(parseFloat(e.target.value))}
                  style={styles.slider}
                />
                <small style={{display: 'block', marginTop: '0.5rem', opacity: 0.7}}>
                  Lower quality = smaller file size
                </small>
              </div>
            )}
          </div>

          <div style={styles.buttonGroup}>
            <button onClick={handleConvert} style={styles.primaryBtn}>
              Convert to {selectedFormatConfig.label}
            </button>
            <button onClick={handleReset} style={styles.secondaryBtn}>Cancel</button>
          </div>
        </div>
      )}

      {/* State 3: Results & Preview */}
      {convertedFileUrl && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}><FiImage /> Conversion Complete</h3>
          
          <div style={styles.previewContainer}>
            <div style={styles.previewBox}>
              <p style={styles.previewLabel}>Original</p>
              <img src={originalPreview} alt="Original" style={styles.previewImg} />
            </div>
            <div style={styles.previewBox}>
              <p style={styles.previewLabel}>Converted ({convertedSize} MB)</p>
              <img src={convertedFileUrl} alt="Converted" style={styles.previewImg} />
            </div>
          </div>

          <div style={styles.buttonGroup}>
            <a 
              href={convertedFileUrl} 
              download={`converted_${originalFile.name.split('.')[0]}${selectedFormatConfig.ext}`} 
              style={styles.downloadBtn}
            >
              <FiDownload style={{ fontSize: '1.2rem' }} /> Download {selectedFormatConfig.label}
            </a>
            <button onClick={handleReset} style={styles.secondaryBtn}>
              <FiRefreshCw style={{ fontSize: '1.2rem' }} /> Convert Another
            </button>
          </div>
        </div>
      )}

      <Loader isLoading={loading} phrases={["Reading pixel data...", "Re-encoding image format...", "Finalizing binary stream..."]} />
    </div>
  );
};

const styles = {
  card: {
    backgroundColor: 'var(--card-bg)',
    padding: '2.5rem',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    textAlign: 'center',
    color: 'var(--text-color)'
  },
  cardTitle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    marginTop: 0,
    marginBottom: '1.5rem',
    fontSize: '1.5rem'
  },
  settingsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
    margin: '2rem auto',
    maxWidth: '400px',
    textAlign: 'left',
  },
  settingGroup: {
    backgroundColor: 'var(--bg-color)',
    padding: '1.5rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
  },
  label: {
    display: 'block',
    marginBottom: '1rem',
    fontWeight: 'bold',
  },
  radioGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
  },
  slider: {
    width: '100%',
    cursor: 'pointer',
    accentColor: 'var(--primary-color)',
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
    marginTop: '2rem'
  },
  primaryBtn: {
    padding: '0.75rem 2rem',
    backgroundColor: 'var(--primary-color)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  secondaryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    backgroundColor: 'transparent',
    color: 'var(--text-color)',
    border: '2px solid var(--border-color)',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer',
  },
  downloadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    backgroundColor: 'var(--primary-color)',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '1.1rem',
    transition: 'opacity 0.2s ease',
  },
  previewContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '2rem',
    flexWrap: 'wrap',
    marginTop: '1.5rem',
  },
  previewBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: '45%',
  },
  previewLabel: {
    marginBottom: '0.5rem',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    opacity: 0.8
  },
  previewImg: {
    maxWidth: '100%',
    maxHeight: '300px',
    objectFit: 'contain',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    backgroundColor: '#e5e5e5' // Help see transparent backgrounds
  }
};

export default ConvertImage;