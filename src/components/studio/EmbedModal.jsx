import { useState, useMemo } from 'react';
import { FiX, FiCode, FiCopy, FiCheck, FiExternalLink, FiMaximize2 } from 'react-icons/fi';

/**
 * EmbedModal — Interactive Embed Code Generator & Live Preview
 */
export default function EmbedModal({
  isOpen,
  onClose,
  toolTitle = 'Tool',
  toolPath = '',
}) {
  const [theme, setTheme] = useState('dark');
  const [showBorder, setShowBorder] = useState(true);
  const [showBrand, setShowBrand] = useState(true);
  const [embedHeight, setEmbedHeight] = useState(640);
  const [activeTab, setActiveTab] = useState('iframe');
  const [copied, setCopied] = useState(false);

  // Normalize slug from toolPath (e.g. "/file-hash" -> "file-hash")
  const slug = useMemo(() => {
    return (toolPath || '').replace(/^\/+/, '').split('?')[0].split('#')[0] || 'file-hash';
  }, [toolPath]);

  // Compute base URL and embed URL
  const { embedUrl, fullEmbedUrl } = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mnk17arts.github.io';
    const basePath = import.meta.env.BASE_URL || '/';
    const cleanBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
    
    const params = new URLSearchParams();
    if (theme !== 'auto') params.set('theme', theme);
    if (!showBorder) params.set('border', '0');
    if (!showBrand) params.set('brand', '0');

    const query = params.toString() ? `?${params.toString()}` : '';
    const hashRoute = `#/embed/${slug}${query}`;
    const relativeUrl = `${cleanBase}${hashRoute}`;
    const absoluteUrl = `${origin}${cleanBase}${hashRoute}`;

    return {
      embedUrl: relativeUrl,
      fullEmbedUrl: absoluteUrl,
    };
  }, [slug, theme, showBorder, showBrand]);

  // Generate code snippets
  const codeSnippet = useMemo(() => {
    if (activeTab === 'iframe') {
      return `<iframe
  src="${fullEmbedUrl}"
  width="100%"
  height="${embedHeight}"
  style="border: none; border-radius: 12px; max-width: 100%; box-shadow: 0 8px 24px rgba(0,0,0,0.15);"
  title="${toolTitle} — The File Peace"
  loading="lazy"
  allow="clipboard-read; clipboard-write"
></iframe>`;
    }

    if (activeTab === 'react') {
      return `export function ${toolTitle.replace(/[^a-zA-Z0-9]/g, '')}Widget() {
  return (
    <iframe
      src="${fullEmbedUrl}"
      width="100%"
      height="${embedHeight}"
      style={{
        border: 'none',
        borderRadius: '12px',
        maxWidth: '100%',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      }}
      title="${toolTitle} — The File Peace"
      loading="lazy"
      allow="clipboard-read; clipboard-write"
    />
  );
}`;
    }

    // Tab 'script': includes embed.js helper
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mnk17arts.github.io';
    const basePath = import.meta.env.BASE_URL || '/';
    const cleanBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
    const sdkUrl = `${origin}${cleanBase}embed.js`;

    return `<!-- The File Peace Auto-Resizing Embed Widget -->
<iframe
  src="${fullEmbedUrl}"
  width="100%"
  height="${embedHeight}"
  style="border: none; border-radius: 12px; width: 100%;"
  title="${toolTitle} — The File Peace"
  data-filepeace-embed
></iframe>
<script src="${sdkUrl}" async></script>`;
  }, [activeTab, fullEmbedUrl, toolTitle, embedHeight]);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

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
          maxWidth: '920px',
          maxHeight: '92vh',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--subtle-bg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiCode size={16} color="var(--primary-color)" />
            <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-color)' }}>
              Embed {toolTitle} on Your Website
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <a
              href={fullEmbedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--text-color)',
                textDecoration: 'none',
              }}
              title="Open standalone embed URL in new tab"
            >
              <span>Test Embed</span>
              <FiExternalLink size={12} />
            </a>

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
              <FiX size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              padding: '0.75rem 1rem',
              background: 'var(--subtle-bg)',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
            }}
          >
            {/* Theme Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-color)' }}>Theme:</span>
              <div style={{ display: 'inline-flex', background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '2px', gap: '2px' }}>
                {['dark', 'light', 'auto'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: theme === t ? 'var(--primary-color)' : 'transparent',
                      color: theme === t ? '#fff' : 'var(--text-secondary)',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Height Control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-color)' }}>Height:</span>
              <select
                value={embedHeight}
                onChange={(e) => setEmbedHeight(Number(e.target.value))}
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-color)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                }}
              >
                <option value={500}>500px (Compact)</option>
                <option value={640}>640px (Standard)</option>
                <option value={750}>750px (Large)</option>
                <option value={850}>850px (Expanded)</option>
              </select>
            </div>

            {/* Toggles */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-color)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showBorder}
                  onChange={(e) => setShowBorder(e.target.checked)}
                />
                <span>Frame Border</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-color)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showBrand}
                  onChange={(e) => setShowBrand(e.target.checked)}
                />
                <span>Attribution</span>
              </label>
            </div>
          </div>

          {/* Snippet Code Generator Box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Tab Selector */}
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {[
                  { id: 'iframe', label: 'HTML <iframe>' },
                  { id: 'react', label: 'React / Next.js' },
                  { id: 'script', label: 'Auto-Resizing Script' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '0.3rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: activeTab === tab.id ? 'var(--primary-color)' : 'transparent',
                      background: activeTab === tab.id ? 'rgba(28, 153, 255, 0.12)' : 'transparent',
                      color: activeTab === tab.id ? 'var(--primary-color)' : 'var(--text-muted)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 1-Click Copy Button */}
              <button
                type="button"
                onClick={handleCopy}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.8rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {copied ? <FiCheck color="#fff" size={13} /> : <FiCopy size={13} />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Code'}</span>
              </button>
            </div>

            {/* Monospace Code Display */}
            <div
              style={{
                background: 'var(--subtle-bg)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                padding: '0.85rem',
                overflowX: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                color: 'var(--text-color)',
                lineHeight: 1.5,
                maxHeight: '140px',
                userSelect: 'all',
              }}
            >
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{codeSnippet}</pre>
            </div>
          </div>

          {/* Live Embed Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              <FiMaximize2 size={12} />
              <span>Live Interactive Preview:</span>
            </div>

            <div
              style={{
                width: '100%',
                height: '320px',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
                background: theme === 'light' ? '#ffffff' : '#0b0f17',
              }}
            >
              <iframe
                src={embedUrl}
                title={`Preview ${toolTitle}`}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
