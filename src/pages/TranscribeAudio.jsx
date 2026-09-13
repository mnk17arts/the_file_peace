import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  FiMic,
  FiMicOff,
  FiUploadCloud,
  FiCopy,
  FiCheck,
  FiDownload,
  FiTrash2,
  FiShield,
} from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import { ToolStudioHeader, ResizableSplitPane } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { validateAudioFile } from '../utils/fileUtils';

const SUPPORTED_LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'en-IN', label: 'English (India)' },
  { code: 'es-ES', label: 'Spanish (Español)' },
  { code: 'fr-FR', label: 'French (Français)' },
  { code: 'de-DE', label: 'German (Deutsch)' },
  { code: 'hi-IN', label: 'Hindi (हिन्दी)' },
  { code: 'ja-JP', label: 'Japanese (日本語)' },
  { code: 'zh-CN', label: 'Chinese (Simplified)' },
  { code: 'pt-BR', label: 'Portuguese (Brasil)' },
  { code: 'it-IT', label: 'Italian (Italiano)' },
  { code: 'ar-SA', label: 'Arabic (العربية)' },
  { code: 'ru-RU', label: 'Russian (Русский)' },
];

export default function TranscribeAudio() {
  const location = useLocation();

  // Mode: 'mic' | 'file'
  const [activeTab, setActiveTab] = useState('mic');
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');

  // File state
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const audioPlayerRef = useRef(null);

  // Dictation / Transcription State
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Export State
  const [savedBlob, setSavedBlob] = useState(null);
  const [savedFileName, setSavedFileName] = useState('');
  const [savedUrl, setSavedUrl] = useState(null);

  // UI state
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const handledIncomingRef = useRef(false);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (savedUrl) URL.revokeObjectURL(savedUrl);
    };
  }, [audioUrl, savedUrl]);

  // Timer interval effect
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  // Initialize Speech Recognition API
  const getSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = selectedLanguage;

    recognition.onresult = (event) => {
      let finalStr = '';
      let interimStr = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalStr += event.results[i][0].transcript + ' ';
        } else {
          interimStr += event.results[i][0].transcript;
        }
      }

      if (finalStr) {
        setTranscript((prev) => (prev ? `${prev.trim()} ${finalStr.trim()} ` : finalStr));
      }
      setInterimText(interimStr);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setErrorMessage('Microphone access was denied. Please allow microphone permissions in your browser.');
      } else if (event.error === 'network') {
        setErrorMessage('Voice recognition encountered a network/service issue.');
      } else {
        setErrorMessage(`Voice recognition error: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (isRecording) {
        try {
          recognition.start();
        } catch {
          setIsRecording(false);
        }
      }
    };

    return recognition;
  }, [selectedLanguage, isRecording]);

  // Toggle live dictation
  const toggleRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMessage(
        'The Web Speech Recognition API is not supported in this browser. Please use Google Chrome, Microsoft Edge, or a Chromium-based browser for live voice dictation.'
      );
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsRecording(false);
    } else {
      setErrorMessage('');
      const rec = getSpeechRecognition();
      if (!rec) {
        setErrorMessage('Failed to initialize speech recognition engine.');
        return;
      }
      try {
        rec.start();
        recognitionRef.current = rec;
        setIsRecording(true);
      } catch (err) {
        console.error('Speech recognition start failed:', err);
        setErrorMessage('Could not start microphone dictation. Please check audio permissions.');
      }
    }
  };

  // Handle incoming piped audio file
  const handleAudioFiles = useCallback(
    (files) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      const validation = validateAudioFile(file);
      if (!validation.valid && !validation.isValid) {
        setErrorMessage(validation.error || 'Invalid audio file.');
        return;
      }

      setErrorMessage('');
      setAudioFile(file);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setActiveTab('file');
    },
    [audioUrl]
  );

  useEffect(() => {
    if (handledIncomingRef.current) return;
    const inc = consumeTransferredFile() || location.state?.incomingFile;
    if (inc) {
      handledIncomingRef.current = true;
      setTimeout(() => {
        handleAudioFiles([inc]);
      }, 0);
    }
  }, [location.state, handleAudioFiles]);

  // Word & Character count metrics
  const wordCount = useMemo(() => {
    const trimmed = transcript.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [transcript]);

  const charCount = transcript.length;

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopy = async () => {
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMessage('Failed to copy transcript to clipboard.');
    }
  };

  // Export handlers
  const handleExportTxt = () => {
    if (!transcript.trim()) return;
    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const name = audioFile ? `${audioFile.name.replace(/\.[^/.]+$/, '')}-transcript.txt` : `voice-transcript-${Date.now()}.txt`;
    const url = URL.createObjectURL(blob);
    setSavedBlob(blob);
    setSavedFileName(name);
    setSavedUrl(url);
  };

  const handleExportDocx = async () => {
    if (!transcript.trim()) return;
    try {
      const paragraphs = transcript.split('\n').map((p) => {
        return new Paragraph({
          children: [new TextRun({ text: p, size: 24, font: 'Calibri' })],
          spacing: { after: 120 },
        });
      });

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Audio Transcription',
                    bold: true,
                    size: 36,
                    font: 'Calibri',
                    color: '1C99FF',
                  }),
                ],
                spacing: { after: 200 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Generated on ${new Date().toLocaleDateString()} | Words: ${wordCount} | Language: ${selectedLanguage}`,
                    italics: true,
                    size: 20,
                    color: '666666',
                  }),
                ],
                spacing: { after: 300 },
              }),
              ...paragraphs,
            ],
          },
        ],
      });

      const buffer = await Packer.toBlob(doc);
      const name = audioFile ? `${audioFile.name.replace(/\.[^/.]+$/, '')}-transcript.docx` : `voice-transcript-${Date.now()}.docx`;
      const url = URL.createObjectURL(buffer);
      setSavedBlob(buffer);
      setSavedFileName(name);
      setSavedUrl(url);
    } catch (err) {
      console.error('Docx export error:', err);
      setErrorMessage('Failed to compile Word (.docx) document.');
    }
  };

  const handleExportPdf = async () => {
    if (!transcript.trim()) return;
    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const margin = 50;
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const textWidth = pageWidth - margin * 2;

      let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      let currentY = pageHeight - margin;

      currentPage.drawText('Audio Transcription', {
        x: margin,
        y: currentY,
        size: 20,
        font: boldFont,
        color: rgb(0.11, 0.6, 1.0),
      });
      currentY -= 30;

      currentPage.drawText(
        `Generated: ${new Date().toLocaleDateString()} | Words: ${wordCount} | Language: ${selectedLanguage}`,
        {
          x: margin,
          y: currentY,
          size: 9,
          font,
          color: rgb(0.4, 0.4, 0.4),
        }
      );
      currentY -= 35;

      const words = transcript.split(/\s+/);
      let currentLineText = '';

      for (let i = 0; i < words.length; i++) {
        const testLine = currentLineText ? `${currentLineText} ${words[i]}` : words[i];
        const lineWidth = font.widthOfTextAtSize(testLine, 11);

        if (lineWidth < textWidth) {
          currentLineText = testLine;
        } else {
          if (currentY < margin + 20) {
            currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
            currentY = pageHeight - margin;
          }
          currentPage.drawText(currentLineText, {
            x: margin,
            y: currentY,
            size: 11,
            font,
            color: rgb(0.12, 0.15, 0.2),
          });
          currentY -= 20;
          currentLineText = words[i];
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
          size: 11,
          font,
          color: rgb(0.12, 0.15, 0.2),
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const name = audioFile ? `${audioFile.name.replace(/\.[^/.]+$/, '')}-transcript.pdf` : `voice-transcript-${Date.now()}.pdf`;
      const url = URL.createObjectURL(blob);
      setSavedBlob(blob);
      setSavedFileName(name);
      setSavedUrl(url);
    } catch (err) {
      console.error('PDF export error:', err);
      setErrorMessage('Could not compile PDF transcript.');
    }
  };

  const handleReset = () => {
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setAudioFile(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setTranscript('');
    setInterimText('');
    setSavedBlob(null);
    if (savedUrl) URL.revokeObjectURL(savedUrl);
    setSavedUrl(null);
    setErrorMessage('');
  };

  // -------------------------------------------------------------
  // VIEW 3: ACTION COMPLETED
  // -------------------------------------------------------------
  if (savedBlob && savedUrl) {
    return (
      <div style={{ maxHeight: 'calc(100vh - 72px)', overflowY: 'auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          fileUrl={savedUrl}
          fileName={savedFileName}
          file={new File([savedBlob], savedFileName, { type: savedBlob.type || 'text/plain' })}
          onReset={() => {
            setSavedBlob(null);
            if (savedUrl) URL.revokeObjectURL(savedUrl);
            setSavedUrl(null);
          }}
          onProcessSourceAgain={() => {
            setSavedBlob(null);
            if (savedUrl) URL.revokeObjectURL(savedUrl);
            setSavedUrl(null);
          }}
          sourceActionLabel="Edit Transcript Canvas"
          stats={[
            { label: 'Words', value: `${wordCount.toLocaleString()}` },
            { label: 'Characters', value: `${charCount.toLocaleString()}` },
            { label: 'Language', value: selectedLanguage },
          ]}
          message="Transcript exported successfully!"
          currentPath="/transcribe-audio"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: TYPE-A STUDIO VIEW
  // -------------------------------------------------------------
  return (
    <div
      style={{
        height: 'calc(100vh - 72px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg-color)',
      }}
    >
      {/* Micro-bar Studio Header */}
      <ToolStudioHeader
        icon={FiMic}
        title="Speech & Audio Transcriber"
        toolPath="/transcribe-audio"
        fileBadge={
          activeTab === 'mic'
            ? isRecording
              ? `🔴 Recording (${formatTimer(recordingSeconds)})`
              : 'Voice Dictation'
            : audioFile
              ? audioFile.name
              : 'Audio File Mode'
        }
        onReset={handleReset}
        resetLabel="Clear Canvas"
        actionButton={
          <button
            type="button"
            onClick={toggleRecording}
            className="btn-primary studio-header-action-btn"
            style={{
              background: isRecording ? '#ff4757' : undefined,
              boxShadow: isRecording ? '0 0 12px rgba(255, 71, 87, 0.4)' : undefined,
            }}
          >
            {isRecording ? <FiMicOff size={15} /> : <FiMic size={15} />}
            <span>{isRecording ? 'Stop Dictation' : 'Start Voice Dictation'}</span>
          </button>
        }
      />

      {/* Error alert if any */}
      {errorMessage && (
        <div style={{ padding: '0.5rem 1rem', background: 'var(--bg-color)' }}>
          <AlertBanner
            type="error"
            message={errorMessage}
            onClose={() => setErrorMessage('')}
          />
        </div>
      )}

      {/* Draggable Split Studio */}
      <ResizableSplitPane
        initialSplit={62}
        minLeft={380}
        minRight={320}
        storageKey="tfp-split-transcribe"
        leftPane={
          <div
            style={{
              padding: '1.25rem',
              height: '90%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            {/* Canvas Header & Quick Controls */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-color)' }}>
                  Live Transcript Canvas
                </span>
                {isRecording && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      color: '#ff4757',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      background: 'rgba(255, 71, 87, 0.1)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      border: '1px solid rgba(255, 71, 87, 0.3)',
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#ff4757',
                      }}
                    />
                    Live Dictating ({formatTimer(recordingSeconds)})
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!transcript}
                  className="btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.3rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: transcript ? 'pointer' : 'not-allowed',
                    color: copied ? '#2ed573' : '#000',
                  }}
                >
                  {copied ? <FiCheck color="#2ed573" /> : <FiCopy />}
                  <span>{copied ? 'Copied' : 'Copy Text'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTranscript('');
                    setInterimText('');
                  }}
                  disabled={!transcript && !interimText}
                  className="btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.3rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: transcript ? 'pointer' : 'not-allowed',
                    color: '#ff4757',
                  }}
                >
                  <FiTrash2 /> Clear
                </button>
              </div>
            </div>

            {/* Transcript Textarea (Expands to fill canvas) */}
            <textarea
              value={transcript + (interimText ? ` [${interimText}]` : '')}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Spoken words and transcribed speech will appear here in real-time. You can also edit and type directly..."
              style={{
                flex: 1,
                minHeight: '260px',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                color: 'var(--text-color)',
                fontSize: '0.94rem',
                lineHeight: 1.65,
                fontFamily: 'inherit',
                resize: 'none',
              }}
            />

            {/* Analytics Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
              }}
            >
              <div style={{ display: 'flex', gap: '0.85rem' }}>
                <span><strong>{wordCount.toLocaleString()}</strong> words</span>
                <span>•</span>
                <span><strong>{charCount.toLocaleString()}</strong> characters</span>
                <span>•</span>
                <span>~{Math.ceil(wordCount / 130)} min speech</span>
              </div>
              <span>🔒 100% In-Memory Voice Processing</span>
            </div>
          </div>
        }
        rightPane={
          <div
            style={{
              padding: '1.25rem',
              height: '90%',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            {/* Mode Switcher Tabs */}
            <div
              style={{
                background: 'var(--card-bg)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                border: '1px solid var(--border-color)',
              }}
            >
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-color)' }}>
                Input Mode
              </h4>

              <div
                style={{
                  display: 'flex',
                  background: 'var(--subtle-bg)',
                  padding: '0.25rem',
                  borderRadius: '30px',
                  border: '1px solid var(--border-color)',
                  gap: '0.25rem',
                  marginBottom: '1rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('mic')}
                  style={{
                    flex: 1,
                    padding: '0.45rem 0.5rem',
                    borderRadius: '20px',
                    border: 'none',
                    background: activeTab === 'mic' ? 'var(--primary-color)' : 'transparent',
                    color: activeTab === 'mic' ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <FiMic size={14} /> Live Mic
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('file')}
                  style={{
                    flex: 1,
                    padding: '0.45rem 0.5rem',
                    borderRadius: '20px',
                    border: 'none',
                    background: activeTab === 'file' ? 'var(--primary-color)' : 'transparent',
                    color: activeTab === 'file' ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <FiUploadCloud size={14} /> Audio File
                </button>
              </div>

              {/* Audio File Player & Selector */}
              {activeTab === 'file' && (
                <div style={{ marginBottom: '1rem' }}>
                  {!audioFile ? (
                    <FileUpload
                      onFilesSelected={handleAudioFiles}
                      accept={{ 'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.aac'] }}
                      multiple={false}
                      title="Upload Audio File"
                      description="Select MP3, WAV, M4A, or AAC audio"
                    />
                  ) : (
                    <div style={{ background: 'var(--subtle-bg)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                          {audioFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setAudioFile(null);
                            if (audioUrl) URL.revokeObjectURL(audioUrl);
                            setAudioUrl(null);
                          }}
                          style={{ background: 'none', border: 'none', color: '#ff4757', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                        >
                          Change
                        </button>
                      </div>
                      <audio ref={audioPlayerRef} src={audioUrl} controls style={{ width: '100%', height: '36px', outline: 'none' }} />
                    </div>
                  )}
                </div>
              )}

              {/* Spoken Language Selector */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-color)', display: 'block', marginBottom: '0.35rem' }}>
                  Spoken Language:
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  disabled={isRecording}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-color)',
                    fontSize: '0.84rem',
                  }}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Export Actions Card */}
            <div
              style={{
                background: 'var(--card-bg)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                border: '1px solid var(--border-color)',
              }}
            >
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-color)' }}>
                Export Transcript
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleExportTxt}
                  disabled={!transcript.trim()}
                  className="btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.84rem',
                    cursor: transcript.trim() ? 'pointer' : 'not-allowed',
                    opacity: transcript.trim() ? 1 : 0.5,
                  }}
                >
                  <FiDownload /> Plain Text (.TXT)
                </button>
                <button
                  type="button"
                  onClick={handleExportDocx}
                  disabled={!transcript.trim()}
                  className="btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.84rem',
                    cursor: transcript.trim() ? 'pointer' : 'not-allowed',
                    opacity: transcript.trim() ? 1 : 0.5,
                  }}
                >
                  <FiDownload /> Word Document (.DOCX)
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={!transcript.trim()}
                  className="btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.84rem',
                    cursor: transcript.trim() ? 'pointer' : 'not-allowed',
                    opacity: transcript.trim() ? 1 : 0.5,
                  }}
                >
                  <FiDownload /> Printable PDF (.PDF)
                </button>
              </div>
            </div>

            {/* Privacy Guarantee */}
            <div
              style={{
                background: 'var(--subtle-bg)',
                padding: '0.9rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                fontSize: '0.8rem',
                color: 'var(--text-color)',
                opacity: 0.9,
                lineHeight: 1.45,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                <FiShield style={{ color: 'var(--accent-color)' }} />
                <span>Zero Audio Retention</span>
              </div>
              <p style={{ margin: 0 }}>
                Audio streams are converted into text directly in your browser. No speech data or transcripts are ever stored or sent to any remote servers.
              </p>
            </div>
          </div>
        }
      />
    </div>
  );
}
