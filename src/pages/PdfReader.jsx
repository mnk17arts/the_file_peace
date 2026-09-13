import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { FiBookOpen, FiDownload, FiEye, FiMaximize2, FiMinimize2 } from 'react-icons/fi';
import AlertBanner from '../components/AlertBanner';
import FileActionMenu from '../components/FileActionMenu';
import PdfPreviewModal from '../components/PdfPreviewModal';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import { formatFileSize } from '../utils/fileUtils';
import { consumeTransferredFile } from '../utils/fileTransfer';

export default function PdfReader() {
  const location = useLocation();
  const [selectedFile, setSelectedFile] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const pdfUrlRef = useRef(null);
  const handledRef = useRef(false);
  const viewerContainerRef = useRef(null);

  useEffect(() => {
    pdfUrlRef.current = pdfUrl;
  }, [pdfUrl]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    };
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement && document.fullscreenElement === viewerContainerRef.current));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const handleFileLoad = useCallback((files) => {
    setErrorMessage(null);

    if (!files || files.length !== 1) {
      setErrorMessage('Please upload exactly one PDF to read.');
      return;
    }

    const file = files[0];
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Please select a valid PDF file (.pdf).');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setErrorMessage('File size exceeds 100 MB limit. Please select a smaller PDF.');
      return;
    }

    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setSelectedFile(file);
    setFileName(file.name);
    setFileSize(file.size);
  }, []);

  // Handle incoming file piped from another tool
  useEffect(() => {
    if (handledRef.current) return;
    const inc = consumeTransferredFile() || location.state?.incomingFile;
    if (inc) {
      handledRef.current = true;
      setTimeout(() => {
        handleFileLoad([inc]);
      }, 0);
    }
  }, [handleFileLoad, location.state]);

  const handleReset = () => {
    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setSelectedFile(null);
    setFileName('');
    setFileSize(0);
    setErrorMessage(null);
  };

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Empty state)
  // -------------------------------------------------------------
  if (!pdfUrl) {
    return (
      <ToolHeroView
        title="PDF Document Reader"
        description="Read, search, navigate, and review your PDF documents with the browser's native high-performance viewer."
        badge="PDF Studio"
        badgeIcon={FiBookOpen}
        toolPath="/pdf-reader"
        onFilesSelected={handleFileLoad}
        accept={{ 'application/pdf': ['.pdf'] }}
        multiple={false}
        uploadTitle="Drop a PDF file here to read"
        uploadDescription="Open, view, and inspect pages directly in your browser"
        formatBadges={['.PDF']}
        singleFileOnly={true}
        alerts={
          errorMessage && (
            <AlertBanner
              message={errorMessage}
              type="error"
              onClose={() => setErrorMessage(null)}
            />
          )
        }
      />
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: TYPE-B SINGLE-COLUMN FOCUS STUDIO
  // -------------------------------------------------------------
  return (
    <div
      style={{
        height: 'calc(100vh - 72px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg-color)',
      }}
    >
      {/* Top 48px Micro Bar */}
      <ToolStudioHeader
        icon={FiBookOpen}
        title="PDF Document Reader"
        fileBadge={`${fileName} • ${formatFileSize(fileSize)}`}
        onReset={handleReset}
        resetLabel="Open Another"
        headerExtra={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FileActionMenu
              file={selectedFile}
              fileUrl={pdfUrl}
              fileName={fileName}
              currentPath="/pdf-reader"
            />
            <button
              type="button"
              onClick={() => setIsPreviewModalOpen(true)}
              className="btn-secondary"
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.78rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
              }}
              title="Open multi-page preview modal"
            >
              <FiEye size={13} /> Preview as Modal
            </button>
            <button
              type="button"
              onClick={() => {
                if (!document.fullscreenElement) {
                  viewerContainerRef.current?.requestFullscreen?.().catch(() => {});
                } else {
                  document.exitFullscreen?.().catch(() => {});
                }
              }}
              className="btn-secondary"
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.78rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
              }}
              title={isFullscreen ? 'Exit fullscreen view' : 'View PDF in full screen'}
            >
              {isFullscreen ? <FiMinimize2 size={13} /> : <FiMaximize2 size={13} />}
              <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>
          </div>
        }
        actionButton={
          <a
            href={pdfUrl}
            download={fileName}
            className="btn-primary studio-header-action-btn"
            style={{ textDecoration: 'none' }}
          >
            <FiDownload size={14} />
            <span>Download PDF</span>
          </a>
        }
      />

      {/* Main Full-Height Viewer Container */}
      <div
        ref={viewerContainerRef}
        style={{
          flex: 1,
          minHeight: 0,
          background: 'var(--card-bg)',
          position: 'relative',
          width: '100%',
          height: '100%',
        }}
      >
        {isFullscreen && (
          <button
            type="button"
            onClick={() => document.exitFullscreen?.().catch(() => {})}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              zIndex: 1000,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.8rem',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(15, 23, 42, 0.85)',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <FiMinimize2 size={14} /> Exit Fullscreen (Esc)
          </button>
        )}
        <iframe
          src={`${pdfUrl}#toolbar=1&navpanes=1`}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
          title={fileName}
        />
      </div>

      {/* Modal Preview If Requested */}
      <PdfPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        pdfUrl={pdfUrl}
        title={fileName}
      />
    </div>
  );
}