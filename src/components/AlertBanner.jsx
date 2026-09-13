import { FiAlertCircle, FiAlertTriangle, FiInfo, FiCheckCircle, FiX } from 'react-icons/fi';

const AlertBanner = ({ message, type = 'error', onClose, style }) => {
  if (!message) return null;

  const typeConfig = {
    error: {
      color: '#ff4757',
      bg: 'rgba(255, 71, 87, 0.12)',
      border: 'rgba(255, 71, 87, 0.35)',
      Icon: FiAlertCircle,
    },
    warning: {
      color: '#ffa502',
      bg: 'rgba(255, 165, 2, 0.12)',
      border: 'rgba(255, 165, 2, 0.35)',
      Icon: FiAlertTriangle,
    },
    info: {
      color: 'var(--primary-color)',
      bg: 'rgba(28, 153, 255, 0.12)',
      border: 'rgba(28, 153, 255, 0.35)',
      Icon: FiInfo,
    },
    success: {
      color: 'var(--accent-color)',
      bg: 'rgba(28, 255, 153, 0.12)',
      border: 'rgba(28, 255, 153, 0.35)',
      Icon: FiCheckCircle,
    }
  };

  const current = typeConfig[type] || typeConfig.error;
  const IconComponent = current.Icon;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        padding: '0.85rem 1.25rem',
        backgroundColor: current.bg,
        border: `1px solid ${current.border}`,
        borderRadius: '8px',
        color: 'var(--text-color)',
        marginBottom: '1.5rem',
        fontSize: '0.95rem',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <IconComponent style={{ color: current.color, fontSize: '1.25rem', flexShrink: 0 }} />
        <span>{message}</span>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Dismiss alert"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-color)',
            cursor: 'pointer',
            padding: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            opacity: 0.7,
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
        >
          <FiX size={16} />
        </button>
      )}
    </div>
  );
};

export default AlertBanner;
