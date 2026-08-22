import { useState, useEffect, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FiDownload, FiRefreshCw, FiFileText, FiMenu, FiTrash2, FiSettings } from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import Loader from '../components/Loader';

const PAGE_SIZES = {
  'Auto': null,
  'A4': { width: 595.28, height: 841.89 },
  'Letter': { width: 612.00, height: 792.00 }
};

const ImageToPdf = () => {
  const [loading, setLoading] = useState(false);
  // Store objects containing the file and its preview URL
  const [imageItems, setImageItems] = useState([]); 
  const [pdfUrl, setPdfUrl] = useState(null);

  // Settings State - Defaulted to Auto
  const [pageSize, setPageSize] = useState('Auto');
  const [orientation, setOrientation] = useState('Portrait');

  // Refs for drag-and-drop
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const handleFileLoad = (files) => {
    if (files.length === 0) return;
    
    // Create a preview URL for each new file
    const newItems = files.map(file => ({
      file: file,
      id: Math.random().toString(36).substr(2, 9), // Unique ID for React keys
      previewUrl: URL.createObjectURL(file)
    }));

    setImageItems(prev => [...prev, ...newItems]);
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e, index) => {
    dragItem.current = index;
    e.dataTransfer.effectAllowed = "move";
    e.target.style.opacity = 0.5;
  };

  const handleDragEnter = (e, index) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = 1;
  };

  const handleDrop = () => {
    if (dragItem.current !== null && dragOverItem.current !== null) {
      const copiedItems = [...imageItems];
      const draggedItemContent = copiedItems.splice(dragItem.current, 1)[0];
      copiedItems.splice(dragOverItem.current, 0, draggedItemContent);
      setImageItems(copiedItems);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const removeFile = (indexToRemove) => {
    const itemToRemove = imageItems[indexToRemove];
    URL.revokeObjectURL(itemToRemove.previewUrl); // Clean up memory
    setImageItems(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // Clean up object URLs when the component unmounts
  useEffect(() => {
    return () => {
      imageItems.forEach(item => URL.revokeObjectURL(item.previewUrl));
    };
  }, [imageItems]);

  // --- PDF Generation ---
  const handleGeneratePdf = async () => {
    if (imageItems.length === 0) return;
    setLoading(true);

    try {
      const pdfDoc = await PDFDocument.create();

      for (const item of imageItems) {
        const file = item.file; // Extract the actual file object
        const imageBytes = await file.arrayBuffer();
        let pdfImage;

        if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
          pdfImage = await pdfDoc.embedJpg(imageBytes);
        } else if (file.type === 'image/png') {
          pdfImage = await pdfDoc.embedPng(imageBytes);
        } else {
          continue;
        }

        const { width: originalWidth, height: originalHeight } = pdfImage.scale(1);
        
        let targetPageWidth, targetPageHeight, drawWidth, drawHeight, xPos, yPos;

        if (pageSize === 'Auto') {
          targetPageWidth = originalWidth;
          targetPageHeight = originalHeight;
          drawWidth = originalWidth;
          drawHeight = originalHeight;
          xPos = 0;
          yPos = 0;
        } else {
          targetPageWidth = PAGE_SIZES[pageSize].width;
          targetPageHeight = PAGE_SIZES[pageSize].height;

          if (orientation === 'Landscape') {
            [targetPageWidth, targetPageHeight] = [targetPageHeight, targetPageWidth];
          }

          const scaleFactor = Math.min(
            targetPageWidth / originalWidth, 
            targetPageHeight / originalHeight
          );

          drawWidth = originalWidth * scaleFactor;
          drawHeight = originalHeight * scaleFactor;
          xPos = (targetPageWidth - drawWidth) / 2;
          yPos = (targetPageHeight - drawHeight) / 2;
        }

        const page = pdfDoc.addPage([targetPageWidth, targetPageHeight]);

        page.drawImage(pdfImage, {
          x: xPos,
          y: yPos,
          width: drawWidth,
          height: drawHeight,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      setPdfUrl(url);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Make sure your images are valid JPGs or PNGs.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    imageItems.forEach(item => URL.revokeObjectURL(item.previewUrl));
    setImageItems([]);
    setPdfUrl(null);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Images to PDF</h2>

      {!pdfUrl && (
        <>
          <FileUpload 
            onFilesSelected={handleFileLoad} 
            accept={{ 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] }} 
            multiple={true} 
            title="Drop JPG or PNG images here"
          />

          {imageItems.length > 0 && (
            <div style={styles.listContainer}>
              <h3 style={{ marginTop: 0, color: 'var(--text-color)' }}>
                Selected Images ({imageItems.length})
              </h3>
              <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '1.5rem' }}>
                Drag and drop items to reorder them before generating.
              </p>
              
              <ul style={styles.fileList}>
                {imageItems.map((item, index) => (
                  <li 
                    key={item.id} 
                    style={styles.listItem}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnter={(e) => handleDragEnter(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                  >
                    <div style={styles.itemInfo}>
                      <FiMenu style={styles.dragHandle} />
                      {/* Mini Image Preview */}
                      <img 
                        src={item.previewUrl} 
                        alt="preview" 
                        style={styles.miniPreview} 
                      />
                      <span style={styles.fileName}>{item.file.name}</span>
                      <span style={styles.fileSize}>({(item.file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                    <button 
                      onClick={() => removeFile(index)} 
                      style={styles.removeBtn}
                      title="Remove image"
                    >
                      <FiTrash2 />
                    </button>
                  </li>
                ))}
              </ul>

              <div style={styles.settingsPanel}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0, marginBottom: '1rem' }}>
                  <FiSettings /> Page Layout Settings
                </h4>
                
                <div style={styles.settingsGrid}>
                  <div style={styles.settingGroup}>
                    <label style={styles.label}>Page Size:</label>
                    <select 
                      value={pageSize} 
                      onChange={(e) => setPageSize(e.target.value)}
                      style={styles.select}
                    >
                      <option value="Auto">Auto (Fit to Image)</option>
                      <option value="A4">A4</option>
                      <option value="Letter">Letter</option>
                    </select>
                  </div>

                  <div style={styles.settingGroup}>
                    <label style={styles.label}>Orientation:</label>
                    <select 
                      value={orientation} 
                      onChange={(e) => setOrientation(e.target.value)}
                      style={styles.select}
                      disabled={pageSize === 'Auto'}
                    >
                      <option value="Portrait">Portrait</option>
                      <option value="Landscape">Landscape</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <button onClick={handleGeneratePdf} style={styles.primaryBtn}>
                  Generate PDF Document
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {pdfUrl && (
        <div style={styles.resultsContainer}>
          <h3 style={styles.successTitle}><FiFileText /> PDF Generated Successfully!</h3>
          <p style={{ marginBottom: '2rem', color: 'var(--text-color)' }}>
            Combined {imageItems.length} image(s) into a single PDF document.
          </p>

          <div style={styles.buttonGroup}>
            <a 
              href={pdfUrl} 
              download={`combined_images_${Date.now()}.pdf`} 
              style={styles.downloadBtn}
            >
              <FiDownload style={{ fontSize: '1.2rem' }} /> Download PDF
            </a>
            <button onClick={handleReset} style={styles.secondaryBtn}>
              <FiRefreshCw style={{ fontSize: '1.2rem' }} /> Create Another
            </button>
          </div>
        </div>
      )}

      <Loader isLoading={loading} phrases={["Analyzing layout...", "Calculating scale and dimensions...", "Embedding pixels...", "Finalizing document..."]} />
    </div>
  );
};

const styles = {
  listContainer: {
    backgroundColor: 'var(--card-bg)',
    padding: '2rem',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    marginTop: '2rem',
  },
  fileList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    marginBottom: '2rem',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    marginBottom: '0.5rem',
    backgroundColor: 'var(--bg-color)',
    color: 'var(--text-color)',
    cursor: 'grab',
    transition: 'background-color 0.2s',
  },
  itemInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    overflow: 'hidden',
  },
  dragHandle: {
    color: 'var(--primary-color)',
    cursor: 'grab',
    fontSize: '1.2rem',
  },
  miniPreview: {
    width: '40px',
    height: '40px',
    objectFit: 'cover', // Ensures the thumbnail is perfectly square without stretching
    borderRadius: '4px',
    border: '1px solid var(--border-color)'
  },
  fileName: {
    fontSize: '0.9rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '220px',
  },
  fileSize: {
    fontSize: '0.8rem',
    opacity: 0.6,
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: '#ff4757',
    cursor: 'pointer',
    fontSize: '1.1rem',
    padding: '0.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsPanel: {
    backgroundColor: 'var(--bg-color)',
    padding: '1.5rem',
    borderRadius: '8px',
    border: '1px dashed var(--border-color)',
    textAlign: 'left',
  },
  settingsGrid: {
    display: 'flex',
    gap: '2rem',
    flexWrap: 'wrap',
  },
  settingGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    flex: '1 1 200px',
  },
  label: {
    fontWeight: 'bold',
    fontSize: '0.9rem',
    color: 'var(--text-color)',
  },
  select: {
    padding: '0.75rem',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--card-bg)',
    color: 'var(--text-color)',
    fontSize: '1rem',
  },
  primaryBtn: {
    padding: '0.75rem 2rem',
    backgroundColor: 'var(--primary-color)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  resultsContainer: {
    backgroundColor: 'var(--card-bg)',
    padding: '3rem 2rem',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    textAlign: 'center',
  },
  successTitle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    margin: '0 0 1rem 0',
    color: 'var(--text-color)',
    fontSize: '1.75rem',
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  downloadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    backgroundColor: 'var(--primary-color)',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '1rem',
    transition: 'opacity 0.2s ease',
  },
  secondaryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    backgroundColor: 'transparent',
    color: 'var(--text-color)',
    border: '2px solid var(--border-color)',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer',
  }
};

export default ImageToPdf;