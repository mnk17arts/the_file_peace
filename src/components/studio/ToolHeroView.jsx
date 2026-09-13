import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiBookOpen, FiShield, FiFile, FiLayers, FiCode } from 'react-icons/fi';
import FileUpload from '../FileUpload';
import { BLOG_POSTS } from '../../data/blogPosts';
import EmbedModal from './EmbedModal';

/**
 * ToolHeroView — Standardized TYPE-A & TYPE-B Initial Upload / Hero Screen
 * 
 * Provides:
 * - Tool category/status badge + Title + Short description
 * - Educational Help/Guide link to corresponding blog post
 * - Explicit input format chips (e.g. [.PDF], [.JPG])
 * - Single vs Multi-file batch capability indicator
 * - 100% in-memory client-side security contract
 */
export default function ToolHeroView({
  title,
  description,
  badge = 'Offline Studio',
  badgeIcon: BadgeIcon = FiShield,
  toolPath = '',
  blogSlug = '',
  acceptedFormats = [],
  formatBadges = [],
  allowMultiple = false,
  multiple = false,
  singleFileOnly = false,
  maxSizeText = '100 MB',
  dropzoneTitle = '',
  dropzoneDescription = '',
  uploadTitle = '',
  uploadDescription = '',
  accept = {},
  onFilesSelected,
  alerts = null,
  dropzone = null,
  compact = false,
  children = null,
  maxWidth = '860px',
  style: customStyle = {},
}) {
  const location = useLocation();
  const [isEmbedOpen, setIsEmbedOpen] = useState(false);
  const effectiveMultiple = Boolean((allowMultiple || multiple) && !singleFileOnly);

  const isEmbedded = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.self !== window.top || window.location.hash.includes('/embed/');
  }, []);

  // Derive format badges: check acceptedFormats, then formatBadges, then auto-derive from accept
  const resolvedFormats = useMemo(() => {
    if (acceptedFormats && acceptedFormats.length > 0) return acceptedFormats;
    if (formatBadges && formatBadges.length > 0) return formatBadges;
    if (accept && typeof accept === 'object') {
      const exts = [];
      Object.values(accept).forEach((val) => {
        if (Array.isArray(val)) {
          val.forEach((e) => {
            if (typeof e === 'string' && !exts.includes(e)) exts.push(e);
          });
        }
      });
      if (exts.length > 0) return exts;
    }
    return [];
  }, [acceptedFormats, formatBadges, accept]);

  const currentPath = useMemo(() => {
    if (toolPath) return toolPath;
    if (location?.pathname && location.pathname !== '/') return location.pathname;
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace(/^#/, '').split('?')[0];
      if (hash && hash !== '/') return hash;
    }
    return '';
  }, [toolPath, location]);

  // Auto-discover blog post if blogSlug is not explicitly passed
  const matchedBlog = useMemo(() => {
    if (blogSlug) {
      return BLOG_POSTS.find((p) => p.slug === blogSlug);
    }
    if (currentPath) {
      return BLOG_POSTS.find((p) => p.toolPath === currentPath);
    }
    return null;
  }, [blogSlug, currentPath]);

  return (
    <div
      className="tool-hero-container"
      style={{
        maxWidth,
        margin: '0 auto',
        padding: compact ? '0.4rem 1rem 1rem' : '0.75rem 1rem 1.5rem',
        ...customStyle,
      }}
    >
      {/* 1. Header Section */}
      <div style={{ textAlign: 'center', marginBottom: compact ? '0.5rem' : '1rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: compact ? '0.25rem' : '0.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {/* Main Category / Feature Badge */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.2rem 0.65rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              background: 'rgba(28, 153, 255, 0.1)',
              color: 'var(--primary-color)',
              border: '1px solid rgba(28, 153, 255, 0.25)',
              textTransform: 'uppercase',
            }}
          >
            {BadgeIcon && (typeof BadgeIcon === 'function' ? <BadgeIcon size={13} /> : BadgeIcon)}
            <span>{badge}</span>
          </span>

          {/* Educational Blog / Help Link */}
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
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                fontSize: '0.74rem',
                fontWeight: 600,
                background: 'rgba(5, 150, 105, 0.1)',
                color: '#10b981',
                border: '1px solid rgba(5, 150, 105, 0.25)',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
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
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                fontSize: '0.74rem',
                fontWeight: 600,
                background: 'rgba(28, 153, 255, 0.1)',
                color: 'var(--primary-color)',
                border: '1px solid rgba(28, 153, 255, 0.25)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <FiCode size={12} />
              <span>Embed</span>
            </button>
          )}
        </div>

        <h1
          style={{
            fontSize: compact ? '1.5rem' : '1.85rem',
            fontWeight: 800,
            color: 'var(--text-color)',
            margin: compact ? '0 0 0.25rem 0' : '0 0 0.4rem 0',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>

        <p
          style={{
            fontSize: compact ? '0.84rem' : '0.92rem',
            color: 'var(--text-muted)',
            maxWidth: '660px',
            margin: '0 auto',
            lineHeight: 1.45,
          }}
        >
          {description}
        </p>
      </div>

      {/* 2. Alerts (if any) */}
      {alerts && <div style={{ marginBottom: compact ? '0.5rem' : '0.85rem' }}>{alerts}</div>}

      {/* 3. Dropzone Card with Explicit Capabilities */}
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '1rem',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {(children || dropzone) ? (
          (children || dropzone)
        ) : (
          <FileUpload
            onFilesSelected={onFilesSelected}
            accept={accept}
            multiple={effectiveMultiple}
            title={uploadTitle || dropzoneTitle || `Select ${title.replace(/(PDF|Image|Audio|Video).*$/, '').trim() || 'File'}`}
            description={uploadDescription || dropzoneDescription || (effectiveMultiple ? 'or drag and drop multiple files here' : 'or drag and drop file from your device')}
          />
        )}

        {/* Input format specs & multi-file capability chips */}
        <div
          style={{
            marginTop: '1rem',
            paddingTop: '0.85rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
          }}
        >
          {/* Format Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>Accepted:</span>
            {resolvedFormats.length > 0 ? (
              resolvedFormats.map((fmt) => (
                <span
                  key={fmt}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    background: 'var(--subtle-bg)',
                    border: '1px solid var(--border-color)',
                    fontWeight: 600,
                    fontSize: '0.72rem',
                    fontFamily: 'monospace',
                    color: 'var(--text-color)',
                  }}
                >
                  <FiFile size={10} />
                  {fmt.startsWith('.') ? fmt.toUpperCase() : `.${fmt.toUpperCase()}`}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>All standard formats</span>
            )}
          </div>

          {/* Capability Tags */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                background: effectiveMultiple ? 'rgba(28, 153, 255, 0.1)' : 'var(--subtle-bg)',
                color: effectiveMultiple ? 'var(--primary-color)' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.72rem',
                border: '1px solid var(--border-color)',
              }}
            >
              <FiLayers size={11} />
              {effectiveMultiple ? 'Multi-file Batch' : 'Single File'}
            </span>

            {maxSizeText && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                Max: {maxSizeText}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Privacy Footer Guarantee */}
      <div
        style={{
          marginTop: '1.25rem',
          textAlign: 'center',
          fontSize: '0.78rem',
          color: 'var(--text-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
        }}
      >
        <FiShield size={12} color="#10b981" />
        <span>100% Client-Side • In-Memory Processing • Zero Server Uploads</span>
      </div>

      {/* Embed Modal */}
      {isEmbedOpen && (
        <EmbedModal
          isOpen={isEmbedOpen}
          onClose={() => setIsEmbedOpen(false)}
          toolTitle={title}
          toolPath={toolPath}
        />
      )}
    </div>
  );
}
