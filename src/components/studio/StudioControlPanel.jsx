import { FiSliders, FiArrowRight, FiLoader } from 'react-icons/fi';

/**
 * Standard Studio Control Panel
 *
 * Sticky right-hand sidebar for parameter adjustments, live feedback, and actions.
 */
export default function StudioControlPanel({
  title = 'Configuration',
  icon: TitleIcon = FiSliders,
  badge,
  children,
  actionButton,
  actionLabel = 'Process File',
  actionIcon: ActionIcon = FiArrowRight,
  onAction,
  actionDisabled = false,
  actionLoading = false,
  secondaryAction,
  statusMessage,
  progress,
  progressMessage,
}) {
  return (
    <div className="studio-control-card">
      {/* Control Panel Header */}
      <div className="studio-control-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="studio-control-icon-badge">
            <TitleIcon size={16} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-color)' }}>
            {title}
          </h3>
        </div>

        {badge && (
          <span className="studio-control-badge">
            {badge}
          </span>
        )}
      </div>

      {/* Control Panel Body (Options, Sliders, Toggles, Presets) */}
      <div className="studio-control-body">
        {children}
      </div>

      {/* Progress Bar (if active) */}
      {typeof progress === 'number' && (
        <div style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-color)' }}>
            <span>{progressMessage || 'Processing...'}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="studio-progress-track">
            <div className="studio-progress-fill" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
        </div>
      )}

      {/* Live Status / Estimation Note */}
      {statusMessage && (
        <div className="studio-status-banner">
          {statusMessage}
        </div>
      )}

      {/* Action Footer */}
      <div className="studio-control-footer">
        {actionButton ? (
          actionButton
        ) : (
          <button
            type="button"
            className="btn-primary studio-action-btn"
            disabled={actionDisabled || actionLoading}
            onClick={onAction}
          >
            {actionLoading ? (
              <>
                <FiLoader className="spin-animation" style={{ marginRight: '0.5rem' }} />
                <span>{progressMessage || 'Processing...'}</span>
              </>
            ) : (
              <>
                <ActionIcon style={{ marginRight: '0.5rem' }} />
                <span>{actionLabel}</span>
              </>
            )}
          </button>
        )}

        {secondaryAction && (
          <div style={{ marginTop: '0.6rem' }}>
            {secondaryAction}
          </div>
        )}
      </div>
    </div>
  );
}
