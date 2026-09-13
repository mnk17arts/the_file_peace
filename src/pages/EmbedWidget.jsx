import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FiShield, FiExternalLink, FiAlertCircle } from 'react-icons/fi';

// Lazy map of all available client-side tool components
const TOOL_COMPONENTS = {
  'merge-pdf': lazy(() => import('./MergePdf')),
  'split-pdf': lazy(() => import('./SplitPdf')),
  'rotate-pdf': lazy(() => import('./RotatePdf')),
  'pdf-to-image': lazy(() => import('./PdfToImage')),
  'compress-image': lazy(() => import('./CompressImage')),
  'compress-video': lazy(() => import('./CompressVideo')),
  'protect-pdf': lazy(() => import('./ProtectPdf')),
  'convert-image': lazy(() => import('./ConvertImage')),
  'image-to-pdf': lazy(() => import('./ImageToPdf')),
  'pdf-reader': lazy(() => import('./PdfReader')),
  'text-to-pdf': lazy(() => import('./TextToPdf')),
  'markup-converter': lazy(() => import('./MarkupConverter')),
  'add-watermark': lazy(() => import('./AddWatermark')),
  'page-numbers': lazy(() => import('./AddPageNumbers')),
  'organize-pdf': lazy(() => import('./OrganizePdf')),
  'unlock-pdf': lazy(() => import('./UnlockPdf')),
  'edit-pdf': lazy(() => import('./EditPdf')),
  'summarize-pdf': lazy(() => import('./SummarizePdf')),
  'translate-pdf': lazy(() => import('./TranslatePdf')),
  'pdf-to-docx': lazy(() => import('./PdfToDocx')),
  'compress-pdf': lazy(() => import('./CompressPdf')),
  'pdf-to-text': lazy(() => import('./PdfToText')),
  'crop-pdf': lazy(() => import('./CropPdf')),
  'flip-pdf': lazy(() => import('./FlipPdf')),
  'invert-pdf': lazy(() => import('./InvertPdf')),
  'flatten-pdf': lazy(() => import('./FlattenPdf')),
  'compare-pdf': lazy(() => import('./ComparePdf')),
  'crop-image': lazy(() => import('./CropImage')),
  'edit-image': lazy(() => import('./EditImage')),
  'extract-audio': lazy(() => import('./ExtractAudio')),
  'audio-tools': lazy(() => import('./AudioTools')),
  'redact-pdf': lazy(() => import('./RedactPdf')),
  'pdf-metadata': lazy(() => import('./PdfMetadata')),
  'strip-exif': lazy(() => import('./StripExif')),
  'file-hash': lazy(() => import('./FileHash')),
  'chat-pdf': lazy(() => import('./ChatPdf')),
  'transcribe-audio': lazy(() => import('./TranscribeAudio')),
  'text-to-handwriting': lazy(() => import('./TextToHandwriting')),
  'zip-tools': lazy(() => import('./ZipTools')),
  'qr-tools': lazy(() => import('./QrTools')),
  'p2p-share': lazy(() => import('./P2pFileShare')),
  'workflow-builder': lazy(() => import('./WorkflowBuilder')),
  'protect-image': lazy(() => import('./ProtectImage')),
};

const EmbedLoader = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '280px',
      gap: '0.75rem',
      color: 'var(--text-color)',
    }}
  >
    <div
      style={{
        width: '36px',
        height: '36px',
        border: '3px solid var(--border-color)',
        borderTopColor: 'var(--primary-color)',
        borderRadius: '50%',
        animation: 'embedSpin 0.75s linear infinite',
      }}
    />
    <style>{`@keyframes embedSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    <span style={{ fontSize: '0.88rem', opacity: 0.8 }}>Initializing Private Offline Tool…</span>
  </div>
);

/**
 * EmbedWidget — Zero-Chrome Embedded Widget Route (/embed/:toolId)
 * 
 * Supports:
 * - Query params: ?theme=dark|light|auto, ?border=0|1, ?brand=0|1
 * - PostMessage auto-resizing (filepeace:resize)
 * - PostMessage theme sync (filepeace:setTheme)
 */
export default function EmbedWidget() {
  const { toolId } = useParams();
  const [searchParams] = useSearchParams();
  const containerRef = useRef(null);

  // Read URL configurations
  const urlTheme = searchParams.get('theme') || 'dark';
  const showBorder = searchParams.get('border') !== '0';
  const showBrand = searchParams.get('brand') !== '0';

  const [activeTheme, setActiveTheme] = useState(() => {
    if (urlTheme === 'light' || urlTheme === 'dark') return urlTheme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  const ToolComponent = TOOL_COMPONENTS[toolId];

  // Sync active theme to document body and root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
    document.body.className = activeTheme === 'dark' ? 'theme-dark' : 'theme-light';
  }, [activeTheme]);

  // PostMessage bus: listen for parent messages (e.g. dynamic theme switch)
  useEffect(() => {
    const handleMessage = (event) => {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'filepeace:setTheme' && (event.data.theme === 'dark' || event.data.theme === 'light')) {
        setActiveTheme(event.data.theme);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // PostMessage resize notification
  useEffect(() => {
    // Notify parent frame that widget is mounted and ready
    try {
      window.parent.postMessage({ type: 'filepeace:ready', toolId }, '*');
    } catch {
      // ignore
    }

    if (!containerRef.current || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.target.scrollHeight || entry.contentRect.height;
        if (height > 0) {
          try {
            window.parent.postMessage({
              type: 'filepeace:resize',
              toolId,
              height: Math.ceil(height) + 16,
            }, '*');
          } catch {
            // ignore
          }
        }
      }
    });

    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [toolId]);

  return (
    <div
      ref={containerRef}
      className="filepeace-embed-container"
      style={{
        width: '100%',
        minHeight: '100vh',
        boxSizing: 'border-box',
        background: 'var(--bg-color)',
        color: 'var(--text-color)',
        padding: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        border: showBorder ? '1px solid var(--border-color)' : 'none',
        borderRadius: showBorder ? '14px' : '0',
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        {ToolComponent ? (
          <Suspense fallback={<EmbedLoader />}>
            <ToolComponent />
          </Suspense>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <FiAlertCircle size={40} color="#ff4757" style={{ marginBottom: '1rem' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Tool Not Found
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
              No offline tool matches the identifier <code>&quot;{toolId}&quot;</code>.
            </p>
            <a
              href="https://mnk17arts.github.io/the_file_peace/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <span>Explore All Offline Tools</span>
              <FiExternalLink size={13} />
            </a>
          </div>
        )}
      </div>

      {/* Attribution Bar (Can be suppressed with ?brand=0) */}
      {showBrand && (
        <footer
          style={{
            marginTop: '0.75rem',
            paddingTop: '0.5rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <FiShield size={12} color="var(--primary-color)" />
            <span>100% In-Memory Client-Side • Zero Data Leaves Device</span>
          </div>

          <a
            href="https://mnk17arts.github.io/the_file_peace/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: 'var(--primary-color)',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <span>Powered by The File Peace</span>
            <FiExternalLink size={10} />
          </a>
        </footer>
      )}
    </div>
  );
}
