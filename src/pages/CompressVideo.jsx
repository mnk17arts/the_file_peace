import { useState } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { FiVideo, FiDownload, FiRefreshCw } from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import Loader from '../components/Loader';


const CompressVideo = () => {
  const [loading, setLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [originalFile, setOriginalFile] = useState(null);
  const [compressedFileUrl, setCompressedFileUrl] = useState(null);
  const [progress, setProgress] = useState(0); // Tracks real-time compression

  const compressPhrases = [
    "Warming up the rendering engine...",
    "Encoding video frames...",
    "Optimizing audio streams...",
    "This might take a moment, hang tight..."
  ];

  const handleFileLoad = async (files) => {
    if (files.length !== 1) {
      alert("Please upload exactly one video.");
      return;
    }

    const file = files[0];
    setOriginalFile(file);
    setLoading(true);
    setProgress(0);

    const ffmpeg = new FFmpeg();

    // Hook into FFmpeg's progress event to update our Loader UI
    ffmpeg.on('progress', ({ progress }) => {
      setProgress(Math.round(progress * 100));
    });

    try {
      // Load FFmpeg via CDN to avoid local bundling issues

        // Use the ESM (ECMAScript Module) version of the core engine!
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

        // Convert the ESM files into secure local blobs to bypass CORS
        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
      // Write the file to FFmpeg's virtual file system
      await ffmpeg.writeFile('input.mp4', await fetchFile(file));

        // Run the compression command 
        await ffmpeg.exec([
            '-i', 'input.mp4',
            '-vcodec', 'libx264',

            // 1. QUALITY: CRF (Constant Rate Factor)
            // A lower number means BETTER quality and LARGER file size.
            '-crf', '28',

            // 2. SPEED: Encoding Preset
            // We are changing this from 'veryfast' to 'ultrafast'.
            // This tells the engine to stop doing complex math to save bytes, and just encode as fast as possible.
            '-preset', 'ultrafast',

            // THE MAGIC SAUCE: Downscale to 720p (Width scales automatically to maintain aspect ratio)
            '-vf', 'scale=-2:720',

            // Audio Settings: Just copy the audio, don't waste time re-encoding it
            '-acodec', 'copy',

            'output.mp4'
        ]);

      // Read the compressed file back out of the virtual system
      const data = await ffmpeg.readFile('output.mp4');
      
      // Convert to a downloadable Blob
      const compressedBlob = new Blob([data.buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(compressedBlob);
      
      setCompressedFileUrl(url);
      setIsCompleted(true);

    } catch (error) {
      console.error("Error compressing video:", error);
      alert("Failed to compress the video. Ensure it's a valid format like MP4 or WebM.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (compressedFileUrl) URL.revokeObjectURL(compressedFileUrl);
    setIsCompleted(false);
    setOriginalFile(null);
    setCompressedFileUrl(null);
    setProgress(0);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Compress Video</h2>

      {!originalFile && !isCompleted && (
        <FileUpload 
          onFilesSelected={handleFileLoad} 
          accept={{ 'video/*': ['.mp4', '.mov', '.webm', '.avi'] }} 
          multiple={false} 
          title="Drop a video to shrink its file size"
        />
      )}

      {isCompleted && (
        <div style={styles.resultsContainer}>
          <h3 style={styles.successTitle}>Video Compressed!</h3>
          
          <div style={styles.buttonGroup}>
            <a 
              href={compressedFileUrl} 
              download={`compressed_${originalFile.name}`} 
              style={styles.downloadBtn}
            >
              <FiDownload style={{ fontSize: '1.2rem' }} /> Download Video
            </a>
            <button onClick={handleReset} style={styles.cancelBtn}>
              <FiRefreshCw style={{ fontSize: '1.2rem' }} /> Compress Another
            </button>
          </div>
        </div>
      )}

      {/* Notice we are passing the progress state into our Loader! */}
      <Loader isLoading={loading} phrases={compressPhrases} progress={progress} />
    </div>
  );
};

const styles = {
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

export default CompressVideo;