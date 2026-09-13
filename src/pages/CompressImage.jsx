import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import imageCompression from 'browser-image-compression';
import { FiSliders, FiMinimize2 } from 'react-icons/fi';
import Loader from '../components/Loader';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import { formatFileSize, validateImageFile } from '../utils/fileUtils';
import { consumeTransferredFile } from '../utils/fileTransfer';

const CompressImage = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const [isCompleted, setIsCompleted] = useState(false);
  const [originalFile, setOriginalFile] = useState(null);
  const [compressedBlob, setCompressedBlob] = useState(null);
  const [compressedFileUrl, setCompressedFileUrl] = useState(null);
  const [stats, setStats] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [alertType, setAlertType] = useState('error');
  const isCancelledRef = useRef(false);
  const handledRef = useRef(false);
  
  // Quality slider (0.1 to 1.0)
  const [quality, setQuality] = useState(0.8);

  const compressedUrlRef = useRef(null);
  useEffect(() => {
    compressedUrlRef.current = compressedFileUrl;
  }, [compressedFileUrl]);

  const compressPhrases = [
    "Squeezing the pixels...",
    "Optimizing color profiles...",
    "Preserving fine details...",
    "Finalizing compression..."
  ];

  useEffect(() => {
    return () => {
      if (compressedUrlRef.current) URL.revokeObjectURL(compressedUrlRef.current);
    };
  }, []);

  const handleCancel = () => {
    isCancelledRef.current = true;
    setLoading(false);
    setAlertType('warning');
    setErrorMessage("Image compression was cancelled.");
  };

  const handleFileLoad = useCallback((files) => {
    if (loadingRef.current) return;
    setErrorMessage(null);

    if (!files || files.length !== 1) {
      setErrorMessage("Please upload exactly one image to compress.");
      return;
    }

    const file = files[0];
    const validation = validateImageFile(file, ['.png', '.jpg', '.jpeg', '.webp'], 50 * 1024 * 1024);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      return;
    }

    setCompressedFileUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCompressedBlob(null);
    setIsCompleted(false);
    setStats(null);
    setOriginalFile(file);
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

  const handleCompress = async () => {
    if (loading || !originalFile) return;
    setErrorMessage(null);
    setAlertType('error');
    isCancelledRef.current = false;
    setLoading(true);

    const options = {
      maxSizeMB: quality * 5,
      maxWidthOrHeight: 3840,
      useWebWorker: true,
      initialQuality: quality,
    };

    try {
      const resultBlob = await imageCompression(originalFile, options);
      
      if (isCancelledRef.current) return;

      const savedBytes = originalFile.size - resultBlob.size;
      const savedPercent = (((originalFile.size - resultBlob.size) / originalFile.size) * 100).toFixed(0);
      
      setStats({ 
        originalSize: originalFile.size, 
        newSize: resultBlob.size, 
        savedBytes,
        savedPercentage: Math.max(0, Number(savedPercent)) 
      });
      
      if (compressedFileUrl) URL.revokeObjectURL(compressedFileUrl);
      const url = URL.createObjectURL(resultBlob);
      setCompressedBlob(resultBlob);
      setCompressedFileUrl(url);
      setIsCompleted(true);

    } catch (error) {
      if (isCancelledRef.current) return;
      console.error("Error compressing image:", error);
      setAlertType('error');
      setErrorMessage("Failed to compress the image. The file may be corrupted or an unsupported format.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (compressedFileUrl) URL.revokeObjectURL(compressedFileUrl);
    setIsCompleted(false);
    setOriginalFile(null);
    setCompressedBlob(null);
    setCompressedFileUrl(null);
    setStats(null);
    setErrorMessage(null);
    setQuality(0.8);
  };

  // -------------------------------------------------------------
  // VIEW 3: ACTION COMPLETED
  // -------------------------------------------------------------
  if (isCompleted && stats && originalFile && compressedFileUrl) {
    const outFileName = `compressed_${originalFile.name}`;
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="Compress Image"
          message={`Image compressed successfully! Saved ${stats.savedPercentage}% (${formatFileSize(Math.max(0, stats.savedBytes))}). New size: ${formatFileSize(stats.newSize)}`}
          fileUrl={compressedFileUrl}
          fileName={outFileName}
          file={compressedBlob}
          onReset={handleReset}
          onProcessSourceAgain={() => {
            if (compressedFileUrl) URL.revokeObjectURL(compressedFileUrl);
            setCompressedFileUrl(null);
            setCompressedBlob(null);
            setIsCompleted(false);
            setStats(null);
          }}
          sourceActionLabel="Compress Source Again"
          onProcessTarget={() => {
            const chained = new File([compressedBlob], outFileName, { type: compressedBlob.type || originalFile.type });
            if (compressedFileUrl) URL.revokeObjectURL(compressedFileUrl);
            setCompressedFileUrl(null);
            setCompressedBlob(null);
            setIsCompleted(false);
            setStats(null);
            handleFileLoad([chained]);
          }}
          targetActionLabel="Compress Output Image"
          currentPath="/compress-image"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Empty state)
  // -------------------------------------------------------------
  if (!originalFile) {
    return (
      <ToolHeroView
        title="Compress Image"
        description="Reduce image file sizes directly in your browser with customized quality control and zero telemetry."
        badge="Image Studio"
        badgeIcon={FiMinimize2}
        toolPath="/compress-image"
        acceptedFormats={['.png', '.jpg', '.jpeg', '.webp']}
        allowMultiple={false}
        maxSizeText="50 MB"
        accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }}
        onFilesSelected={handleFileLoad}
        alerts={
          errorMessage ? (
            <AlertBanner
              message={errorMessage}
              type={alertType}
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
      <ToolStudioHeader
        toolTitle="Compress Image"
        fileBadge={`${originalFile.name} (${formatFileSize(originalFile.size)})`}
        onBack={handleReset}
        backLabel="Choose Another Image"
        primaryAction={{
          label: loading ? 'Compressing...' : 'Compress Image',
          icon: FiMinimize2,
          onClick: handleCompress,
          disabled: loading,
          loading
        }}
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.5rem 0' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {errorMessage && (
            <AlertBanner
              message={errorMessage}
              type={alertType}
              onClose={() => setErrorMessage(null)}
            />
          )}

          <div
            style={{
              background: 'var(--card-bg, #1e293b)',
              border: '1px solid var(--border-color, #334155)',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--primary-color, #6366f1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.3rem'
                }}
              >
                <FiSliders />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Compression Quality</h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.875rem', opacity: 0.75 }}>
                  Adjust target quality to balance file size against visual clarity.
                </p>
              </div>
            </div>

            {/* Quality Presets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.75rem' }}>
              {[
                { label: 'Low (60%)', value: 0.6, desc: 'Maximum Savings' },
                { label: 'Balanced (80%)', value: 0.8, desc: 'Recommended' },
                { label: 'High (95%)', value: 0.95, desc: 'Best Quality' }
              ].map((preset) => {
                const isSelected = Math.abs(quality - preset.value) < 0.05;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setQuality(preset.value)}
                    disabled={loading}
                    style={{
                      padding: '0.85rem 0.5rem',
                      borderRadius: '10px',
                      border: `2px solid ${isSelected ? 'var(--primary-color, #6366f1)' : 'var(--border-color, #334155)'}`,
                      background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-color, #0f172a)',
                      color: 'var(--text-color)',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{preset.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '0.25rem' }}>{preset.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Quality Slider */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>Target Quality</span>
                <span style={{ fontWeight: 700, color: 'var(--primary-color, #6366f1)' }}>{Math.round(quality * 100)}%</span>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '0.4rem' }}>
                <span>Smaller File</span>
                <span>Balanced</span>
                <span>Crisp Details</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.75rem' }}>
              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                style={{
                  padding: '0.75rem 1.25rem',
                  background: 'transparent',
                  border: '1px solid var(--border-color, #334155)',
                  borderRadius: '10px',
                  color: 'var(--text-color)',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCompress}
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--primary-color, #6366f1)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                <FiMinimize2 /> Compress Image
              </button>
            </div>
          </div>
        </div>
      </div>

      <Loader isLoading={loading} phrases={compressPhrases} onCancel={handleCancel} />
    </div>
  );
};

export default CompressImage;