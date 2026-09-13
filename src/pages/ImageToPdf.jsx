import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { PDFDocument } from 'pdf-lib';
import {
  FiTrash2,
  FiPlus,
  FiFileText,
  FiArrowLeft,
  FiArrowRight,
  FiGrid,
  FiList,
  FiArrowUp,
  FiArrowDown,
  FiImage
} from 'react-icons/fi';
import Loader from '../components/Loader';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import { formatFileSize } from '../utils/fileUtils';
import { consumeTransferredFile } from '../utils/fileTransfer';

const PAGE_SIZES = {
  'Auto': null,
  'A4': { width: 595.28, height: 841.89 },
  'Letter': { width: 612.00, height: 792.00 }
};

const ImageToPdf = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const [imageItems, setImageItems] = useState([]); 
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  // Settings State
  const [pageSize, setPageSize] = useState('Auto');
  const [orientation, setOrientation] = useState('Portrait');

  // Drag-and-drop refs
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const imageItemsRef = useRef([]);

  const pdfUrlRef = useRef(null);
  const handledRef = useRef(false);

  useEffect(() => {
    imageItemsRef.current = imageItems;
  }, [imageItems]);

  useEffect(() => {
    pdfUrlRef.current = pdfUrl;
  }, [pdfUrl]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      imageItemsRef.current.forEach(item => URL.revokeObjectURL(item.previewUrl));
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    };
  }, []);

  const handleFileLoad = useCallback((files) => {
    if (loadingRef.current) return;
    setErrorMessage(null);
    if (!files || files.length === 0) return;
    
    const fileList = Array.from(files);
    const validItems = [];

    for (const file of fileList) {
      const isJpg = file.type === 'image/jpeg' || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg');
      const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');

      if (!isJpg && !isPng) {
        setErrorMessage(`"${file.name}" is not supported. Please upload JPG or PNG images only.`);
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        setErrorMessage(`"${file.name}" exceeds the 50 MB limit per image.`);
        return;
      }

      validItems.push({
        file: file,
        id: Math.random().toString(36).substring(2, 11),
        previewUrl: URL.createObjectURL(file)
      });
    }

    setImageItems(prev => [...prev, ...validItems]);
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

  const handleDragStart = (e, index) => {
    if (loading) return;
    dragItem.current = index;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnter = (e, index) => {
    if (loading) return;
    dragOverItem.current = index;
  };

  const handleDrop = () => {
    if (loading) return;
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const copiedItems = [...imageItems];
      const dragged = copiedItems.splice(dragItem.current, 1)[0];
      copiedItems.splice(dragOverItem.current, 0, dragged);
      setImageItems(copiedItems);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const moveImage = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= imageItems.length) return;
    const copied = [...imageItems];
    const item = copied.splice(index, 1)[0];
    copied.splice(targetIndex, 0, item);
    setImageItems(copied);
  };

  const removeFile = (indexToRemove) => {
    if (loading) return;
    const itemToRemove = imageItems[indexToRemove];
    URL.revokeObjectURL(itemToRemove.previewUrl);
    setImageItems(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const generatePDF = async () => {
    if (loading || imageItems.length === 0) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const pdfDoc = await PDFDocument.create();

      for (const item of imageItems) {
        const file = item.file;
        const arrayBuffer = await file.slice(0).arrayBuffer();
        
        let image;
        if (file.type === 'image/jpeg' || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')) {
          image = await pdfDoc.embedJpg(arrayBuffer);
        } else if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
          image = await pdfDoc.embedPng(arrayBuffer);
        } else {
          continue;
        }

        const imgWidth = image.width;
        const imgHeight = image.height;

        let pageWidth, pageHeight;
        let drawWidth, drawHeight;
        let x = 0, y = 0;

        if (pageSize === 'Auto') {
          pageWidth = imgWidth;
          pageHeight = imgHeight;
          drawWidth = imgWidth;
          drawHeight = imgHeight;
        } else {
          const standardDim = PAGE_SIZES[pageSize];
          if (orientation === 'Landscape') {
            pageWidth = standardDim.height;
            pageHeight = standardDim.width;
          } else {
            pageWidth = standardDim.width;
            pageHeight = standardDim.height;
          }

          const margin = 20; 
          const availableWidth = pageWidth - (margin * 2);
          const availableHeight = pageHeight - (margin * 2);

          const widthRatio = availableWidth / imgWidth;
          const heightRatio = availableHeight / imgHeight;
          const scale = Math.min(widthRatio, heightRatio, 1); 

          drawWidth = imgWidth * scale;
          drawHeight = imgHeight * scale;

          x = margin + (availableWidth - drawWidth) / 2;
          y = margin + (availableHeight - drawHeight) / 2;
        }

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        page.drawImage(image, {
          x: x,
          y: y,
          width: drawWidth,
          height: drawHeight,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const url = URL.createObjectURL(blob);
      
      setPdfBlob(blob);
      setPdfUrl(url);
    } catch (error) {
      console.error("Error generating PDF:", error);
      setErrorMessage("Failed to generate PDF. Make sure your images are valid, uncorrupted JPGs or PNGs.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    imageItems.forEach(item => URL.revokeObjectURL(item.previewUrl));
    setImageItems([]);
    setPdfUrl(null);
    setPdfBlob(null);
    setErrorMessage(null);
  };

  // -------------------------------------------------------------
  // VIEW 3: ACTION COMPLETED
  // -------------------------------------------------------------
  if (pdfUrl && pdfBlob) {
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted 
          toolTitle="Images to PDF"
          fileUrl={pdfUrl}
          fileName="Images_Combined.pdf"
          file={pdfBlob}
          onReset={handleReset}
          message="Your PDF document has been successfully generated from images!"
          onProcessSourceAgain={() => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
            setPdfUrl(null);
            setPdfBlob(null);
          }}
          sourceActionLabel="Adjust Images & Convert Again"
          onProcessTarget={() => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
            setPdfUrl(null);
            setPdfBlob(null);
            setImageItems([]);
          }}
          targetActionLabel="Use Combined PDF"
          currentPath="/image-to-pdf"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Empty state)
  // -------------------------------------------------------------
  if (imageItems.length === 0) {
    return (
      <ToolHeroView
        title="Images to PDF"
        description="Convert multiple JPG and PNG images into a single structured, customized PDF document."
        badge="Convert & Create"
        badgeIcon={FiImage}
        toolPath="/image-to-pdf"
        acceptedFormats={['.jpg', '.jpeg', '.png']}
        allowMultiple={true}
        maxSizeText="50 MB per image"
        accept={{ 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] }}
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
  // VIEW 2: STUDIO WORKSPACE
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
        toolTitle="Images to PDF"
        fileBadge={`${imageItems.length} Images`}
        onBack={handleReset}
        backLabel="Clear All"
        headerExtra={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Page Size Select */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary, #94a3b8)', fontWeight: 500 }}>Size:</span>
              <select 
                value={pageSize} 
                onChange={(e) => setPageSize(e.target.value)}
                disabled={loading}
                style={{
                  padding: '0.4rem 0.6rem',
                  borderRadius: '8px',
                  background: 'var(--bg-color, #0f172a)',
                  border: '1px solid var(--border-color, #334155)',
                  color: 'var(--text-color)',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <option value="Auto">Auto (Fit to Image)</option>
                <option value="A4">A4</option>
                <option value="Letter">Letter</option>
              </select>
            </div>

            {pageSize !== 'Auto' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary, #94a3b8)', fontWeight: 500 }}>Orientation:</span>
                <select 
                  value={orientation} 
                  onChange={(e) => setOrientation(e.target.value)}
                  disabled={loading}
                  style={{
                    padding: '0.4rem 0.6rem',
                    borderRadius: '8px',
                    background: 'var(--bg-color, #0f172a)',
                    border: '1px solid var(--border-color, #334155)',
                    color: 'var(--text-color)',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="Portrait">Portrait</option>
                  <option value="Landscape">Landscape</option>
                </select>
              </div>
            )}

            {/* View Mode Toggle */}
            <div style={{ display: 'flex', background: 'var(--bg-color, #0f172a)', borderRadius: '8px', border: '1px solid var(--border-color, #334155)', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                style={{
                  padding: '0.4rem 0.65rem',
                  background: viewMode === 'grid' ? 'var(--primary-color, #6366f1)' : 'transparent',
                  color: viewMode === 'grid' ? '#fff' : 'var(--text-color)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.82rem',
                  fontWeight: 500
                }}
              >
                <FiGrid /> Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  padding: '0.4rem 0.65rem',
                  background: viewMode === 'list' ? 'var(--primary-color, #6366f1)' : 'transparent',
                  color: viewMode === 'list' ? '#fff' : 'var(--text-color)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.82rem',
                  fontWeight: 500
                }}
              >
                <FiList /> List
              </button>
            </div>

            {/* Add More Images Button */}
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid var(--primary-color, #6366f1)',
                borderRadius: '8px',
                color: 'var(--primary-color, #6366f1)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <FiPlus /> Add Images
              <input 
                type="file" 
                accept="image/jpeg,image/png" 
                multiple 
                style={{ display: 'none' }} 
                disabled={loading}
                onChange={(e) => handleFileLoad(e.target.files)} 
              />
            </label>
          </div>
        }
        primaryAction={{
          label: loading ? 'Converting...' : 'Convert to PDF',
          icon: FiFileText,
          onClick: generatePDF,
          disabled: loading || imageItems.length === 0,
          loading
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

        {viewMode === 'grid' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1.25rem',
              paddingBottom: '2rem'
            }}
          >
            {imageItems.map((item, index) => (
              <div
                key={item.id}
                draggable={!loading}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragEnd={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                style={{
                  background: 'var(--card-bg, #1e293b)',
                  border: '1px solid var(--border-color, #334155)',
                  borderRadius: '12px',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                  cursor: 'grab',
                  position: 'relative'
                }}
              >
                {/* Badge Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-color)' }}>
                    Page {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    title="Remove image"
                    disabled={loading}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary, #94a3b8)',
                      cursor: 'pointer',
                      padding: '0.2rem',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>

                {/* Preview Thumbnail */}
                <div
                  style={{
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: 'var(--bg-color, #0f172a)',
                    border: '1px solid var(--border-color, #334155)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '180px'
                  }}
                >
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    loading="lazy"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
                  />
                </div>

                {/* File Meta */}
                <div style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <strong style={{ color: 'var(--text-color)' }}>{item.file.name}</strong>
                  <span style={{ display: 'block', color: 'var(--text-secondary, #94a3b8)', fontSize: '0.75rem' }}>
                    {formatFileSize(item.file.size)}
                  </span>
                </div>

                {/* Reorder Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => moveImage(index, -1)}
                    disabled={index === 0 || loading}
                    style={{
                      flex: 1,
                      padding: '0.35rem',
                      background: 'var(--bg-color, #0f172a)',
                      border: '1px solid var(--border-color, #334155)',
                      borderRadius: '6px',
                      color: 'var(--text-color)',
                      cursor: index === 0 ? 'not-allowed' : 'pointer',
                      opacity: index === 0 ? 0.35 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <FiArrowLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(index, 1)}
                    disabled={index === imageItems.length - 1 || loading}
                    style={{
                      flex: 1,
                      padding: '0.35rem',
                      background: 'var(--bg-color, #0f172a)',
                      border: '1px solid var(--border-color, #334155)',
                      borderRadius: '6px',
                      color: 'var(--text-color)',
                      cursor: index === imageItems.length - 1 ? 'not-allowed' : 'pointer',
                      opacity: index === imageItems.length - 1 ? 0.35 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <FiArrowRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List Mode */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '2rem' }}>
            {imageItems.map((item, index) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  background: 'var(--card-bg, #1e293b)',
                  border: '1px solid var(--border-color, #334155)',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem'
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-color)', minWidth: '60px', textAlign: 'center' }}>
                  Page {index + 1}
                </span>

                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px' }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.file.name}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
                    {formatFileSize(item.file.size)}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => moveImage(index, -1)}
                    disabled={index === 0 || loading}
                    style={{
                      padding: '0.4rem',
                      background: 'var(--bg-color, #0f172a)',
                      border: '1px solid var(--border-color, #334155)',
                      borderRadius: '6px',
                      color: 'var(--text-color)',
                      cursor: index === 0 ? 'not-allowed' : 'pointer',
                      opacity: index === 0 ? 0.35 : 1
                    }}
                  >
                    <FiArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(index, 1)}
                    disabled={index === imageItems.length - 1 || loading}
                    style={{
                      padding: '0.4rem',
                      background: 'var(--bg-color, #0f172a)',
                      border: '1px solid var(--border-color, #334155)',
                      borderRadius: '6px',
                      color: 'var(--text-color)',
                      cursor: index === imageItems.length - 1 ? 'not-allowed' : 'pointer',
                      opacity: index === imageItems.length - 1 ? 0.35 : 1
                    }}
                  >
                    <FiArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    disabled={loading}
                    style={{
                      padding: '0.4rem',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '6px',
                      color: '#ef4444',
                      cursor: 'pointer'
                    }}
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Loader isLoading={loading} phrases={["Processing images...", "Resizing canvas...", "Compiling PDF document..."]} />
    </div>
  );
};

export default ImageToPdf;
