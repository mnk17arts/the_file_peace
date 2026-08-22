import { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { FiDownload, FiRefreshCw } from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import Loader from '../components/Loader';

import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const PdfToImage = () => {
  const [loading, setLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [extractedImages, setExtractedImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const extractionPhrases = [
    "Setting up the canvas...",
    "Painting the pixels...",
    "Converting vectors to images...",
    "Almost done rendering..."
  ];

  const handleFileLoad = async (files) => {
    if (files.length !== 1) {
      alert("Please upload exactly one PDF to extract.");
      return;
    }

    setLoading(true);
    const file = files[0];

    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Load the document into pdf.js
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      const imageUrls = [];

      // Loop through every page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        
        // Scale 2.0 gives us a high-resolution image
        const viewport = page.getViewport({ scale: 2.0 }); 

        // Create a hidden canvas to draw the PDF page
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render the PDF page onto the canvas
        await page.render({ canvasContext: context, viewport: viewport }).promise;

        // Convert the canvas to a Blob (PNG image)
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const imageUrl = URL.createObjectURL(blob);
        
        imageUrls.push({
          url: imageUrl,
          name: `Page_${pageNum}.png`
        });
      }

      setExtractedImages(imageUrls);
      setSelectedImages(imageUrls.map((_, index) => index));
      setSelectAll(true);
      setIsCompleted(true);

    } catch (error) {
      console.error("Error extracting images:", error);
      alert("Failed to extract images from this PDF. It might be corrupted or heavily encrypted.");
    } finally {
      setLoading(false);
    }
  };
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

const downloadSelected = () => {
  if (selectedImages.length === 0) {
    alert("Please select at least one image.");
    return;
  }

  selectedImages.forEach((index, i) => {
    const img = extractedImages[index];

    setTimeout(() => {
      const link = document.createElement("a");
      link.href = img.url;
      link.download = img.name;
      link.click();
    }, i * 200);
  });
};

const downloadAll = () => {
  extractedImages.forEach((img, i) => {
    setTimeout(() => {
      const link = document.createElement("a");
      link.href = img.url;
      link.download = img.name;
      link.click();
    }, i * 200);
  });
};

  const handleReset = () => {
    // Clean up memory
    extractedImages.forEach(img => URL.revokeObjectURL(img.url));
    setIsCompleted(false);
    setExtractedImages([]);
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>PDF to Image</h2>

      {/* State 1: Upload File */}
      {!isCompleted && (
        <FileUpload 
          onFilesSelected={handleFileLoad} 
          accept={{ 'application/pdf': ['.pdf'] }} 
          multiple={false} 
          title="Drop a PDF to convert to images"
        />
      )}

      {/* State 2: Success & Download Grid */}
      {isCompleted && (
        <div style={styles.resultsContainer}>
          <div style={styles.headerRow}>
  <h3>Extracted {extractedImages.length} Images</h3>

  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
    <button onClick={handleSelectAll} style={styles.resetBtn}>
      {selectAll ? "Deselect All" : "Select All"}
    </button>

    <button onClick={downloadSelected} style={styles.downloadBtnTop}>
      Download Selected
    </button>

    <button onClick={downloadAll} style={styles.downloadBtnTop}>
      Download All
    </button>

    <button onClick={handleReset} style={styles.resetBtn}>
      <FiRefreshCw style={{ marginRight: "5px" }} />
      Convert Another
    </button>
  </div>
</div>

          <div style={styles.grid}>
  {extractedImages.map((img, index) => (
    <div key={index} style={styles.imageCard}>
      <div style={styles.checkboxContainer}>
        <input
          type="checkbox"
          checked={selectedImages.includes(index)}
          onChange={() => handleSelectImage(index)}
        />
      </div>

      <img
        src={img.url}
        alt={`Page ${index + 1}`}
        style={styles.preview}
      />

      <a href={img.url} download={img.name} style={styles.downloadBtn}>
        <FiDownload /> Download
      </a>
    </div>
  ))}
</div>
        </div>
      )}

      <Loader isLoading={loading} phrases={extractionPhrases} />
    </div>
  );
};

const styles = {
  resultsContainer: {
    backgroundColor: 'var(--card-bg)',
    padding: '2rem',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    fontFamily: 'inherit',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '1rem',
  },
  resetBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.5rem 1rem',
    backgroundColor: 'transparent',
    color: 'var(--text-color)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '1.5rem',
  },
  imageCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: 'var(--bg-color)',
    padding: '1rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
  },
  preview: {
    width: '100%',
    height: 'auto',
    maxHeight: '250px',
    objectFit: 'contain',
    marginBottom: '1rem',
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
  },
  downloadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    backgroundColor: 'var(--primary-color)',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    width: '100%',
    justifyContent: 'center',
    fontFamily: 'inherit',
  },
  checkboxContainer: {
  width: "100%",
  display: "flex",
  justifyContent: "flex-end",
  marginBottom: "10px",
},

downloadBtnTop: {
  padding: "8px 14px",
  border: "none",
  borderRadius: "6px",
  backgroundColor: "var(--primary-color)",
  color: "white",
  cursor: "pointer",
  fontWeight: "bold",
  fontFamily: "inherit",
},
};

export default PdfToImage;