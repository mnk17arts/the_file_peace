import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import {
  FiScissors,
  FiArrowLeft,
  FiPlay,
  FiPause,
  FiVolume2,
} from 'react-icons/fi';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { formatFileSize, validateAudioFile } from '../utils/fileUtils';

const FORMATS = [
  { id: 'mp3', label: 'MP3', mime: 'audio/mp3', ext: '.mp3', acodec: 'libmp3lame' },
  { id: 'wav', label: 'WAV', mime: 'audio/wav', ext: '.wav', acodec: 'pcm_s16le' },
  { id: 'aac', label: 'AAC', mime: 'audio/aac', ext: '.aac', acodec: 'aac' },
  { id: 'ogg', label: 'OGG', mime: 'audio/ogg', ext: '.ogg', acodec: 'libvorbis' },
];

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00.00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

export default function AudioTools() {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [targetFormat, setTargetFormat] = useState('mp3');
  const [volumeGain, setVolumeGain] = useState(100); // 50% to 200%
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Result state
  const [trimmedBlob, setTrimmedBlob] = useState(null);

  const waveformCanvasRef = useRef(null);
  const audioDataRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioElementRef = useRef(null);
  const ffmpegRef = useRef(null);
  const isCancelledRef = useRef(false);
  const handledIncomingRef = useRef(false);

  // Stable Object URLs
  const audioSrc = useMemo(() => {
    return file ? URL.createObjectURL(file) : null;
  }, [file]);

  useEffect(() => {
    return () => {
      if (audioSrc) URL.revokeObjectURL(audioSrc);
    };
  }, [audioSrc]);

  const trimmedUrl = useMemo(() => {
    return trimmedBlob ? URL.createObjectURL(trimmedBlob) : null;
  }, [trimmedBlob]);

  useEffect(() => {
    return () => {
      if (trimmedUrl) URL.revokeObjectURL(trimmedUrl);
    };
  }, [trimmedUrl]);

  // Waveform Drawing
  const drawWaveform = useCallback((audioBuffer, start, end, current) => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || !audioBuffer) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Get channel data (mono or left channel)
    const rawData = audioBuffer.getChannelData(0);
    const step = Math.ceil(rawData.length / width);
    const amp = height / 2;

    // Draw background waveform bars
    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = rawData[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      const barHeight = Math.max(2, (max - min) * amp * 0.9);
      const isTrimmed = (i / width) * audioBuffer.duration >= start && (i / width) * audioBuffer.duration <= end;
      ctx.fillStyle = isTrimmed ? '#1c99ff' : 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(i, (height - barHeight) / 2, 1, barHeight);
    }

    // Draw trim boundaries
    const startX = (start / audioBuffer.duration) * width;
    const endX = (end / audioBuffer.duration) * width;

    // Dim excluded regions
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, startX, height);
    ctx.fillRect(endX, 0, width - endX, height);

    // Boundary lines
    ctx.strokeStyle = '#2ed573';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, height);
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, height);
    ctx.stroke();

    // Playback cursor
    if (current >= 0) {
      const curX = (current / audioBuffer.duration) * width;
      ctx.strokeStyle = '#ff4757';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(curX, 0);
      ctx.lineTo(curX, height);
      ctx.stroke();
    }
  }, []);

  // Decode audio data for visual waveform rendering
  const decodeAndDrawWaveform = useCallback(async (selectedFile) => {
    setErrorMessage('');
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ctx;

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      audioDataRef.current = audioBuffer;
      const dur = audioBuffer.duration;
      setDuration(dur);
      setStartTime(0);
      setEndTime(dur);
      setCurrentTime(0);

      // Draw initial waveform
      drawWaveform(audioBuffer, 0, dur, 0);
    } catch (err) {
      console.warn('Waveform decode error (audio might still be playable):', err);
    }
  }, [drawWaveform]);

  const handleFiles = useCallback((files) => {
    if (!files || files.length === 0) return;
    const selected = Array.isArray(files) ? files[0] : files;
    const validation = validateAudioFile(selected);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      return;
    }
    setFile(selected);
    setTrimmedBlob(null);
    setIsPlaying(false);
    decodeAndDrawWaveform(selected);
  }, [decodeAndDrawWaveform]);

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

  // Audio Playback Preview
  const handleTogglePlay = () => {
    if (!audioElementRef.current) return;
    const audio = audioElementRef.current;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (audio.currentTime < startTime || audio.currentTime >= endTime - 0.05) {
        audio.currentTime = startTime;
        setCurrentTime(startTime);
      }
      audio.volume = Math.min(1.0, Math.max(0.0, volumeGain / 100));
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Audio play failed or was interrupted:', err);
        setIsPlaying(false);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (!audioElementRef.current) return;
    const cur = audioElementRef.current.currentTime;
    setCurrentTime(cur);

    if (cur >= endTime) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = startTime;
      setCurrentTime(startTime);
      setIsPlaying(false);
      if (audioDataRef.current) {
        drawWaveform(audioDataRef.current, startTime, endTime, startTime);
      }
    } else if (audioDataRef.current) {
      drawWaveform(audioDataRef.current, startTime, endTime, cur);
    }
  };

  // Update waveform on start slider change
  const handleStartChange = (val) => {
    const newStart = Math.min(val, endTime - 0.5);
    setStartTime(newStart);
    if (!isPlaying) {
      setCurrentTime(newStart);
      if (audioElementRef.current) {
        audioElementRef.current.currentTime = newStart;
      }
      if (audioDataRef.current) {
        drawWaveform(audioDataRef.current, newStart, endTime, newStart);
      }
    } else if (audioDataRef.current) {
      drawWaveform(audioDataRef.current, newStart, endTime, currentTime);
    }
  };

  // Update waveform on end slider change
  const handleEndChange = (val) => {
    const newEnd = Math.max(val, startTime + 0.5);
    setEndTime(newEnd);
    if (audioDataRef.current) {
      drawWaveform(audioDataRef.current, startTime, newEnd, currentTime);
    }
  };

  // Click on waveform to seek
  const handleWaveformClick = (e) => {
    if (!waveformCanvasRef.current || !duration) return;
    const rect = waveformCanvasRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const seekTime = ratio * duration;
    const clamped = Math.max(startTime, Math.min(endTime, seekTime));
    setCurrentTime(clamped);
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = clamped;
    }
    if (audioDataRef.current) {
      drawWaveform(audioDataRef.current, startTime, endTime, clamped);
    }
  };

  // Process Trim & Transcode via WebAssembly FFmpeg
  const handleExecuteTrim = async () => {
    if (!file || isProcessing) return;
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    }

    setIsProcessing(true);
    setErrorMessage('');
    setProgressPercent(5);
    setProgressMsg('Loading WebAssembly Audio Engine...');
    isCancelledRef.current = false;

    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    ffmpeg.on('progress', ({ progress: p }) => {
      if (!isCancelledRef.current) {
        setProgressPercent(Math.min(95, Math.max(10, Math.round(p * 100))));
      }
    });

    try {
      const baseURL = import.meta.env.BASE_URL;
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}ffmpeg-core.wasm`, 'application/wasm'),
      });

      if (isCancelledRef.current) return;

      const inExt = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'mp3';
      const inputName = `input.${inExt}`;
      const formatObj = FORMATS.find((f) => f.id === targetFormat) || FORMATS[0];
      const outputName = `output${formatObj.ext}`;

      await ffmpeg.writeFile(inputName, await fetchFile(file));

      setProgressMsg('Trimming and processing audio...');
      setProgressPercent(40);

      // FFmpeg args: -ss start, -to end, -af volume=gain
      const volMultiplier = (volumeGain / 100).toFixed(2);
      const ffmpegArgs = [
        '-ss', String(startTime),
        '-to', String(endTime),
        '-i', inputName,
        '-af', `volume=${volMultiplier}`,
        outputName,
      ];

      await ffmpeg.exec(ffmpegArgs);

      if (isCancelledRef.current) return;

      setProgressMsg('Finalizing trimmed audio track...');
      setProgressPercent(95);

      const data = await ffmpeg.readFile(outputName);
      const outBlob = new Blob([data.buffer], { type: formatObj.mime });
      setTrimmedBlob(outBlob);
      setProgressPercent(100);
    } catch (err) {
      console.error('Trim error:', err);
      if (!isCancelledRef.current) {
        setErrorMessage(err.message || 'Failed to process audio track.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    setFile(null);
    setTrimmedBlob(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setStartTime(0);
    setEndTime(0);
    setDuration(0);
    setErrorMessage('');
  };

  const currentFmt = FORMATS.find((f) => f.id === targetFormat) || FORMATS[0];

  const audioElem = audioSrc ? (
    <audio
      ref={audioElementRef}
      src={audioSrc}
      onTimeUpdate={handleTimeUpdate}
      onEnded={() => {
        setIsPlaying(false);
        setCurrentTime(startTime);
      }}
      style={{ display: 'none' }}
    />
  ) : null;

  if (trimmedBlob && trimmedUrl) {
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {audioElem}
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1.25rem' }}>
          <button
            onClick={() => setTrimmedBlob(null)}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.95rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}
          >
            <FiArrowLeft /> Back to Audio Studio
          </button>
        </div>

        <ActionCompleted
          fileUrl={trimmedUrl}
          fileName={`${file.name.replace(/\.[^/.]+$/, '')}-trimmed${currentFmt.ext}`}
          file={new File([trimmedBlob], `${file.name.replace(/\.[^/.]+$/, '')}-trimmed${currentFmt.ext}`, { type: currentFmt.mime })}
          onReset={handleReset}
          message="Audio trimmed & converted successfully!"
          currentPath="/audio-tools"
        />
      </div>
    );
  }

  if (!file) {
    return (
      <>
        {audioElem}
        <ToolHeroView
          title="Audio Converter & Trimmer"
          toolPath="/audio-tools"
          description="Visual waveform trimmer, volume booster, and multi-format audio converter (MP3, WAV, AAC, OGG) 100% offline."
          badge="Audio Studio"
          badgeIcon={FiVolume2}
          acceptedFormats={['MP3', 'WAV', 'AAC', 'OGG', 'M4A', 'FLAC']}
          allowMultiple={false}
          accept={{ 'audio/*': ['.mp3', '.wav', '.aac', '.ogg', '.m4a', '.flac', '.weba'] }}
          onFilesSelected={handleFiles}
          alerts={errorMessage && (
            <AlertBanner
              message={errorMessage}
              type="error"
              onClose={() => setErrorMessage('')}
            />
          )}
        />
      </>
    );
  }

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
      {audioElem}
      <ToolStudioHeader
        toolTitle="Audio Studio"
        toolPath="/audio-tools"
        fileCount={1}
        primaryAction={{
          label: isProcessing ? `Processing (${progressPercent}%)` : 'Trim & Export Audio',
          icon: <FiScissors size={16} />,
          onClick: handleExecuteTrim,
          disabled: isProcessing,
          loading: isProcessing,
        }}
        onReset={handleReset}
        resetLabel="Change Audio"
      />

      {errorMessage && (
        <div style={{ marginBottom: '0.75rem' }}>
          <AlertBanner
            message={errorMessage}
            type="error"
            onClose={() => setErrorMessage('')}
          />
        </div>
      )}

      {/* Scrollable Studio Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingRight: '0.25rem' }}>
        {/* Audio File Info Card */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.25rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <span style={{ fontWeight: 700, color: 'var(--text-color)', display: 'block', fontSize: '1rem' }}>{file.name}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Total Duration: {formatTime(duration)} • {formatFileSize(file.size)}
            </span>
          </div>
        </div>

        {/* Waveform Visualizer Desk */}
        <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={handleTogglePlay}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 1rem',
                  borderRadius: '8px',
                  background: 'var(--primary-color)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                {isPlaying ? <FiPause /> : <FiPlay />} {isPlaying ? 'Pause Preview' : 'Play Selection'}
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Position: <strong style={{ color: 'var(--text-color)' }}>{formatTime(currentTime)}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
              <span>Start: <strong style={{ color: '#2ed573' }}>{formatTime(startTime)}</strong></span>
              <span>End: <strong style={{ color: '#2ed573' }}>{formatTime(endTime)}</strong></span>
              <span>Length: <strong style={{ color: 'var(--primary-color)' }}>{formatTime(endTime - startTime)}</strong></span>
            </div>
          </div>

          {/* Waveform Canvas */}
          <div
            onClick={handleWaveformClick}
            style={{ width: '100%', overflow: 'hidden', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#0f172a', cursor: 'pointer' }}
            title="Click anywhere on waveform to seek"
          >
            <canvas
              ref={waveformCanvasRef}
              width={1000}
              height={120}
              style={{ width: '100%', height: '120px', display: 'block' }}
            />
          </div>

          {/* Dual Sliders for Trimming */}
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                <span>Start Trim Point: {formatTime(startTime)}</span>
                <span>Drag to trim start</span>
              </div>
              <input
                type="range"
                min="0"
                max={Math.max(0.1, duration)}
                step="0.05"
                value={startTime}
                onChange={(e) => handleStartChange(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#2ed573' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                <span>End Trim Point: {formatTime(endTime)}</span>
                <span>Drag to trim end</span>
              </div>
              <input
                type="range"
                min="0"
                max={Math.max(0.1, duration)}
                step="0.05"
                value={endTime}
                onChange={(e) => handleEndChange(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#2ed573' }}
              />
            </div>
          </div>
        </div>

        {/* Config: Format Picker & Volume Booster */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {/* Target Format */}
          <div style={{ background: 'var(--card-bg)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.75rem' }}>
              Output Format:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTargetFormat(f.id)}
                  style={{
                    padding: '0.55rem 0.2rem',
                    borderRadius: '8px',
                    border: `1px solid ${targetFormat === f.id ? 'var(--primary-color)' : 'var(--border-color)'}`,
                    background: targetFormat === f.id ? 'rgba(28, 153, 255, 0.12)' : 'var(--subtle-bg)',
                    color: targetFormat === f.id ? 'var(--primary-color)' : 'var(--text-color)',
                    fontWeight: targetFormat === f.id ? 700 : 500,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Volume Booster */}
          <div style={{ background: 'var(--card-bg)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-color)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <FiVolume2 /> Volume Level:
              </span>
              <strong style={{ color: volumeGain > 100 ? '#ffa502' : 'var(--primary-color)', fontSize: '0.9rem' }}>
                {volumeGain}% {volumeGain > 100 ? '(Boosted)' : ''}
              </strong>
            </div>
            <input
              type="range"
              min="50"
              max="200"
              step="5"
              value={volumeGain}
              onChange={(e) => {
                const val = Number(e.target.value);
                setVolumeGain(val);
                if (audioElementRef.current) {
                  audioElementRef.current.volume = Math.min(1.0, Math.max(0.0, val / 100));
                }
              }}
              style={{ width: '100%', marginTop: '0.4rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              <span>50% (Quieter)</span>
              <span>100% (Normal)</span>
              <span>200% (2x Boost)</span>
            </div>
          </div>
        </div>

        {/* Processing Progress */}
        {isProcessing && (
          <div style={{ background: 'var(--card-bg)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-color)', marginBottom: '0.5rem' }}>
              <span>{progressMsg}</span>
              <span>{progressPercent}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: 'var(--primary-color)',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
