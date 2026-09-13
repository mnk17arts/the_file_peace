import { FiZap } from 'react-icons/fi';

/**
 * Standard Two-Column Studio Layout Shell
 *
 * Provides a standardized horizontal workspace for all File Peace studio tools:
 * - Left Pane (58% desktop): Dedicated to document canvas, visual previews, dropzone & compact queue.
 * - Right Pane (42% desktop): Sticky control panel for parameters, options, live status, and action buttons.
 * - Responsive: Clean single-column collapse on tablet/mobile (< 1024px) with sticky action visibility.
 */
export default function StudioLayout({
  title,
  badge,
  badgeIcon: BadgeIcon = FiZap,
  description,
  headerActions,
  alerts,
  hasFiles = true,
  initialDropzone,
  leftPane,
  rightPane,
  isCompleted = false,
  completedView,
  footerNote = '100% Client-Side • In-Memory Processing • Zero Server Uploads',
  maxWidth = '1380px',
}) {
  // If task has completed, render the completed view (e.g. ActionCompleted)
  if (isCompleted && completedView) {
    return (
      <div className="studio-layout-wrapper" style={{ maxWidth, margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>
        {completedView}
      </div>
    );
  }

  return (
    <div className="studio-layout-wrapper" style={{ maxWidth, margin: '0 auto', padding: '1.25rem 1rem 4rem' }}>
      {/* 1. Studio Header */}
      {!hasFiles ? (
        // Empty State: Hero Banner
        <div className="studio-header hero-mode" style={{ textAlign: 'center', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
          {badge && (
            <div className="hero-pill-badge" style={{ marginBottom: '0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <BadgeIcon style={{ color: 'var(--accent-color)' }} />
              <span>{badge}</span>
            </div>
          )}
          <h1 style={{ fontSize: '2.1rem', fontWeight: 800, margin: '0 0 0.4rem 0', letterSpacing: '-0.02em', color: 'var(--text-color)' }}>
            {title}
          </h1>
          {description && (
            <p style={{ fontSize: '0.95rem', color: 'var(--text-color)', opacity: 0.75, maxWidth: '750px', margin: '0 auto', lineHeight: 1.5 }}>
              {description}
            </p>
          )}
        </div>
      ) : (
        // Active Studio Mode: Ultra-Compact Bar (~38px height)
        <div className="studio-header compact-mode" style={{ marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-color)' }}>
                {title}
              </h1>
              {badge && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '999px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: 'rgba(28, 153, 255, 0.12)',
                    color: 'var(--primary-color)',
                    border: '1px solid rgba(28, 153, 255, 0.25)',
                  }}
                >
                  <BadgeIcon size={12} style={{ color: 'var(--accent-color)' }} />
                  <span>{badge}</span>
                </span>
              )}
            </div>

            {/* Top Actions (e.g. Change File, Reset, Clear) */}
            {headerActions && (
              <div className="studio-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {headerActions}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Global Feedback Alerts */}
      {alerts && <div style={{ marginBottom: '1.25rem' }}>{alerts}</div>}

      {/* 3. Main Studio Workspace */}
      {!hasFiles && initialDropzone ? (
        // Initial Empty State: Clean centered dropzone
        <div className="studio-initial-dropzone" style={{ maxWidth: '820px', margin: '2rem auto' }}>
          {initialDropzone}
        </div>
      ) : (
        // Active Workspace: 2-Column Horizontal Studio Grid
        <div className="studio-grid">
          {/* Left Pane: Canvas, Live Preview, Interactive Document Viewer, or Queue */}
          <div className="studio-left-pane">
            <div className="studio-canvas-card">
              {leftPane}
            </div>
          </div>

          {/* Right Pane: Sticky Control Panel with Options & Actions */}
          <div className="studio-right-pane">
            {rightPane}
          </div>
        </div>
      )}

      {/* 4. Privacy Footer Note */}
      {footerNote && (
        <div style={{ textAlign: 'center', marginTop: '2.5rem', fontSize: '0.8rem', color: 'var(--text-color)', opacity: 0.5 }}>
          <span>🔒 {footerNote}</span>
        </div>
      )}
    </div>
  );
}
