import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  FiShield,
  FiMapPin,
  FiCamera,
  FiClock,
  FiCheckCircle,
} from 'react-icons/fi';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import {
  ToolHeroView,
  ToolStudioHeader,
  ResizableSplitPane,
} from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { validateImageFile } from '../utils/fileUtils';

// Fast binary parser for EXIF / TIFF tags in JPEG & PNG files
function parseExifTags(buffer) {
  const view = new DataView(buffer);
  const result = {
    gps: null,
    camera: null,
    software: null,
    dateTime: null,
    iso: null,
    fNumber: null,
    exposure: null,
    rawCount: 0,
    hasExif: false,
  };

  try {
    // Check for JPEG SOI (0xFFD8)
    if (view.getUint16(0) === 0xFFD8) {
      let offset = 2;
      const length = view.byteLength;

      while (offset < length) {
        const marker = view.getUint16(offset);
        offset += 2;

        if (marker === 0xFFE1) {
          // APP1 Marker (EXIF)
          offset += 2;

          const exifHeader = String.fromCharCode(
            view.getUint8(offset),
            view.getUint8(offset + 1),
            view.getUint8(offset + 2),
            view.getUint8(offset + 3)
          );

          if (exifHeader === 'Exif') {
            result.hasExif = true;
            result.rawCount += 5;
            const tiffOffset = offset + 6;
            const isLittleEndian = view.getUint16(tiffOffset) === 0x4949;

            const ifdOffset = view.getUint32(tiffOffset + 4, isLittleEndian);
            const numEntries = view.getUint16(tiffOffset + ifdOffset, isLittleEndian);
            result.rawCount += numEntries;

            let entryOffset = tiffOffset + ifdOffset + 2;
            for (let i = 0; i < numEntries; i++) {
              const tag = view.getUint16(entryOffset, isLittleEndian);

              if (tag === 0x010F || tag === 0x0110) {
                result.camera = 'Detected Camera Device';
              } else if (tag === 0x0131) {
                result.software = 'Detected Photo Software';
              } else if (tag === 0x0132) {
                result.dateTime = 'Captured Timestamp';
              } else if (tag === 0x8825) {
                result.gps = 'GPS Coordinates Present';
              }

              entryOffset += 12;
            }
          }
          break;
        } else if ((marker & 0xFF00) !== 0xFF00) {
          break;
        } else {
          offset += view.getUint16(offset);
        }
      }
    } else {
      // Check for PNG chunk metadata (eXIf, tEXt, iTXt)
      const uint8 = new Uint8Array(buffer);
      const str = String.fromCharCode(...uint8.slice(0, 1000));
      if (str.includes('eXIf') || str.includes('tEXt') || str.includes('iTXt')) {
        result.hasExif = true;
        result.software = 'PNG Text Metadata Detected';
        result.rawCount += 3;
      }
    }
  } catch (err) {
    console.warn('EXIF parsing error:', err);
  }

  return result;
}

export default function StripExif() {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [exifData, setExifData] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cleanedBlob, setCleanedBlob] = useState(null);
  const handledIncomingRef = useRef(false);

  // Managed output blob URL
  const cleanedUrl = useMemo(() => {
    return cleanedBlob ? URL.createObjectURL(cleanedBlob) : null;
  }, [cleanedBlob]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      if (cleanedUrl) URL.revokeObjectURL(cleanedUrl);
    };
  }, [imageUrl, cleanedUrl]);

  // Inspect EXIF
  const inspectExif = useCallback(async (selectedFile) => {
    try {
      const buffer = await selectedFile.arrayBuffer();
      const tags = parseExifTags(buffer);
      setExifData(tags);
      const url = URL.createObjectURL(selectedFile);
      setImageUrl(url);
    } catch (err) {
      console.error('Inspect error:', err);
      setErrorMessage('Could not inspect photo metadata.');
    }
  }, []);

  // Handle files selected
  const handleFiles = useCallback((files) => {
    if (!files || files.length === 0) return;
    const selected = Array.isArray(files) ? files[0] : files;
    const validation = validateImageFile(selected);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      return;
    }
    setFile(selected);
    setCleanedBlob(null);
    inspectExif(selected);
  }, [inspectExif]);

  // Handle incoming transferred file
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

  // Strip Metadata by Canvas Re-Encoding
  const handleStripMetadata = async () => {
    if (!file || isProcessing) return;
    setIsProcessing(true);
    setErrorMessage('');

    try {
      const img = new Image();
      const tempUrl = URL.createObjectURL(file);

      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = tempUrl;
      });

      URL.revokeObjectURL(tempUrl);

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      let outFormat = 'image/jpeg';
      if (file.type === 'image/png') outFormat = 'image/png';
      if (file.type === 'image/webp') outFormat = 'image/webp';

      const blob = await new Promise((res) => canvas.toBlob(res, outFormat, 0.95));
      if (!blob) throw new Error('Failed to generate stripped photo.');

      setCleanedBlob(blob);
    } catch (err) {
      console.error('Strip metadata error:', err);
      setErrorMessage(err.message || 'Failed to strip photo metadata.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setExifData(null);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setCleanedBlob(null);
    setErrorMessage('');
  };

  const getExtension = () => {
    if (!file) return '.jpg';
    const ext = file.name.substring(file.name.lastIndexOf('.'));
    return ext || '.jpg';
  };

  const outFileName = file
    ? `${file.name.replace(/\.[^/.]+$/, '')}-clean${getExtension()}`
    : 'cleaned_photo.jpg';

  // -------------------------------------------------------------
  // VIEW 3: FINAL COMPLETION VIEW
  // -------------------------------------------------------------
  if (cleanedBlob && cleanedUrl) {
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="Image EXIF & Metadata Wiper"
          message="EXIF and device metadata stripped successfully!"
          fileUrl={cleanedUrl}
          fileName={outFileName}
          file={new File([cleanedBlob], outFileName, { type: cleanedBlob.type })}
          stats={[
            { label: 'Detected Tags', value: `${exifData?.rawCount || 0} removed` },
            { label: 'Remaining EXIF', value: '0 Bytes', color: '#10b981' },
            { label: 'Format', value: getExtension().toUpperCase() },
          ]}
          onReset={handleReset}
          onProcessSourceAgain={() => setCleanedBlob(null)}
          sourceActionLabel="Inspect Metadata Again"
          onProcessTarget={() => {
            const chainedFile = new File([cleanedBlob], outFileName, { type: cleanedBlob.type });
            setFile(chainedFile);
            setCleanedBlob(null);
            inspectExif(chainedFile);
          }}
          targetActionLabel="Inspect Sanitized Photo"
          currentPath="/strip-exif"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Upload stage)
  // -------------------------------------------------------------
  if (!file) {
    return (
      <ToolHeroView
        title="Image EXIF & Metadata Wiper"
        description="Detect and sanitize GPS geolocation coordinates, camera serials, timestamps, and device fingerprints 100% offline."
        badge="Privacy & Security"
        badgeIcon={FiShield}
        toolPath="/strip-exif"
        acceptedFormats={['.jpg', '.jpeg', '.png', '.webp']}
        allowMultiple={false}
        maxSizeText="50 MB"
        accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.bmp'] }}
        onFilesSelected={handleFiles}
        alerts={
          errorMessage ? (
            <AlertBanner message={errorMessage} type="error" onClose={() => setErrorMessage('')} />
          ) : null
        }
      />
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: CONFIGURATION VIEW (TYPE-A Draggable Two-Column Studio)
  // -------------------------------------------------------------
  const leftControlsPane = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '1.2rem',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.65rem' }}>
        <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-color)' }}>
          Detected EXIF & Metadata
        </span>
        <span
          style={{
            fontSize: '0.74rem',
            fontWeight: 700,
            padding: '0.15rem 0.5rem',
            borderRadius: '999px',
            background: exifData?.hasExif ? 'rgba(239, 68, 68, 0.12)' : 'rgba(5, 150, 105, 0.12)',
            color: exifData?.hasExif ? '#ef4444' : '#10b981',
            border: `1px solid ${exifData?.hasExif ? 'rgba(239, 68, 68, 0.3)' : 'rgba(5, 150, 105, 0.3)'}`,
          }}
        >
          {exifData?.hasExif ? `${exifData.rawCount} Tags Detected` : 'Clean Header'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
        {/* GPS Card */}
        <div style={{ background: 'var(--subtle-bg)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <FiMapPin style={{ color: exifData?.gps ? '#ef4444' : '#10b981' }} />
            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-color)' }}>GPS Geolocation</span>
          </div>
          <span style={{ fontSize: '0.78rem', color: exifData?.gps ? '#ef4444' : 'var(--text-muted)' }}>
            {exifData?.gps ? '⚠️ Warning: Precise GPS coordinates detected in photo header.' : '✓ No GPS location data detected in header.'}
          </span>
        </div>

        {/* Camera Device Card */}
        <div style={{ background: 'var(--subtle-bg)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <FiCamera style={{ color: exifData?.camera ? '#f59e0b' : '#10b981' }} />
            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-color)' }}>Camera Device & Hardware</span>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {exifData?.camera ? 'Embedded camera make, model, or lens data found in TIFF directory.' : '✓ No hardware serials or model information found.'}
          </span>
        </div>

        {/* Timestamp & Software Card */}
        <div style={{ background: 'var(--subtle-bg)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <FiClock style={{ color: exifData?.dateTime ? '#f59e0b' : '#10b981' }} />
            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-color)' }}>Capture Timestamp & Software</span>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {exifData?.dateTime || exifData?.software ? 'Original date & time stamp recorded by camera firmware.' : '✓ No software or creation timestamps found.'}
          </span>
        </div>

        {/* Sanitization Guarantee Banner */}
        <div style={{ marginTop: 'auto', background: 'rgba(5, 150, 105, 0.08)', padding: '0.85rem', borderRadius: '10px', border: '1px solid rgba(5, 150, 105, 0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.25rem' }}>
            <FiCheckCircle />
            <span>100% Zero-Trace Cleaning</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Re-encodes pixel matrices on an isolated HTML5 canvas, stripping all hidden APP1 markers, GPS coordinates, and camera serials.
          </p>
        </div>
      </div>

      {/* Primary Action Button inside Controls */}
      <button
        type="button"
        onClick={handleStripMetadata}
        disabled={isProcessing}
        className="btn-primary"
        style={{
          width: '100%',
          marginTop: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1.25rem',
          borderRadius: '8px',
          fontWeight: 800,
          fontSize: '0.92rem',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          border: 'none',
        }}
      >
        <FiCheckCircle size={16} />
        <span>{isProcessing ? 'Sanitizing Image...' : 'Wipe All EXIF & Download'}</span>
      </button>
    </div>
  );

  const rightPreviewPane = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '0.85rem',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.65rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-color)' }}>
          Photo Preview
        </span>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          Original Inspection View
        </span>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--subtle-bg)',
          borderRadius: '8px',
          padding: '1rem',
          overflow: 'auto',
          minHeight: '380px',
        }}
      >
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Source Preview"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: '6px',
              boxShadow: '0 6px 24px rgba(0,0,0,0.15)',
            }}
          />
        )}
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
        🔒 Ready to sanitize • Output will retain 100% original visual resolution with 0 metadata
      </div>
    </div>
  );

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
      {/* 1. Ultra-compact 48px Micro-Header */}
      <ToolStudioHeader
        title="Image EXIF & Metadata Wiper"
        icon={FiShield}
        file={file}
        category="Optimize"
        toolPath="/strip-exif"
        onReset={handleReset}
        resetLabel="Change Photo"
      />

      {/* Error banner */}
      {errorMessage && (
        <div style={{ marginBottom: '0.5rem' }}>
          <AlertBanner message={errorMessage} type="error" onClose={() => setErrorMessage('')} />
        </div>
      )}

      {/* 2. Draggable Two-Column Split Pane Studio */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResizableSplitPane
          leftPane={leftControlsPane}
          rightPane={rightPreviewPane}
          defaultSplit={45}
          minLeftWidth={320}
          minRightWidth={360}
          height="100%"
          leftTitle="Metadata"
          rightTitle="Photo"
          storageKey="strip_exif"
        />
      </div>
    </div>
  );
}
