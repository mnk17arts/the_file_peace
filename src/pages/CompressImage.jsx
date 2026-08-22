import { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { FiDownload, FiRefreshCw, FiSliders } from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import Loader from '../components/Loader';

const CompressImage = () => {
  const [loading, setLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [originalFile, setOriginalFile] = useState(null);
  const [compressedFileUrl, setCompressedFileUrl] = useState(null);
  const [stats, setStats] = useState({ originalSize: 0, newSize: 0, savedPercentage: 0 });
  
  // New state for user-controlled quality (0.1 to 1.0)
  const [quality, setQuality] = useState(0.8);

  const compressPhrases = [
    "Squeezing the pixels...",
    "Optimizing color profiles...",
    "Preserving fine details...",
    "Finalizing compression..."
  ];

  const handleFileLoad = (files) => {
    if (files.length !== 1) {
      alert("Please upload exactly one image to compress.");
      return;
    }
    setOriginalFile(files[0]);
  };

  const handleCompress = async () => {
    setLoading(true);

    // Dynamic options based on user slider
    const options = {
      maxSizeMB: quality * 5, // Scales up to 5MB for high quality, down to 0.5MB for low
      maxWidthOrHeight: 3840, // Allow 4K resolutions to prevent blurry downscaling
      useWebWorker: true,
      initialQuality: quality, // Pass the slider value directly to the engine
    };

    try {
      const compressedBlob = await imageCompression(originalFile, options);
      
      const originalMB = (originalFile.size / 1024 / 1024).toFixed(2);
      const newMB = (compressedBlob.size / 1024 / 1024).toFixed(2);
      const saved = (((originalFile.size - compressedBlob.size) / originalFile.size) * 100).toFixed(0);
      
      setStats({ originalSize: originalMB, newSize: newMB, savedPercentage: saved });
      
      const url = URL.createObjectURL(compressedBlob);
      setCompressedFileUrl(url);
      setIsCompleted(true);

    } catch (error) {
      console.error("Error compressing image:", error);
      alert("Failed to compress the image. It might be an unsupported format.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (compressedFileUrl) URL.revokeObjectURL(compressedFileUrl);
    setIsCompleted(false);
    setOriginalFile(null);
    setCompressedFileUrl(null);
    setStats({ originalSize: 0, newSize: 0, savedPercentage: 0 });
    setQuality(0.8); // Reset slider
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Compress Image</h2>

      {/* State 1: Upload File */}
      {!originalFile && !isCompleted && (
        <FileUpload 
          onFilesSelected={handleFileLoad} 
          accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }} 
          multiple={false} 
          title="Drop an image to compress"
        />
      )}

      {/* State 2: Compression Settings (New Middle Step) */}
      {originalFile && !isCompleted && (
        <div style={styles.settingsContainer}>
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <FiSliders /> Adjust Quality
          </h3>
          <p>Selected file: <strong>{originalFile.name}</strong> ({(originalFile.size / 1024 / 1024).toFixed(2)} MB)</p>
          
          <div style={styles.sliderGroup}>
            <label style={styles.label}>
              Quality: <strong>{Math.round(quality * 100)}%</strong>
            </label>
            <input 
              type="range" 
              min="0.1" 
              max="1.0" 
              step="0.05" 
              value={quality} 
              onChange={(e) => setQuality(parseFloat(e.target.value))}
              style={styles.slider}
            />
            <div style={styles.sliderLabels}>
              <span>Smaller File</span>
              <span>Better Quality</span>
            </div>
          </div>

          <div style={styles.buttonGroup}>
            <button onClick={handleCompress} style={styles.compressBtn}>
              Compress Now
            </button>
            <button onClick={handleReset} style={styles.cancelBtn}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* State 3: Success & Stats */}
      {isCompleted && (
        <div style={styles.resultsContainer}>
          <h3 style={styles.successTitle}>Compression Complete!</h3>
          
          <div style={styles.statsGrid}>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>Original Size</span>
              <span style={styles.statValue}>{stats.originalSize} MB</span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>New Size</span>
              <span style={{...styles.statValue, color: 'var(--accent-color)'}}>{stats.newSize} MB</span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>You Saved</span>
              <span style={{...styles.statValue, color: 'var(--primary-color)'}}>{stats.savedPercentage}%</span>
            </div>
          </div>

          <div style={styles.buttonGroup}>
            <a 
              href={compressedFileUrl} 
              download={`compressed_${originalFile.name}`} 
              style={styles.downloadBtn}
            >
              <FiDownload style={{ fontSize: '1.2rem' }} /> Download Image
            </a>
            <button onClick={handleReset} style={styles.cancelBtn}>
              <FiRefreshCw style={{ fontSize: '1.2rem' }} /> Compress Another
            </button>
          </div>
        </div>
      )}

      <Loader isLoading={loading} phrases={compressPhrases} />
    </div>
  );
};

const styles = {
  settingsContainer: {
    backgroundColor: 'var(--card-bg)',
    padding: '2.5rem 2rem',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    textAlign: 'center',
  },
  sliderGroup: {
    margin: '2rem auto',
    maxWidth: '400px',
    textAlign: 'left',
  },
  label: {
    display: 'block',
    marginBottom: '1rem',
    color: 'var(--text-color)',
    fontSize: '1.1rem',
  },
  slider: {
    width: '100%',
    cursor: 'pointer',
    accentColor: 'var(--primary-color)',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '0.5rem',
    fontSize: '0.85rem',
    opacity: 0.7,
    color: 'var(--text-color)',
  },
  compressBtn: {
    padding: '0.75rem 2rem',
    backgroundColor: 'var(--primary-color)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  resultsContainer: {
    backgroundColor: 'var(--card-bg)',
    padding: '3rem 2rem',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    textAlign: 'center',
  },
  successTitle: {
    margin: '0 0 2rem 0',
    color: 'var(--text-color)',
    fontSize: '1.75rem',
  },
  statsGrid: {
    display: 'flex',
    justifyContent: 'center',
    gap: '2rem',
    marginBottom: '2.5rem',
    flexWrap: 'wrap',
  },
  statBox: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--bg-color)',
    padding: '1.5rem',
    borderRadius: '8px',
    minWidth: '120px',
    border: '1px solid var(--border-color)',
  },
  statLabel: {
    fontSize: '0.9rem',
    opacity: 0.7,
    marginBottom: '0.5rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--text-color)',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: 'var(--text-color)',
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
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
    fontSize: '1rem',
    transition: 'opacity 0.2s ease',
  },
  cancelBtn: {
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
  }
};

export default CompressImage;