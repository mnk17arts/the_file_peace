import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { marked } from 'marked';
import html2pdf from 'html2pdf.js';
import {
  FiGlobe,
  FiFileText,
  FiCopy,
  FiCheck,
  FiDownload,
  FiVolume2,
  FiVolumeX,
  FiRefreshCw,
  FiEye,
  FiEyeOff,
  FiColumns,
  FiSliders,
} from 'react-icons/fi';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import AlertBanner from '../components/AlertBanner';
import { consumeTransferredFile } from '../utils/fileTransfer';
import {
  SUPPORTED_LANGUAGES,
  detectLanguage,
  calculateTranslationStats,
  translateWithFreeWeb,
  translateWithOffline,
  translateWithGemini,
  translateWithGroq,
  translateWithOpenAI,
} from '../utils/textTranslator';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

marked.setOptions({
  gfm: true,
  breaks: true,
});

export default function TranslatePdf() {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [numPages, setNumPages] = useState(0);

  // Settings
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('es');
  const [engine, setEngine] = useState('web'); // 'web' | 'offline' | 'gemini' | 'groq' | 'openai'
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('the_file_peace_gemini_key') || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveKeyLocally, setSaveKeyLocally] = useState(true);

  // Results State
  const [translatedText, setTranslatedText] = useState('');
  const [detectedSourceLang, setDetectedSourceLang] = useState('en');
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'translated' | 'original'

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [loaderMessage, setLoaderMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const handledIncomingRef = useRef(false);

  // Clean up speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Update localStorage when API key changes
  useEffect(() => {
    if (saveKeyLocally && apiKey.trim()) {
      localStorage.setItem('the_file_peace_gemini_key', apiKey.trim());
    }
  }, [apiKey, saveKeyLocally]);

  // Extract raw text from PDF using PDF.js
  const extractTextFromPdf = async (pdfFile) => {
    const buffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
    }).promise;

    let fullText = '';
    const pageCount = pdf.numPages;
    setNumPages(pageCount);

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ');
      fullText += `${pageText}\n\n`;
    }

    return fullText.trim();
  };

  // Run translation pipeline
  const handleGenerateTranslation = useCallback(async (textToTranslate = extractedText) => {
    if (!textToTranslate || textToTranslate.trim().length === 0) {
      setErrorMessage('The uploaded document contains no readable text.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    const targetLangName = SUPPORTED_LANGUAGES.find((l) => l.code === targetLang)?.name || targetLang;
    setLoaderMessage(`Translating document into ${targetLangName}...`);

    try {
      let resultText = '';
      if (engine === 'web') {
        resultText = await translateWithFreeWeb(textToTranslate, sourceLang, targetLang);
      } else if (engine === 'offline') {
        resultText = translateWithOffline(textToTranslate, sourceLang, targetLang);
      } else if (engine === 'gemini') {
        if (!apiKey.trim()) throw new Error('Please provide your Google AI Studio Gemini API Key.');
        resultText = await translateWithGemini(textToTranslate, sourceLang, targetLang, apiKey.trim());
      } else if (engine === 'groq') {
        if (!apiKey.trim()) throw new Error('Please provide your Groq API Key.');
        resultText = await translateWithGroq(textToTranslate, sourceLang, targetLang, apiKey.trim());
      } else if (engine === 'openai') {
        if (!apiKey.trim()) throw new Error('Please provide your OpenAI API Key.');
        resultText = await translateWithOpenAI(textToTranslate, sourceLang, targetLang, apiKey.trim());
      }

      setTranslatedText(resultText);
    } catch (err) {
      console.error('Translation error:', err);
      setErrorMessage(err.message || 'Failed to translate document.');
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, engine, extractedText, sourceLang, targetLang]);

  // Process uploaded files
  const handleFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    const selected = Array.isArray(files) ? files[0] : files;

    if (!selected.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Please upload a valid PDF document.');
      return;
    }

    setFile(selected);
    setTranslatedText('');
    setErrorMessage('');
    setIsLoading(true);
    setLoaderMessage('Extracting readable text streams from PDF...');

    try {
      const text = await extractTextFromPdf(selected);
      setExtractedText(text);

      const detected = detectLanguage(text);
      setDetectedSourceLang(detected);

      await handleGenerateTranslation(text);
    } catch (err) {
      console.error('Text extraction error:', err);
      setErrorMessage('Failed to read text from this PDF.');
    } finally {
      setIsLoading(false);
    }
  }, [handleGenerateTranslation]);

  // Handle incoming transfer file
  useEffect(() => {
    if (handledIncomingRef.current) return;
    const incoming = consumeTransferredFile() || location.state?.incomingFile;
    if (incoming) {
      handledIncomingRef.current = true;
      setTimeout(() => {
        handleFiles([incoming]);
      }, 0);
    }
  }, [location.state, handleFiles]);

  // Copy translated text
  const handleCopy = () => {
    if (!translatedText) return;
    navigator.clipboard.writeText(translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download TXT
  const handleDownloadTxt = () => {
    if (!translatedText || !file) return;
    const blob = new Blob([translatedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name.replace(/\.[^/.]+$/, '')}_translated_${targetLang}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download Markdown
  const handleDownloadMd = () => {
    if (!translatedText || !file) return;
    const blob = new Blob([translatedText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name.replace(/\.[^/.]+$/, '')}_translated_${targetLang}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export as PDF via html2pdf
  const handleDownloadPdf = async () => {
    if (!translatedText || !file) return;
    setIsLoading(true);
    setLoaderMessage('Generating formatted PDF...');

    try {
      const container = document.createElement('div');
      container.style.padding = '40px';
      container.style.color = '#1e293b';
      container.style.fontFamily = 'Helvetica, Arial, sans-serif';
      container.style.lineHeight = '1.6';

      const targetLangName = SUPPORTED_LANGUAGES.find((l) => l.code === targetLang)?.name || targetLang;

      container.innerHTML = `
        <h1 style="color: #0284c7; font-size: 22px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Document Translation</h1>
        <div style="font-size: 11px; color: #64748b; margin-bottom: 24px;">Source: ${file.name} | Language: ${targetLangName} | Translated by The File Peace</div>
        <div>${marked.parse(translatedText)}</div>
      `;

      const opt = {
        margin: 10,
        filename: `${file.name.replace(/\.[^/.]+$/, '')}_translated_${targetLang}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };

      await html2pdf().set(opt).from(container).save();
    } catch (err) {
      console.error('PDF export error:', err);
      setErrorMessage('Could not generate PDF directly. Please download as .MD or .TXT.');
    } finally {
      setIsLoading(false);
    }
  };

  // Text-To-Speech with Multilingual Voice Binding & Chunking
  const handleToggleTts = () => {
    if (!window.speechSynthesis || !translatedText) return;

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();

    // Determine target BCP-47 locale tag
    const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === targetLang);
    const targetTtsLang = langConfig?.tts || (targetLang.includes('-') ? targetLang : `${targetLang}-${targetLang.toUpperCase()}`);

    // Clean plain text
    const cleanText = translatedText
      .replace(/[*#_`~[\]()]/g, ' ')
      .replace(/\n+/g, '. ')
      .trim();

    if (!cleanText) return;

    // Sentence-level chunking to avoid speech synthesis timeout bug on long texts
    const sentences = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText];
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + ' ' + sentence).length < 200) {
        currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());

    const voices = window.speechSynthesis.getVoices();
    const langPrefix = targetTtsLang.split('-')[0].toLowerCase();
    const matchedVoice =
      voices.find((v) => v.lang.replace('_', '-').toLowerCase() === targetTtsLang.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix)) ||
      null;

    let chunkIndex = 0;
    const speakNextChunk = () => {
      if (chunkIndex >= chunks.length) {
        setIsPlayingAudio(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
      utterance.lang = targetTtsLang;
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
      utterance.rate = 1.0;

      utterance.onend = () => {
        chunkIndex++;
        speakNextChunk();
      };
      utterance.onerror = (e) => {
        console.warn('TTS playback error:', e);
        setIsPlayingAudio(false);
      };

      window.speechSynthesis.speak(utterance);
    };

    setIsPlayingAudio(true);
    speakNextChunk();
  };

  const handleReset = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setFile(null);
    setExtractedText('');
    setTranslatedText('');
    setNumPages(0);
    setIsPlayingAudio(false);
    setErrorMessage('');
  };

  const translationStats = useMemo(() => {
    return calculateTranslationStats(extractedText, translatedText);
  }, [extractedText, translatedText]);

  if (!file) {
    return (
      <ToolHeroView
        title="PDF Language Translator"
        toolPath="/translate-pdf"
        badge="Multi-Lingual Engine"
        badgeIcon={FiGlobe}
        description="Translate document text into 40+ global languages with side-by-side verification and zero server uploads."
        acceptedFormats={['PDF']}
        allowMultiple={false}
        accept={{ 'application/pdf': ['.pdf'] }}
        onFilesSelected={handleFiles}
        alerts={errorMessage && (
          <AlertBanner
            type="error"
            message={errorMessage}
            onClose={() => setErrorMessage('')}
          />
        )}
      />
    );
  }

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
        toolTitle="PDF Translator Studio"
        toolPath="/translate-pdf"
        fileCount={1}
        primaryAction={{
          label: isLoading ? (loaderMessage || 'Translating...') : 'Translate Document',
          icon: <FiGlobe size={16} />,
          onClick: () => handleGenerateTranslation(),
          disabled: isLoading,
          loading: isLoading,
        }}
        onReset={handleReset}
        resetLabel="Change File"
      />

      {errorMessage && (
        <div style={{ marginBottom: '0.75rem' }}>
          <AlertBanner
            type="error"
            message={errorMessage}
            onClose={() => setErrorMessage('')}
          />
        </div>
      )}

      {/* Two-column studio grid */}
      <div
        className="studio-grid"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          gap: '1.25rem',
          overflow: 'hidden',
        }}
      >
        {/* Left Pane: Document Viewer */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.25rem',
            boxSizing: 'border-box',
          }}
        >
          {/* View Mode & Export Toolbar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              paddingBottom: '0.65rem',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            {/* View mode toggle */}
            <div style={{ display: 'inline-flex', background: 'var(--subtle-bg)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', gap: '0.25rem' }}>
              <button
                onClick={() => setViewMode('split')}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'split' ? 'var(--primary-color)' : 'transparent',
                  color: viewMode === 'split' ? '#fff' : 'var(--text-color)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <FiColumns size={13} /> Side-by-Side
              </button>
              <button
                onClick={() => setViewMode('translated')}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'translated' ? 'var(--primary-color)' : 'transparent',
                  color: viewMode === 'translated' ? '#fff' : 'var(--text-color)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <FiGlobe size={13} /> Translated
              </button>
              <button
                onClick={() => setViewMode('original')}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'original' ? 'var(--primary-color)' : 'transparent',
                  color: viewMode === 'original' ? '#fff' : 'var(--text-color)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <FiFileText size={13} /> Original
              </button>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                onClick={handleToggleTts}
                disabled={!translatedText || isLoading}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: translatedText ? 'pointer' : 'not-allowed',
                  background: 'var(--subtle-bg)',
                  border: '1px solid var(--border-color)',
                  color: isPlayingAudio ? '#ef4444' : 'var(--text-color)',
                }}
              >
                {isPlayingAudio ? <FiVolumeX color="#ef4444" /> : <FiVolume2 />}
                <span>{isPlayingAudio ? 'Stop' : 'Listen'}</span>
              </button>

              <button
                onClick={handleCopy}
                disabled={!translatedText || isLoading}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: translatedText ? 'pointer' : 'not-allowed',
                  background: 'var(--subtle-bg)',
                  border: '1px solid var(--border-color)',
                  color: copied ? '#10b981' : 'var(--text-color)',
                }}
              >
                {copied ? <FiCheck color="#10b981" /> : <FiCopy />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={handleDownloadTxt}
                disabled={!translatedText || isLoading}
                className="btn-secondary"
                style={{
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: translatedText ? 'pointer' : 'not-allowed',
                  background: 'var(--subtle-bg)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-color)',
                }}
              >
                .TXT
              </button>

              <button
                onClick={handleDownloadMd}
                disabled={!translatedText || isLoading}
                className="btn-secondary"
                style={{
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: translatedText ? 'pointer' : 'not-allowed',
                  background: 'var(--subtle-bg)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-color)',
                }}
              >
                .MD
              </button>

              <button
                onClick={handleDownloadPdf}
                disabled={!translatedText || isLoading}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.3rem 0.7rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: translatedText ? 'pointer' : 'not-allowed',
                  background: 'var(--primary-color)',
                  border: 'none',
                  color: '#fff',
                }}
              >
                <FiDownload /> PDF
              </button>
            </div>
          </div>

          {/* Document Content Split or Single View */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: viewMode === 'split' ? '1fr 1fr' : '1fr',
              gap: '0.85rem',
              marginTop: '0.75rem',
              overflow: 'hidden',
            }}
          >
            {/* Original Document Pane */}
            {(viewMode === 'split' || viewMode === 'original') && (
              <div
                style={{
                  background: 'var(--subtle-bg)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  padding: '1rem',
                  overflowY: 'auto',
                  fontSize: '0.88rem',
                  lineHeight: 1.6,
                  color: 'var(--text-color)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <FiFileText /> Original Document ({SUPPORTED_LANGUAGES.find((l) => l.code === (sourceLang === 'auto' ? detectedSourceLang : sourceLang))?.name || 'Detected'})
                </div>
                {extractedText.split('\n\n').map((para, pIdx) => {
                  const trimmed = para.trim();
                  if (!trimmed) return null;
                  return <p key={pIdx} style={{ margin: '0 0 0.75rem 0' }}>{trimmed}</p>;
                })}
              </div>
            )}

            {/* Translated Document Pane */}
            {(viewMode === 'split' || viewMode === 'translated') && (
              <div
                style={{
                  background: 'var(--subtle-bg)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  padding: '1rem',
                  overflowY: 'auto',
                  fontSize: '0.88rem',
                  lineHeight: 1.6,
                  color: 'var(--text-color)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--primary-color)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <FiGlobe /> Translated ({SUPPORTED_LANGUAGES.find((l) => l.code === targetLang)?.name})
                </div>
                {isLoading ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <FiRefreshCw className="spin-animation" size={24} style={{ color: 'var(--primary-color)', marginBottom: '0.75rem' }} />
                    <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{loaderMessage}</div>
                  </div>
                ) : translatedText ? (
                  <div dangerouslySetInnerHTML={{ __html: marked.parse(translatedText) }} />
                ) : (
                  <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    Click &quot;Translate Document&quot; to generate the translation.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Settings */}
        <div
          style={{
            height: '100%',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.25rem',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FiSliders /> Settings
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(28, 153, 255, 0.12)', color: 'var(--primary-color)' }}>
              {engine === 'web' ? 'Free Instant' : engine === 'offline' ? 'Offline' : 'Cloud AI'}
            </span>
          </div>

          {/* File Info Card */}
          <div style={{ background: 'var(--subtle-bg)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-color)', wordBreak: 'break-all', marginBottom: '0.25rem' }}>
              {file.name}
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <span>{numPages} Pages</span>
              <span>•</span>
              <span>{translationStats.origWords.toLocaleString()} Words</span>
            </div>
          </div>

          {/* Source Language */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-color)', display: 'block', marginBottom: '0.35rem' }}>
              Original Language:
            </label>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                color: 'var(--text-color)',
                fontSize: '0.85rem',
              }}
            >
              <option value="auto">Auto-Detect Language ({detectedSourceLang.toUpperCase()})</option>
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </div>

          {/* Target Language */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-color)', display: 'block', marginBottom: '0.35rem' }}>
              Target Language:
            </label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                color: 'var(--text-color)',
                fontSize: '0.85rem',
              }}
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </div>

          {/* Translation Engine */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-color)', display: 'block', marginBottom: '0.35rem' }}>
              Translation Engine:
            </label>
            <select
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                color: 'var(--text-color)',
                fontSize: '0.85rem',
              }}
            >
              <option value="web">🌐 Free Instant Translation</option>
              <option value="offline">🔒 Offline Dictionary Engine (100% Client-Side)</option>
              <option value="gemini">✨ Google Gemini 2.0 / 1.5 (BYOK)</option>
              <option value="groq">⚡ Groq Llama-3.3 70B (Free BYOK)</option>
              <option value="openai">🤖 OpenAI GPT-4o-mini (BYOK)</option>
            </select>
          </div>

          {/* Cloud API Key Box if needed */}
          {engine !== 'web' && engine !== 'offline' && (
            <div style={{ background: 'var(--subtle-bg)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-color)', display: 'block', marginBottom: '0.35rem' }}>
                {engine.toUpperCase()} API Key:
              </span>
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="Enter API Key..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-color)',
                    fontSize: '0.82rem',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  style={{
                    padding: '0.45rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-color)',
                    cursor: 'pointer',
                  }}
                >
                  {showApiKey ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                </button>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={saveKeyLocally}
                  onChange={(e) => setSaveKeyLocally(e.target.checked)}
                />
                Remember key in local storage
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
