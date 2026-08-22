import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import FileUpload from '../components/FileUpload';
import Loader from '../components/Loader';
import ActionCompleted from '../components/ActionCompleted';

const MergePdf = () => {
  const [loading, setLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [resultFileUrl, setResultFileUrl] = useState(null);

  const pdfPhrases = [
    "Reading between the lines...",
    "Stitchin' those PDFs together...",
    "Applying high-quality industrial glue...",
    "Finalizing document structure..."
  ];

  const handleFiles = async (files) => {
    // We need at least 2 files to perform a merge
    if (files.length < 2) {
      alert("Please select at least 2 PDF files to merge.");
      return;
    }

    setLoading(true);

    try {
      // 1. Create a new, blank PDF document
      const mergedPdf = await PDFDocument.create();

      // 2. Loop through each uploaded file
      for (const file of files) {
        // Convert the File object to an ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        
        // Load the PDF data into pdf-lib
        const pdf = await PDFDocument.load(arrayBuffer);
        
        // Get all the page numbers (indices) from this PDF
        const pageIndices = pdf.getPageIndices();
        
        // Copy the pages from the uploaded PDF into our new merged environment
        const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);
        
        // Add each copied page to the end of the new document
        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
        });
      }

      // 3. Serialize the new PDF document to bytes (a Uint8Array)
      const mergedPdfBytes = await mergedPdf.save();

      // 4. Convert the bytes into a Blob, and generate a download URL
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      setResultFileUrl(url);
      setIsCompleted(true);

    } catch (error) {
      console.error("Error merging PDFs:", error);
      alert("An error occurred while merging the files. Make sure they are valid PDFs.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (resultFileUrl) URL.revokeObjectURL(resultFileUrl);
    setIsCompleted(false);
    setResultFileUrl(null);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Merge PDF Files</h2>
      
      {!isCompleted && (
        <FileUpload 
          onFilesSelected={handleFiles} 
          accept={{ 'application/pdf': ['.pdf'] }} 
          multiple={true} 
          title="Drop multiple PDFs here"
        />
      )}

      {isCompleted && (
        <ActionCompleted 
          fileUrl={resultFileUrl} 
          fileName="Merged_Document.pdf"
          onReset={handleReset}
          message="Your PDFs have been successfully merged!"
        />
      )}

      <Loader isLoading={loading} phrases={pdfPhrases} />
    </div>
  );
};

export default MergePdf;