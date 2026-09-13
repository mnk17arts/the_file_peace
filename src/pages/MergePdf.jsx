import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { PDFDocument } from 'pdf-lib';
import {
  FiLayers,
  FiArrowRight,
  FiCheckCircle,
  FiPlus,
} from 'react-icons/fi';
import ActionCompleted from '../components/ActionCompleted';
import AlertBanner from '../components/AlertBanner';
import Loader from '../components/Loader';
import {
  ToolHeroView,
  ToolStudioHeader,
  ResizableSplitPane,
  CompactFileQueue,
} from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { formatFileSize } from '../utils/fileUtils';

export default function MergePdf() {
  const location = useLocation();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [resultFileUrl, setResultFileUrl] = useState(null);
  const [resultBlob, setResultBlob] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const fileInputRef = useRef(null);
  const resultUrlRef = useRef(null);
  useEffect(() => {
    resultUrlRef.current = resultFileUrl;
  }, [resultFileUrl]);

  const handledRef = useRef(false);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  // Handle incoming file piped from another tool
  useEffect(() => {
    if (handledRef.current) return;
    const inc = consumeTransferredFile() || location.state?.incomingFile;
    if (inc) {
      handledRef.current = true;
      setTimeout(() => {
        setSelectedFiles((prev) => {
          if (prev.some((f) => f.name === inc.name && f.size === inc.size)) return prev;
          return [...prev, inc];
        });
        setErrorMessage(null);
      }, 0);
    }
  }, [location.state]);

  // Add files to queue
  const handleAddFiles = useCallback((newFiles) => {
    if (!newFiles || newFiles.length === 0) return;
    setSelectedFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const filtered = newFiles.filter((f) => !existingKeys.has(`${f.name}-${f.size}`));
      return [...prev, ...filtered];
    });
    setErrorMessage(null);
  }, []);

  // Hidden input file handler
  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleAddFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  // Remove file by index
  const handleRemoveFile = useCallback((idx) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // Reorder files
  const handleReorder = useCallback((fromIndex, toIndex) => {
    setSelectedFiles((prev) => {
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  }, []);

  // Execute Merge Operation
  const handleMerge = async () => {
    if (loading) return;
    if (selectedFiles.length < 2) {
      setErrorMessage('Please select at least 2 PDF files to merge.');
      return;
    }

    setLoading(true);
    setLoadingMessage('Creating unified document in memory...');
    setErrorMessage(null);

    try {
      const mergedPdf = await PDFDocument.create();

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setLoadingMessage(`Merging document ${i + 1} of ${selectedFiles.length} (${file.name})...`);

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const pageIndices = pdf.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);

        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
        });
      }

      setLoadingMessage('Finalizing and encoding merged document...');
      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });

      if (resultFileUrl) URL.revokeObjectURL(resultFileUrl);
      const url = URL.createObjectURL(blob);

      setResultBlob(blob);
      setResultFileUrl(url);
      setIsCompleted(true);
    } catch (error) {
      console.error('Error merging PDFs:', error);
      setErrorMessage(
        'An error occurred while merging the files. Make sure they are valid, unencrypted PDFs.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (resultFileUrl) URL.revokeObjectURL(resultFileUrl);
    setIsCompleted(false);
    setResultFileUrl(null);
    setResultBlob(null);
    setErrorMessage(null);
    setSelectedFiles([]);
  };

  const totalBytes = selectedFiles.reduce((acc, f) => acc + (f.size || 0), 0);

  // -------------------------------------------------------------
  // VIEW 3: ACTION COMPLETED
  // -------------------------------------------------------------
  if (isCompleted && resultFileUrl) {
    return (
      <div style={{ maxHeight: 'calc(100vh - 72px)', overflowY: 'auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          fileUrl={resultFileUrl}
          fileName="Merged_Document.pdf"
          file={resultBlob}
          onReset={handleReset}
          onProcessSourceAgain={() => setIsCompleted(false)}
          sourceActionLabel="Rearrange / Add More PDFs"
          onProcessTarget={() => {
            const chained = new File([resultBlob], 'Merged_Document.pdf', { type: 'application/pdf' });
            setSelectedFiles([chained]);
            setIsCompleted(false);
            setResultFileUrl(null);
            setResultBlob(null);
          }}
          targetActionLabel="Merge Again as Source"
          stats={[
            { label: 'Merged Files', value: `${selectedFiles.length} PDFs` },
            { label: 'Total Input Size', value: formatFileSize(totalBytes) },
            { label: 'Output Size', value: formatFileSize(resultBlob?.size || 0) },
          ]}
          message="Your PDFs have been successfully merged!"
          currentPath="/merge-pdf"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Upload stage)
  // -------------------------------------------------------------
  if (selectedFiles.length === 0) {
    return (
      <ToolHeroView
        title="Merge PDF Documents"
        description="Combine multiple PDF documents into a single, unified file. Drag, reorder, and assemble pages 100% in your browser."
        badge="Batch Assembly"
        badgeIcon={FiLayers}
        toolPath="/merge-pdf"
        onFilesSelected={handleAddFiles}
        accept={{ 'application/pdf': ['.pdf'] }}
        multiple={true}
        allowMultiple={true}
        uploadTitle="Select PDFs to Merge"
        uploadDescription="Drag & drop 2 or more PDF files here, or click to browse"
        formatBadges={['.PDF']}
        acceptedFormats={['.pdf']}
        singleFileOnly={false}
      />
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: TYPE-A STUDIO VIEW
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
      {/* Hidden file input for adding more files */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".pdf,application/pdf"
        multiple
        style={{ display: 'none' }}
      />

      {/* Top 48px Micro Bar */}
      <ToolStudioHeader
        icon={FiLayers}
        title="Merge PDF Documents"
        fileBadge={`${selectedFiles.length} PDFs • ${formatFileSize(totalBytes)}`}
        onChangeFile={() => fileInputRef.current?.click()}
        changeLabel="+ Add PDFs"
        onReset={handleReset}
        resetLabel="Clear All"
        actionButton={
          <button
            type="button"
            className="btn-primary studio-header-action-btn"
            disabled={loading || selectedFiles.length < 2}
            onClick={handleMerge}
          >
            <FiArrowRight size={16} />
            <span>
              {loading
                ? 'Merging Documents...'
                : `Merge ${selectedFiles.length} PDFs`}
            </span>
          </button>
        }
      />

      {/* In-Studio Error Alert */}
      {errorMessage && (
        <div style={{ padding: '0.5rem 1rem', background: 'var(--bg-color)' }}>
          <AlertBanner
            message={errorMessage}
            type="error"
            onClose={() => setErrorMessage(null)}
          />
        </div>
      )}

      {/* Draggable Split Studio */}
      <ResizableSplitPane
        initialSplit={52}
        minLeft={360}
        minRight={320}
        storageKey="tfp-split-merge-pdf"
        leftPane={
          <div
            style={{
              padding: '1.25rem',
              height: '100%',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Quick File Queue Header */}
            <CompactFileQueue
              files={selectedFiles}
              title="Input Files Queue"
              onRemove={handleRemoveFile}
              onClear={() => setSelectedFiles([])}
              onAddFiles={handleAddFiles}
              accept=".pdf,application/pdf"
              multiple={true}
              onReorder={handleReorder}
              layout="horizontal"
            />

            {/* Document Assembly Sequence Cards */}
            <div
              style={{
                flex: 1,
                background: 'var(--card-bg)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.85rem',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-color)' }}>
                    Document Assembly Order ({selectedFiles.length})
                  </span>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Files will be merged top to bottom in this exact sequence
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                >
                  <FiPlus size={13} /> Add More
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  overflowY: 'auto',
                  paddingRight: '0.25rem',
                  flex: 1,
                }}
              >
                {selectedFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      background: 'var(--subtle-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          background: 'rgba(28, 153, 255, 0.12)',
                          color: 'var(--primary-color)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </span>

                      <div style={{ minWidth: 0 }}>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: '0.88rem',
                            color: 'var(--text-color)',
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {file.name}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleReorder(idx, idx - 1)}
                        disabled={idx === 0}
                        className="btn-secondary"
                        style={{
                          padding: '0.25rem 0.45rem',
                          fontSize: '0.72rem',
                          cursor: idx === 0 ? 'not-allowed' : 'pointer',
                          opacity: idx === 0 ? 0.35 : 1,
                        }}
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReorder(idx, idx + 1)}
                        disabled={idx === selectedFiles.length - 1}
                        className="btn-secondary"
                        style={{
                          padding: '0.25rem 0.45rem',
                          fontSize: '0.72rem',
                          cursor: idx === selectedFiles.length - 1 ? 'not-allowed' : 'pointer',
                          opacity: idx === selectedFiles.length - 1 ? 0.35 : 1,
                        }}
                        title="Move Down"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        }
        rightPane={
          <div
            style={{
              padding: '1.25rem',
              height: '100%',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            {/* Status & Action Card */}
            <div
              style={{
                background: 'var(--card-bg)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                border: '1px solid var(--border-color)',
              }}
            >
              <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-color)' }}>
                Assembly Summary
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ background: 'var(--subtle-bg)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Total Files</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-color)' }}>{selectedFiles.length}</span>
                </div>

                <div style={{ background: 'var(--subtle-bg)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Total Size</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-color)' }}>{formatFileSize(totalBytes)}</span>
                </div>
              </div>

              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                {selectedFiles.length >= 2 ? (
                  <span style={{ color: '#2ed573', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <FiCheckCircle /> Ready to merge {selectedFiles.length} documents into one PDF.
                  </span>
                ) : (
                  <span style={{ color: '#ffa502', fontWeight: 600 }}>
                    Please add at least 1 more PDF document to enable merging.
                  </span>
                )}
              </div>

              <button
                type="button"
                className="btn-primary studio-action-btn"
                disabled={loading || selectedFiles.length < 2}
                onClick={handleMerge}
                style={{ width: '100%', padding: '0.85rem' }}
              >
                <FiArrowRight style={{ marginRight: '0.5rem' }} size={16} />
                <span>
                  {loading
                    ? 'Merging Documents...'
                    : `Merge ${selectedFiles.length} Documents`}
                </span>
              </button>
            </div>

            {/* Privacy & Technology Note */}
            <div
              style={{
                background: 'var(--subtle-bg)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                fontSize: '0.82rem',
                color: 'var(--text-color)',
                opacity: 0.9,
                lineHeight: 1.5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                <FiCheckCircle style={{ color: 'var(--accent-color)' }} />
                <span>Lossless In-Memory Assembly</span>
              </div>
              <p style={{ margin: 0 }}>
                Pages are merged directly in your browser using standard PDF streams. Original vector graphics, text layers, and embedded fonts are 100% preserved with zero server uploads.
              </p>
            </div>
          </div>
        }
      />

      {loading && <Loader message={loadingMessage || 'Merging documents...'} />}
    </div>
  );
}
