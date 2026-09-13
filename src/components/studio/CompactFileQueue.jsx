import { useRef } from 'react';
import { FiFile, FiTrash2, FiPlus, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import { formatFileSize } from '../../utils/fileUtils';

/**
 * Compact File Queue Component
 *
 * Provides immediate in-viewport feedback when files are uploaded,
 * replacing huge vertical file lists with a sleek, space-efficient queue.
 */
export default function CompactFileQueue({
  files = [],
  onRemove,
  onClear,
  onAddFiles,
  accept,
  multiple = true,
  onReorder,
  layout = 'horizontal', // 'horizontal' | 'list' | 'grid'
  title = 'Selected Files',
}) {
  const fileInputRef = useRef(null);

  if (!files || files.length === 0) return null;

  const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0 && onAddFiles) {
      onAddFiles(Array.from(e.target.files));
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="compact-file-queue-container">
      {/* Hidden File Input for Add More */}
      {onAddFiles && (
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
      )}

      {/* Queue Header: Immediate Feedback & Count */}
      <div className="compact-file-queue-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-color)' }}>
            {title}
          </span>
          <span className="compact-queue-counter-badge">
            {files.length} {files.length === 1 ? 'file' : 'files'} • {formatFileSize(totalBytes)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {onAddFiles && (
            <button
              type="button"
              className="btn-compact-add"
              onClick={() => fileInputRef.current?.click()}
              title="Add more files"
            >
              <FiPlus size={14} />
              <span>Add More</span>
            </button>
          )}

          {onClear && files.length > 1 && (
            <button
              type="button"
              className="btn-compact-clear"
              onClick={onClear}
              title="Clear all files"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Queue List / Chips */}
      <div className={`compact-file-queue-items ${layout}`}>
        {files.map((item, idx) => {
          const fileName = item.name || `File ${idx + 1}`;
          const fileSize = item.size ? formatFileSize(item.size) : '';

          return (
            <div key={`${fileName}-${idx}`} className="compact-queue-chip" title={fileName}>
              <div className="compact-chip-icon">
                <FiFile size={14} />
              </div>

              <div className="compact-chip-info">
                <span className="compact-chip-name">{fileName}</span>
                {fileSize && <span className="compact-chip-size">{fileSize}</span>}
              </div>

              {/* Reorder Arrows (if supported) */}
              {onReorder && files.length > 1 && (
                <div className="compact-chip-reorder">
                  {idx > 0 && (
                    <button
                      type="button"
                      className="compact-chip-btn-arrow"
                      onClick={() => onReorder(idx, idx - 1)}
                      title="Move up"
                    >
                      <FiArrowUp size={11} />
                    </button>
                  )}
                  {idx < files.length - 1 && (
                    <button
                      type="button"
                      className="compact-chip-btn-arrow"
                      onClick={() => onReorder(idx, idx + 1)}
                      title="Move down"
                    >
                      <FiArrowDown size={11} />
                    </button>
                  )}
                </div>
              )}

              {/* Remove Button */}
              {onRemove && (
                <button
                  type="button"
                  className="compact-chip-remove"
                  onClick={() => onRemove(idx)}
                  title="Remove this file"
                >
                  <FiTrash2 size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
