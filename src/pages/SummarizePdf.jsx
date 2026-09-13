import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { marked } from 'marked';
import {
  FiZap,
  FiFileText,
  FiBookOpen,
  FiCopy,
  FiCheck,
  FiDownload,
  FiVolume2,
  FiVolumeX,
  FiRefreshCw,
  FiSliders,
  FiEye,
  FiEyeOff,
  FiTrendingDown,
  FiClock,
  FiTag,
} from 'react-icons/fi';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import AlertBanner from '../components/AlertBanner';
import { consumeTransferredFile } from '../utils/fileTransfer';
import {
  generateOfflineSummary,
  summarizeWithGemini,
  summarizeWithGroq,
  summarizeWithOpenAI,
  calculateTextStats,
} from '../utils/textSummarizer';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

marked.setOptions({
  gfm: true,
  breaks: true,
});

export default function SummarizePdf() {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [numPages, setNumPages] = useState(0);

  // Settings
  const [depth, setDepth] = useState('medium'); // 'short' | 'medium' | 'detailed'
  const [engine, setEngine] = useState('offline'); // 'offline' | 'gemini' | 'groq' | 'openai'
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('the_file_peace_gemini_key') || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveKeyLocally, setSaveKeyLocally] = useState(true);

  // Results state
  const [summaryData, setSummaryData] = useState(null); // { summary, keywords, stats }
  const [isLoading, setIsLoading] = useState(false);
  const [loaderMessage, setLoaderMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const speechUtteranceRef = useRef(null);
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
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }

    return fullText.trim();
  };

  // Run summarization pipeline
  const handleGenerateSummary = useCallback(async (text, currentDepth, currentEngine) => {
    if (!text || text.trim().length === 0) {
      setErrorMessage('The uploaded document contains no readable text. It might be scanned or image-based.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setLoaderMessage(
      currentEngine === 'offline'
        ? 'Extracting key themes with local smart NLP...'
        : `Synthesizing summary with ${currentEngine.toUpperCase()} AI model...`
    );

    try {
      let result;
      if (currentEngine === 'offline') {
        result = generateOfflineSummary(text, currentDepth);
      } else if (currentEngine === 'gemini') {
        if (!apiKey.trim()) throw new Error('Please provide your Google AI Studio Gemini API Key.');
        result = await summarizeWithGemini(apiKey.trim(), text, currentDepth);
      } else if (currentEngine === 'groq') {
        if (!apiKey.trim()) throw new Error('Please provide your Groq API Key.');
        result = await summarizeWithGroq(apiKey.trim(), text, currentDepth);
      } else if (currentEngine === 'openai') {
        if (!apiKey.trim()) throw new Error('Please provide your OpenAI API Key.');
        result = await summarizeWithOpenAI(apiKey.trim(), text, currentDepth);
      }

      setSummaryData(result);
    } catch (err) {
      console.error('Summarization error:', err);
      setErrorMessage(err.message || 'Failed to generate summary.');
    } finally {
      setIsLoading(false);
    }
  }, [apiKey]);

  // Process uploaded files
  const handleFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    const selected = Array.isArray(files) ? files[0] : files;

    if (!selected.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Please upload a valid PDF document.');
      return;
    }

    setFile(selected);
    setSummaryData(null);
    setErrorMessage('');
    setIsLoading(true);
    setLoaderMessage('Extracting readable text streams from PDF...');

    try {
      const text = await extractTextFromPdf(selected);
      setExtractedText(text);
      await handleGenerateSummary(text, depth, engine);
    } catch (err) {
      console.error('Text extraction error:', err);
      setErrorMessage('Failed to read text from this PDF.');
    } finally {
      setIsLoading(false);
    }
  }, [depth, engine, handleGenerateSummary]);

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

  // Depth change handler
  const handleDepthChange = (newDepth) => {
    setDepth(newDepth);
    if (extractedText) {
      handleGenerateSummary(extractedText, newDepth, engine);
    }
  };

  // Engine change handler
  const handleEngineChange = (newEngine) => {
    setEngine(newEngine);
    if (newEngine === 'offline' && extractedText) {
      handleGenerateSummary(extractedText, depth, 'offline');
    }
  };

  // Copy Markdown
  const handleCopy = () => {
    if (!summaryData?.summary) return;
    navigator.clipboard.writeText(summaryData.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download TXT
  const handleDownloadTxt = () => {
    if (!summaryData?.summary || !file) return;
    const blob = new Blob([summaryData.summary], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name.replace(/\.[^/.]+$/, '')}_summary.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download Markdown
  const handleDownloadMd = () => {
    if (!summaryData?.summary || !file) return;
    const blob = new Blob([summaryData.summary], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name.replace(/\.[^/.]+$/, '')}_summary.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export as PDF
  const handleDownloadPdf = async () => {
    if (!summaryData?.summary || !file) return;
    setIsLoading(true);
    setLoaderMessage('Generating formatted PDF document...');

    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const margin = 50;
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const contentWidth = pageWidth - margin * 2;

      let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      let currentY = pageHeight - margin;

      // Draw Header
      currentPage.drawText('Document Executive Summary', {
        x: margin,
        y: currentY,
        size: 18,
        font: boldFont,
        color: rgb(0.08, 0.53, 0.82),
      });
      currentY -= 25;

      currentPage.drawText(`Source: ${file.name} | Generated by The File Peace`, {
        x: margin,
        y: currentY,
        size: 9,
        font,
        color: rgb(0.4, 0.45, 0.5),
      });
      currentY -= 30;

      // Split plain text into lines
      const plainText = summaryData.summary.replace(/[#*`]/g, '');
      const lines = plainText.split('\n');

      for (const line of lines) {
        if (!line.trim()) {
          currentY -= 12;
          continue;
        }

        const words = line.split(' ');
        let currentLineText = '';

        for (const word of words) {
          const testLine = currentLineText ? `${currentLineText} ${word}` : word;
          const textWidth = font.widthOfTextAtSize(testLine, 10.5);

          if (textWidth > contentWidth) {
            if (currentY < margin + 20) {
              currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
              currentY = pageHeight - margin;
            }
            currentPage.drawText(currentLineText, {
              x: margin,
              y: currentY,
              size: 10.5,
              font,
              color: rgb(0.12, 0.15, 0.2),
            });
            currentY -= 16;
            currentLineText = word;
          } else {
            currentLineText = testLine;
          }
        }

        if (currentLineText) {
          if (currentY < margin + 20) {
            currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
            currentY = pageHeight - margin;
          }
          currentPage.drawText(currentLineText, {
            x: margin,
            y: currentY,
            size: 10.5,
            font,
            color: rgb(0.12, 0.15, 0.2),
          });
          currentY -= 16;
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.replace(/\.[^/.]+$/, '')}_summary.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export error:', err);
      setErrorMessage('Failed to export PDF summary. Please use .MD or .TXT export.');
    } finally {
      setIsLoading(false);
    }
  };

  // Text-To-Speech
  const handleToggleAudio = () => {
    if (!window.speechSynthesis || !summaryData?.summary) return;

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    } else {
      window.speechSynthesis.cancel();
      const plainText = summaryData.summary
        .replace(/[#*•]/g, ' ')
        .replace(/\n+/g, '. ')
        .replace(/\s+/g, ' ');

      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.rate = 1.0;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      speechUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setIsPlayingAudio(true);
    }
  };

  const handleReset = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setFile(null);
    setExtractedText('');
    setNumPages(0);
    setSummaryData(null);
    setIsPlayingAudio(false);
    setErrorMessage('');
  };

  const originalStats = calculateTextStats(extractedText);
  const renderedHtml = useMemo(() => {
    return summaryData?.summary ? marked.parse(summaryData.summary) : '';
  }, [summaryData]);

  if (!file) {
    return (
      <ToolHeroView
        title="AI PDF Summarizer"
        toolPath="/summarize-pdf"
        badge="Smart NLP & AI"
        badgeIcon={FiBookOpen}
        description="Extract key takeaways, executive summaries, and in-depth analyses from any PDF with 100% offline smart NLP or optional AI models."
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
        toolTitle="PDF Summarizer Studio"
        toolPath="/summarize-pdf"
        fileCount={1}
        primaryAction={{
          label: isLoading ? (loaderMessage || 'Synthesizing...') : 'Re-summarize',
          icon: <FiRefreshCw size={16} />,
          onClick: () => handleGenerateSummary(extractedText, depth, engine),
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
        {/* Left Pane: Summary Document & Exports */}
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
          {summaryData ? (
            <>
              {/* Summary Header & Export Toolbar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.6rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-color)' }}>
                    Executive Summary
                  </h3>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      background: 'rgba(28, 153, 255, 0.12)',
                      color: 'var(--primary-color)',
                    }}
                  >
                    {depth === 'short' ? 'Quick Takeaways' : depth === 'detailed' ? 'Detailed Analysis' : 'Executive Overview'}
                  </span>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleCopy}
                    className="btn-secondary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: 'var(--subtle-bg)',
                      border: '1px solid var(--border-color)',
                      color: copied ? '#10b981' : 'var(--text-color)',
                    }}
                    title="Copy Markdown"
                  >
                    {copied ? <FiCheck color="#10b981" /> : <FiCopy />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={handleToggleAudio}
                    className="btn-secondary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: 'var(--subtle-bg)',
                      border: '1px solid var(--border-color)',
                      color: isPlayingAudio ? '#ef4444' : 'var(--text-color)',
                    }}
                    title={isPlayingAudio ? 'Stop Reading' : 'Listen with TTS'}
                  >
                    {isPlayingAudio ? <FiVolumeX color="#ef4444" /> : <FiVolume2 />}
                    <span>{isPlayingAudio ? 'Stop' : 'Listen'}</span>
                  </button>

                  <button
                    onClick={handleDownloadTxt}
                    className="btn-secondary"
                    style={{
                      padding: '0.35rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: 'var(--subtle-bg)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-color)',
                    }}
                    title="Download .txt"
                  >
                    .TXT
                  </button>

                  <button
                    onClick={handleDownloadMd}
                    className="btn-secondary"
                    style={{
                      padding: '0.35rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: 'var(--subtle-bg)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-color)',
                    }}
                    title="Download .md"
                  >
                    .MD
                  </button>

                  <button
                    onClick={handleDownloadPdf}
                    className="btn-primary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: 'var(--primary-color)',
                      border: 'none',
                      color: '#fff',
                    }}
                    title="Download PDF Summary"
                  >
                    <FiDownload /> PDF
                  </button>
                </div>
              </div>

              {/* Rendered Summary Document */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  padding: '1.25rem',
                  marginTop: '0.75rem',
                  borderRadius: '8px',
                  background: 'var(--subtle-bg)',
                  border: '1px solid var(--border-color)',
                  lineHeight: 1.65,
                  fontSize: '0.92rem',
                  color: 'var(--text-color)',
                }}
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />

              {/* Extracted Key Topics Pills */}
              {summaryData.keywords && summaryData.keywords.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.75rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <FiTag /> Key Topics:
                  </span>
                  {summaryData.keywords.map((kw) => (
                    <span
                      key={kw}
                      style={{
                        padding: '0.2rem 0.55rem',
                        borderRadius: '12px',
                        background: 'var(--subtle-bg)',
                        border: '1px solid var(--border-color)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-color)',
                      }}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-secondary)' }}>
              <FiBookOpen size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p style={{ margin: 0, fontWeight: 600 }}>Click &quot;Re-summarize&quot; to generate an executive overview</p>
            </div>
          )}
        </div>

        {/* Right Pane: Parameters */}
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
              <FiSliders /> Parameters
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px', background: engine === 'offline' ? 'rgba(46, 213, 115, 0.12)' : 'rgba(28, 153, 255, 0.12)', color: engine === 'offline' ? '#2ed573' : 'var(--primary-color)' }}>
              {engine === 'offline' ? '100% Private' : 'Cloud AI'}
            </span>
          </div>

          {/* Document Info */}
          <div style={{ background: 'var(--subtle-bg)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-color)', wordBreak: 'break-all', marginBottom: '0.25rem' }}>
              {file.name}
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <span>{numPages} {numPages === 1 ? 'Page' : 'Pages'}</span>
              <span>•</span>
              <span>{originalStats.words.toLocaleString()} Words</span>
              <span>•</span>
              <span>~{originalStats.readingTimeMinutes} min read</span>
            </div>
          </div>

          {/* Reduction Metrics */}
          {summaryData && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div style={{ background: 'var(--subtle-bg)', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>Reduction</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                  <FiTrendingDown size={14} /> {summaryData.stats.reductionPct}%
                </span>
              </div>
              <div style={{ background: 'var(--subtle-bg)', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>Time Saved</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>
                  <FiClock size={14} /> ~{summaryData.stats.readingTimeSaved}m
                </span>
              </div>
            </div>
          )}

          {/* Depth Selector */}
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.5rem' }}>
              Summary Detail Level:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
              {[
                { id: 'short', label: 'Quick', icon: FiZap },
                { id: 'medium', label: 'Executive', icon: FiFileText },
                { id: 'detailed', label: 'Detailed', icon: FiBookOpen },
              ].map((lvl) => {
                const Icon = lvl.icon;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => handleDepthChange(lvl.id)}
                    style={{
                      padding: '0.45rem 0.5rem',
                      borderRadius: '6px',
                      border: `1px solid ${depth === lvl.id ? 'var(--primary-color)' : 'var(--border-color)'}`,
                      background: depth === lvl.id ? 'var(--primary-color)' : 'var(--subtle-bg)',
                      color: depth === lvl.id ? '#fff' : 'var(--text-color)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <Icon size={13} /> {lvl.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Engine Selector */}
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.5rem' }}>
              Processing Engine:
            </span>
            <select
              value={engine}
              onChange={(e) => handleEngineChange(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                color: 'var(--text-color)',
                fontSize: '0.85rem',
              }}
            >
              <option value="offline">🔒 Built-in Smart NLP (100% Offline &amp; Private)</option>
              <option value="gemini">✨ Google Gemini 2.0 / 1.5 (BYOK)</option>
              <option value="groq">⚡ Groq Llama-3.3 70B (Free BYOK)</option>
              <option value="openai">🤖 OpenAI GPT-4o-mini (BYOK)</option>
            </select>
          </div>

          {/* BYOK API Key Input if AI model chosen */}
          {engine !== 'offline' && (
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
