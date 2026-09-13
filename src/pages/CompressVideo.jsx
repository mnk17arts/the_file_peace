import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { FiSliders, FiVideo, FiPlay } from 'react-icons/fi';
import Loader from '../components/Loader';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import {
  ToolHeroView,
  ToolStudioHeader,
  ResizableSplitPane,
} from '../components/studio';
import { formatFileSize, validateVideoFile } from '../utils/fileUtils';
import { consumeTransferredFile } from '../utils/fileTransfer';

export default function CompressVideo() {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [originalFile, setOriginalFile] = useState(null);
  const [originalVideoUrl, setOriginalVideoUrl] = useState(null);
  const [compressedFileUrl, setCompressedFileUrl] = useState(null);
  const [compressedBlob, setCompressedBlob] = useState(null);
  const [stats, setStats] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [alertType, setAlertType] = useState('error');

  // Settings State
  const [resolution, setResolution] = useState('720'); // 'original', '1080', '720', '480'
  const [crfQuality, setCrfQuality] = useState('28'); // '23' (High), '28' (Balanced), '34' (Max Compression)

  const ffmpegRef = useRef(null);
  const isCancelledRef = useRef(false);
  const compressedUrlRef = useRef(null);
  const handledRef = useRef(false);

  useEffect(() => {
    compressedUrlRef.current = compressedFileUrl;
  }, [compressedFileUrl]);

  const videoPhrases = [
    'Decoding video streams...',
    'Re-encoding with H.264...',
    'Crunching keyframes...',
    'Optimizing audio bitrates...',
    'Finalizing compressed container...',
  ];

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (compressedUrlRef.current) URL.revokeObjectURL(compressedUrlRef.current);
      if (originalVideoUrl) URL.revokeObjectURL(originalVideoUrl);
    };
  }, [originalVideoUrl]);

  const handleCancel = () => {
    isCancelledRef.current = true;
    try {
      if (ffmpegRef.current) {
        ffmpegRef.current.terminate();
      }
    } catch (err) {
      console.warn('Error terminating FFmpeg instance:', err);
    }
    setLoading(false);
    setProgress(0);
    setAlertType('warning');
    setErrorMessage('Video compression was cancelled.');
  };

  const handleFileLoad = useCallback((files) => {
    if (loadingRef.current) return;
    setErrorMessage(null);
    setAlertType('error');

    if (!files || files.length !== 1) {
      setErrorMessage('Please upload exactly one video to compress.');
      return;
    }

    const file = files[0];
    const validation = validateVideoFile(file, ['.mp4', '.mov', '.webm', '.avi', '.mkv'], 150 * 1024 * 1024);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      return;
    }

    setCompressedFileUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCompressedBlob(null);
    setStats(null);
    setIsCompleted(false);
    setOriginalFile(file);

    const url = URL.createObjectURL(file);
    setOriginalVideoUrl(url);
  }, []);

  // Handle incoming file piped from another tool
  useEffect(() => {
    if (handledRef.current) return;
    const incoming = consumeTransferredFile() || location.state?.incomingFile;
    if (incoming) {
      handledRef.current = true;
      setTimeout(() => {
        handleFileLoad([incoming]);
      }, 0);
    }
  }, [location.state, handleFileLoad]);

  const handleReset = () => {
    if (loading) return;
    if (originalVideoUrl) URL.revokeObjectURL(originalVideoUrl);
    setOriginalVideoUrl(null);
    setOriginalFile(null);
    if (compressedFileUrl) URL.revokeObjectURL(compressedFileUrl);
    setCompressedFileUrl(null);
    setCompressedBlob(null);
    setStats(null);
    setIsCompleted(false);
    setErrorMessage(null);
    setProgress(0);
  };

  const handleCompress = async () => {
    if (!originalFile) return;

    setLoading(true);
    setProgress(0);
    setErrorMessage(null);
    setAlertType('error');
    isCancelledRef.current = false;

    try {
      if (!ffmpegRef.current) {
        const ffmpeg = new FFmpeg();
        const baseURL = `${window.location.origin}${import.meta.env.BASE_URL}`;

        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}ffmpeg-core.wasm`, 'application/wasm'),
        });

        ffmpegRef.current = ffmpeg;
      }

      const ffmpeg = ffmpegRef.current;

      ffmpeg.on('progress', ({ progress: p }) => {
        if (!isCancelledRef.current) {
          setProgress(Math.min(Math.round(p * 100), 99));
        }
      });

      const inputExt = originalFile.name.substring(originalFile.name.lastIndexOf('.'));
      const inputName = `input${inputExt}`;
      const outputName = 'output.mp4';

      await ffmpeg.writeFile(inputName, await fetchFile(originalFile));

      const ffmpegArgs = ['-i', inputName];

      if (resolution !== 'original') {
        const scaleMap = {
          '1080': 'scale=-2:1080',
          '720': 'scale=-2:720',
          '480': 'scale=-2:480',
        };
        if (scaleMap[resolution]) {
          ffmpegArgs.push('-vf', scaleMap[resolution]);
        }
      }

      ffmpegArgs.push(
        '-c:v', 'libx264',
        '-crf', crfQuality,
        '-preset', 'ultrafast',
        '-c:a', 'aac',
        '-b:a', '128k',
        outputName
      );

      await ffmpeg.exec(ffmpegArgs);

      if (isCancelledRef.current) return;

      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      setCompressedBlob(blob);
      setCompressedFileUrl(url);

      const origSize = originalFile.size;
      const compSize = blob.size;
      const savedBytes = Math.max(0, origSize - compSize);
      const pctSaved = origSize > 0 ? (savedBytes / origSize) * 100 : 0;

      setStats({
        originalSize: origSize,
        compressedSize: compSize,
        bytesSaved: savedBytes,
        percentageSaved: pctSaved,
      });

      setIsCompleted(true);
      setProgress(100);

      // Clean up in-memory virtual filesystem
      try {
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);
      } catch (cleanErr) {
        console.warn('Error cleaning up virtual files:', cleanErr);
      }
    } catch (err) {
      console.error('Video compression error:', err);
      if (!isCancelledRef.current) {
        setErrorMessage('Failed to compress video. Please try again with a different format or preset.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompressSourceAgain = () => {
    setCompressedBlob(null);
    if (compressedFileUrl) URL.revokeObjectURL(compressedFileUrl);
    setCompressedFileUrl(null);
    setStats(null);
    setIsCompleted(false);
  };

  const handleCompressTarget = () => {
    if (!compressedBlob) return;
    const newFile = new File([compressedBlob], `compressed_${originalFile.name.replace(/\.[^/.]+$/, '')}.mp4`, {
      type: 'video/mp4',
    });
    setOriginalFile(newFile);
    if (originalVideoUrl) URL.revokeObjectURL(originalVideoUrl);
    setOriginalVideoUrl(URL.createObjectURL(newFile));

    setCompressedBlob(null);
    if (compressedFileUrl) URL.revokeObjectURL(compressedFileUrl);
    setCompressedFileUrl(null);
    setStats(null);
    setIsCompleted(false);
  };

  const outputFileName = useMemo(() => {
    return originalFile ? `compressed_${originalFile.name.replace(/\.[^/.]+$/, '')}.mp4` : 'compressed_video.mp4';
  }, [originalFile]);

  // -------------------------------------------------------------
  // VIEW 3: FINAL COMPLETION VIEW
  // -------------------------------------------------------------
  if (isCompleted && stats && originalFile && compressedFileUrl) {
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="Compress Video"
          message="Video Successfully Compressed!"
          fileUrl={compressedFileUrl}
          fileName={outputFileName}
          file={compressedBlob}
          stats={[
            { label: 'Original Size', value: formatFileSize(stats.originalSize) },
            { label: 'Compressed Size', value: formatFileSize(stats.compressedSize), color: '#10b981' },
            {
              label: 'Space Saved',
              value: stats.percentageSaved > 0 ? `${stats.percentageSaved.toFixed(1)}%` : '0%',
              color: 'var(--primary-color)',
            },
          ]}
          onReset={handleReset}
          onProcessSourceAgain={handleCompressSourceAgain}
          sourceActionLabel="Compress Source Again"
          onProcessTarget={handleCompressTarget}
          targetActionLabel="Compress Target Video"
          currentPath="/compress-video"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Upload stage)
  // -------------------------------------------------------------
  if (!originalFile) {
    return (
      <ToolHeroView
        title="Compress Video"
        description="Shrink MP4, WebM, and MOV video file sizes locally using WebAssembly FFmpeg without cloud uploads."
        badge="FFmpeg Wasm"
        badgeIcon={FiVideo}
        toolPath="/compress-video"
        acceptedFormats={['.mp4', '.mov', '.webm', '.avi', '.mkv']}
        allowMultiple={false}
        maxSizeText="150 MB"
        accept={{ 'video/*': ['.mp4', '.mov', '.webm', '.avi', '.mkv'] }}
        onFilesSelected={handleFileLoad}
        alerts={
          errorMessage ? (
            <AlertBanner
              message={errorMessage}
              type={alertType}
              onClose={() => setErrorMessage(null)}
            />
          ) : null
        }
      />
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: CONFIGURATION VIEW (TYPE-A Draggable Two-Column Studio)
  // -------------------------------------------------------------
  const leftControlsPane = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '1.25rem',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.65rem' }}>
        <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-color)' }}>
          Compression Settings
        </span>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          H.264 In-Memory
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
        {/* Quality / CRF Level */}
        <div>
          <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-color)', marginBottom: '0.5rem' }}>
            Compression Strength (CRF):
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {[
              { id: '23', label: 'High Quality (Light Compression)', desc: 'CRF 23 • Minimal quality loss, modest size reduction' },
              { id: '28', label: 'Balanced (Recommended)', desc: 'CRF 28 • Excellent balance of video clarity & file size' },
              { id: '34', label: 'Maximum Compression', desc: 'CRF 34 • Drastic size savings, ideal for Discord/email sharing' },
            ].map((opt) => (
              <label
                key={opt.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '8px',
                  border: `1px solid ${crfQuality === opt.id ? 'var(--primary-color)' : 'var(--border-color)'}`,
                  background: crfQuality === opt.id ? 'rgba(28, 153, 255, 0.08)' : 'var(--subtle-bg)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="radio"
                  name="crf"
                  value={opt.id}
                  checked={crfQuality === opt.id}
                  onChange={() => setCrfQuality(opt.id)}
                  style={{ marginTop: '0.2rem' }}
                />
                <div>
                  <span style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-color)', display: 'block' }}>
                    {opt.label}
                  </span>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {opt.desc}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Video Resolution Downscaling */}
        <div>
          <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-color)', marginBottom: '0.5rem' }}>
            Output Resolution:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
            {[
              { id: 'original', label: 'Original Resolution' },
              { id: '1080', label: '1080p (Full HD)' },
              { id: '720', label: '720p (HD)' },
              { id: '480', label: '480p (SD)' },
            ].map((res) => (
              <label
                key={res.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.5rem 0.65rem',
                  borderRadius: '6px',
                  border: `1px solid ${resolution === res.id ? 'var(--primary-color)' : 'var(--border-color)'}`,
                  background: resolution === res.id ? 'rgba(28, 153, 255, 0.08)' : 'var(--subtle-bg)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-color)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="res"
                  value={res.id}
                  checked={resolution === res.id}
                  onChange={() => setResolution(res.id)}
                />
                {res.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Compress Action Trigger */}
      <button
        type="button"
        onClick={handleCompress}
        disabled={loading}
        className="btn-primary"
        style={{
          width: '100%',
          marginTop: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1.25rem',
          borderRadius: '8px',
          fontWeight: 800,
          fontSize: '0.92rem',
          cursor: loading ? 'not-allowed' : 'pointer',
          border: 'none',
        }}
      >
        <FiVideo size={16} />
        <span>Compress Video Now</span>
      </button>
    </div>
  );

  const rightPreviewPane = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '0.85rem',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.65rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <FiPlay size={14} color="var(--primary-color)" />
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-color)' }}>
            Video Playback & Inspection
          </span>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {originalFile ? formatFileSize(originalFile.size) : ''}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000',
          borderRadius: '8px',
          padding: '0.5rem',
          overflow: 'hidden',
          minHeight: '380px',
        }}
      >
        {originalVideoUrl && (
          <video
            src={originalVideoUrl}
            controls
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              borderRadius: '6px',
              outline: 'none',
            }}
          />
        )}
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
        🔒 100% In-Browser Video Compression • No bytes are uploaded to external servers
      </div>
    </div>
  );

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
      {/* 1. Ultra-compact 48px Micro-Header */}
      <ToolStudioHeader
        title="Compress Video"
        icon={FiSliders}
        file={originalFile}
        category="Optimize"
        toolPath="/compress-video"
        onReset={handleReset}
        resetLabel="Change Video"
      />

      {/* Error / Warning Alert */}
      {errorMessage && (
        <div style={{ marginBottom: '0.5rem' }}>
          <AlertBanner
            message={errorMessage}
            type={alertType}
            onClose={() => setErrorMessage(null)}
          />
        </div>
      )}

      {/* 2. Draggable Two-Column Split Pane Studio */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResizableSplitPane
          leftPane={leftControlsPane}
          rightPane={rightPreviewPane}
          defaultSplit={45}
          minLeftWidth={320}
          minRightWidth={360}
          height="100%"
          leftTitle="Settings"
          rightTitle="Video Preview"
          storageKey="compress_video"
        />
      </div>

      {/* Processing Loader Modal */}
      <Loader
        isLoading={loading}
        phrases={videoPhrases}
        progress={progress}
        onCancel={handleCancel}
      />
    </div>
  );
}
