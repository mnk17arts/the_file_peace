import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUploadCloud } from 'react-icons/fi';

const FileUpload = ({
  onFilesSelected,
  onChange,
  onFileSelect,
  accept,
  multiple = false,
  title = "Drag & drop files here",
  description = '',
  disabled = false,
  compact = false,
  style: customStyle = {},
}) => {
  const handler = onFilesSelected || onChange || onFileSelect;

  const onDrop = useCallback((acceptedFiles, fileRejections) => {
    const files = [...(acceptedFiles || [])];

    // If some files were rejected purely due to browser MIME classification (e.g. custom .vault, .enc files),
    // recover them if their extension matches the requested accept prop or if accept allows all files
    if (fileRejections && fileRejections.length > 0) {
      if (!accept || accept === '*' || accept === '*/*') {
        fileRejections.forEach((r) => files.push(r.file));
      } else if (typeof accept === 'string') {
        const allowedExts = accept
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter((s) => s.startsWith('.'));

        fileRejections.forEach((r) => {
          const ext = '.' + (r.file.name.split('.').pop() || '').toLowerCase();
          if (allowedExts.includes(ext) || allowedExts.length === 0) {
            files.push(r.file);
          }
        });
      }
    }

    if (handler && files.length > 0) {
      handler(files);
    }
  }, [handler, accept]);

  // Normalize string accept (e.g. "application/pdf,.pdf") to dropzone format
  const normalizedAccept = typeof accept === 'string'
    ? accept.split(',').reduce((acc, curr) => {
        const trimmed = curr.trim();
        if (trimmed.includes('/')) {
          if (!acc[trimmed]) acc[trimmed] = [];
        } else if (trimmed.startsWith('.')) {
          if (!acc['application/octet-stream']) acc['application/octet-stream'] = [];
          if (!acc['application/octet-stream'].includes(trimmed)) {
            acc['application/octet-stream'].push(trimmed);
          }
        }
        return acc;
      }, {})
    : accept;

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: normalizedAccept,
    multiple,
    disabled,
  });

  // Dynamic styling based on drag state
  const dropzoneStyle = {
    ...styles.dropzone,
    ...(compact ? styles.dropzoneCompact : {}),
    borderColor: isDragActive ? 'var(--primary-color)' : 'var(--border-color)',
    backgroundColor: isDragActive ? 'var(--bg-color)' : 'var(--card-bg)',
    opacity: isDragReject ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    ...customStyle,
  };

  return (
    <div {...getRootProps()} style={dropzoneStyle}>
      <input {...getInputProps()} />
      <FiUploadCloud
        style={{
          ...styles.icon,
          ...(compact ? styles.iconCompact : {}),
        }}
      />
      <h3
        style={{
          ...styles.title,
          ...(compact ? styles.titleCompact : {}),
        }}
      >
        {title}
      </h3>
      
      {isDragActive ? (
        <p style={{ ...styles.text, ...(compact ? styles.textCompact : {}) }}>Drop the files now...</p>
      ) : (
        <p style={{ ...styles.text, ...(compact ? styles.textCompact : {}) }}>
          {description || (disabled ? 'Processing files…' : 'or click to browse files from your device')}
        </p>
      )}
      
      {isDragReject && (
        <p style={{ color: 'red', marginTop: '10px' }}>File type not supported for this tool.</p>
      )}
    </div>
  );
};

const styles = {
  dropzone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 2rem',
    border: '2px dashed',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    minHeight: '250px',
  },
  dropzoneCompact: {
    padding: '1.25rem 1rem',
    minHeight: '140px',
  },
  icon: {
    fontSize: '4rem',
    color: 'var(--primary-color)',
    marginBottom: '1rem',
  },
  iconCompact: {
    fontSize: '2.2rem',
    marginBottom: '0.4rem',
  },
  title: {
    margin: '0 0 0.5rem 0',
    fontSize: '1.25rem',
  },
  titleCompact: {
    fontSize: '0.95rem',
    margin: '0 0 0.25rem 0',
    fontWeight: 700,
  },
  text: {
    margin: 0,
    color: 'var(--text-color)',
    opacity: 0.7,
  },
  textCompact: {
    fontSize: '0.78rem',
  },
};

export default FileUpload;
