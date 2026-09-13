import { useState, useEffect } from 'react';

const Loader = ({
  isLoading = true,
  message = null,
  progress = null,
  phrases = [],
  onCancel = null
}) => {
  const defaultPhrases = message
    ? [message]
    : [
        "Compiling the layout...",
        "Shaving off excess megabytes...",
        "Applying pure digital magic...",
        "Organizing data particles...",
        "Almost there, finalizing files..."
      ];

  // Use custom phrases if passed, otherwise fallback to defaults
  const loadingPhrases = phrases.length > 0 ? phrases : defaultPhrases;
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (message || !isLoading) return;

    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % loadingPhrases.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [isLoading, loadingPhrases, message]);

  if (!isLoading) return null;

  const currentPhrase = message || loadingPhrases[phraseIndex] || loadingPhrases[0];

  return (
    <div 
      style={styles.overlay} 
      role="dialog" 
      aria-modal="true" 
      aria-live="polite"
      aria-label="Processing operation"
    >
      <div style={styles.card}>
        {/* Animated Spinner */}
        <div style={styles.spinner} aria-hidden="true" />
        
        {/* Dynamic Phrase */}
        <p style={styles.phrase}>{currentPhrase}</p>
        
        {/* Optional Progress Bar (For things like Video/Audio processing) */}
        {progress !== null && (
          <div 
            style={styles.progressContainer}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div style={{ ...styles.progressBar, width: `${progress}%` }} />
            <span style={styles.progressText}>{progress}%</span>
          </div>
        )}

        {/* Optional Cancellation action */}
        {onCancel && (
          <button
            onClick={onCancel}
            style={styles.cancelBtn}
            type="button"
          >
            Cancel Operation
          </button>
        )}
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  card: {
    backgroundColor: 'var(--card-bg)',
    padding: '2.5rem',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: '420px',
    width: '90%',
    textAlign: 'center',
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '5px solid var(--border-color)',
    borderTop: '5px solid var(--primary-color)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '1.5rem',
  },
  phrase: {
    fontSize: '1.05rem',
    fontWeight: '500',
    color: 'var(--text-color)',
    margin: '0 0 1rem 0',
  },
  progressContainer: {
    width: '100%',
    backgroundColor: 'var(--bg-color)',
    borderRadius: '8px',
    height: '18px',
    position: 'relative',
    overflow: 'hidden',
    marginTop: '0.5rem',
    border: '1px solid var(--border-color)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'var(--accent-color)',
    transition: 'width 0.3s ease',
  },
  progressText: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    color: '#0f172a',
  },
  cancelBtn: {
    marginTop: '1.5rem',
    padding: '0.5rem 1.25rem',
    backgroundColor: 'transparent',
    color: 'var(--text-color)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.88rem',
    fontWeight: '500',
    transition: 'all 0.2s',
  }
};

export default Loader;