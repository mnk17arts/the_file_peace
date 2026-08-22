import { useState } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import { FiRotateCw, FiRotateCcw } from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import Loader from '../components/Loader';
import ActionCompleted from '../components/ActionCompleted';

const RotatePdf = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [rotationAngle, setRotationAngle] = useState(0);
  
  const [loading, setLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [resultFileUrl, setResultFileUrl] = useState(null);

  const rotatePhrases = [
    "Flipping things around...",
    "Adjusting the gravity...",
    "Realigning the pixels..."
  ];

  // Step 1: Handle File Upload
  const handleFileLoad = (files) => {
    if (files.length !== 1) {
      alert("Please upload exactly one PDF to rotate.");
      return;
    }
    // We just save the file in state for now, we process it when they hit "Apply"
    setSelectedFile(files[0]);
    setRotationAngle(0); // Reset angle on new file
  };

  // UI Helpers to change the rotation state
  const rotateRight = () => setRotationAngle((prev) => (prev + 90) % 360);
  const rotateLeft = () => setRotationAngle((prev) => (prev - 90 + 360) % 360);

  // Step 2: Apply the rotation to the actual PDF
  const handleApplyRotation = async () => {
    setLoading(true);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const pages = pdf.getPages();

      // Loop through every page and add the selected rotation
      pages.forEach((page) => {
        const currentRotation = page.getRotation().angle;
        // Combine existing rotation with new rotation
        page.setRotation(degrees(currentRotation + rotationAngle));
      });

      const pdfBytes = await pdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      
      setResultFileUrl(URL.createObjectURL(blob));
      setIsCompleted(true);

    } catch (error) {
      console.error("Error rotating PDF:", error);
      alert("Failed to rotate the document.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (resultFileUrl) URL.revokeObjectURL(resultFileUrl);
    setIsCompleted(false);
    setSelectedFile(null);
    setResultFileUrl(null);
    setRotationAngle(0);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Rotate PDF</h2>

      {/* State 1: Upload File */}
      {!selectedFile && !isCompleted && (
        <FileUpload 
          onFilesSelected={handleFileLoad} 
          accept={{ 'application/pdf': ['.pdf'] }} 
          multiple={false} 
          title="Drop a PDF to rotate"
        />
      )}

      {/* State 2: Select Rotation */}
      {selectedFile && !isCompleted && (
        <div style={styles.actionContainer}>
          <h3 style={{ marginTop: 0 }}>Rotate Document</h3>
          <p>Selected file: <strong>{selectedFile.name}</strong></p>
          
          <div style={styles.previewBox}>
            {/* We use CSS transform to visually show the user what will happen! */}
            <div style={{ 
              ...styles.dummyPage, 
              transform: `rotate(${rotationAngle}deg)` 
            }}>
              PDF
            </div>
          </div>
          <p>Current Rotation: <strong>{rotationAngle}°</strong></p>

          <div style={styles.buttonGroup}>
            <button onClick={rotateLeft} style={styles.iconBtn} title="Rotate Left">
              <FiRotateCcw />
            </button>
            <button onClick={rotateRight} style={styles.iconBtn} title="Rotate Right">
              <FiRotateCw />
            </button>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button onClick={handleApplyRotation} style={styles.applyBtn}>
              Apply Changes
            </button>
            <button onClick={handleReset} style={styles.cancelBtn}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* State 3: Success */}
      {isCompleted && (
        <ActionCompleted 
          fileUrl={resultFileUrl} 
          fileName="Rotated_Document.pdf"
          onReset={handleReset}
          message="Your PDF has been rotated successfully!"
        />
      )}

      <Loader isLoading={loading} phrases={rotatePhrases} />
    </div>
  );
};

const styles = {
  actionContainer: {
    backgroundColor: 'var(--card-bg)',
    padding: '2rem',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    textAlign: 'center',
  },
  previewBox: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '150px',
    margin: '1.5rem 0',
  },
  dummyPage: {
    width: '80px',
    height: '110px',
    backgroundColor: 'var(--primary-color)',
    color: 'white',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: 'bold',
    borderRadius: '4px',
    transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', // Smooth bouncy spin
    boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.75rem',
    fontSize: '1.5rem',
    backgroundColor: 'var(--bg-color)',
    color: 'var(--text-color)',
    border: '2px solid var(--border-color)',
    borderRadius: '50%',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  applyBtn: {
    padding: '0.75rem 2rem',
    backgroundColor: 'var(--accent-color)', /* Green for action */
    color: '#0f172a',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginRight: '1rem',
  },
  cancelBtn: {
    padding: '0.75rem 2rem',
    backgroundColor: 'transparent',
    color: 'var(--text-color)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    fontSize: '1.1rem',
    cursor: 'pointer',
  }
};

export default RotatePdf;