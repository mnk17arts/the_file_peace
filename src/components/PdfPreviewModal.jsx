import { FiX, FiDownload, FiMaximize2 } from 'react-icons/fi';

const PdfPreviewModal = ({ isOpen, onClose, pdfUrl, title = 'PDF Document Preview' }) => {
  if (!isOpen || !pdfUrl) return null;

  return (
    <div style={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.titleInfo}>
            <FiMaximize2 style={{ fontSize: '1.2rem', color: 'var(--primary-color)' }} />
            <span style={styles.titleText}>{title}</span>
          </div>
          <div style={styles.headerActions}>
            <a
              href={pdfUrl}
              download={title.endsWith('.pdf') ? title : `${title}.pdf`}
              style={styles.downloadBtn}
              title="Download PDF"
            >
              <FiDownload /> Download
            </a>
            <button onClick={onClose} style={styles.closeBtn} title="Close Preview">
              <FiX /> Close
            </button>
          </div>
        </div>

        <div style={styles.body}>
          <iframe
            src={`${pdfUrl}#toolbar=1&navpanes=1`}
            style={styles.iframe}
            title={title}
          />
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '1.5rem',
  },
  modal: {
    backgroundColor: 'var(--card-bg)',
    width: '100%',
    maxWidth: '1100px',
    height: '90vh',
    borderRadius: '16px',
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.5rem',
    backgroundColor: 'var(--bg-color)',
    borderBottom: '1px solid var(--border-color)',
    flexShrink: 0,
  },
  titleInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  titleText: {
    fontWeight: 'bold',
    fontSize: '1.1rem',
    color: 'var(--text-color)',
    maxWidth: '500px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  downloadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.5rem 1rem',
    backgroundColor: 'var(--primary-color)',
    color: '#ffffff',
    borderRadius: '8px',
    textDecoration: 'none',
    fontWeight: 'bold',
    fontSize: '0.9rem',
  },
  closeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.5rem 1rem',
    backgroundColor: 'transparent',
    color: 'var(--text-color)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  body: {
    flex: 1,
    width: '100%',
    backgroundColor: '#333333',
    overflow: 'hidden',
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
  },
};

export default PdfPreviewModal;
