import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { FiDownload, FiRefreshCw, FiSettings } from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import FileActionMenu from '../components/FileActionMenu';
import { consumeTransferredFile } from '../utils/fileTransfer';

const ConvertVideo = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const [progress, setProgress] = useState(0);
  const [originalFile, setOriginalFile] = useState(null);
  
  // Settings State
  const [targetFormat, setTargetFormat] = useState('mp4');
  
  // Result State
  const [convertedUrl, setConvertedUrl] = useState(null);
  const [convertedBlob, setConvertedBlob] = useState(null);
  const [convertedSize, setConvertedSize] = useState(0);

  const ffmpegRef = useRef(new FFmpeg());
  const convertedUrlRef = useRef(null);
  const handledRef = useRef(false);

  useEffect(() => {
    convertedUrlRef.current = convertedUrl;
  }, [convertedUrl]);

  useEffect(() => {
    return () => {
      if (convertedUrlRef.current) URL.revokeObjectURL(convertedUrlRef.current);
    };
  }, []);

  const formatOptions = [
    { label: 'MP4 (.mp4)', value: 'mp4', mime: 'video/mp4' },
    { label: 'WebM (.webm)', value: 'webm', mime: 'video/webm' },
    { label: 'AVI (.avi)', value: 'avi', mime: 'video/x-msvideo' },
  ];

  const handleFileLoad = useCallback((files) => {
    if (loadingRef.current || !files || files.length !== 1) return;
    setConvertedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setConvertedBlob(null);
    setOriginalFile(files[0]);
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

  const handleConvert = async () => {
    if (!originalFile) return;
    setLoading(true);
    setProgress(0);

    const ffmpeg = ffmpegRef.current;

    if (!ffmpeg.loaded) {
        // Dynamically get the base URL (e.g., '/the_file_peace/')
        const baseURL = import.meta.env.BASE_URL;
        
        // Fetch the files as raw Blobs using the correct base path
        const coreURL = await toBlobURL(`${baseURL}ffmpeg-core.js`, 'text/javascript');
        const wasmURL = await toBlobURL(`${baseURL}ffmpeg-core.wasm`, 'application/wasm');
  
        await ffmpeg.load({
          coreURL: coreURL,
          wasmURL: wasmURL,
        });
      }

    // Capture the progress event and update our React state
    ffmpeg.on('progress', ({ progress }) => {
      // FFmpeg returns progress as a decimal from 0 to 1
      setProgress(Math.round(progress * 100));
    });

    try {
      const inputName = `input.${originalFile.name.split('.').pop()}`;
      const outputName = `output.${targetFormat}`;

      await ffmpeg.writeFile(inputName, await fetchFile(originalFile));

      // Execute conversion
      await ffmpeg.exec(['-i', inputName, outputName]);

      const data = await ffmpeg.readFile(outputName);
      
      const targetMime = formatOptions.find(f => f.value === targetFormat).mime;
      const blob = new Blob([data.buffer], { type: targetMime });
      const url = URL.createObjectURL(blob);

      setConvertedBlob(blob);
      setConvertedSize((blob.size / 1024 / 1024).toFixed(2));
      setConvertedUrl(url);
      
    } catch (error) {
      console.error("FFmpeg Error:", error);
      alert("An error occurred during conversion. The input format might not be supported.");
    } finally {
      setLoading(false);
      // We intentionally do not reset progress to 0 here so the bar stays at 100% on success
    }
  };

  const handleReset = () => {
    if (convertedUrl) URL.revokeObjectURL(convertedUrl);
    setOriginalFile(null);
    setConvertedUrl(null);
    setConvertedBlob(null);
    setProgress(0);
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Video Format Converter</h2>

      {!originalFile && !convertedUrl && (
        <FileUpload 
          onFilesSelected={handleFileLoad} 
          accept={{ 'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm'] }} 
          multiple={false} 
          title="Drop a video to convert its format"
        />
      )}

      {originalFile && !convertedUrl && (
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
                      disabled={loading}
                    />
                    {fmt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Real-time Progress Bar */}
          {loading ? (
            <div style={styles.progressContainer}>
              <div style={styles.progressHeader}>
                <span>Transcoding Video...</span>
                <span>{progress}%</span>
              </div>
              <div style={styles.progressBarBg}>
                <div 
                  style={{ 
                    ...styles.progressBarFill, 
                    width: `${progress}%` 
                  }} 
                />
              </div>
              <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '1rem' }}>
                Please keep this tab open. Processing entirely in your browser.
              </p>
            </div>
          ) : (
            <div style={styles.buttonGroup}>
              <button onClick={handleConvert} style={styles.primaryBtn}>
                Convert Video
              </button>
              <button onClick={handleReset} style={styles.secondaryBtn}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {convertedUrl && (
        <div style={styles.card}>
          <h3 style={styles.successTitle}>Conversion Complete!</h3>
          <p style={{ marginBottom: '2rem', color: 'var(--text-color)' }}>
            Successfully converted to <strong>.{targetFormat}</strong> ({convertedSize} MB)
          </p>

          <div style={styles.buttonGroup}>
            <a 
              href={convertedUrl} 
              download={`${originalFile.name.split('.')[0]}_converted.${targetFormat}`} 
              style={styles.downloadBtn}
            >
              <FiDownload style={{ fontSize: '1.2rem' }} /> Download Video
            </a>
            <FileActionMenu
              file={convertedBlob}
              fileUrl={convertedUrl}
              fileName={`${originalFile.name.split('.')[0]}_converted.${targetFormat}`}
              currentPath="/convert-video"
            />
            <button onClick={handleReset} style={styles.secondaryBtn}>
              <FiRefreshCw style={{ fontSize: '1.2rem' }} /> Convert Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  card: { backgroundColor: 'var(--card-bg)', padding: '2.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-color)' },
  cardTitle: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: 0, marginBottom: '1.5rem', fontSize: '1.5rem' },
  settingsGrid: { display: 'flex', flexDirection: 'column', gap: '2rem', margin: '2rem auto', maxWidth: '400px', textAlign: 'left' },
  settingGroup: { backgroundColor: 'var(--bg-color)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' },
  label: { display: 'block', marginBottom: '1rem', fontWeight: 'bold' },
  radioGroup: { display: 'flex', flexWrap: 'wrap', gap: '1rem' },
  radioLabel: { display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' },
  buttonGroup: { display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem' },
  primaryBtn: { padding: '0.75rem 2rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' },
  secondaryBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', backgroundColor: 'transparent', color: 'var(--text-color)', border: '2px solid var(--border-color)', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' },
  successTitle: { margin: '0 0 1rem 0', color: '#2ed573', fontSize: '1.75rem' },
  downloadBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', backgroundColor: '#2ed573', color: '#0f172a', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', transition: 'opacity 0.2s ease' },
  
  // Progress Bar Styles
  progressContainer: { marginTop: '2rem', padding: '1.5rem', backgroundColor: 'var(--bg-color)', borderRadius: '8px', border: '1px dashed var(--border-color)' },
  progressHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontWeight: 'bold', color: 'var(--text-color)' },
  progressBarBg: { width: '100%', height: '12px', backgroundColor: 'var(--card-bg)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' },
  progressBarFill: { height: '100%', backgroundColor: 'var(--primary-color)', transition: 'width 0.2s ease-out' }
};

export default ConvertVideo;