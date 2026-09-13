import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { FiDownload, FiArchive, FiImage, FiCheckSquare, FiSquare } from 'react-icons/fi';
import Loader from '../components/Loader';
import AlertBanner from '../components/AlertBanner';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { formatFileSize } from '../utils/fileUtils';

import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const PdfToImage = () => {
  const location = useLocation();
  const handledRef = useRef(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [extractedImages, setExtractedImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const extractionPhrases = [
    "Setting up the canvas...",
    "Painting high-DPI pixels...",
    "Converting vectors to PNG...",
    "Almost done rendering..."
  ];

  useEffect(() => {
    return () => {
      extractedImages.forEach((img) => URL.revokeObjectURL(img.url));
    };
  }, [extractedImages]);

  const handleFileLoad = useCallback(async (files) => {
    if (loading) return;
    setErrorMessage(null);

    if (!files || files.length !== 1) {
      setErrorMessage("Please upload exactly one PDF to extract.");
      return;
    }

    const selected = files[0];
    if (!selected.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage("Please select a valid PDF file (.pdf).");
      return;
    }

    if (selected.size > 100 * 1024 * 1024) {
      setErrorMessage("File size exceeds 100 MB limit. Please select a smaller PDF.");
      return;
    }

    setExtractedImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.url));
      return [];
    });
    setSelectedImages([]);
    setSelectAll(false);
    setIsCompleted(false);
    setFile(selected);

    setLoading(true);
    const imageUrls = [];

    try {
      const arrayBuffer = await selected.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        const blob = await new Promise((resolve) => {
          canvas.toBlob((b) => resolve(b), "image/png");
        });

        if (!blob) {
          throw new Error(`Failed to render page ${pageNum} to image.`);
        }

        const url = URL.createObjectURL(blob);
        const imageName = `${selected.name.replace(/\.[^/.]+$/, "")}_page_${pageNum}.png`;
        const readyFile = new File([blob], imageName, { type: 'image/png' });

        imageUrls.push({
          url,
          name: imageName,
          blob,
          file: readyFile,
          pageNum
        });
      }

      setExtractedImages(imageUrls);
      setIsCompleted(true);
    } catch (error) {
      console.error("Error extracting images:", error);
      imageUrls.forEach((img) => URL.revokeObjectURL(img.url));
      setErrorMessage("Failed to extract images from this PDF. It might be password-protected or corrupted.");
    } finally {
      setLoading(false);
    }
  }, [loading]);

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

  const handleSelectImage = (index) => {
    setSelectedImages((prev) => {
      if (prev.includes(index)) {
        const updated = prev.filter((i) => i !== index);
        setSelectAll(false);
        return updated;
      }
      const updated = [...prev, index];
      if (updated.length === extractedImages.length) {
        setSelectAll(true);
      }
      return updated;
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedImages([]);
      setSelectAll(false);
    } else {
      setSelectedImages(extractedImages.map((_, i) => i));
      setSelectAll(true);
    }
  };

  const downloadZip = async (indices = null, zipName = 'extracted_pages.zip') => {
    const targets = indices !== null
      ? indices.map((idx) => extractedImages[idx]).filter(Boolean)
      : extractedImages;

    if (targets.length === 0) {
      setErrorMessage("Please select at least one image to package into ZIP.");
      return;
    }

    setZipping(true);
    setErrorMessage(null);

    try {
      const zip = new JSZip();
      for (const img of targets) {
        zip.file(img.name, img.blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = zipUrl;
      link.download = zipName;
      link.click();

      setTimeout(() => URL.revokeObjectURL(zipUrl), 10000);
    } catch (error) {
      console.error("ZIP creation failed:", error);
      setErrorMessage("Failed to generate ZIP archive. You can still download individual images.");
    } finally {
      setZipping(false);
    }
  };

  const handleReset = () => {
    extractedImages.forEach((img) => URL.revokeObjectURL(img.url));
    setIsCompleted(false);
    setFile(null);
    setExtractedImages([]);
    setSelectedImages([]);
    setSelectAll(false);
    setErrorMessage(null);
  };

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Empty state)
  // -------------------------------------------------------------
  if (!isCompleted || !file) {
    return (
      <>
        <ToolHeroView
          title="PDF to Image"
          description="Convert every page of a PDF document into crisp, high-resolution PNG images directly in your browser."
          badge="Convert PDF"
          badgeIcon={FiImage}
          toolPath="/pdf-to-image"
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
        <Loader isLoading={loading} phrases={extractionPhrases} />
      </>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: STUDIO GALLERY VIEW
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
        toolTitle="PDF to Image"
        fileBadge={`${file.name} (${formatFileSize(file.size)} • ${extractedImages.length} pgs)`}
        onBack={handleReset}
        backLabel="Choose Another PDF"
        headerExtra={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={zipping}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.85rem',
                background: 'var(--bg-color, #0f172a)',
                border: '1px solid var(--border-color, #334155)',
                borderRadius: '8px',
                color: 'var(--text-color)',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              {selectAll ? <FiCheckSquare style={{ color: 'var(--primary-color)' }} /> : <FiSquare />}
              {selectAll ? 'Deselect All' : 'Select All'}
            </button>

            {selectedImages.length > 0 && selectedImages.length < extractedImages.length && (
              <button
                type="button"
                onClick={() => downloadZip(selectedImages, `selected_${selectedImages.length}_pages.zip`)}
                disabled={zipping}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 0.85rem',
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid var(--primary-color, #6366f1)',
                  borderRadius: '8px',
                  color: 'var(--primary-color, #6366f1)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <FiArchive /> Download Selected ({selectedImages.length})
              </button>
            )}
          </div>
        }
        primaryAction={{
          label: zipping ? 'Packaging ZIP...' : 'Download All as ZIP',
          icon: FiArchive,
          onClick: () => downloadZip(null, `${file.name.replace(/\.[^/.]+$/, "")}_images.zip`),
          disabled: zipping,
          loading: zipping
        }}
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1rem 0' }}>
        {errorMessage && (
          <div style={{ marginBottom: '1rem' }}>
            <AlertBanner
              message={errorMessage}
              type="error"
              onClose={() => setErrorMessage(null)}
            />
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '1.25rem',
            paddingBottom: '2rem'
          }}
        >
          {extractedImages.map((img, index) => {
            const isSelected = selectedImages.includes(index);
            return (
              <div
                key={index}
                style={{
                  background: 'var(--card-bg, #1e293b)',
                  border: `2px solid ${isSelected ? 'var(--primary-color, #6366f1)' : 'var(--border-color, #334155)'}`,
                  borderRadius: '12px',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                  transition: 'border-color 0.2s ease',
                  position: 'relative'
                }}
              >
                {/* Header: Page Badge, Download Icon & Checkbox */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-color)' }}>
                    Page {img.pageNum}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <a
                      href={img.url}
                      download={img.name}
                      title={`Download Page ${img.pageNum} Image`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: 'var(--primary-color, #6366f1)',
                        color: '#fff',
                        textDecoration: 'none',
                        transition: 'opacity 0.2s ease',
                      }}
                    >
                      <FiDownload size={14} />
                    </a>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectImage(index)}
                      aria-label={`Select page ${img.pageNum}`}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary-color, #6366f1)' }}
                    />
                  </div>
                </div>

                {/* Thumbnail Preview */}
                <div
                  style={{
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: 'var(--bg-color, #0f172a)',
                    border: '1px solid var(--border-color, #334155)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '160px'
                  }}
                >
                  <img
                    src={img.url}
                    alt={`Page ${img.pageNum}`}
                    loading="lazy"
                    style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '240px', objectFit: 'contain' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Loader isLoading={zipping} phrases={["Compressing images into ZIP...", "Building archive...", "Readying download..."]} />
    </div>
  );
};

export default PdfToImage;