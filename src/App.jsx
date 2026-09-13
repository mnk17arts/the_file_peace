import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import ScrollToTop from './components/ScrollToTop';

// Lazy-load individual tools and pages to minimize the initial application bundle
const MergePdf = lazy(() => import('./pages/MergePdf'));
const SplitPdf = lazy(() => import('./pages/SplitPdf'));
const RotatePdf = lazy(() => import('./pages/RotatePdf'));
const PdfToImage = lazy(() => import('./pages/PdfToImage'));
const CompressImage = lazy(() => import('./pages/CompressImage'));
const CompressVideo = lazy(() => import('./pages/CompressVideo'));
const ProtectPdf = lazy(() => import('./pages/ProtectPdf'));
const ConvertImage = lazy(() => import('./pages/ConvertImage'));
const ImageToPdf = lazy(() => import('./pages/ImageToPdf'));
const PdfReader = lazy(() => import('./pages/PdfReader'));
const TextToPdf = lazy(() => import('./pages/TextToPdf'));
const MarkupConverter = lazy(() => import('./pages/MarkupConverter'));
const AddWatermark = lazy(() => import('./pages/AddWatermark'));
const AddPageNumbers = lazy(() => import('./pages/AddPageNumbers'));
const OrganizePdf = lazy(() => import('./pages/OrganizePdf'));
const UnlockPdf = lazy(() => import('./pages/UnlockPdf'));
const EditPdf = lazy(() => import('./pages/EditPdf'));
const SummarizePdf = lazy(() => import('./pages/SummarizePdf'));
const TranslatePdf = lazy(() => import('./pages/TranslatePdf'));
const PdfToDocx = lazy(() => import('./pages/PdfToDocx'));
const CompressPdf = lazy(() => import('./pages/CompressPdf'));
const PdfToText = lazy(() => import('./pages/PdfToText'));
const CropPdf = lazy(() => import('./pages/CropPdf'));
const FlipPdf = lazy(() => import('./pages/FlipPdf'));
const InvertPdf = lazy(() => import('./pages/InvertPdf'));
const FlattenPdf = lazy(() => import('./pages/FlattenPdf'));
const ComparePdf = lazy(() => import('./pages/ComparePdf'));
const CropImage = lazy(() => import('./pages/CropImage'));
const EditImage = lazy(() => import('./pages/EditImage'));
const ExtractAudio = lazy(() => import('./pages/ExtractAudio'));
const AudioTools = lazy(() => import('./pages/AudioTools'));
const RedactPdf = lazy(() => import('./pages/RedactPdf'));
const PdfMetadata = lazy(() => import('./pages/PdfMetadata'));
const StripExif = lazy(() => import('./pages/StripExif'));
const FileHash = lazy(() => import('./pages/FileHash'));
const ChatPdf = lazy(() => import('./pages/ChatPdf'));
const TranscribeAudio = lazy(() => import('./pages/TranscribeAudio'));
const TextToHandwriting = lazy(() => import('./pages/TextToHandwriting'));
const ZipTools = lazy(() => import('./pages/ZipTools'));
const QrTools = lazy(() => import('./pages/QrTools'));
const P2pFileShare = lazy(() => import('./pages/P2pFileShare'));
const WorkflowBuilder = lazy(() => import('./pages/WorkflowBuilder'));
const ProtectImage = lazy(() => import('./pages/ProtectImage'));
const AddAudioToVideo = lazy(() => import('./pages/AddAudioToVideo'));
const BlogList = lazy(() => import('./pages/BlogList'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const EmbedWidget = lazy(() => import('./pages/EmbedWidget'));
const Changelog = lazy(() => import('./pages/Changelog'));

const RouteFallback = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '320px',
    gap: '1rem',
    color: 'var(--text-color)',
    opacity: 0.85
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '3px solid var(--border-color)',
      borderTopColor: 'var(--primary-color)',
      borderRadius: '50%',
      animation: 'appSpin 0.8s linear infinite'
    }} />
    <style>{`@keyframes appSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    <span style={{ fontSize: '0.95rem' }}>Loading module...</span>
  </div>
);

function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Isolated Embed Widget Route: Zero-chrome embedded mode for external parent iframes */}
        <Route path="embed/:toolId" element={<Suspense fallback={<RouteFallback />}><EmbedWidget /></Suspense>} />

        <Route path="/" element={<Layout />}>
          {/* Eagerly loaded Dashboard for instant first render */}
          <Route index element={<Home />} />

          {/* Dedicated FAQ Help route */}
          <Route path="faq" element={<Suspense fallback={<RouteFallback />}><FaqPage /></Suspense>} />

          {/* Blog & Knowledge Hub routes */}
          <Route path="blog" element={<Suspense fallback={<RouteFallback />}><BlogList /></Suspense>} />
          <Route path="blog/:slug" element={<Suspense fallback={<RouteFallback />}><BlogPost /></Suspense>} />

          {/* Release Changelog & Version Timeline */}
          <Route path="changelog" element={<Suspense fallback={<RouteFallback />}><Changelog /></Suspense>} />

          {/* On-demand lazy loaded tool routes */}
          <Route path="merge-pdf" element={<Suspense fallback={<RouteFallback />}><MergePdf /></Suspense>} />
          <Route path="rotate-pdf" element={<Suspense fallback={<RouteFallback />}><RotatePdf /></Suspense>} />
          <Route path="pdf-to-image" element={<Suspense fallback={<RouteFallback />}><PdfToImage /></Suspense>} />
          <Route path="split-pdf" element={<Suspense fallback={<RouteFallback />}><SplitPdf /></Suspense>} />
          <Route path="compress-image" element={<Suspense fallback={<RouteFallback />}><CompressImage /></Suspense>} />
          <Route path="compress-video" element={<Suspense fallback={<RouteFallback />}><CompressVideo /></Suspense>} />
          <Route path="protect-pdf" element={<Suspense fallback={<RouteFallback />}><ProtectPdf /></Suspense>} />
          <Route path="convert-image" element={<Suspense fallback={<RouteFallback />}><ConvertImage /></Suspense>} />
          <Route path="image-to-pdf" element={<Suspense fallback={<RouteFallback />}><ImageToPdf /></Suspense>} />
          <Route path="pdf-reader" element={<Suspense fallback={<RouteFallback />}><PdfReader /></Suspense>} />
          <Route path="text-to-pdf" element={<Suspense fallback={<RouteFallback />}><TextToPdf /></Suspense>} />
          <Route path="markup-converter" element={<Suspense fallback={<RouteFallback />}><MarkupConverter /></Suspense>} />
          <Route path="add-watermark" element={<Suspense fallback={<RouteFallback />}><AddWatermark /></Suspense>} />
          <Route path="page-numbers" element={<Suspense fallback={<RouteFallback />}><AddPageNumbers /></Suspense>} />
          <Route path="organize-pdf" element={<Suspense fallback={<RouteFallback />}><OrganizePdf /></Suspense>} />
          <Route path="unlock-pdf" element={<Suspense fallback={<RouteFallback />}><UnlockPdf /></Suspense>} />
          <Route path="edit-pdf" element={<Suspense fallback={<RouteFallback />}><EditPdf /></Suspense>} />
          <Route path="summarize-pdf" element={<Suspense fallback={<RouteFallback />}><SummarizePdf /></Suspense>} />
          <Route path="translate-pdf" element={<Suspense fallback={<RouteFallback />}><TranslatePdf /></Suspense>} />
          <Route path="pdf-to-docx" element={<Suspense fallback={<RouteFallback />}><PdfToDocx /></Suspense>} />
          <Route path="compress-pdf" element={<Suspense fallback={<RouteFallback />}><CompressPdf /></Suspense>} />
          <Route path="pdf-to-text" element={<Suspense fallback={<RouteFallback />}><PdfToText /></Suspense>} />
          <Route path="crop-pdf" element={<Suspense fallback={<RouteFallback />}><CropPdf /></Suspense>} />
          <Route path="flip-pdf" element={<Suspense fallback={<RouteFallback />}><FlipPdf /></Suspense>} />
          <Route path="invert-pdf" element={<Suspense fallback={<RouteFallback />}><InvertPdf /></Suspense>} />
          <Route path="flatten-pdf" element={<Suspense fallback={<RouteFallback />}><FlattenPdf /></Suspense>} />
          <Route path="compare-pdf" element={<Suspense fallback={<RouteFallback />}><ComparePdf /></Suspense>} />
          <Route path="crop-image" element={<Suspense fallback={<RouteFallback />}><CropImage /></Suspense>} />
          <Route path="edit-image" element={<Suspense fallback={<RouteFallback />}><EditImage /></Suspense>} />
          <Route path="extract-audio" element={<Suspense fallback={<RouteFallback />}><ExtractAudio /></Suspense>} />
          <Route path="audio-tools" element={<Suspense fallback={<RouteFallback />}><AudioTools /></Suspense>} />
          <Route path="redact-pdf" element={<Suspense fallback={<RouteFallback />}><RedactPdf /></Suspense>} />
          <Route path="pdf-metadata" element={<Suspense fallback={<RouteFallback />}><PdfMetadata /></Suspense>} />
          <Route path="strip-exif" element={<Suspense fallback={<RouteFallback />}><StripExif /></Suspense>} />
          <Route path="file-hash" element={<Suspense fallback={<RouteFallback />}><FileHash /></Suspense>} />
          <Route path="chat-pdf" element={<Suspense fallback={<RouteFallback />}><ChatPdf /></Suspense>} />
          <Route path="transcribe-audio" element={<Suspense fallback={<RouteFallback />}><TranscribeAudio /></Suspense>} />
          <Route path="text-to-handwriting" element={<Suspense fallback={<RouteFallback />}><TextToHandwriting /></Suspense>} />
          <Route path="zip-tools" element={<Suspense fallback={<RouteFallback />}><ZipTools /></Suspense>} />
          <Route path="qr-tools" element={<Suspense fallback={<RouteFallback />}><QrTools /></Suspense>} />
          <Route path="p2p-share" element={<Suspense fallback={<RouteFallback />}><P2pFileShare /></Suspense>} />
          <Route path="workflow-builder" element={<Suspense fallback={<RouteFallback />}><WorkflowBuilder /></Suspense>} />
          <Route path="protect-image" element={<Suspense fallback={<RouteFallback />}><ProtectImage /></Suspense>} />
          <Route path="add-audio-to-video" element={<Suspense fallback={<RouteFallback />}><AddAudioToVideo /></Suspense>} />
        </Route>
      </Routes>
    </>
  );
}

export default App;