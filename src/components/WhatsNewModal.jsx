import { useNavigate } from 'react-router-dom';
import { FiX, FiZap, FiCode, FiShield, FiMoon, FiArrowRight, FiCheck } from 'react-icons/fi';

export default function WhatsNewModal({ isOpen, onClose }) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleGoToChangelog = () => {
    localStorage.setItem('filepeace_seen_version', '2.0.0');
    onClose();
    navigate('/changelog');
  };

  const handleDismiss = () => {
    localStorage.setItem('filepeace_seen_version', '2.0.0');
    onClose();
  };

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
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--card-bg)',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '92vh',
          borderRadius: '18px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 24px 50px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--subtle-bg)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.2rem 0.65rem',
                borderRadius: '999px',
                background: 'rgba(46, 213, 115, 0.12)',
                color: '#2ed573',
                fontSize: '0.74rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '0.4rem',
              }}
            >
              <span>🎉 What&apos;s New in v2.0</span>
            </div>
            <h2
              style={{
                fontSize: '1.35rem',
                fontWeight: 900,
                margin: '0 0 0.25rem 0',
                color: 'var(--text-color)',
                letterSpacing: '-0.02em',
              }}
            >
              The Privacy &amp; Studio Overhaul
            </h2>
            <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
              Over 24 new offline studios, visual pipelines, embed widgets, and theme refreshes.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Highlights Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '0.85rem',
            }}
          >
            {/* 1. Pipelines */}
            <div
              style={{
                background: 'var(--subtle-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '0.9rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <FiZap size={16} color="var(--primary-color)" />
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-color)' }}>
                  Workflow Pipelines
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Chain actions together in a visual pipeline to batch-process files and download all results as a ZIP.
              </p>
            </div>

            {/* 2. Embed SDK */}
            <div
              style={{
                background: 'var(--subtle-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '0.9rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <FiCode size={16} color="#2ed573" />
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-color)' }}>
                  Embeddable Widgets &amp; SDK
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Embed any offline utility on your website or blog with automatic iframe resizing and host theme sync.
              </p>
            </div>

            {/* 3. Obsidian Themes */}
            <div
              style={{
                background: 'var(--subtle-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '0.9rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <FiMoon size={16} color="#a855f7" />
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-color)' }}>
                  Obsidian &amp; Arctic Themes
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Complete visual aesthetic refresh with glassmorphism cards, glowing accents, and slim scrollbars.
              </p>
            </div>

            {/* 4. Privacy Studio */}
            <div
              style={{
                background: 'var(--subtle-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '0.9rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <FiShield size={16} color="#f59e0b" />
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-color)' }}>
                  Image Privacy &amp; Encryption
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                AES-256 password-encrypted ZIP archives and in-browser steganographic hiding in pixel data (LSB).
              </p>
            </div>
          </div>
        </div>

        {/* Footer CTAs */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--subtle-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <button
            type="button"
            onClick={handleDismiss}
            className="btn-secondary"
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-color)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <FiCheck size={14} />
            <span>Got it, thanks!</span>
          </button>

          <button
            type="button"
            onClick={handleGoToChangelog}
            className="btn-primary"
            style={{
              padding: '0.45rem 1.15rem',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>View Full Changelog</span>
            <FiArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
