import { useState, useMemo } from 'react';
import {
  FiCheckCircle,
  FiDownload,
  FiEye,
  FiRepeat,
  FiZap,
  FiRefreshCw,
} from 'react-icons/fi';
import UniversalPreviewModal from './studio/UniversalPreviewModal';
import FileActionMenu from './FileActionMenu';

/**
 * ActionCompleted — Standardized Completion View across all tools
 * 
 * Includes the 6 Standard Workflow Actions:
 * a) Download <File type>
 * b) Preview <File type>
 * c) Use this file for... (context-aware next steps)
 * d) Process Source Again (re-tweak original with different settings)
 * e) Process Target (iterative chaining using output as fresh input)
 * f) Process a New File (reset tool)
 */
export default function ActionCompleted({
  fileUrl,
  fileName = 'processed_file.pdf',
  file = null,
  onReset,
  message = 'Task completed successfully!',
  toolTitle = '',
  stats = null, // e.g. [{ label: 'Original Size', value: '1.2 MB' }, { label: 'Compressed Size', value: '450 KB' }]
  onProcessSourceAgain = null,
  sourceActionLabel = 'Process Source Again',
  onProcessTarget = null,
  targetActionLabel = 'Process Target File',
  downloadLabel = null,
  extraActions = null,
  currentPath = '',
}) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Derive file type name (e.g. PDF, Image, Video, Audio, ZIP)
  const fileExt = useMemo(() => {
    return (fileName.split('.').pop() || '').toLowerCase();
  }, [fileName]);

  const typeLabel = useMemo(() => {
    if (fileExt === 'pdf') return 'PDF';
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(fileExt)) return 'Image';
    if (['mp4', 'webm', 'mov', 'mkv'].includes(ext => fileExt.includes(ext))) return 'Video';
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(fileExt)) return 'Audio';
    if (fileExt === 'docx') return 'Word (.docx)';
    if (fileExt === 'zip') return 'ZIP Archive';
    if (fileExt === 'txt') return 'Text (.txt)';
    return fileExt.toUpperCase() || 'File';
  }, [fileExt]);

  const canPreview = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'mp4', 'webm', 'mp3', 'wav', 'ogg'].includes(fileExt);

  const resolvedDownloadLabel = downloadLabel || `Download ${typeLabel}`;

  return (
    <div
      className="action-completed-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 1.5rem',
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        boxShadow: 'var(--card-shadow)',
        textAlign: 'center',
        maxWidth: '820px',
        margin: '1rem auto 2rem',
      }}
    >
      {/* 1. Subtle Tool Breadcrumb (if provided) */}
      {toolTitle && (
        <div
          style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-dim)',
            marginBottom: '0.75rem',
          }}
        >
          {toolTitle}
        </div>
      )}

      {/* 2. Success Status Icon & Title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'rgba(5, 150, 105, 0.12)',
          color: '#10b981',
          marginBottom: '1rem',
        }}
      >
        <FiCheckCircle size={36} />
      </div>

      <h2
        style={{
          fontSize: '1.6rem',
          fontWeight: 800,
          margin: '0 0 0.5rem 0',
          color: 'var(--text-color)',
          letterSpacing: '-0.01em',
        }}
      >
        {message}
      </h2>

      <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '0 0 1.5rem 0' }}>
        <strong>{fileName}</strong> is ready and securely processed in memory.
      </p>

      {/* 3. Metrics & Stats Grid (if provided) */}
      {stats && Array.isArray(stats) && stats.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${stats.length}, minmax(110px, 1fr))`,
            gap: '1rem',
            width: '100%',
            maxWidth: '580px',
            marginBottom: '1.75rem',
            padding: '1rem',
            borderRadius: '12px',
            background: 'var(--subtle-bg)',
            border: '1px solid var(--border-color)',
          }}
        >
          {stats.map((stat, idx) => (
            <div key={idx} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '0.25rem' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: stat.color || 'var(--text-color)' }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Action Buttons Grid */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.85rem',
          width: '100%',
          maxWidth: '640px',
        }}
      >
        {/* Row 1: Primary Output Actions (Download & Preview) */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
          {/* Download Button */}
          <a
            href={fileUrl}
            download={fileName}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.6rem',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '0.96rem',
              textDecoration: 'none',
              backgroundColor: 'var(--primary-color)',
              color: '#fff',
              boxShadow: '0 4px 14px var(--primary-glow)',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            <FiDownload size={16} />
            <span>{resolvedDownloadLabel}</span>
          </a>

          {/* Preview Button */}
          {canPreview && (
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.75rem 1.35rem',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.92rem',
                backgroundColor: 'transparent',
                color: 'var(--text-color)',
                border: '2px solid var(--primary-color)',
                cursor: 'pointer',
              }}
            >
              <FiEye size={16} />
              <span>Preview {typeLabel}</span>
            </button>
          )}
        </div>

        {/* Row 2: In-Memory Loop Actions (Process Source Again & Process Target) */}
        {(onProcessSourceAgain || onProcessTarget || extraActions) && (
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%', marginTop: '0.25rem' }}>
            {onProcessSourceAgain && (
              <button
                type="button"
                onClick={onProcessSourceAgain}
                className="btn-secondary"
                title="Return to studio with current input file to adjust settings"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 1.1rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  backgroundColor: 'var(--subtle-bg)',
                  color: 'var(--text-color)',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                }}
              >
                <FiRepeat size={14} />
                <span>{sourceActionLabel}</span>
              </button>
            )}

            {onProcessTarget && (
              <button
                type="button"
                onClick={onProcessTarget}
                className="btn-secondary"
                title="Feed this generated output directly back as the new input"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 1.1rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  backgroundColor: 'var(--subtle-bg)',
                  color: 'var(--text-color)',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                }}
              >
                <FiZap size={14} color="var(--primary-color)" />
                <span>{targetActionLabel}</span>
              </button>
            )}

            {extraActions}
          </div>
        )}

        {/* Row 3: Ecosystem & Reset Actions (Use this file for... & Process New File) */}
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%', marginTop: '0.5rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)' }}>
          {/* Inter-tool routing */}
          <FileActionMenu
            file={file}
            fileUrl={fileUrl}
            fileName={fileName}
            currentPath={currentPath}
          />

          {/* Process New File / Reset */}
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.6rem 1.1rem',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.85rem',
                backgroundColor: 'transparent',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
              }}
            >
              <FiRefreshCw size={13} />
              <span>Process New File</span>
            </button>
          )}
        </div>
      </div>

      {/* 5. Universal In-Browser Preview Modal */}
      <UniversalPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        fileUrl={fileUrl}
        fileName={fileName}
      />
    </div>
  );
}