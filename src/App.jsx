import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import MergePdf from './pages/MergePdf';
import SplitPdf from './pages/SplitPdf';
import RotatePdf from './pages/RotatePdf';
import PdfToImage from './pages/PdfToImage';
import CompressImage from './pages/CompressImage';
import CompressVideo from './pages/CompressVideo';
import ProtectPdf from './pages/ProtectPdf';
import ConvertImage from './pages/ConvertImage';
import ImageToPdf from './pages/ImageToPdf';
import PdfReader from './pages/PdfReader';
import TextToPdf from './pages/TextToPdf';
import MarkupConverter from './pages/MarkupConverter';
import AddWatermark from './pages/AddWatermark';
import AddPageNumbers from './pages/AddPageNumbers';
import OrganizePdf from './pages/OrganizePdf';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* The Dashboard */}
        <Route index element={<Home />} />
        
        {/* The Tools */}
        <Route path="merge-pdf" element={<MergePdf />} />
        <Route path="rotate-pdf" element={<RotatePdf />} />
        <Route path="pdf-to-image" element={<PdfToImage />} />
        
        {/* Placeholder routes for future tools so they don't break if clicked */}
        <Route path="split-pdf" element={<SplitPdf />} />
        <Route path="compress-image" element={<CompressImage />} />
        <Route path="compress-video" element={<CompressVideo />} />
        <Route path="protect-pdf" element={<ProtectPdf />} />
        <Route path="convert-image" element={<ConvertImage />} />
        <Route path="image-to-pdf" element={<ImageToPdf />} />
        <Route path="pdf-reader" element={<PdfReader />} />
        <Route path="text-to-pdf" element={<TextToPdf />} />
        <Route path="markup-converter" element={<MarkupConverter />} />
        <Route path="add-watermark" element={<AddWatermark />} />
        <Route path="page-numbers" element={<AddPageNumbers />} />
        <Route path="organize-pdf" element={<OrganizePdf />} />

      </Route>
    </Routes>
  );
}

export default App;