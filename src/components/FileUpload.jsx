import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUploadCloud } from 'react-icons/fi';

const FileUpload = ({ onFilesSelected, accept, multiple = false, title = "Drag & drop files here" }) => {
  const onDrop = useCallback((acceptedFiles) => {
    if (onFilesSelected) {
      onFilesSelected(acceptedFiles);
    }
  }, [onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept,
    multiple,
  });

  // Dynamic styling based on drag state
  const dropzoneStyle = {
    ...styles.dropzone,
    borderColor: isDragActive ? 'var(--primary-color)' : 'var(--border-color)',
    backgroundColor: isDragActive ? 'var(--bg-color)' : 'var(--card-bg)',
    opacity: isDragReject ? 0.5 : 1,
  };

  return (
    <div {...getRootProps()} style={dropzoneStyle}>
      <input {...getInputProps()} />
      <FiUploadCloud style={styles.icon} />
      <h3 style={styles.title}>{title}</h3>
      
      {isDragActive ? (
        <p style={styles.text}>Drop the files now...</p>
      ) : (
        <p style={styles.text}>or click to browse files from your device</p>
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
  icon: {
    fontSize: '4rem',
    color: 'var(--primary-color)',
    marginBottom: '1rem',
  },
  title: {
    margin: '0 0 0.5rem 0',
    fontSize: '1.25rem',
  },
  text: {
    margin: 0,
    color: 'var(--text-color)',
    opacity: 0.7,
  }
};

export default FileUpload;