import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import JSZip from 'jszip';
import {
  FiFolder,
  FiFile,
  FiDownload,
  FiEye,
  FiSearch,
  FiArchive,
  FiTrash2,
  FiPackage,
  FiPlus,
  FiX,
  FiCheck,
} from 'react-icons/fi';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { formatFileSize } from '../utils/fileUtils';

export default function ZipTools() {
  const location = useLocation();

  // Mode: 'extract' | 'create'
  const [activeTab, setActiveTab] = useState('extract');

  // Extraction state
  const [zipFile, setZipFile] = useState(null);
  const [zipEntries, setZipEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewEntry, setPreviewEntry] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewContent, setPreviewContent] = useState('');

  // Creation state
  const [filesToZip, setFilesToZip] = useState([]);
  const [archiveName, setArchiveName] = useState('archive.zip');
  const [compressionLevel, setCompressionLevel] = useState(6); // 0 (STORE) to 9 (MAX DEFLATE)
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  // Output Result State
  const [savedBlob, setSavedBlob] = useState(null);
  const [savedFileName, setSavedFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handledIncomingRef = useRef(false);

  const savedUrl = useMemo(() => {
    return savedBlob ? URL.createObjectURL(savedBlob) : null;
  }, [savedBlob]);

  useEffect(() => {
    return () => {
      if (savedUrl) URL.revokeObjectURL(savedUrl);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [savedUrl, previewUrl]);

  // Handle ZIP File Upload for extraction
  const handleZipUpload = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    const selected = Array.isArray(files) ? files[0] : files;

    if (!selected.name.toLowerCase().endsWith('.zip')) {
      setErrorMessage('Please select a valid .zip archive file.');
      return;
    }

    setErrorMessage('');
    setPreviewEntry(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    try {
      const buffer = await selected.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);
      const entries = [];

      zip.forEach((relativePath, zipEntry) => {
        entries.push({
          path: relativePath,
          name: relativePath.split('/').filter(Boolean).pop() || relativePath,
          isDir: zipEntry.dir,
          date: zipEntry.date,
          entryObj: zipEntry,
          uncompressedSize: zipEntry._data?.uncompressedSize || 0,
        });
      });

      // Sort directories first, then filenames alphabetically
      entries.sort((a, b) => {
        if (a.isDir === b.isDir) return a.path.localeCompare(b.path);
        return a.isDir ? -1 : 1;
      });

      setZipFile(selected);
      setZipEntries(entries);
    } catch (err) {
      console.error('ZIP extraction error:', err);
      setErrorMessage(err.message || 'Failed to read ZIP archive.');
    }
  }, []);

  // Handle incoming transferred file
  useEffect(() => {
    if (handledIncomingRef.current) return;
    const incoming = consumeTransferredFile() || location.state?.incomingFile;
    if (incoming) {
      handledIncomingRef.current = true;
      if (incoming.name.toLowerCase().endsWith('.zip')) {
        setTimeout(() => {
          setActiveTab('extract');
          handleZipUpload([incoming]);
        }, 0);
      } else {
        setTimeout(() => {
          setActiveTab('create');
          setFilesToZip([incoming]);
        }, 0);
      }
    }
  }, [location.state, handleZipUpload]);

  // Preview an entry inside the ZIP
  const handlePreview = async (entry) => {
    if (entry.isDir) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setPreviewEntry(entry);
    setPreviewUrl(null);
    setPreviewContent('');

    try {
      const lower = entry.name.toLowerCase();
      if (lower.match(/\.(png|jpe?g|webp|gif|svg|bmp)$/)) {
        const blob = await entry.entryObj.async('blob');
        setPreviewUrl(URL.createObjectURL(blob));
      } else if (lower.endsWith('.pdf')) {
        const arrayBuf = await entry.entryObj.async('arraybuffer');
        const blob = new Blob([arrayBuf], { type: 'application/pdf' });
        setPreviewUrl(URL.createObjectURL(blob));
      } else if (lower.match(/\.(txt|md|json|js|jsx|ts|tsx|css|html|xml|csv|log|py|c|cpp|java|sh|yml|yaml|ini|env|sql)$/)) {
        const text = await entry.entryObj.async('text');
        setPreviewContent(text.slice(0, 20000));
      } else {
        setPreviewContent(`[Binary or Unsupported Preview format: .${lower.split('.').pop() || 'file'}]\nClick "Download File" to save and open locally.`);
      }
    } catch (err) {
      console.error('Entry preview error:', err);
      setPreviewContent('Failed to load preview for this file.');
    }
  };

  // Download a single file from the ZIP
  const handleDownloadSingle = async (entry) => {
    try {
      const blob = await entry.entryObj.async('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = entry.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Single download error:', err);
      setErrorMessage('Failed to extract file.');
    }
  };

  // Download all files from the ZIP
  const handleDownloadAll = async () => {
    const nonDirEntries = zipEntries.filter((e) => !e.isDir);
    if (nonDirEntries.length === 0) return;

    for (let i = 0; i < nonDirEntries.length; i++) {
      await handleDownloadSingle(nonDirEntries[i]);
      if (i < nonDirEntries.length - 1) {
        await new Promise((r) => setTimeout(r, 120));
      }
    }
  };

  // Handle Adding files to Create ZIP queue
  const handleAddFilesToZip = (files) => {
    if (!files || files.length === 0) return;
    const list = Array.isArray(files) ? files : Array.from(files);
    setFilesToZip((prev) => [...prev, ...list]);
  };

  const handleRemoveFromZip = (idx) => {
    setFilesToZip((prev) => prev.filter((_, i) => i !== idx));
  };

  // Create & Pack ZIP Archive
  const handleCreateZip = async () => {
    if (filesToZip.length === 0) return;
    setIsZipping(true);
    setZipProgress(0);
    setErrorMessage('');

    try {
      const zip = new JSZip();

      filesToZip.forEach((file) => {
        zip.file(file.name, file);
      });

      const compressionType = compressionLevel === 0 ? 'STORE' : 'DEFLATE';
      const compressionOptions = compressionLevel > 0 ? { level: compressionLevel } : {};

      const content = await zip.generateAsync(
        {
          type: 'blob',
          compression: compressionType,
          compressionOptions,
        },
        (metadata) => {
          setZipProgress(Math.round(metadata.percent));
        }
      );

      const finalName = archiveName.trim().endsWith('.zip') ? archiveName.trim() : `${archiveName.trim() || 'archive'}.zip`;
      setSavedBlob(content);
      setSavedFileName(finalName);
    } catch (err) {
      console.error('ZIP creation error:', err);
      setErrorMessage(err.message || 'Failed to generate ZIP archive.');
    } finally {
      setIsZipping(false);
    }
  };

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return zipEntries;
    const q = searchQuery.toLowerCase();
    return zipEntries.filter((e) => e.path.toLowerCase().includes(q));
  }, [zipEntries, searchQuery]);

  const totalUncompressedSize = useMemo(() => {
    return zipEntries.reduce((sum, e) => sum + e.uncompressedSize, 0);
  }, [zipEntries]);

  const totalQueuedSize = useMemo(() => {
    return filesToZip.reduce((sum, f) => sum + f.size, 0);
  }, [filesToZip]);

  const handleReset = () => {
    setZipFile(null);
    setZipEntries([]);
    setFilesToZip([]);
    setSavedBlob(null);
    setPreviewEntry(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewContent('');
    setErrorMessage('');
    setZipProgress(0);
  };

  // Mode switcher tabs element
  const renderModeTabs = (isStudio = false) => (
    <div
      style={{
        display: 'inline-flex',
        background: 'var(--subtle-bg)',
        padding: '0.2rem',
        borderRadius: '30px',
        border: '1px solid var(--border-color)',
        gap: '0.2rem',
        marginBottom: isStudio ? 0 : '0.5rem',
      }}
    >
      <button
        type="button"
        onClick={() => setActiveTab('extract')}
        style={{
          padding: isStudio ? '0.3rem 0.85rem' : '0.35rem 1rem',
          borderRadius: '20px',
          border: 'none',
          background: activeTab === 'extract' ? 'var(--primary-color)' : 'transparent',
          color: activeTab === 'extract' ? '#fff' : 'var(--text-secondary)',
          fontWeight: 700,
          fontSize: isStudio ? '0.8rem' : '0.82rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          transition: 'all 0.15s ease',
        }}
      >
        <FiPackage size={isStudio ? 13 : 14} /> Unpack &amp; Browse
      </button>
      <button
        type="button"
        onClick={() => setActiveTab('create')}
        style={{
          padding: isStudio ? '0.3rem 0.85rem' : '0.35rem 1rem',
          borderRadius: '20px',
          border: 'none',
          background: activeTab === 'create' ? 'var(--primary-color)' : 'transparent',
          color: activeTab === 'create' ? '#fff' : 'var(--text-secondary)',
          fontWeight: 700,
          fontSize: isStudio ? '0.8rem' : '0.82rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          transition: 'all 0.15s ease',
        }}
      >
        <FiArchive size={isStudio ? 13 : 14} /> Create New ZIP
      </button>
    </div>
  );

  // -------------------------------------------------------------
  // VIEW 3: ACTION COMPLETED
  // -------------------------------------------------------------
  if (savedBlob && savedUrl) {
    return (
      <div style={{ maxHeight: 'calc(100vh - 72px)', overflowY: 'auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          fileUrl={savedUrl}
          fileName={savedFileName}
          file={new File([savedBlob], savedFileName, { type: 'application/zip' })}
          onReset={handleReset}
          onProcessSourceAgain={() => setSavedBlob(null)}
          sourceActionLabel="Back to ZIP Studio"
          message="ZIP archive successfully created!"
          currentPath="/zip-tools"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (NO ARCHIVE OR FILES LOADED)
  // -------------------------------------------------------------
  const isHeroState = activeTab === 'extract' ? !zipFile : filesToZip.length === 0;

  if (isHeroState) {
    return (
      <div>
        {activeTab === 'extract' ? (
          <ToolHeroView
            title="ZIP Studio"
            toolPath="/zip-tools"
            badge="Archives &amp; Extraction"
            badgeIcon={FiPackage}
            description="Unpack, inspect, search, and preview ZIP contents 100% locally in your browser without extracting to disk."
            acceptedFormats={['ZIP Archives (.zip)']}
            allowMultiple={false}
            accept={{ 'application/zip': ['.zip'] }}
            onFilesSelected={handleZipUpload}
            alerts={
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                {renderModeTabs(false)}
              </div>
            }
          />
        ) : (
          <ToolHeroView
            title="ZIP Studio"
            toolPath="/zip-tools"
            badge="Archives &amp; Creation"
            badgeIcon={FiArchive}
            description="Pack multiple files of any type into a high-efficiency compressed ZIP archive with custom compression levels."
            acceptedFormats={['Any files (*.*)']}
            allowMultiple={true}
            onFilesSelected={handleAddFilesToZip}
            alerts={
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                {renderModeTabs(false)}
              </div>
            }
          />
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: ACTIVE STUDIO WORKSPACE (LOCKED TO VIEWPORT HEIGHT)
  // -------------------------------------------------------------
  return (
    <div
      className="studio-page-container"
      style={{
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '0.75rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 72px)',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <ToolStudioHeader
        title="ZIP Studio"
        toolPath="/zip-tools"
        fileBadge={
          activeTab === 'extract'
            ? `${zipEntries.length} items (${formatFileSize(totalUncompressedSize)})`
            : `${filesToZip.length} files (${formatFileSize(totalQueuedSize)})`
        }
        onReset={handleReset}
        resetLabel="Reset"
        headerExtra={renderModeTabs(true)}
        actionButton={
          activeTab === 'create' ? (
            <button
              type="button"
              onClick={handleCreateZip}
              disabled={isZipping || filesToZip.length === 0}
              className="btn-primary studio-header-action-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 1.1rem',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              <FiPackage size={15} />
              <span>{isZipping ? `Packing (${zipProgress}%)` : 'Create ZIP'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={zipEntries.filter((e) => !e.isDir).length === 0}
              className="btn-primary studio-header-action-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 1.1rem',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              <FiDownload size={15} />
              <span>Extract All</span>
            </button>
          )
        }
      />

      {errorMessage && (
        <div style={{ padding: '0.4rem 0', flexShrink: 0 }}>
          <AlertBanner
            message={errorMessage}
            type="error"
            onClose={() => setErrorMessage('')}
          />
        </div>
      )}

      {/* Main Studio Body: Fixed height, internal sleek scrollbars */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns:
            activeTab === 'extract'
              ? previewEntry
                ? 'minmax(0, 1.25fr) minmax(0, 1fr)'
                : '1fr'
              : 'minmax(0, 1.2fr) minmax(0, 1fr)',
          gap: '1rem',
          overflow: 'hidden',
          paddingTop: '0.5rem',
        }}
      >
        {/* ========================================================= */}
        {/* TAB 1: EXTRACT & BROWSE ZIP */}
        {/* ========================================================= */}
        {activeTab === 'extract' && (
          <>
            {/* Left Column: Explorer List */}
            <div
              className="workspace-card"
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                height: '100%',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              {/* Header Info */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginBottom: '0.75rem',
                  paddingBottom: '0.6rem',
                  borderBottom: '1px solid var(--border-color)',
                  flexShrink: 0,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: '1rem',
                      color: 'var(--text-color)',
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    📦 {zipFile?.name || 'archive.zip'}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {zipEntries.length} items • Uncompressed: ~{formatFileSize(totalUncompressedSize)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      background: 'rgba(28, 153, 255, 0.1)',
                      color: 'var(--primary-color)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      border: '1px solid rgba(28, 153, 255, 0.25)',
                    }}
                  >
                    Change ZIP
                    <input
                      type="file"
                      accept=".zip,application/zip"
                      style={{ display: 'none' }}
                      onChange={(e) => handleZipUpload(e.target.files)}
                    />
                  </label>
                </div>
              </div>

              {/* Search Bar */}
              <div style={{ position: 'relative', marginBottom: '0.75rem', width: '100%', flexShrink: 0 }}>
                <FiSearch
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-secondary)',
                  }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search files in archive..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.5rem 0.75rem 0.5rem 2rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--subtle-bg)',
                    color: 'var(--text-color)',
                    fontSize: '0.84rem',
                  }}
                />
              </div>

              {/* File List Stream */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                  paddingRight: '0.25rem',
                }}
              >
                {filteredEntries.map((entry, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.65rem',
                      borderRadius: '8px',
                      background:
                        previewEntry?.path === entry.path
                          ? 'rgba(28, 153, 255, 0.12)'
                          : 'var(--subtle-bg)',
                      border: `1px solid ${
                        previewEntry?.path === entry.path ? 'var(--primary-color)' : 'transparent'
                      }`,
                      fontSize: '0.84rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {entry.isDir ? (
                        <FiFolder style={{ color: '#f59e0b', flexShrink: 0 }} size={15} />
                      ) : (
                        <FiFile style={{ color: 'var(--primary-color)', flexShrink: 0 }} size={15} />
                      )}
                      <span
                        style={{
                          fontWeight: entry.isDir ? 700 : 500,
                          color: 'var(--text-color)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {entry.path}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                      {!entry.isDir && (
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                          {formatFileSize(entry.uncompressedSize)}
                        </span>
                      )}

                      {!entry.isDir && (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            type="button"
                            onClick={() => handlePreview(entry)}
                            title="Preview File"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary-color)',
                              cursor: 'pointer',
                              padding: '0.25rem',
                              borderRadius: '4px',
                            }}
                          >
                            <FiEye size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadSingle(entry)}
                            title="Download File"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--secondary-color, #2ed573)',
                              cursor: 'pointer',
                              padding: '0.25rem',
                              borderRadius: '4px',
                            }}
                          >
                            <FiDownload size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {filteredEntries.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    No files found matching &quot;{searchQuery}&quot;
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: In-Browser Preview Panel */}
            {previewEntry && (
              <div
                className="workspace-card"
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '14px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: 0,
                  height: '100%',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.6rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid var(--border-color)',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      color: 'var(--text-color)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    📄 {previewEntry.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewEntry(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '0.2rem',
                    }}
                    title="Close preview"
                  >
                    <FiX size={16} />
                  </button>
                </div>

                {/* Preview Viewport */}
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    overflowX: 'auto',
                    background: 'var(--subtle-bg)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box',
                  }}
                >
                  {previewUrl &&
                    previewEntry.name.toLowerCase().match(/\.(png|jpe?g|webp|gif|svg|bmp)$/) && (
                      <img
                        src={previewUrl}
                        alt={previewEntry.name}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                          borderRadius: '6px',
                        }}
                      />
                    )}

                  {previewUrl && previewEntry.name.toLowerCase().endsWith('.pdf') && (
                    <iframe
                      src={previewUrl}
                      title={previewEntry.name}
                      style={{ width: '100%', height: '100%', border: 'none', borderRadius: '6px' }}
                    />
                  )}

                  {previewContent && (
                    <pre
                      style={{
                        margin: 0,
                        fontSize: '0.78rem',
                        color: 'var(--text-color)',
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        width: '100%',
                        height: '100%',
                        overflowY: 'auto',
                      }}
                    >
                      {previewContent}
                    </pre>
                  )}
                </div>

                <div
                  style={{
                    marginTop: '0.75rem',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.5rem',
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleDownloadSingle(previewEntry)}
                    className="btn-primary"
                    style={{
                      padding: '0.4rem 0.85rem',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <FiDownload size={13} /> Download File
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ========================================================= */}
        {/* TAB 2: CREATE NEW ZIP */}
        {/* ========================================================= */}
        {activeTab === 'create' && (
          <>
            {/* Left Column: Queued Files */}
            <div
              className="workspace-card"
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                height: '100%',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginBottom: '0.75rem',
                  paddingBottom: '0.6rem',
                  borderBottom: '1px solid var(--border-color)',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.96rem', color: 'var(--text-color)' }}>
                    📦 Queued Files ({filesToZip.length})
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    • ~{formatFileSize(totalQueuedSize)}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      background: 'rgba(28, 153, 255, 0.1)',
                      color: 'var(--primary-color)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      border: '1px solid rgba(28, 153, 255, 0.25)',
                    }}
                  >
                    <FiPlus size={13} /> Add More
                    <input
                      type="file"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => handleAddFilesToZip(e.target.files)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setFilesToZip([])}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ff4757',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      padding: '0.35rem 0.5rem',
                    }}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Queued Files Scrollable Stream */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                  paddingRight: '0.25rem',
                }}
              >
                {filesToZip.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.65rem',
                      borderRadius: '8px',
                      background: 'var(--subtle-bg)',
                      fontSize: '0.84rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <span style={{ fontSize: '0.72rem', opacity: 0.6, width: '16px' }}>{i + 1}.</span>
                      <FiFile color="var(--primary-color)" style={{ flexShrink: 0 }} size={14} />
                      <span
                        style={{
                          color: 'var(--text-color)',
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {f.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                        {formatFileSize(f.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFromZip(i)}
                        title="Remove file"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ff4757',
                          cursor: 'pointer',
                          padding: '0.2rem',
                        }}
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Settings Desk */}
            <div
              className="workspace-card"
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                minWidth: 0,
                height: '100%',
                boxSizing: 'border-box',
                overflowY: 'auto',
              }}
            >
              <span
                style={{
                  fontWeight: 800,
                  fontSize: '0.96rem',
                  color: 'var(--text-color)',
                  display: 'block',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '0.6rem',
                }}
              >
                Archive Settings &amp; Compression:
              </span>

              {/* Archive Name */}
              <div>
                <label
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    display: 'block',
                    marginBottom: '0.35rem',
                  }}
                >
                  Output ZIP Filename:
                </label>
                <input
                  type="text"
                  value={archiveName}
                  onChange={(e) => setArchiveName(e.target.value)}
                  placeholder="archive.zip"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--subtle-bg)',
                    color: 'var(--text-color)',
                    fontSize: '0.88rem',
                  }}
                />
              </div>

              {/* Compression Presets */}
              <div>
                <label
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    display: 'block',
                    marginBottom: '0.5rem',
                  }}
                >
                  Compression Level: {compressionLevel === 0 ? 'Store (No Compression)' : `DEFLATE Level ${compressionLevel}`}
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginBottom: '0.75rem' }}>
                  {[
                    { label: 'Store (0)', val: 0 },
                    { label: 'Fast (1)', val: 1 },
                    { label: 'Normal (6)', val: 6 },
                    { label: 'Max (9)', val: 9 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setCompressionLevel(preset.val)}
                      style={{
                        padding: '0.4rem 0.2rem',
                        borderRadius: '6px',
                        border: `1px solid ${compressionLevel === preset.val ? 'var(--primary-color)' : 'var(--border-color)'}`,
                        background: compressionLevel === preset.val ? 'rgba(28, 153, 255, 0.12)' : 'var(--subtle-bg)',
                        color: compressionLevel === preset.val ? 'var(--primary-color)' : 'var(--text-color)',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <input
                  type="range"
                  min="0"
                  max="9"
                  value={compressionLevel}
                  onChange={(e) => setCompressionLevel(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--primary-color)' }}
                />
              </div>

              {/* Summary Stats Box */}
              <div
                style={{
                  background: 'var(--subtle-bg)',
                  borderRadius: '10px',
                  padding: '0.85rem',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Files queued:</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-color)' }}>{filesToZip.length} files</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Uncompressed Size:</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-color)' }}>~{formatFileSize(totalQueuedSize)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Privacy / Engine:</span>
                  <span style={{ fontWeight: 700, color: 'var(--secondary-color, #2ed573)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                    <FiCheck size={13} /> 100% Client-Side JSZip
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              {isZipping && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      marginBottom: '0.35rem',
                    }}
                  >
                    <span>Packing in memory...</span>
                    <span>{zipProgress}%</span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: '7px',
                      background: 'var(--subtle-bg)',
                      borderRadius: '999px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${zipProgress}%`,
                        height: '100%',
                        background: 'var(--primary-color)',
                        transition: 'width 0.2s ease',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Submit CTA */}
              <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleCreateZip}
                  disabled={isZipping || filesToZip.length === 0}
                  className="btn-primary"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    cursor: isZipping || filesToZip.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <FiPackage size={17} />
                  <span>{isZipping ? `Packing Archive (${zipProgress}%)...` : 'Pack & Download ZIP'}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
