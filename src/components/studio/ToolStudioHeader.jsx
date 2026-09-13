import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiRefreshCw, FiBookOpen, FiFile, FiLayers, FiCode } from 'react-icons/fi';
import { formatFileSize } from '../../utils/fileUtils';
import { BLOG_POSTS } from '../../data/blogPosts';
import EmbedModal from './EmbedModal';

/**
 * ToolStudioHeader — Ultra-compact 48px micro-header for Configuration Views
 * 
 * Replaces bulky ~180px hero headers to prevent vertical scrolling and lock the studio to 100vh.
 */
export default function ToolStudioHeader({
  title,
  toolTitle,
  icon: Icon,
  file = null,
  files = null,
  fileBadge: customBadge = null,
  category = '',
  viewModes = null,
  centerControls = null,
  headerExtra = null,
  actionButton = null,
  primaryAction = null,
  actionLabel = '',
  actionIcon: ActionIcon = null,
  onAction = null,
  actionDisabled = false,
  actionLoading = false,
  onReset = null,
  onBack = null,
  resetLabel = 'Change File',
  backLabel = '',
  toolPath = '',
  blogSlug = '',
  children = null,
}) {
  const location = useLocation();
  const [isEmbedOpen, setIsEmbedOpen] = useState(false);
  const displayTitle = title || toolTitle;
  const handleReset = onReset || onBack;
  const displayResetLabel = backLabel || resetLabel;

  const currentPath = useMemo(() => {
    if (toolPath) return toolPath;
    if (location?.pathname && location.pathname !== '/') return location.pathname;
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace(/^#/, '').split('?')[0];
      if (hash && hash !== '/') return hash;
    }
    return '';
  }, [toolPath, location]);

  const matchedBlog = useMemo(() => {
    if (blogSlug) return BLOG_POSTS.find((p) => p.slug === blogSlug);
    if (currentPath) return BLOG_POSTS.find((p) => p.toolPath === currentPath);
    return null;
  }, [blogSlug, currentPath]);

  // Formatted file metadata badge
  const fileBadge = useMemo(() => {
    if (customBadge) {
      if (typeof customBadge === 'string') {
        return { isMulti: false, label: customBadge };
      }
      return customBadge;
    }
    if (files && Array.isArray(files) && files.length > 0) {
      const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);
      return {
        isMulti: true,
        label: `${files.length} files (${formatFileSize(totalSize)})`,
      };
    }
    if (file) {
      const name = typeof file === 'string' ? file : file.name;
      const size = typeof file === 'object' && file?.size ? formatFileSize(file.size) : '';
      return {
        isMulti: false,
        label: size ? `${name} • ${size}` : name,
      };
    }
    return null;
  }, [file, files, customBadge]);

  const isEmbedded = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.self !== window.top || window.location.hash.includes('/embed/');
  }, []);

  return (
    <header
      className="tool-studio-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 1rem',
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        marginBottom: '0.75rem',
        minHeight: '48px',
        boxShadow: 'var(--card-shadow)',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}
    >
      {/* Left: Tool Icon + Name + Active File Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: '1 1 auto' }}>
        {Icon && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(28, 153, 255, 0.12)',
              color: 'var(--primary-color)',
              flexShrink: 0,
            }}
          >
            {typeof Icon === 'function' ? <Icon size={16} /> : Icon}
          </div>
        )}

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <h2
              style={{
                fontSize: '0.98rem',
                fontWeight: 800,
                color: 'var(--text-color)',
                margin: 0,
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}
            >
              {displayTitle}
            </h2>
            {category && (
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '4px',
                  background: 'var(--subtle-bg)',
                  color: 'var(--text-dim)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {category}
              </span>
            )}
          </div>

          {/* Active File / Batch Meta pill */}
          {fileBadge && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                marginTop: '0.15rem',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
                maxWidth: '320px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {fileBadge.isMulti ? <FiLayers size={11} color="var(--primary-color)" /> : <FiFile size={11} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fileBadge.label}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Center: View Modes / Segmented Pills / Tabs */}
      {(centerControls || viewModes) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {centerControls || viewModes}
        </div>
      )}

      {/* Right: Actions, Extra Controls, Help & Change File */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        {/* Header Extra Controls (e.g. FileActionMenu, Mode toggles) */}
        {headerExtra}
        {children}

        {/* Help Link to Blog */}
        {matchedBlog && (
          <Link
            to={`/blog/${matchedBlog.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`Read guide: ${matchedBlog.title}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.25rem 0.65rem',
              borderRadius: '999px',
              fontSize: '0.74rem',
              fontWeight: 600,
              background: 'rgba(5, 150, 105, 0.1)',
              color: '#10b981',
              border: '1px solid rgba(5, 150, 105, 0.25)',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <FiBookOpen size={12} />
            <span>How it works</span>
          </Link>
        )}

        {/* Embed Tool Button (Hidden when running inside iframe or embed route) */}
        {!isEmbedded && (
          <button
            type="button"
            onClick={() => setIsEmbedOpen(true)}
            className="tool-embed-btn"
            title="Embed this tool on your website or blog"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.35rem 0.6rem',
              borderRadius: '6px',
              fontSize: '0.76rem',
              fontWeight: 600,
              background: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <FiCode size={12} color="var(--primary-color)" />
            <span>Embed</span>
          </button>
        )}

        {/* Change / Reset File Button */}
        {handleReset && (
          <button
            type="button"
            onClick={handleReset}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.65rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'var(--subtle-bg)',
              color: 'var(--text-color)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <FiRefreshCw size={11} />
            <span>{displayResetLabel}</span>
          </button>
        )}

        {/* Primary Action Button */}
        {actionButton ? (
          actionButton
        ) : primaryAction ? (
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled || primaryAction.loading}
            className="btn-primary studio-header-action-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: primaryAction.disabled || primaryAction.loading ? 'not-allowed' : 'pointer',
              opacity: primaryAction.disabled ? 0.6 : 1,
            }}
          >
            {primaryAction.icon && (typeof primaryAction.icon === 'function' ? <primaryAction.icon size={14} /> : primaryAction.icon)}
            <span>{primaryAction.label}</span>
          </button>
        ) : actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            disabled={actionDisabled || actionLoading}
            className="btn-primary studio-header-action-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.85rem',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 700,
              background: 'var(--primary-color)',
              color: '#fff',
              border: 'none',
              cursor: actionDisabled || actionLoading ? 'not-allowed' : 'pointer',
              opacity: actionDisabled ? 0.6 : 1,
            }}
          >
            {ActionIcon && (typeof ActionIcon === 'function' ? <ActionIcon size={13} /> : ActionIcon)}
            <span>{actionLabel}</span>
          </button>
        ) : null}
      </div>

      {/* Embed Code Generator Modal */}
      {isEmbedOpen && (
        <EmbedModal
          isOpen={isEmbedOpen}
          onClose={() => setIsEmbedOpen(false)}
          toolTitle={displayTitle}
          toolPath={toolPath}
        />
      )}
    </header>
  );
}
