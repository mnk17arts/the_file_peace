import { useState, useEffect, useMemo } from 'react';
import { FiX, FiDownload, FiEye } from 'react-icons/fi';

/**
 * UniversalPreviewModal — Supports in-browser instant preview for PDF, Images, Video, Audio, and Text
 */
export default function UniversalPreviewModal({
  isOpen = true,
  onClose,
  fileUrl: propFileUrl,
  fileName: propFileName,
  file,
}) {
  const [textContent, setTextContent] = useState('');

  const fileUrl = useMemo(() => {
    if (propFileUrl) return propFileUrl;
    if (file instanceof Blob) {
      return URL.createObjectURL(file);
    }
    return null;
  }, [propFileUrl, file]);

  useEffect(() => {
    return () => {
      if (!propFileUrl && fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [propFileUrl, fileUrl]);

  const fileName = propFileName || file?.name || 'file';

  const ext = (fileName || '').toLowerCase().split('.').pop();
  const isPdf = ext === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(ext);
  const isVideo = ['mp4', 'webm', 'mov', 'mkv', 'ogg'].includes(ext);
  const isAudio = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'].includes(ext);
  const isText = ['txt', 'md', 'markdown', 'json', 'csv', 'xml', 'html', 'log', 'js', 'jsx', 'css', 'ts', 'tsx', 'yaml', 'yml'].includes(ext);

  useEffect(() => {
    if (isText && fileUrl) {
      fetch(fileUrl)
        .then((res) => res.text())
        .then((text) => setTextContent(text.slice(0, 100000)))
        .catch((err) => console.error('Failed to load text preview:', err));
    }
  }, [isText, fileUrl]);

  if (!isOpen || (!fileUrl && !file)) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(11, 15, 23, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1.5rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--card-bg)',
          width: '100%',
          maxWidth: isPdf ? '1050px' : '850px',
          height: isPdf ? '88vh' : 'auto',
          maxHeight: '90vh',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1.25rem',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--subtle-bg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
            <FiEye style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
            <span
              style={{
                fontWeight: 700,
                fontSize: '0.92rem',
                color: 'var(--text-color)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {fileName}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <a
              href={fileUrl}
              download={fileName}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.8rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 700,
                textDecoration: 'none',
                background: 'var(--primary-color)',
                color: '#fff',
              }}
            >
              <FiDownload size={13} />
              <span>Download</span>
            </a>

            <button
              onClick={onClose}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'transparent',
                color: 'var(--text-color)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <FiX size={14} />
              <span>Close</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
            overflow: 'auto',
            background: 'var(--bg-color)',
          }}
        >
          {isPdf && (
            <iframe
              src={`${fileUrl}#toolbar=1&navpanes=0`}
              style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }}
              title={fileName}
            />
          )}

          {isImage && (
            <img
              src={fileUrl}
              alt={fileName}
              style={{
                maxWidth: '100%',
                maxHeight: '75vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              }}
            />
          )}

          {isVideo && (
            <video
              src={fileUrl}
              controls
              autoPlay
              style={{
                maxWidth: '100%',
                maxHeight: '75vh',
                borderRadius: '8px',
                outline: 'none',
              }}
            />
          )}

          {isAudio && (
            <div style={{ textAlign: 'center', width: '100%', maxWidth: '420px', padding: '2rem 1rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎵</div>
              <p style={{ fontWeight: 600, marginBottom: '1rem', color: 'var(--text-color)' }}>{fileName}</p>
              <audio src={fileUrl} controls autoPlay style={{ width: '100%', outline: 'none' }} />
            </div>
          )}

          {isText && (
            <div
              style={{
                width: '100%',
                maxHeight: '75vh',
                overflow: 'auto',
                background: 'var(--subtle-bg)',
                borderRadius: '8px',
                padding: '1rem',
                border: '1px solid var(--border-color)',
                textAlign: 'left',
              }}
            >
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'monospace',
                  fontSize: '0.82rem',
                  lineHeight: 1.5,
                  color: 'var(--text-color)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {textContent || 'Loading content...'}
              </pre>
            </div>
          )}

          {!isPdf && !isImage && !isVideo && !isAudio && !isText && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--text-muted)' }}>Inline preview is not available for this file type.</p>
              <a
                href={fileUrl}
                download={fileName}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '8px',
                  marginTop: '1rem',
                }}
              >
                <FiDownload /> Download File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
