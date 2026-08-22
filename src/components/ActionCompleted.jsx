import { FiCheckCircle, FiDownload, FiRefreshCw } from 'react-icons/fi';

const ActionCompleted = ({ fileUrl, fileName = "processed_file.pdf", onReset, message = "Task completed successfully!" }) => {
  return (
    <div style={styles.container}>
      <FiCheckCircle style={styles.successIcon} />
      <h2 style={styles.title}>{message}</h2>
      
      <div style={styles.buttonGroup}>
        {/* The Download Button */}
        <a href={fileUrl} download={fileName} style={styles.downloadButton}>
          <FiDownload style={styles.btnIcon} />
          Download File
        </a>

        {/* The Start Over Button */}
        <button onClick={onReset} style={styles.resetButton}>
          <FiRefreshCw style={styles.btnIcon} />
          Process Another File
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 2rem',
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
    textAlign: 'center',
  },
  successIcon: {
    fontSize: '4.5rem',
    color: 'var(--accent-color)', // Using your neon green for success
    marginBottom: '1rem',
  },
  title: {
    fontSize: '1.5rem',
    margin: '0 0 2rem 0',
    color: 'var(--text-color)',
  },
  buttonGroup: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  downloadButton: {
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
    cursor: 'pointer',
    border: 'none',
  },
  resetButton: {
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
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  },
  btnIcon: {
    fontSize: '1.2rem',
  }
};

export default ActionCompleted;