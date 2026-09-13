import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import {
  FiDownload,
  FiMinimize2,
  FiSliders,
  FiFileText,
  FiCheckCircle,
} from 'react-icons/fi';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import AlertBanner from '../components/AlertBanner';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { formatFileSize, validatePdfFile } from '../utils/fileUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const COMPRESSION_PRESETS = [
  {
    id: 'extreme',
    title: 'Extreme Compression',
    desc: 'Lowest file size, medium image quality (Great for email & low bandwidth)',
    scale: 1.0,
    quality: 0.45,
    badge: 'Smallest Size',
  },
  {
    id: 'balanced',
    title: 'Recommended / Balanced',
    desc: 'High quality text & visuals with significant file size reduction',
    scale: 1.5,
    quality: 0.70,
    badge: 'Popular',
  },
  {
    id: 'light',
    title: 'Light Compression',
    desc: 'Near-lossless visual quality with gentle file size optimization',
    scale: 2.0,
    quality: 0.88,
    badge: 'High Quality',
  },
];

export default function CompressPdf() {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // Settings
  const [selectedPreset, setSelectedPreset] = useState('balanced');
  const [customQuality, setCustomQuality] = useState(70);
  const [customScale, setCustomScale] = useState(1.5);
  const [useCustom, setUseCustom] = useState(false);

  // Results
  const [compressedBlob, setCompressedBlob] = useState(null);
  const [previewPageUrl, setPreviewPageUrl] = useState(null);
  const [numPages, setNumPages] = useState(0);

  const handledIncomingRef = useRef(false);

  // Manage compressedUrl lifecycle
  const compressedUrl = useMemo(() => {
    return compressedBlob ? URL.createObjectURL(compressedBlob) : null;
  }, [compressedBlob]);

  useEffect(() => {
    return () => {
      if (compressedUrl) {
        URL.revokeObjectURL(compressedUrl);
      }
    };
  }, [compressedUrl]);

  // Compress PDF via canvas raster downsampling and pdf-lib recompilation
  const handleCompress = useCallback(async (selectedFile, scale, quality) => {
    setIsProcessing(true);
    setProgressPercent(5);
    setProgressMsg('Loading document in memory...');
    setErrorMessage('');
    setCompressedBlob(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        isEvalSupported: false,
      }).promise;

      const totalPages = pdf.numPages;
      setNumPages(totalPages);

      const newPdfDoc = await PDFDocument.create();

      for (let i = 1; i <= totalPages; i++) {
        setProgressMsg(`Optimizing page ${i} of ${totalPages}...`);
        setProgressPercent(Math.round((i / totalPages) * 90));

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        await page.render({
          canvasContext: ctx,
          viewport: viewport,
        }).promise;

        // Generate JPEG blob at selected quality
        const jpegBlob = await new Promise((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
        });

        if (i === 1) {
          // Set preview for page 1
          if (previewPageUrl) URL.revokeObjectURL(previewPageUrl);
          setPreviewPageUrl(URL.createObjectURL(jpegBlob));
        }

        const jpegBytes = await jpegBlob.arrayBuffer();
        const embeddedImage = await newPdfDoc.embedJpg(jpegBytes);

        // Get standard unscaled dimensions from viewport scale
        const origViewport = page.getViewport({ scale: 1.0 });
        const newPage = newPdfDoc.addPage([origViewport.width, origViewport.height]);
        newPage.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: origViewport.width,
          height: origViewport.height,
        });
      }

      setProgressMsg('Finalizing compressed PDF...');
      setProgressPercent(95);

      const finalBytes = await newPdfDoc.save();
      const outBlob = new Blob([finalBytes], { type: 'application/pdf' });
      setCompressedBlob(outBlob);
      setProgressPercent(100);
    } catch (err) {
      console.error('Compression error:', err);
      setErrorMessage(err.message || 'Failed to compress PDF document.');
    } finally {
      setIsProcessing(false);
    }
  }, [previewPageUrl]);

  // Handle file drop
  const handleFiles = useCallback((files) => {
    if (!files || files.length === 0) return;
    const selected = Array.isArray(files) ? files[0] : files;
    const validation = validatePdfFile(selected);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      return;
    }

    setFile(selected);
    setCompressedBlob(null);

    const preset = COMPRESSION_PRESETS.find((p) => p.id === selectedPreset) || COMPRESSION_PRESETS[1];
    const scale = useCustom ? customScale : preset.scale;
    const quality = useCustom ? customQuality / 100 : preset.quality;

    handleCompress(selected, scale, quality);
  }, [customQuality, customScale, handleCompress, selectedPreset, useCustom]);

  // Handle incoming transfer file
  useEffect(() => {
    if (handledIncomingRef.current) return;
    const incoming = consumeTransferredFile() || location.state?.incomingFile;
    if (incoming) {
      handledIncomingRef.current = true;
      setTimeout(() => {
        handleFiles([incoming]);
      }, 0);
    }
  }, [handleFiles, location.state]);

  const handleApplyPreset = (presetId) => {
    setSelectedPreset(presetId);
    setUseCustom(false);
    if (file) {
      const preset = COMPRESSION_PRESETS.find((p) => p.id === presetId);
      if (preset) {
        handleCompress(file, preset.scale, preset.quality);
      }
    }
  };

  const handleApplyCustom = () => {
    if (file) {
      handleCompress(file, customScale, customQuality / 100);
    }
  };

  const handleDownloadCompressed = () => {
    if (!compressedBlob || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const outName = `${baseName}-compressed.pdf`;
    const url = URL.createObjectURL(compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    if (previewPageUrl) URL.revokeObjectURL(previewPageUrl);
    setFile(null);
    setCompressedBlob(null);
    setPreviewPageUrl(null);
    setErrorMessage('');
    setProgressPercent(0);
  };

  // Compute savings
  const savedBytes = file && compressedBlob ? file.size - compressedBlob.size : 0;
  const savedPercent = file && compressedBlob ? Math.round((savedBytes / file.size) * 100) : 0;

  if (!file) {
    return (
      <ToolHeroView
        title="Compress PDF"
        toolPath="/compress-pdf"
        badge="In-Memory Optimization"
        badgeIcon={FiMinimize2}
        description="Reduce PDF file sizes dramatically with local WebAssembly and Canvas optimization while maintaining crisp visual clarity."
        acceptedFormats={['PDF']}
        allowMultiple={false}
        accept={{ 'application/pdf': ['.pdf'] }}
        onFilesSelected={handleFiles}
        alerts={errorMessage && (
          <AlertBanner
            message={errorMessage}
            type="error"
            onClose={() => setErrorMessage('')}
          />
        )}
      />
    );
  }

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
        toolTitle="Compress PDF Studio"
        toolPath="/compress-pdf"
        fileCount={1}
        primaryAction={
          compressedBlob
            ? {
                label: `Download Optimized PDF (${formatFileSize(compressedBlob.size)})`,
                icon: <FiDownload size={16} />,
                onClick: handleDownloadCompressed,
              }
            : {
                label: isProcessing ? (progressMsg || 'Optimizing...') : 'Compress & Optimize PDF',
                icon: <FiMinimize2 size={16} />,
                onClick: () => {
                  const preset = COMPRESSION_PRESETS.find((p) => p.id === selectedPreset) || COMPRESSION_PRESETS[1];
                  const scale = useCustom ? customScale : preset.scale;
                  const quality = useCustom ? customQuality / 100 : preset.quality;
                  handleCompress(file, scale, quality);
                },
                disabled: isProcessing,
                loading: isProcessing,
              }
        }
        onReset={handleReset}
        resetLabel="Change File"
      />

      {errorMessage && (
        <div style={{ marginBottom: '0.75rem' }}>
          <AlertBanner
            message={errorMessage}
            type="error"
            onClose={() => setErrorMessage('')}
          />
        </div>
      )}

      {/* Two-column studio grid */}
      <div
        className="studio-grid"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          gap: '1.25rem',
          overflow: 'hidden',
        }}
      >
        {/* Left: Preview & Metrics */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.25rem',
            boxSizing: 'border-box',
          }}
        >
          {/* Header info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(28, 153, 255, 0.1)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiFileText size={18} />
              </div>
              <div>
                <span style={{ fontWeight: 700, color: 'var(--text-color)', fontSize: '0.95rem', display: 'block' }}>
                  {file.name}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Original: {formatFileSize(file.size)} • {numPages} {numPages === 1 ? 'Page' : 'Pages'}
                </span>
              </div>
            </div>

            {compressedBlob && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(46, 213, 115, 0.12)', color: '#2ed573', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
                <FiCheckCircle size={14} />
                <span>{savedPercent > 0 ? `Reduced by ${savedPercent}%` : 'Optimized'}</span>
              </div>
            )}
          </div>

          {/* Live Document Preview Canvas */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--subtle-bg)',
              borderRadius: '8px',
              padding: '1.25rem',
              border: '1px solid var(--border-color)',
              position: 'relative',
              marginTop: '0.75rem',
              overflow: 'hidden',
            }}
          >
            {previewPageUrl ? (
              <img
                src={previewPageUrl}
                alt="Page 1 Preview"
                style={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  borderRadius: '6px',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
                  border: '1px solid var(--border-color)',
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', maxWidth: '280px' }}>
                <FiFileText size={48} style={{ color: 'var(--primary-color)', marginBottom: '0.75rem' }} />
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-color)', fontWeight: 600 }}>
                  {isProcessing ? progressMsg || 'Optimizing pages...' : 'Loading document preview...'}
                </p>
                {isProcessing && progressPercent > 0 && (
                  <div style={{ width: '100%', height: '6px', background: 'var(--border-color)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--primary-color)', transition: 'width 0.2s ease' }} />
                  </div>
                )}
              </div>
            )}

            {previewPageUrl && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Page 1 of {numPages} • Live In-Memory Preview
              </div>
            )}
          </div>

          {/* Output Reduction Comparison Bar */}
          {compressedBlob && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '0.75rem' }}>
              <div style={{ background: 'var(--subtle-bg)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>Original</span>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-color)' }}>{formatFileSize(file.size)}</span>
              </div>

              <div style={{ background: 'rgba(46, 213, 115, 0.08)', padding: '0.75rem', borderRadius: '8px', border: '1px solid #2ed573', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: '#2ed573', fontWeight: 600, display: 'block' }}>Compressed</span>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#2ed573' }}>{formatFileSize(compressedBlob.size)}</span>
              </div>

              <div style={{ background: 'rgba(28, 153, 255, 0.08)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--primary-color)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--primary-color)', fontWeight: 600, display: 'block' }}>Savings</span>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                  {savedPercent > 0 ? `-${savedPercent}%` : 'Done'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Settings & Presets */}
        <div
          style={{
            height: '100%',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.25rem',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FiSliders /> Compression Presets
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(28, 153, 255, 0.12)', color: 'var(--primary-color)' }}>
              {useCustom ? 'Custom' : 'Preset'}
            </span>
          </div>

          {/* Preset Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {COMPRESSION_PRESETS.map((p) => {
              const isSelected = !useCustom && selectedPreset === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handleApplyPreset(p.id)}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '10px',
                    border: `1.5px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`,
                    background: isSelected ? 'rgba(28, 153, 255, 0.08)' : 'var(--subtle-bg)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: isSelected ? 'var(--primary-color)' : 'var(--text-color)' }}>
                      {p.title}
                    </span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '4px', background: isSelected ? 'var(--primary-color)' : 'var(--border-color)', color: isSelected ? '#fff' : 'var(--text-secondary)' }}>
                      {p.badge}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {p.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Custom Sliders Toggle */}
          <div style={{ background: 'var(--subtle-bg)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-color)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useCustom}
                onChange={(e) => setUseCustom(e.target.checked)}
              />
              <span>Fine-Tuned Custom Sliders</span>
            </label>

            {useCustom && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>JPEG Quality:</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-color)' }}>{customQuality}%</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="95"
                    value={customQuality}
                    onChange={(e) => setCustomQuality(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Resolution Scale:</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-color)' }}>{customScale}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.75"
                    max="2.0"
                    step="0.25"
                    value={customScale}
                    onChange={(e) => setCustomScale(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleApplyCustom}
                  disabled={isProcessing}
                  style={{
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    background: 'var(--primary-color)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    alignSelf: 'flex-start',
                  }}
                >
                  Apply Custom Settings
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
