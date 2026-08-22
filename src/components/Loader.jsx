import { useState, useEffect } from 'react';

const Loader = ({ isLoading, progress = null, phrases = [] }) => {
  const defaultPhrases = [
    "Compiling the layout...",
    "Shaving off excess megabytes...",
    "Applying pure digital magic...",
    "Organizing data particles...",
    "Almost there, finalizing files..."
  ];

  // Use custom phrases if passed, otherwise fallback to defaults
  const loadingPhrases = phrases.length > 0 ? phrases : defaultPhrases;
  const [currentPhrase, setCurrentPhrase] = useState(loadingPhrases[0]);

  useEffect(() => {
    if (!isLoading) return;

    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % loadingPhrases.length;
      setCurrentPhrase(loadingPhrases[index]);
    }, 2500); // Changes wording every 2.5 seconds

    return () => clearInterval(interval);
  }, [isLoading, loadingPhrases]);

  if (!isLoading) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        {/* Animated Spinner */}
        <div style={styles.spinner}></div>
        
        {/* Dynamic Phrase */}
        <p style={styles.phrase}>{currentPhrase}</p>
        
        {/* Optional Progress Bar (For things like Video/Audio processing) */}
        {progress !== null && (
          <div style={styles.progressContainer}>
            <div style={{ ...styles.progressBar, width: `${progress}%` }}></div>
            <span style={styles.progressText}>{progress}%</span>
          </div>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Dims the background
    backdropFilter: 'blur(4px)', // Soft blur effect
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999, // Stays on top of everything
  },
  card: {
    backgroundColor: 'var(--card-bg)',
    padding: '2.5rem',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: '400px',
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
    fontSize: '1.1rem',
    fontWeight: '500',
    color: 'var(--text-color)',
    margin: '0 0 1rem 0',
  },
  progressContainer: {
    width: '100%',
    backgroundColor: 'var(--bg-color)',
    borderRadius: '8px',
    height: '16px',
    position: 'relative',
    overflow: 'hidden',
    marginTop: '0.5rem',
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'var(--accent-color)', // Using your neon green for completion tracking
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
    color: '#0f172a', // Always dark text for visibility inside progress bar
  }
};

// Add raw keyframes to index.css if you don't already have a spinner animation
export default Loader;