import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import {
  FiVideo,
  FiMusic,
  FiVolume2,
  FiSliders,
  FiDownload,
  FiPlay,
  FiPause,
} from 'react-icons/fi';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { formatFileSize, validateVideoFile, validateAudioFile } from '../utils/fileUtils';

export default function AddAudioToVideo() {
  const location = useLocation();

  // Selected Files
  const [videoFile, setVideoFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);

  // Studio Settings
  const [mode, setMode] = useState('replace'); // 'replace' | 'mix'
  const [audioVolume, setAudioVolume] = useState(100); // 0 - 200%
  const [videoVolume, setVideoVolume] = useState(100); // 0 - 200%
  const [loopAudio, setLoopAudio] = useState(true);
  const [trimToVideo, setTrimToVideo] = useState(true);
  const [outputFormat, setOutputFormat] = useState('mp4'); // 'mp4' | 'webm'

  // Processing & Status
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Result State
  const [processedBlob, setProcessedBlob] = useState(null);

  // Media Player References
  const videoPlayerRef = useRef(null);
  const audioPreviewRef = useRef(null);
  const ffmpegRef = useRef(null);
  const isCancelledRef = useRef(false);
  const handledIncomingRef = useRef(false);

  const videoInputRef = useRef(null);
  const audioInputRef = useRef(null);

  // Object URLs for preview with independent lifecycles
  const videoPreviewUrl = useMemo(() => {
    return videoFile ? URL.createObjectURL(videoFile) : null;
  }, [videoFile]);

  const audioPreviewUrl = useMemo(() => {
    return audioFile ? URL.createObjectURL(audioFile) : null;
  }, [audioFile]);

  const processedVideoUrl = useMemo(() => {
    return processedBlob ? URL.createObjectURL(processedBlob) : null;
  }, [processedBlob]);

  const videoUrlRef = useRef(null);
  const audioUrlRef = useRef(null);
  const processedUrlRef = useRef(null);

  useEffect(() => {
    if (videoUrlRef.current && videoUrlRef.current !== videoPreviewUrl) {
      URL.revokeObjectURL(videoUrlRef.current);
    }
    videoUrlRef.current = videoPreviewUrl;
  }, [videoPreviewUrl]);

  useEffect(() => {
    if (audioUrlRef.current && audioUrlRef.current !== audioPreviewUrl) {
      URL.revokeObjectURL(audioUrlRef.current);
    }
    audioUrlRef.current = audioPreviewUrl;
  }, [audioPreviewUrl]);

  useEffect(() => {
    if (processedUrlRef.current && processedUrlRef.current !== processedVideoUrl) {
      URL.revokeObjectURL(processedUrlRef.current);
    }
    processedUrlRef.current = processedVideoUrl;
  }, [processedVideoUrl]);

  useEffect(() => {
    return () => {
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      if (processedUrlRef.current) URL.revokeObjectURL(processedUrlRef.current);
    };
  }, []);

  // Handle incoming transferred file from another tool
  useEffect(() => {
    if (handledIncomingRef.current) return;
    const incoming = consumeTransferredFile() || location.state?.incomingFile;
    if (incoming) {
      handledIncomingRef.current = true;
      setTimeout(() => {
        if (incoming.type.startsWith('video/')) {
          setVideoFile(incoming);
        } else if (incoming.type.startsWith('audio/')) {
          setAudioFile(incoming);
        }
      }, 0);
    }
  }, [location.state]);

  const handleVideoSelected = useCallback((files) => {
    if (!files) return;
    const file = (files && typeof files === 'object' && 'length' in files && !('name' in files))
      ? files[0]
      : files;
    if (!file) return;
    const validation = validateVideoFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      return;
    }
    setVideoFile(file);
    setProcessedBlob(null);
    setErrorMessage('');
  }, []);

  const handleAudioSelected = useCallback((files) => {
    if (!files) return;
    const file = (files && typeof files === 'object' && 'length' in files && !('name' in files))
      ? files[0]
      : files;
    if (!file) return;
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      return;
    }
    setAudioFile(file);
    setProcessedBlob(null);
    setErrorMessage('');
  }, []);

  const handleReset = () => {
    setVideoFile(null);
    setAudioFile(null);
    setProcessedBlob(null);
    setIsProcessing(false);
    setProgressPercent(0);
    setProgressMsg('');
    setErrorMessage('');
  };

  // Synchronized Preview Play/Pause
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const togglePreviewPlay = () => {
    if (!videoPlayerRef.current) return;
    if (isPlayingPreview) {
      videoPlayerRef.current.pause();
      if (audioPreviewRef.current) audioPreviewRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      videoPlayerRef.current.play();
      if (audioPreviewRef.current) {
        audioPreviewRef.current.currentTime = videoPlayerRef.current.currentTime % (audioPreviewRef.current.duration || 1);
        audioPreviewRef.current.play();
      }
      setIsPlayingPreview(true);
    }
  };

  // Keep volume preview updated
  useEffect(() => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.volume = mode === 'replace' ? 0 : Math.min(1, videoVolume / 100);
    }
    if (audioPreviewRef.current) {
      audioPreviewRef.current.volume = Math.min(1, audioVolume / 100);
    }
  }, [mode, videoVolume, audioVolume]);

  // Load WebAssembly FFmpeg
  const loadFFmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current;

    const ffmpeg = new FFmpeg();
    ffmpeg.on('progress', ({ progress }) => {
      const pct = Math.round(progress * 100);
      setProgressPercent(Math.min(99, Math.max(0, pct)));
    });

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

  // Execute in-memory audio-to-video processing
  const handleProcessMerge = async () => {
    if (!videoFile || !audioFile || isProcessing) return;

    setIsProcessing(true);
    isCancelledRef.current = false;
    setErrorMessage('');
    setProgressPercent(0);
    setProgressMsg('Initializing WebAssembly video processing engine...');

    try {
      const ffmpeg = await loadFFmpeg();
      if (isCancelledRef.current) return;

      setProgressMsg('Loading video and audio streams into browser RAM...');
      const videoExt = videoFile.name.substring(videoFile.name.lastIndexOf('.')) || '.mp4';
      const audioExt = audioFile.name.substring(audioFile.name.lastIndexOf('.')) || '.mp3';

      const vInputName = `v_in_${Date.now()}${videoExt}`;
      const aInputName = `a_in_${Date.now()}${audioExt}`;
      const outExt = outputFormat === 'webm' ? '.webm' : '.mp4';
      const outName = `out_${Date.now()}${outExt}`;

      await ffmpeg.writeFile(vInputName, await fetchFile(videoFile));
      await ffmpeg.writeFile(aInputName, await fetchFile(audioFile));
      if (isCancelledRef.current) return;

      setProgressMsg('Multiplexing and mixing audio track onto video...');

      const aVol = (audioVolume / 100).toFixed(2);
      const vVol = (videoVolume / 100).toFixed(2);

      // Build FFmpeg command arguments
      let args = [];

      if (loopAudio) {
        args.push('-stream_loop', '-1');
      }
      args.push('-i', aInputName);
      args.push('-i', vInputName);

      if (mode === 'replace') {
        // Video stream from input 1 (video), Audio stream from input 0 (audio)
        if (Number(aVol) !== 1.0) {
          args.push(
            '-filter_complex', `[0:a]volume=${aVol}[aout]`,
            '-map', '1:v:0',
            '-map', '[aout]'
          );
        } else {
          args.push('-map', '1:v:0', '-map', '0:a:0');
        }
      } else {
        // Mix both audio tracks
        args.push(
          '-filter_complex',
          `[1:a]volume=${vVol}[va];[0:a]volume=${aVol}[aa];[va][aa]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
          '-map', '1:v:0',
          '-map', '[aout]'
        );
      }

      // Codec configuration
      if (outputFormat === 'webm') {
        args.push('-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-c:a', 'libopus');
      } else {
        args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k');
      }

      if (trimToVideo) {
        args.push('-shortest');
      }

      args.push(outName);

      // Run FFmpeg command
      try {
        await ffmpeg.exec(args);
      } catch (firstErr) {
        // If mix mode failed because the video didn't have an audio track, fallback to replace mode
        if (mode === 'mix') {
          console.warn('Mix mode failed (video might lack audio track), falling back to replace mode:', firstErr);
          setProgressMsg('Video has no native audio; falling back to adding audio track...');
          const fallbackArgs = [
            ...(loopAudio ? ['-stream_loop', '-1'] : []),
            '-i', aInputName,
            '-i', vInputName,
            '-filter_complex', `[0:a]volume=${aVol}[aout]`,
            '-map', '1:v:0',
            '-map', '[aout]',
            '-c:v', outputFormat === 'webm' ? 'libvpx-vp9' : 'copy',
            '-c:a', outputFormat === 'webm' ? 'libopus' : 'aac',
            ...(trimToVideo ? ['-shortest'] : []),
            outName
          ];
          await ffmpeg.exec(fallbackArgs);
        } else {
          throw firstErr;
        }
      }

      if (isCancelledRef.current) return;

      setProgressMsg('Extracting finalized video from WebAssembly memory...');
      const outData = await ffmpeg.readFile(outName);
      const mimeType = outputFormat === 'webm' ? 'video/webm' : 'video/mp4';
      const resultBlob = new Blob([outData.buffer], { type: mimeType });

      // Clean up files in virtual filesystem
      try {
        await ffmpeg.deleteFile(vInputName);
        await ffmpeg.deleteFile(aInputName);
        await ffmpeg.deleteFile(outName);
      } catch (cleanupErr) {
        console.warn('VFS cleanup warning:', cleanupErr);
      }

      setProcessedBlob(resultBlob);
    } catch (err) {
      console.error('Add Audio to Video Error:', err);
      setErrorMessage(err.message || 'Failed to merge audio into video. Check file formats.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // -------------------------------------------------------------
  // VIEW 3: ACTION COMPLETED
  // -------------------------------------------------------------
  if (processedBlob && processedVideoUrl) {
    const baseName = videoFile ? videoFile.name.replace(/\.[^/.]+$/, '') : 'video';
    const outputName = `${baseName}-with-audio.${outputFormat}`;
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          fileUrl={processedVideoUrl}
          fileName={outputName}
          file={new File([processedBlob], outputName, { type: processedBlob.type })}
          onReset={handleReset}
          message="Audio successfully merged into video!"
          currentPath="/add-audio-to-video"
          preview={
            <div style={{ maxWidth: '540px', margin: '0 auto 1.5rem', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>
              <video
                src={processedVideoUrl}
                controls
                style={{ width: '100%', maxHeight: '360px', display: 'block', background: '#000' }}
              />
            </div>
          }
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: HERO / INITIAL DUAL UPLOAD VIEW
  // -------------------------------------------------------------
  if (!videoFile || !audioFile) {
    return (
      <ToolHeroView
        title="Add Audio to Video Studio"
        toolPath="/add-audio-to-video"
        description="Merge background music, voiceovers, or replace sound on any video file 100% locally in your browser with WebAssembly."
        badge="Video & Audio Studio"
        badgeIcon={FiVideo}
        acceptedFormats={['MP4', 'WebM', 'MOV', 'MKV', 'MP3', 'WAV', 'AAC', 'M4A', 'OGG']}
        allowMultiple={false}
        alerts={errorMessage && <AlertBanner message={errorMessage} type="error" onClose={() => setErrorMessage('')} />}
      >
        <div style={{ maxWidth: '780px', margin: '1.5rem auto 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {/* Video Dropzone / Card */}
          <div
            style={{
              background: 'var(--card-bg)',
              border: videoFile ? '2px solid #10b981' : '2px dashed var(--border-color)',
              borderRadius: '16px',
              padding: '1.75rem 1.25rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              transition: 'all 0.2s ease',
            }}
          >
            <input
              type="file"
              ref={videoInputRef}
              accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleVideoSelected(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                background: videoFile ? 'rgba(16, 185, 129, 0.12)' : 'rgba(28, 153, 255, 0.12)',
                color: videoFile ? '#10b981' : 'var(--primary-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FiVideo size={26} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-color)' }}>
                {videoFile ? 'Video Selected' : '1. Choose Video File'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {videoFile ? `${videoFile.name} (${formatFileSize(videoFile.size)})` : 'Supports MP4, WebM, MOV, MKV'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="btn-primary"
              style={{
                marginTop: '0.5rem',
                padding: '0.55rem 1.25rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 700,
                background: videoFile ? 'var(--subtle-bg)' : 'var(--primary-color)',
                color: videoFile ? 'var(--text-color)' : '#fff',
                border: videoFile ? '1px solid var(--border-color)' : 'none',
                cursor: 'pointer',
              }}
            >
              {videoFile ? 'Change Video' : 'Select Video'}
            </button>
          </div>

          {/* Audio Dropzone / Card */}
          <div
            style={{
              background: 'var(--card-bg)',
              border: audioFile ? '2px solid #10b981' : '2px dashed var(--border-color)',
              borderRadius: '16px',
              padding: '1.75rem 1.25rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              transition: 'all 0.2s ease',
            }}
          >
            <input
              type="file"
              ref={audioInputRef}
              accept="audio/mp3,audio/mpeg,audio/wav,audio/aac,audio/ogg,audio/m4a,audio/flac"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleAudioSelected(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                background: audioFile ? 'rgba(16, 185, 129, 0.12)' : 'rgba(99, 102, 241, 0.12)',
                color: audioFile ? '#10b981' : '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FiMusic size={26} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-color)' }}>
                {audioFile ? 'Audio Selected' : '2. Choose Audio Track'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {audioFile ? `${audioFile.name} (${formatFileSize(audioFile.size)})` : 'Supports MP3, WAV, AAC, M4A, OGG'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              className="btn-primary"
              style={{
                marginTop: '0.5rem',
                padding: '0.55rem 1.25rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 700,
                background: audioFile ? 'var(--subtle-bg)' : '#6366f1',
                color: audioFile ? 'var(--text-color)' : '#fff',
                border: audioFile ? '1px solid var(--border-color)' : 'none',
                cursor: 'pointer',
              }}
            >
              {audioFile ? 'Change Audio' : 'Select Audio'}
            </button>
          </div>
        </div>
      </ToolHeroView>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: TWO-COLUMN STUDIO WORKSPACE
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
        overflow: 'hidden',
      }}
    >
      <ToolStudioHeader
        icon={FiVideo}
        title="Add Audio to Video Studio"
        toolPath="/add-audio-to-video"
        fileBadge={`${videoFile.name} + ${audioFile.name}`}
        primaryAction={{
          label: isProcessing ? (progressMsg || `Processing (${progressPercent}%)`) : 'Merge & Export Video',
          icon: <FiDownload size={16} />,
          onClick: handleProcessMerge,
          disabled: isProcessing,
          loading: isProcessing,
        }}
        onReset={handleReset}
        resetLabel="Reset Files"
      />

      {errorMessage && (
        <div style={{ marginBottom: '0.75rem' }}>
          <AlertBanner message={errorMessage} type="error" onClose={() => setErrorMessage('')} />
        </div>
      )}

      {/* Two Column Layout */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(400px, 1.2fr) minmax(340px, 0.9fr)',
          gap: '1rem',
          overflow: 'hidden',
        }}
      >
        {/* Left Column: Live Interactive Media Player */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-color)' }}>
              Interactive Synchronization Preview
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={togglePreviewPlay}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isPlayingPreview ? <FiPause size={13} /> : <FiPlay size={13} />}
                <span>{isPlayingPreview ? 'Pause Sync' : 'Play Both'}</span>
              </button>
            </div>
          </div>

          {/* Video Container */}
          <div
            style={{
              flex: 1,
              minHeight: '280px',
              background: '#0a0d14',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {videoPreviewUrl ? (
              <video
                key={videoPreviewUrl}
                ref={videoPlayerRef}
                src={videoPreviewUrl}
                controls
                playsInline
                preload="auto"
                loop
                onPlay={() => {
                  setIsPlayingPreview(true);
                  if (audioPreviewRef.current) {
                    audioPreviewRef.current.currentTime = videoPlayerRef.current ? videoPlayerRef.current.currentTime : 0;
                    audioPreviewRef.current.play().catch(() => {});
                  }
                }}
                onPause={() => {
                  setIsPlayingPreview(false);
                  if (audioPreviewRef.current) audioPreviewRef.current.pause();
                }}
                onSeeked={() => {
                  if (videoPlayerRef.current && audioPreviewRef.current) {
                    audioPreviewRef.current.currentTime = videoPlayerRef.current.currentTime % (audioPreviewRef.current.duration || 1);
                  }
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  maxHeight: '480px',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No video loaded</div>
            )}
            {/* Hidden audio element for preview sync */}
            {audioPreviewUrl && (
              <audio
                key={audioPreviewUrl}
                ref={audioPreviewRef}
                src={audioPreviewUrl}
                loop={loopAudio}
                preload="auto"
                style={{ display: 'none' }}
              />
            )}
          </div>

          {/* Source Information Badges */}
          <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '160px', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'var(--subtle-bg)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FiVideo size={16} color="var(--primary-color)" />
              <div style={{ overflow: 'hidden' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Video Source</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-color)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {videoFile.name} ({formatFileSize(videoFile.size)})
                </span>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: '160px', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'var(--subtle-bg)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FiMusic size={16} color="#6366f1" />
              <div style={{ overflow: 'hidden' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Audio Track</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-color)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {audioFile.name} ({formatFileSize(audioFile.size)})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Audio & Mixing Controls */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxSizing: 'border-box',
            overflowY: 'auto',
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1rem', fontWeight: 800, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FiSliders size={16} color="var(--primary-color)" />
              Audio Mixing Configuration
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Configure how the background audio track combines with the video stream.
            </p>
          </div>

          {/* Mode Selector */}
          <div>
            <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-color)', display: 'block', marginBottom: '0.5rem' }}>
              Audio Track Mode
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => setMode('replace')}
                style={{
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: mode === 'replace' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                  background: mode === 'replace' ? 'rgba(28, 153, 255, 0.08)' : 'var(--subtle-bg)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: mode === 'replace' ? 'var(--primary-color)' : 'var(--text-color)', marginBottom: '0.2rem' }}>
                  Replace Audio
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Removes existing audio; plays only the new audio track.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('mix')}
                style={{
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: mode === 'mix' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                  background: mode === 'mix' ? 'rgba(28, 153, 255, 0.08)' : 'var(--subtle-bg)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: mode === 'mix' ? 'var(--primary-color)' : 'var(--text-color)', marginBottom: '0.2rem' }}>
                  Keep &amp; Mix Both
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Blends original video speech with background music.
                </div>
              </button>
            </div>
          </div>

          {/* Added Audio Volume Slider */}
          <div style={{ background: 'var(--subtle-bg)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <FiVolume2 size={14} color="#6366f1" /> Added Audio Track Volume
              </span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#6366f1' }}>{audioVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="200"
              step="5"
              value={audioVolume}
              onChange={(e) => setAudioVolume(Number(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          {/* Original Video Volume Slider (Only for Mix mode) */}
          <div
            style={{
              background: 'var(--subtle-bg)',
              padding: '0.85rem',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              opacity: mode === 'replace' ? 0.45 : 1,
              pointerEvents: mode === 'replace' ? 'none' : 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <FiVolume2 size={14} color="var(--primary-color)" /> Original Video Audio Volume
              </span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                {mode === 'replace' ? 'Muted' : `${videoVolume}%`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="200"
              step="5"
              value={videoVolume}
              onChange={(e) => setVideoVolume(Number(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.84rem', color: 'var(--text-color)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={loopAudio}
                onChange={(e) => setLoopAudio(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary-color)' }}
              />
              <span style={{ fontWeight: 600 }}>Loop audio track if shorter than video</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.84rem', color: 'var(--text-color)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={trimToVideo}
                onChange={(e) => setTrimToVideo(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary-color)' }}
              />
              <span style={{ fontWeight: 600 }}>Trim output strictly to video duration</span>
            </label>
          </div>

          {/* Output Format */}
          <div>
            <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-color)', display: 'block', marginBottom: '0.4rem' }}>
              Output Video Format
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[
                { id: 'mp4', label: 'MP4 (Universal H.264 + AAC)' },
                { id: 'webm', label: 'WebM (VP9 + Opus)' },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setOutputFormat(fmt.id)}
                  style={{
                    flex: 1,
                    padding: '0.45rem 0.65rem',
                    borderRadius: '8px',
                    border: outputFormat === fmt.id ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                    background: outputFormat === fmt.id ? 'rgba(28, 153, 255, 0.1)' : 'var(--subtle-bg)',
                    color: outputFormat === fmt.id ? 'var(--primary-color)' : 'var(--text-color)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
