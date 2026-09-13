import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import {
  FiMusic,
  FiCheck
} from 'react-icons/fi';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { formatFileSize, validateVideoFile } from '../utils/fileUtils';

const AUDIO_FORMATS = [
  { id: 'mp3', label: 'MP3 (Universal)', mime: 'audio/mp3', ext: '.mp3', acodec: 'libmp3lame' },
  { id: 'wav', label: 'WAV (Uncompressed Lossless)', mime: 'audio/wav', ext: '.wav', acodec: 'pcm_s16le' },
  { id: 'aac', label: 'AAC (High Efficiency)', mime: 'audio/aac', ext: '.aac', acodec: 'aac' },
  { id: 'ogg', label: 'OGG (Open Audio)', mime: 'audio/ogg', ext: '.ogg', acodec: 'libvorbis' },
];

const BITRATES = [
  { id: '320k', label: '320 kbps (Studio Quality)' },
  { id: '256k', label: '256 kbps (High Quality)' },
  { id: '192k', label: '192 kbps (Standard)' },
  { id: '128k', label: '128 kbps (Compact File Size)' },
];

export default function ExtractAudio() {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [targetFormat, setTargetFormat] = useState('mp3');
  const [bitrate, setBitrate] = useState('256k');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Result state
  const [extractedBlob, setExtractedBlob] = useState(null);

  const ffmpegRef = useRef(null);
  const isCancelledRef = useRef(false);
  const handledIncomingRef = useRef(false);

  // Manage extractedUrl lifecycle with useMemo
  const extractedUrl = useMemo(() => {
    return extractedBlob ? URL.createObjectURL(extractedBlob) : null;
  }, [extractedBlob]);

  useEffect(() => {
    return () => {
      if (extractedUrl) URL.revokeObjectURL(extractedUrl);
    };
  }, [extractedUrl]);

  const handleFiles = useCallback((files) => {
    if (!files || files.length === 0) return;
    const selected = Array.isArray(files) ? files[0] : files;
    const validation = validateVideoFile(selected);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      return;
    }
    setFile(selected);
    setExtractedBlob(null);
    setErrorMessage('');
    setProgressPercent(0);
  }, []);

  // Handle incoming transferred file
  useEffect(() => {
    if (handledIncomingRef.current) return;
    const incoming = consumeTransferredFile() || location.state?.incomingFile;
    if (incoming) {
      handledIncomingRef.current = true;
      setTimeout(() => {
        handleFiles([incoming]);
      }, 0);
    }
  }, [handleFiles, location.state]);

  // Initialize WebAssembly FFmpeg
  const loadFFmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current;

    const ffmpeg = new FFmpeg();
    ffmpeg.on('progress', ({ progress }) => {
      const pct = Math.round(progress * 100);
      setProgressPercent(Math.min(99, Math.max(0, pct)));
    });

    // Base URL resolution
    const baseURL = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const coreURL = await toBlobURL(`${baseURL}ffmpeg-core.js`, 'text/javascript');
    const wasmURL = await toBlobURL(`${baseURL}ffmpeg-core.wasm`, 'application/wasm');

    await ffmpeg.load({
      coreURL,
      wasmURL,
    });

    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  };

  // Perform In-Browser Audio Extraction
  const handleExtractAudio = async () => {
    if (!file || isProcessing) return;
    setIsProcessing(true);
    isCancelledRef.current = false;
    setErrorMessage('');
    setProgressPercent(0);
    setProgressMsg('Loading WebAssembly audio engine...');

    try {
      const ffmpeg = await loadFFmpeg();
      if (isCancelledRef.current) return;

      setProgressMsg('Reading video file into memory...');
      const inputName = `input_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
      const selectedFmt = AUDIO_FORMATS.find((f) => f.id === targetFormat) || AUDIO_FORMATS[0];
      const outputName = `output_${Date.now()}${selectedFmt.ext}`;

      await ffmpeg.writeFile(inputName, await fetchFile(file));
      if (isCancelledRef.current) return;

      setProgressMsg('Extracting and transcoding audio track...');

      // Build FFmpeg command
      const ffmpegArgs = ['-i', inputName, '-vn']; // -vn disables video stream
      if (selectedFmt.id === 'mp3') {
        ffmpegArgs.push('-c:a', 'libmp3lame', '-b:a', bitrate);
      } else if (selectedFmt.id === 'wav') {
        ffmpegArgs.push('-c:a', 'pcm_s16le');
      } else if (selectedFmt.id === 'aac') {
        ffmpegArgs.push('-c:a', 'aac', '-b:a', bitrate);
      } else if (selectedFmt.id === 'ogg') {
        ffmpegArgs.push('-c:a', 'libvorbis', '-b:a', bitrate);
      }

      ffmpegArgs.push(outputName);

      await ffmpeg.exec(ffmpegArgs);
      if (isCancelledRef.current) return;

      const data = await ffmpeg.readFile(outputName);
      const outBlob = new Blob([data.buffer], { type: selectedFmt.mime });
      setExtractedBlob(outBlob);
      setProgressPercent(100);

      // Clean virtual file system
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch (err) {
      if (isCancelledRef.current) return;
      console.error('Audio extraction error:', err);
      setErrorMessage(err.message || 'Failed to extract audio. Video may have no audio track or unsupported codec.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    setIsProcessing(false);
    setProgressPercent(0);
    setProgressMsg('');
    setErrorMessage('Audio extraction was cancelled.');
  };

  const handleReset = () => {
    setFile(null);
    setExtractedBlob(null);
    setErrorMessage('');
    setProgressPercent(0);
  };

  const currentFmt = AUDIO_FORMATS.find((f) => f.id === targetFormat) || AUDIO_FORMATS[0];

  // -------------------------------------------------------------
  // VIEW 3: ACTION COMPLETED
  // -------------------------------------------------------------
  if (extractedBlob && extractedUrl && file) {
    const outFileName = `${file.name.replace(/\.[^/.]+$/, '')}-audio${currentFmt.ext}`;
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="Extract Audio"
          fileUrl={extractedUrl}
          fileName={outFileName}
          file={new File([extractedBlob], outFileName, { type: currentFmt.mime })}
          onReset={handleReset}
          onProcessSourceAgain={() => setExtractedBlob(null)}
          sourceActionLabel="Extract Source Again"
          onProcessTarget={() => {
            const chained = new File([extractedBlob], outFileName, { type: currentFmt.mime });
            setFile(chained);
            setExtractedBlob(null);
          }}
          targetActionLabel="Use Audio File"
          message="Audio track extracted successfully!"
          currentPath="/extract-audio"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Empty state)
  // -------------------------------------------------------------
  if (!file) {
    return (
      <ToolHeroView
        title="Extract Audio from Video"
        description="Extract crystal-clear MP3, WAV, AAC, or OGG audio tracks from video files with custom bitrates 100% offline in your browser."
        badge="Audio & Media"
        badgeIcon={FiMusic}
        toolPath="/extract-audio"
        acceptedFormats={['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v']}
        allowMultiple={false}
        maxSizeText="500 MB"
        accept={{ 'video/*': ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'] }}
        onFilesSelected={handleFiles}
        alerts={
          errorMessage ? (
            <AlertBanner
              message={errorMessage}
              type="error"
              onClose={() => setErrorMessage('')}
            />
          ) : null
        }
      />
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: STUDIO CONFIGURATION VIEW
  // -------------------------------------------------------------
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
        overflow: 'hidden'
      }}
    >
      <ToolStudioHeader
        toolTitle="Extract Audio"
        fileBadge={`${file.name} (${formatFileSize(file.size)})`}
        onBack={handleReset}
        backLabel="Choose Another Video"
        primaryAction={{
          label: isProcessing ? `Extracting (${progressPercent}%)...` : 'Extract Audio Track',
          icon: FiMusic,
          onClick: handleExtractAudio,
          disabled: isProcessing,
          loading: isProcessing
        }}
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1rem 0' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {errorMessage && (
            <AlertBanner
              message={errorMessage}
              type="error"
              onClose={() => setErrorMessage('')}
            />
          )}

          <div
            style={{
              background: 'var(--card-bg, #1e293b)',
              border: '1px solid var(--border-color, #334155)',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
              {/* Target Format Picker */}
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.75rem' }}>
                  Target Audio Format:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {AUDIO_FORMATS.map((fmt) => {
                    const isSelected = targetFormat === fmt.id;
                    return (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setTargetFormat(fmt.id)}
                        disabled={isProcessing}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          borderRadius: '10px',
                          border: `1px solid ${isSelected ? 'var(--primary-color, #6366f1)' : 'var(--border-color, #334155)'}`,
                          background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-color, #0f172a)',
                          color: 'var(--text-color)',
                          cursor: isProcessing ? 'not-allowed' : 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <span style={{ fontWeight: isSelected ? 700 : 500, fontSize: '0.9rem' }}>{fmt.label}</span>
                        {isSelected && <FiCheck style={{ color: 'var(--primary-color, #6366f1)' }} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bitrate Selection */}
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.75rem' }}>
                  Audio Quality / Bitrate:
                </span>
                {targetFormat === 'wav' ? (
                  <div
                    style={{
                      padding: '1rem',
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: '10px',
                      fontSize: '0.85rem',
                      color: 'var(--text-color)',
                      lineHeight: 1.5
                    }}
                  >
                    🎵 <strong>Uncompressed PCM:</strong> WAV format extracts pure uncompressed 16-bit PCM audio with zero loss in fidelity. Bitrate settings do not apply.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {BITRATES.map((b) => {
                      const isSelected = bitrate === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setBitrate(b.id)}
                          disabled={isProcessing}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.75rem 1rem',
                            borderRadius: '10px',
                            border: `1px solid ${isSelected ? 'var(--primary-color, #6366f1)' : 'var(--border-color, #334155)'}`,
                            background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-color, #0f172a)',
                            color: 'var(--text-color)',
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            textAlign: 'left'
                          }}
                        >
                          <span style={{ fontWeight: isSelected ? 700 : 500, fontSize: '0.9rem' }}>{b.label}</span>
                          {isSelected && <FiCheck style={{ color: 'var(--primary-color, #6366f1)' }} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* In-Progress State */}
            {isProcessing && (
              <div style={{ padding: '1.25rem', background: 'var(--bg-color, #0f172a)', borderRadius: '12px', border: '1px solid var(--border-color, #334155)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '0.5rem', fontWeight: 600 }}>
                  <span style={{ color: 'var(--text-color)' }}>{progressMsg || 'Processing...'}</span>
                  <span style={{ color: 'var(--primary-color, #6366f1)' }}>{progressPercent}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--primary-color, #6366f1)', borderRadius: '999px', transition: 'width 0.2s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={handleCancel}
                    style={{
                      padding: '0.35rem 0.75rem',
                      background: 'transparent',
                      border: '1px solid var(--border-color, #334155)',
                      borderRadius: '6px',
                      color: 'var(--text-secondary, #94a3b8)',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={handleReset}
                disabled={isProcessing}
                style={{
                  padding: '0.75rem 1.25rem',
                  background: 'transparent',
                  border: '1px solid var(--border-color, #334155)',
                  borderRadius: '10px',
                  color: 'var(--text-color)',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExtractAudio}
                disabled={isProcessing}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--primary-color, #6366f1)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  opacity: isProcessing ? 0.6 : 1
                }}
              >
                <FiMusic /> {isProcessing ? 'Extracting...' : 'Extract Audio Track'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
