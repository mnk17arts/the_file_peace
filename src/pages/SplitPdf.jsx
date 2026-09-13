import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { PDFDocument } from 'pdf-lib';
import { FiScissors, FiDownload, FiLayers } from 'react-icons/fi';
import Loader from '../components/Loader';
import ActionCompleted from '../components/ActionCompleted';
import AlertBanner from '../components/AlertBanner';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';

const SplitPdf = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const [isCompleted, setIsCompleted] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  const [resultFileUrl, setResultFileUrl] = useState(null);
  const [resultBlob, setResultBlob] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const resultUrlRef = useRef(null);
  useEffect(() => {
    resultUrlRef.current = resultFileUrl;
  }, [resultFileUrl]);

  const handledRef = useRef(false);

  const splitPhrases = [
    "Slicing the pages...",
    "Extracting page ranges...",
    "Creating your new PDF...",
    "Almost done..."
  ];

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  // Step 1: Read the file, calculate total pages, and show controls
  const handleFileLoad = useCallback(async (files) => {
    if (loadingRef.current) return;
    setErrorMessage(null);

    if (!files || files.length !== 1) {
      setErrorMessage("Please upload exactly one PDF file to split.");
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

    setLoading(true);

    try {
      const arrayBuffer = await file.slice(0).arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer.slice(0));
      const pageCount = pdf.getPageCount();

      setResultFileUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setResultBlob(null);
      setIsCompleted(false);

      setSelectedFile({
        file: file,
        name: file.name,
        arrayBuffer: arrayBuffer
      });
      setTotalPages(pageCount);
      setStartPage(1);
      setEndPage(pageCount);

    } catch (error) {
      console.error("Error reading PDF:", error);
      setErrorMessage("Failed to read the PDF. The file might be corrupted or password-protected.");
      setSelectedFile(null);
    } finally {
      setLoading(false);
    }
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

  // Step 2: Handle the actual splitting process
  const handleSplit = async () => {
    if (loading || !selectedFile) return;
    setErrorMessage(null);

    if (startPage < 1 || endPage > totalPages || startPage > endPage) {
      setErrorMessage(`Invalid page range. Please choose pages between 1 and ${totalPages}.`);
      return;
    }

    setLoading(true);

    try {
      // Load an isolated copy of the original PDF buffer
      const originalPdf = await PDFDocument.load(selectedFile.arrayBuffer.slice(0));
      
      // Create a new empty PDF
      const newPdf = await PDFDocument.create();

      // pdf-lib uses 0-based indexing
      const pageIndicesToCopy = [];
      for (let i = startPage - 1; i < endPage; i++) {
        pageIndicesToCopy.push(i);
      }

      // Copy the specific pages
      const copiedPages = await newPdf.copyPages(originalPdf, pageIndicesToCopy);
      copiedPages.forEach((page) => newPdf.addPage(page));

      // Save and generate URL
      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      if (resultFileUrl) URL.revokeObjectURL(resultFileUrl);
      const url = URL.createObjectURL(blob);
      
      setResultBlob(blob);
      setResultFileUrl(url);
      setIsCompleted(true);

    } catch (error) {
      console.error("Error splitting PDF:", error);
      setErrorMessage("Failed to split the document. Please verify the file integrity.");
    } finally {
      setLoading(false);
    }
  };

  const handleSplitSourceAgain = () => {
    if (resultFileUrl) URL.revokeObjectURL(resultFileUrl);
    setResultFileUrl(null);
    setResultBlob(null);
    setIsCompleted(false);
    setErrorMessage(null);
  };

  const handleReset = () => {
    if (resultFileUrl) URL.revokeObjectURL(resultFileUrl);
    setIsCompleted(false);
    setSelectedFile(null);
    setResultFileUrl(null);
    setResultBlob(null);
    setErrorMessage(null);
  };

  // -------------------------------------------------------------
  // VIEW 3: FINAL COMPLETION VIEW
  // -------------------------------------------------------------
  if (isCompleted && resultFileUrl && selectedFile) {
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="Split PDF"
          message={`Pages ${startPage} to ${endPage} have been extracted!`}
          fileUrl={resultFileUrl}
          fileName={`split_${selectedFile.name}`}
          file={resultBlob}
          onReset={handleReset}
          onProcessSourceAgain={handleSplitSourceAgain}
          sourceActionLabel="Split Original Source Again"
          onProcessTarget={() => {
            const chained = new File([resultBlob], `split_${selectedFile.name}`, { type: 'application/pdf' });
            setSelectedFile({ file: chained, name: chained.name, arrayBuffer: null });
            setIsCompleted(false);
            setResultFileUrl(null);
            setResultBlob(null);
            handleFileLoad([chained]);
          }}
          targetActionLabel="Split Output Again"
          currentPath="/split-pdf"
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
        title="Split PDF"
        description="Extract specific page ranges or burst pages into a new, standalone PDF document."
        badge="Organize PDF"
        badgeIcon={FiScissors}
        toolPath="/split-pdf"
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
        title="Split PDF"
        icon={FiScissors}
        file={selectedFile?.file}
        category="Organize PDF"
        toolPath="/split-pdf"
        onReset={handleReset}
        resetLabel="Change PDF"
        actionButton={
          <button
            type="button"
            onClick={handleSplit}
            disabled={loading}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <FiDownload size={14} /> {loading ? 'Splitting...' : 'Extract & Split PDF'}
          </button>
        }
      />

      {errorMessage && (
        <div style={{ margin: '0.5rem 0' }}>
          <AlertBanner message={errorMessage} type="error" onClose={() => setErrorMessage(null)} />
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.75rem 0', display: 'flex', justifyContent: 'center' }}>
        <div style={{ maxWidth: '640px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Preset Quick Chips */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.6rem' }}>
              QUICK SELECTION PRESETS
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {[
                { label: 'First Page', s: 1, e: 1 },
                { label: 'First 5 Pages', s: 1, e: Math.min(5, totalPages) },
                { label: 'Last Page', s: totalPages, e: totalPages },
                { label: 'All Pages', s: 1, e: totalPages },
              ].map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setStartPage(p.s);
                    setEndPage(p.e);
                  }}
                  style={{
                    padding: '0.5rem 0.2rem',
                    borderRadius: '8px',
                    border: startPage === p.s && endPage === p.e ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                    background: startPage === p.s && endPage === p.e ? 'rgba(28, 153, 255, 0.12)' : 'var(--subtle-bg)',
                    color: startPage === p.s && endPage === p.e ? 'var(--primary-color)' : 'var(--text-color)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Range Configuration Card */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.85rem', borderRadius: '999px', background: 'rgba(28, 153, 255, 0.1)', color: 'var(--primary-color)', fontSize: '0.82rem', fontWeight: 700, marginBottom: '1rem' }}>
              <FiLayers size={14} /> Total Document Pages: {totalPages}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', margin: '1rem 0' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  From page:
                </label>
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={startPage}
                  onChange={(e) => setStartPage(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ width: '90px', padding: '0.6rem', textAlign: 'center', fontSize: '1.15rem', fontWeight: 700, borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)' }}
                  disabled={loading}
                />
              </div>

              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '1.2rem' }}>➔</span>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  To page:
                </label>
                <input
                  type="number"
                  min={startPage}
                  max={totalPages}
                  value={endPage}
                  onChange={(e) => setEndPage(Math.min(totalPages, parseInt(e.target.value) || totalPages))}
                  style={{ width: '90px', padding: '0.6rem', textAlign: 'center', fontSize: '1.15rem', fontWeight: 700, borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)' }}
                  disabled={loading}
                />
              </div>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '1.25rem 0 0 0' }}>
              Will extract <strong>{Math.max(0, endPage - startPage + 1)}</strong> {Math.max(0, endPage - startPage + 1) === 1 ? 'page' : 'pages'} into a new PDF.
            </p>
          </div>
        </div>
      </div>

      <Loader isLoading={loading} phrases={splitPhrases} />
    </div>
  );
};



export default SplitPdf;
