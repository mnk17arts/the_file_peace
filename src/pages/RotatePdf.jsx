import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { PDFDocument, degrees } from 'pdf-lib';
import { FiRotateCw, FiRotateCcw, FiDownload } from 'react-icons/fi';
import Loader from '../components/Loader';
import ActionCompleted from '../components/ActionCompleted';
import AlertBanner from '../components/AlertBanner';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';

const RotatePdf = () => {
  const location = useLocation();
  const [selectedFile, setSelectedFile] = useState(null);
  const [rotationAngle, setRotationAngle] = useState(0);
  
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const [isCompleted, setIsCompleted] = useState(false);
  const [resultFileUrl, setResultFileUrl] = useState(null);
  const [resultBlob, setResultBlob] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const resultUrlRef = useRef(null);
  const handledRef = useRef(false);

  useEffect(() => {
    resultUrlRef.current = resultFileUrl;
  }, [resultFileUrl]);

  const rotatePhrases = [
    "Flipping things around...",
    "Adjusting the gravity...",
    "Realigning the pixels..."
  ];

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  // Step 1: Handle File Upload
  const handleFileLoad = useCallback((files) => {
    if (loadingRef.current) return;
    setErrorMessage(null);

    if (!files || files.length !== 1) {
      setErrorMessage("Please upload exactly one PDF to rotate.");
      return;
    }

    const file = files[0];
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage("Please select a valid PDF file (.pdf).");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setErrorMessage("File size exceeds 100 MB limit. Please select a smaller PDF.");
      return;
    }

    setResultFileUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setResultBlob(null);
    setIsCompleted(false);
    setSelectedFile(file);
    setRotationAngle(0);
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

  const handleRotateLeft = () => {
    setRotationAngle((prev) => (prev - 90) % 360);
  };

  const handleRotateRight = () => {
    setRotationAngle((prev) => (prev + 90) % 360);
  };

  // Step 2: Apply the rotation to the actual PDF
  const handleApplyRotation = async () => {
    if (loading || !selectedFile) return;
    setErrorMessage(null);

    if (rotationAngle % 360 === 0) {
      setErrorMessage("Please rotate the document at least 90° before applying.");
      return;
    }

    setLoading(true);

    try {
      const arrayBuffer = await selectedFile.slice(0).arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const pages = pdf.getPages();

      // Loop through every page and add the selected rotation
      pages.forEach((page) => {
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees(currentRotation + rotationAngle));
      });

      const pdfBytes = await pdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      
      if (resultFileUrl) URL.revokeObjectURL(resultFileUrl);
      const url = URL.createObjectURL(blob);
      setResultBlob(blob);
      setResultFileUrl(url);
      setIsCompleted(true);

    } catch (error) {
      console.error("Error rotating PDF:", error);
      setErrorMessage("Failed to rotate the document. The PDF may be password-protected or corrupted.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (resultFileUrl) URL.revokeObjectURL(resultFileUrl);
    setIsCompleted(false);
    setSelectedFile(null);
    setResultFileUrl(null);
    setResultBlob(null);
    setRotationAngle(0);
    setErrorMessage(null);
  };

  // -------------------------------------------------------------
  // VIEW 3: FINAL COMPLETION VIEW
  // -------------------------------------------------------------
  if (isCompleted && resultFileUrl && selectedFile) {
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="Rotate PDF"
          message="Your PDF has been rotated successfully!"
          fileUrl={resultFileUrl}
          fileName={`rotated_${selectedFile.name}`}
          file={resultBlob}
          onReset={handleReset}
          onProcessSourceAgain={() => {
            setResultFileUrl(null);
            setResultBlob(null);
            setIsCompleted(false);
          }}
          sourceActionLabel="Rotate Original Again"
          onProcessTarget={() => {
            const chained = new File([resultBlob], `rotated_${selectedFile.name}`, { type: 'application/pdf' });
            setSelectedFile(chained);
            setResultFileUrl(null);
            setResultBlob(null);
            setIsCompleted(false);
            setRotationAngle(0);
          }}
          targetActionLabel="Rotate Output Again"
          currentPath="/rotate-pdf"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Empty state)
  // -------------------------------------------------------------
  if (!selectedFile && !isCompleted) {
    return (
      <ToolHeroView
        title="Rotate PDF"
        description="Permanently rotate all pages inside your PDF document clockwise or counter-clockwise."
        badge="Organize PDF"
        badgeIcon={FiRotateCw}
        toolPath="/rotate-pdf"
        acceptedFormats={['.pdf']}
        allowMultiple={false}
        maxSizeText="100 MB"
        accept={{ 'application/pdf': ['.pdf'] }}
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
  // VIEW 2: CONFIGURATION VIEW (Studio Archetype)
  // -------------------------------------------------------------
  const normalizedAngle = ((rotationAngle % 360) + 360) % 360;

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
        title="Rotate PDF"
        icon={FiRotateCw}
        file={selectedFile}
        category="Organize PDF"
        toolPath="/rotate-pdf"
        onReset={handleReset}
        resetLabel="Change PDF"
        actionButton={
          <button
            type="button"
            onClick={handleApplyRotation}
            disabled={loading || normalizedAngle === 0}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: loading || normalizedAngle === 0 ? 'not-allowed' : 'pointer',
              opacity: normalizedAngle === 0 ? 0.6 : 1,
            }}
          >
            <FiDownload size={14} /> {loading ? 'Applying...' : 'Apply & Save Rotation'}
          </button>
        }
      />

      {errorMessage && (
        <div style={{ margin: '0.5rem 0' }}>
          <AlertBanner message={errorMessage} type="error" onClose={() => setErrorMessage(null)} />
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1rem 0', display: 'flex', justifyContent: 'center' }}>
        <div style={{ maxWidth: '580px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Quick Rotation Buttons */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.6rem' }}>
              CHOOSE ROTATION ANGLE
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {[
                { label: '0° (Original)', angle: 0 },
                { label: '+90° (Right)', angle: 90 },
                { label: '180° (Flip)', angle: 180 },
                { label: '270° (Left)', angle: 270 },
              ].map((item) => (
                <button
                  key={item.angle}
                  type="button"
                  onClick={() => setRotationAngle(item.angle)}
                  style={{
                    padding: '0.6rem 0.2rem',
                    borderRadius: '8px',
                    border: normalizedAngle === item.angle ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                    background: normalizedAngle === item.angle ? 'rgba(28, 153, 255, 0.12)' : 'var(--subtle-bg)',
                    color: normalizedAngle === item.angle ? 'var(--primary-color)' : 'var(--text-color)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Document Orientation Box */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.75rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '1rem' }}>
              LIVE ORIENTATION PREVIEW
            </span>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '170px' }}>
              <div
                style={{
                  width: '90px',
                  height: '125px',
                  backgroundColor: 'var(--primary-color)',
                  color: 'white',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 4px',
                  borderRadius: '6px',
                  boxShadow: '0 8px 24px rgba(28, 153, 255, 0.35)',
                  fontWeight: 'bold',
                  fontSize: '0.8rem',
                  letterSpacing: '1px',
                  transform: `rotate(${rotationAngle}deg)`,
                  transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxSizing: 'border-box',
                }}
              >
                <span>TOP</span>
                <span style={{ fontSize: '1.1rem' }}>📄</span>
                <span>BOTTOM</span>
              </div>
            </div>

            <p style={{ margin: '1rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-color)', fontWeight: 600 }}>
              Applied Rotation: <strong style={{ color: 'var(--primary-color)' }}>{normalizedAngle}°</strong>
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={handleRotateLeft}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--subtle-bg)',
                  color: 'var(--text-color)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
                disabled={loading}
              >
                <FiRotateCcw size={14} /> Rotate -90°
              </button>
              <button
                type="button"
                onClick={handleRotateRight}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--subtle-bg)',
                  color: 'var(--text-color)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
                disabled={loading}
              >
                <FiRotateCw size={14} /> Rotate +90°
              </button>
            </div>
          </div>
        </div>
      </div>

      <Loader isLoading={loading} phrases={rotatePhrases} />
    </div>
  );
};



export default RotatePdf;
