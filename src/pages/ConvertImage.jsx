import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { FiImage, FiSettings, FiCheck } from 'react-icons/fi';
import Loader from '../components/Loader';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import { formatFileSize } from '../utils/fileUtils';
import { consumeTransferredFile } from '../utils/fileTransfer';

const ConvertImage = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const [originalFile, setOriginalFile] = useState(null);
  const [originalPreview, setOriginalPreview] = useState(null);
  
  // Settings State
  const [targetFormat, setTargetFormat] = useState('image/png');
  const [quality, setQuality] = useState(0.9);
  const [errorMessage, setErrorMessage] = useState(null);
  
  // Result State
  const [convertedFileUrl, setConvertedFileUrl] = useState(null);
  const [convertedBlob, setConvertedBlob] = useState(null);

  const canvasRef = useRef(null);
  const originalPreviewRef = useRef(null);
  const convertedFileUrlRef = useRef(null);
  const handledRef = useRef(false);

  const formatOptions = [
    { label: 'PNG', value: 'image/png', ext: '.png', supportsQuality: false },
    { label: 'JPG', value: 'image/jpeg', ext: '.jpg', supportsQuality: true },
    { label: 'WebP', value: 'image/webp', ext: '.webp', supportsQuality: true },
    { label: 'BMP', value: 'image/bmp', ext: '.bmp', supportsQuality: false },
  ];

  const selectedFormatConfig = formatOptions.find(f => f.value === targetFormat) || formatOptions[0];

  useEffect(() => {
    originalPreviewRef.current = originalPreview;
  }, [originalPreview]);

  useEffect(() => {
    convertedFileUrlRef.current = convertedFileUrl;
  }, [convertedFileUrl]);

  // Clean up object URLs only when this tool unmounts
  useEffect(() => {
    return () => {
      if (originalPreviewRef.current) URL.revokeObjectURL(originalPreviewRef.current);
      if (convertedFileUrlRef.current) URL.revokeObjectURL(convertedFileUrlRef.current);
    };
  }, []);

  const handleFileLoad = useCallback((files) => {
    if (loadingRef.current) return;
    setErrorMessage(null);

    if (!files || files.length !== 1) {
      setErrorMessage("Please upload exactly one image to convert.");
      return;
    }

    const file = files[0];
    setOriginalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setConvertedFileUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    setOriginalFile(file);
    setConvertedBlob(null);
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

  const handleConvert = () => {
    if (loading || !originalPreview) return;
    setErrorMessage(null);
    setLoading(true);

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      canvas.width = img.width;
      canvas.height = img.height;

      // Handle transparency for formats that don't support alpha
      if (targetFormat === 'image/jpeg' || targetFormat === 'image/bmp') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setErrorMessage("Conversion failed. Your browser might not natively support encoding this format.");
            setLoading(false);
            return;
          }

          if (convertedFileUrl) URL.revokeObjectURL(convertedFileUrl);
          const url = URL.createObjectURL(blob);
          setConvertedFileUrl(url);
          setConvertedBlob(blob);
          setLoading(false);
        },
        targetFormat,
        selectedFormatConfig.supportsQuality ? quality : undefined
      );
    };

    img.onerror = () => {
      setErrorMessage("Failed to load and parse image content.");
      setLoading(false);
    };

    img.src = originalPreview;
  };

  const handleReset = () => {
    if (convertedFileUrl) URL.revokeObjectURL(convertedFileUrl);
    if (originalPreview) URL.revokeObjectURL(originalPreview);
    setOriginalFile(null);
    setOriginalPreview(null);
    setConvertedFileUrl(null);
    setConvertedBlob(null);
    setTargetFormat('image/png');
    setQuality(0.9);
    setErrorMessage(null);
  };

  // -------------------------------------------------------------
  // VIEW 3: COMPLETION VIEW
  // -------------------------------------------------------------
  if (convertedFileUrl && originalFile && convertedBlob) {
    const outFileName = `converted_${originalFile.name.replace(/\.[^/.]+$/, "")}${selectedFormatConfig.ext}`;
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="Convert Image"
          message={`Image successfully converted to ${selectedFormatConfig.label}!`}
          fileUrl={convertedFileUrl}
          fileName={outFileName}
          file={new File([convertedBlob], outFileName, { type: targetFormat })}
          onReset={handleReset}
          onProcessSourceAgain={() => {
            if (convertedFileUrl) URL.revokeObjectURL(convertedFileUrl);
            setConvertedFileUrl(null);
            setConvertedBlob(null);
          }}
          sourceActionLabel="Convert Source Again"
          onProcessTarget={() => {
            const chained = new File([convertedBlob], outFileName, { type: targetFormat });
            if (convertedFileUrl) URL.revokeObjectURL(convertedFileUrl);
            setConvertedFileUrl(null);
            setConvertedBlob(null);
            handleFileLoad([chained]);
          }}
          targetActionLabel="Convert Output Image Again"
          currentPath="/convert-image"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Empty State)
  // -------------------------------------------------------------
  if (!originalFile) {
    return (
      <ToolHeroView
        title="Convert Image Format"
        description="Convert images between PNG, JPG, WebP, and BMP directly in your browser with zero server uploads."
        badge="Image Studio"
        badgeIcon={FiImage}
        toolPath="/convert-image"
        acceptedFormats={['.png', '.jpg', '.jpeg', '.webp', '.bmp']}
        allowMultiple={false}
        maxSizeText="50 MB"
        accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.bmp'] }}
        onFilesSelected={handleFileLoad}
        alerts={
          errorMessage ? (
            <AlertBanner
              message={errorMessage}
              type="error"
              onClose={() => setErrorMessage(null)}
            />
          ) : null
        }
      />
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: STUDIO CONFIGURATION VIEW
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
        overflow: 'hidden'
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <ToolStudioHeader
        toolTitle="Convert Image"
        fileBadge={`${originalFile.name} (${formatFileSize(originalFile.size)})`}
        onBack={handleReset}
        backLabel="Choose Another Image"
        primaryAction={{
          label: loading ? 'Converting...' : `Convert to ${selectedFormatConfig.label}`,
          icon: FiSettings,
          onClick: handleConvert,
          disabled: loading,
          loading
        }}
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1rem 0' }}>
        {errorMessage && (
          <div style={{ maxWidth: '1200px', margin: '0 auto 1rem auto' }}>
            <AlertBanner
              message={errorMessage}
              type="error"
              onClose={() => setErrorMessage(null)}
            />
          </div>
        )}

        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 420px) minmax(350px, 1fr)',
            gap: '1.5rem',
            alignItems: 'start'
          }}
        >
          {/* Left Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                background: 'var(--card-bg, #1e293b)',
                border: '1px solid var(--border-color, #334155)',
                borderRadius: '16px',
                padding: '1.5rem'
              }}
            >
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-color)' }}>
                Target Output Format
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {formatOptions.map((fmt) => {
                  const isSelected = targetFormat === fmt.value;
                  return (
                    <button
                      key={fmt.value}
                      type="button"
                      onClick={() => setTargetFormat(fmt.value)}
                      disabled={loading}
                      style={{
                        padding: '0.85rem',
                        borderRadius: '10px',
                        border: `2px solid ${isSelected ? 'var(--primary-color, #6366f1)' : 'var(--border-color, #334155)'}`,
                        background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-color, #0f172a)',
                        color: 'var(--text-color)',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'border-color 0.2s'
                      }}
                    >
                      <span>{fmt.label}</span>
                      {isSelected && <FiCheck style={{ color: 'var(--primary-color, #6366f1)' }} />}
                    </button>
                  );
                })}
              </div>

              {selectedFormatConfig.supportsQuality && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-secondary, #94a3b8)' }}>
                    <span>Compression Quality</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>{Math.round(quality * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={quality}
                    onChange={(e) => setQuality(parseFloat(e.target.value))}
                    disabled={loading}
                    style={{ width: '100%', accentColor: 'var(--primary-color, #6366f1)' }}
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)', display: 'block', marginTop: '0.35rem' }}>
                    Lower quality produces smaller file size.
                  </span>
                </div>
              )}

              {targetFormat === 'image/jpeg' && (
                <div
                  style={{
                    padding: '0.85rem',
                    borderRadius: '8px',
                    background: 'rgba(234, 179, 8, 0.1)',
                    border: '1px solid rgba(234, 179, 8, 0.25)',
                    fontSize: '0.82rem',
                    color: 'var(--text-color)',
                    lineHeight: 1.45
                  }}
                >
                  ⚠️ <strong>Transparency Note:</strong> JPG does not support transparency. Transparent areas will render on a solid white background.
                </div>
              )}

              {targetFormat === 'image/bmp' && (
                <div
                  style={{
                    padding: '0.85rem',
                    borderRadius: '8px',
                    background: 'rgba(99, 102, 241, 0.1)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    fontSize: '0.82rem',
                    color: 'var(--text-color)',
                    lineHeight: 1.45
                  }}
                >
                  ℹ️ <strong>Browser Limitation:</strong> Canvas does not support native BMP encoding in all browsers; output may fall back to lossless PNG.
                </div>
              )}
            </div>
          </div>

          {/* Right Preview */}
          <div
            style={{
              background: 'var(--card-bg, #1e293b)',
              border: '1px solid var(--border-color, #334155)',
              borderRadius: '16px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
            }}
          >
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-color)', alignSelf: 'flex-start', marginBottom: '0.75rem' }}>
              Original Image Preview
            </span>
            <div
              style={{
                width: '100%',
                maxHeight: 'calc(100vh - 250px)',
                overflow: 'auto',
                background: 'var(--bg-color, #0f172a)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid var(--border-color, #334155)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <img
                src={originalPreview}
                alt="Source preview"
                style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: '6px' }}
              />
            </div>
          </div>
        </div>
      </div>

      <Loader isLoading={loading} phrases={["Reading pixel data...", "Re-encoding image format...", "Finalizing binary stream..."]} />
    </div>
  );
};

export default ConvertImage;
