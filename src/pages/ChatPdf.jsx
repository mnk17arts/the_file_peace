import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { marked } from 'marked';
import {
  FiSend,
  FiFileText,
  FiDownload,
  FiKey,
  FiCpu,
  FiBookmark,
  FiCheck,
  FiCopy,
} from 'react-icons/fi';
import Loader from '../components/Loader';
import AlertBanner from '../components/AlertBanner';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { formatFileSize, validatePdfFile } from '../utils/fileUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

marked.setOptions({
  gfm: true,
  breaks: true,
});

const QUICK_QUESTIONS = [
  'What is the core executive summary of this document?',
  'What are the key conclusions and action items?',
  'List all significant statistics, numbers, and dates mentioned.',
  'What are the potential risks or limitations highlighted?',
];

export default function ChatPdf() {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [pagesData, setPagesData] = useState([]); // [{ page: 1, text: '...' }]
  const [totalWords, setTotalWords] = useState(0);

  // Chat State
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState(null); // { page: 1, excerpt: '...' }

  // Settings
  const [engine, setEngine] = useState('offline'); // 'offline' | 'gemini' | 'groq' | 'openai'
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('the_file_peace_gemini_key') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // UI State
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [loaderMessage, setLoaderMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const messagesContainerRef = useRef(null);
  const handledIncomingRef = useRef(false);
  const msgCounterRef = useRef(0);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAiThinking]);

  // Extract text per page
  const extractPdfPages = useCallback(async (selectedFile) => {
    setIsLoadingDoc(true);
    setLoaderMessage('Extracting document pages and indexing text...');
    setErrorMessage('');

    try {
      const buffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        isEvalSupported: false,
      }).promise;

      const extracted = [];
      let wordCount = 0;

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent();
        const items = textContent.items || [];
        const lineBuckets = [];
        const yTolerance = 4;

        items.forEach((item) => {
          if (!item.str || !item.str.trim()) return;
          const y = item.transform ? item.transform[5] : 0;
          const x = item.transform ? item.transform[4] : 0;

          let bucket = lineBuckets.find((b) => Math.abs(b.y - y) <= yTolerance);
          if (!bucket) {
            bucket = { y, items: [] };
            lineBuckets.push(bucket);
          }
          bucket.items.push({ x, str: item.str });
        });

        lineBuckets.sort((a, b) => b.y - a.y);
        const lines = lineBuckets.map((b) => {
          b.items.sort((a, b) => a.x - b.x);
          return b.items.map((it) => it.str).join(' ').trim();
        }).filter(Boolean);

        const pageText = lines.length > 0 ? lines.join('\n') : (textContent.items.map((i) => i.str).join(' ').trim() || '(No selectable text)');
        extracted.push({ page: p, text: pageText });
        wordCount += pageText.split(/\s+/).filter(Boolean).length;
      }

      if (extracted.length === 0) {
        throw new Error('No selectable text found. This document might be an unscanned image PDF.');
      }

      setPagesData(extracted);
      setTotalWords(wordCount);

      // Initial welcome message from assistant
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `Hello! I have loaded and indexed **${selectedFile.name}** (${pdf.numPages} pages, ~${wordCount.toLocaleString()} words). \n\nAsk me anything about this document, or click one of the suggested prompts below!`,
          citations: [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.error('PDF text extraction error:', err);
      setErrorMessage(err.message || 'Failed to extract text from PDF document.');
    } finally {
      setIsLoadingDoc(false);
      setLoaderMessage('');
    }
  }, []);

  const handleFiles = useCallback((files) => {
    if (!files || files.length === 0) return;
    const selected = Array.isArray(files) ? files[0] : files;
    const validation = validatePdfFile(selected);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      return;
    }
    setFile(selected);
    extractPdfPages(selected);
  }, [extractPdfPages]);

  // Handle incoming transferred file
  useEffect(() => {
    if (handledIncomingRef.current) return;
    const incoming = consumeTransferredFile() || location.state?.incomingFile;
    if (incoming) {
      handledIncomingRef.current = true;
      setTimeout(() => {
        handleFiles([incoming]);
      }, 0);
    }
  }, [handleFiles, location.state]);

  // Search relevant pages for a query or full document context
  const getContextPages = useCallback((query, topK = 8) => {
    if (!pagesData || pagesData.length === 0) return [];

    const totalChars = pagesData.reduce((acc, p) => acc + (p.text?.length || 0), 0);
    // If the PDF is <= 25 pages or <= 60,000 characters, include ALL pages in document order
    if (pagesData.length <= 25 || totalChars <= 60000) {
      return [...pagesData].sort((a, b) => a.page - b.page);
    }

    // For very large documents, score pages and combine top matches with page 1
    const queryTokens = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (queryTokens.length === 0) {
      return pagesData.slice(0, topK);
    }

    const scored = pagesData.map((p) => {
      const lower = p.text.toLowerCase();
      let score = 0;
      queryTokens.forEach((token) => {
        const regex = new RegExp(`\\b${token}`, 'g');
        const matches = lower.match(regex);
        if (matches) {
          score += matches.length * (token.length > 5 ? 2 : 1);
        }
      });
      return { ...p, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const selectedSet = new Set();
    // Always include Page 1 for metadata/title/author/contact info
    if (pagesData[0]) selectedSet.add(pagesData[0].page);

    const topMatches = scored.filter((p) => p.score > 0).slice(0, topK);
    if (topMatches.length === 0) {
      pagesData.slice(0, topK).forEach((p) => selectedSet.add(p.page));
    } else {
      topMatches.forEach((p) => selectedSet.add(p.page));
    }

    return pagesData
      .filter((p) => selectedSet.has(p.page))
      .sort((a, b) => a.page - b.page);
  }, [pagesData]);

  // Local Offline Heuristic Answer Generator
  const generateOfflineResponse = useCallback((query, relevantPages) => {
    if (relevantPages.length === 0) {
      return {
        answer: "I couldn't locate specific sections matching your query in the document. Try rephrasing your question or asking about broad topics.",
        citations: [],
      };
    }

    const citations = relevantPages.map((p) => ({
      page: p.page,
      excerpt: p.text.length > 250 ? p.text.slice(0, 250) + '...' : p.text,
    }));

    const queryTerms = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const candidateSentences = [];

    relevantPages.forEach((p) => {
      const sentences = p.text.split(/(?<=[.?!])\s+/);
      sentences.forEach((sent) => {
        const lowerSent = sent.toLowerCase();
        let matchCount = 0;
        queryTerms.forEach((term) => {
          if (lowerSent.includes(term)) matchCount++;
        });
        if (matchCount > 0 && sent.length > 30) {
          candidateSentences.push({ sent: sent.trim(), matchCount, page: p.page });
        }
      });
    });

    candidateSentences.sort((a, b) => b.matchCount - a.matchCount);

    let answer;
    if (candidateSentences.length > 0) {
      const topSentences = candidateSentences.slice(0, 4);
      answer = `Based on the document (**Page ${topSentences.map((s) => s.page).filter((v, i, a) => a.indexOf(v) === i).join(', ')}**):\n\n` +
        topSentences.map((s) => `• "${s.sent}" *(Page ${s.page})*`).join('\n\n') +
        `\n\n*(Extracted 100% offline via local contextual heuristic. For deep synthesis, you can connect a Gemini or OpenAI key in Settings).*`;
    } else {
      const p = relevantPages[0];
      answer = `Here is the most relevant section found on **Page ${p.page}**:\n\n> ${p.text.slice(0, 450)}...\n\n*(Click the page citation below to view full excerpt).*`;
    }

    return { answer, citations };
  }, []);

  // Send message and get AI answer
  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isAiThinking) return;

    setInputQuery('');
    setErrorMessage('');

    msgCounterRef.current += 1;
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const userMsg = {
      id: `user-msg-${msgCounterRef.current}`,
      role: 'user',
      content: query,
      timestamp: timeStr,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsAiThinking(true);

    try {
      const relevantPages = getContextPages(query, 8);
      const contextText = relevantPages
        .map((p) => `--- PAGE ${p.page} ---\n${p.text}`)
        .join('\n\n');

      let responseText = '';
      const citations = relevantPages.map((p) => ({
        page: p.page,
        excerpt: p.text.length > 250 ? p.text.slice(0, 250) + '...' : p.text,
      }));

      // History of prior chat turns (up to last 6 messages)
      const priorHistory = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-6);

      const systemPrompt = `You are an intelligent, helpful, and precise document assistant. Answer the user's questions based on the full provided PDF context below.
Always cite the relevant page numbers using [Page X] format when mentioning specific details, projects, credentials, or answers.
If something is mentioned on page 1 (like contact details or summary) or page 2, answer accurately from the document.

DOCUMENT CONTEXT:
${contextText}`;

      if (engine === 'offline' || !apiKey.trim()) {
        // Offline heuristic engine
        const offlineRes = generateOfflineResponse(query, relevantPages);
        responseText = offlineRes.answer;
      } else if (engine === 'gemini') {
        const historyText = priorHistory.length > 0
          ? `\n\nPREVIOUS CONVERSATION:\n` + priorHistory.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')
          : '';
        const prompt = `${systemPrompt}${historyText}\n\nUSER QUESTION: ${query}`;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 },
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || 'Gemini API call failed.');
        responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
      } else if (engine === 'groq') {
        const groqMessages = [
          { role: 'system', content: systemPrompt },
          ...priorHistory.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: query },
        ];
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({
            model: 'groq/compound-mini',
            messages: groqMessages,
            temperature: 0.2,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || 'Groq API call failed.');
        responseText = data.choices?.[0]?.message?.content || 'No response generated.';
      } else if (engine === 'openai') {
        const openaiMessages = [
          { role: 'system', content: systemPrompt },
          ...priorHistory.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: query },
        ];
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: openaiMessages,
            temperature: 0.2,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || 'OpenAI API call failed.');
        responseText = data.choices?.[0]?.message?.content || 'No response generated.';
      }

      msgCounterRef.current += 1;
      const aiMsg = {
        id: `ai-msg-${msgCounterRef.current}`,
        role: 'assistant',
        content: responseText,
        citations: citations,
        timestamp: timeStr,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error('Chat AI response error:', err);
      msgCounterRef.current += 1;
      const errorAiMsg = {
        id: `err-msg-${msgCounterRef.current}`,
        role: 'assistant',
        content: `⚠️ **Error generating response**: ${err.message || 'Please check your API key and connection.'}\n\nYou can switch to the **100% Offline Engine** in settings to query without an API key.`,
        citations: [],
        timestamp: timeStr,
      };
      setMessages((prev) => [...prev, errorAiMsg]);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleCopyMessage = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleExportMarkdown = () => {
    if (!file) return;
    const docOverview = pagesData.length > 0 && pagesData[0]?.text
      ? pagesData[0].text.slice(0, 1200).trim() + (pagesData[0].text.length > 1200 ? '...' : '')
      : 'No text extracted';

    const conversationText = messages
      .map((m) => `### ${m.role === 'user' ? '👤 User' : '🤖 Assistant'} (${m.timestamp})\n\n${m.content}\n\n`)
      .join('---\n\n');

    const mdContent = `# Document Summary & Q&A Report: ${file.name}\n\n` +
      `*Generated locally by The File Peace on ${new Date().toLocaleDateString()} with zero server uploads.*\n\n` +
      `## Document Overview\n` +
      `- **File Name:** ${file.name}\n` +
      `- **Pages:** ${pagesData.length}\n` +
      `- **Total Words:** ~${totalWords.toLocaleString()} words\n` +
      `- **File Size:** ${formatFileSize(file.size)}\n` +
      `- **AI Engine Used:** ${engine.toUpperCase()}\n\n` +
      `---\n\n` +
      `## Document Opening Excerpt\n\n` +
      `> ${docOverview.replace(/\n/g, '\n> ')}\n\n` +
      `---\n\n` +
      `## Discussion & Answers\n\n` +
      (conversationText || '*No Q&A messages recorded.*');

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name.replace(/\.[^/.]+$/, '')}-summary.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    if (!file) return;
    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      let page = pdfDoc.addPage([595.28, 841.89]); // A4
      let y = 800;

      // Header
      const cleanDocTitle = (file?.name || 'Document')
        .replace(/[^\x20-\x7E]/g, '');
      page.drawText(`Document Summary & Q&A: ${cleanDocTitle}`, { x: 50, y, size: 15, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      y -= 22;
      page.drawText(`Exported from The File Peace (100% Client-Side) • ${new Date().toLocaleDateString()}`, { x: 50, y, size: 9.5, font, color: rgb(0.4, 0.4, 0.4) });
      y -= 18;
      page.drawText(`Pages: ${pagesData.length}  |  Words: ~${totalWords.toLocaleString()}  |  Size: ${formatFileSize(file.size)}`, { x: 50, y, size: 9.5, font, color: rgb(0.3, 0.3, 0.3) });
      y -= 28;

      for (const m of messages) {
        if (y < 80) {
          page = pdfDoc.addPage([595.28, 841.89]);
          y = 800;
        }

        const sender = m.role === 'user' ? 'USER' : 'ASSISTANT';
        page.drawText(`${sender} (${m.timestamp}):`, { x: 50, y, size: 11, font: fontBold, color: m.role === 'user' ? rgb(0.1, 0.4, 0.9) : rgb(0.1, 0.7, 0.3) });
        y -= 16;

        // Clean markdown and sanitize non-WinAnsi unicode characters
        const sanitizedContent = (m.content || '')
          .replace(/[“”]/g, '"')
          .replace(/[‘’]/g, "'")
          .replace(/[–—]/g, '-')
          .replace(/…/g, '...')
          .replace(/[【[]/g, '[')
          .replace(/[】\]]/g, ']')
          .replace(/•/g, '-')
          .replace(/[\u200B-\u200D\uFEFF\u00A0\u202F]/g, ' ')
          .replace(/[#*`_>]/g, '')
          .replace(/[^\x20-\x7E\r\n\t]/g, '');

        const rawLines = sanitizedContent.split('\n');

        for (const rawLine of rawLines) {
          if (!rawLine.trim()) {
            y -= 8;
            continue;
          }

          // Word wrap line to max width ~ 80 characters
          const words = rawLine.split(/\s+/);
          let currentLine = '';

          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (testLine.length > 80) {
              if (y < 60) {
                page = pdfDoc.addPage([595.28, 841.89]);
                y = 800;
              }
              page.drawText(currentLine, { x: 50, y, size: 9.5, font, color: rgb(0.2, 0.2, 0.2) });
              y -= 14;
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }

          if (currentLine) {
            if (y < 60) {
              page = pdfDoc.addPage([595.28, 841.89]);
              y = 800;
            }
            page.drawText(currentLine, { x: 50, y, size: 9.5, font, color: rgb(0.2, 0.2, 0.2) });
            y -= 14;
          }
        }
        y -= 12;
      }

      const pdfBytes = await pdfDoc.save({ updateMetadata: false });
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.replace(/\.[^/.]+$/, '')}-summary.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export error:', err);
      setErrorMessage(`Failed to export PDF summary: ${err.message}`);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPagesData([]);
    setMessages([]);
    setInputQuery('');
    setTotalWords(0);
    setErrorMessage('');
    setSelectedCitation(null);
  };

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Upload stage)
  // -------------------------------------------------------------
  if (!file) {
    if (isLoadingDoc) {
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
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Loader message={loaderMessage || 'Processing document...'} />
        </div>
      );
    }

    return (
      <ToolHeroView
        title="Chat with PDF (Document Q&A)"
        description="Ask questions, extract facts, and explore documents with interactive page source citations and zero server uploads."
        badge="View PDF"
        badgeIcon={FiFileText}
        toolPath="/chat-pdf"
        acceptedFormats={['PDF documents (.pdf)']}
        accept={{ 'application/pdf': ['.pdf'] }}
        allowMultiple={false}
        onFilesSelected={handleFiles}
        alerts={
          errorMessage ? (
            <AlertBanner
              message={errorMessage}
              type="error"
              onClose={() => setErrorMessage('')}
            />
          ) : null
        }
      />
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: ACTIVE STUDIO VIEW
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
        overflow: 'hidden',
      }}
    >
      {/* Micro Studio Header */}
      <ToolStudioHeader
        title="Chat with PDF"
        icon={FiFileText}
        file={file}
        category="View PDF"
        toolPath="/chat-pdf"
        fileBadge={pagesData.length > 0 ? `${pagesData.length} Pages • ~${totalWords.toLocaleString()} words` : undefined}
        onReset={handleReset}
        resetLabel="Change PDF"
        headerExtra={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleExportMarkdown}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--subtle-bg)',
                color: 'var(--text-color)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <FiDownload size={13} /> Summary (.md)
            </button>
          </div>
        }
        primaryAction={{
          label: 'Summary (.pdf)',
          icon: FiDownload,
          onClick: handleExportPdf,
        }}
      />

      {errorMessage && (
        <div style={{ marginBottom: '0.5rem' }}>
          <AlertBanner
            message={errorMessage}
            type="error"
            onClose={() => setErrorMessage('')}
          />
        </div>
      )}

      {/* Main Chat Workspace Grid */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 320px) 1fr',
          gap: '1rem',
          overflow: 'hidden',
        }}
      >
        {/* Left Sidebar: Document Info & Engine Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', minHeight: 0, overflowY: 'auto', paddingRight: '0.25rem' }}>
          {/* Document Info Card */}
          <div className="workspace-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }}>
            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <FiFileText color="var(--primary-color)" /> Document Summary
            </span>

            <div style={{ background: 'var(--subtle-bg)', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.85rem', border: '1px solid var(--border-color)' }}>
              <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-color)', display: 'block', wordBreak: 'break-word', marginBottom: '0.35rem' }}>
                {file.name}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
                <span>{pagesData.length} pages</span>
                <span>•</span>
                <span>~{totalWords.toLocaleString()} words</span>
                <span>•</span>
                <span>{formatFileSize(file.size)}</span>
              </div>

              {/* Explicit Download Summary buttons in sidebar */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleExportMarkdown}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    padding: '0.35rem 0.4rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-color)',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <FiDownload size={12} /> .md Summary
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    padding: '0.35rem 0.4rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-color)',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <FiDownload size={12} /> .pdf Summary
                </button>
              </div>
            </div>

            {/* Engine Picker */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-color)' }}>
                  AI Engine:
                </label>
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <FiKey size={12} /> {showSettings ? 'Hide Key' : 'API Key'}
                </button>
              </div>

              <select
                value={engine}
                onChange={(e) => setEngine(e.target.value)}
                style={{ width: '100%', padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.84rem' }}
              >
                <option value="offline">🛡️ 100% Offline (Local Heuristic)</option>
                <option value="gemini">⚡ Google Gemini 1.5 Flash (BYOK)</option>
                <option value="groq">⚡ Groq Llama-3.1 (BYOK)</option>
                <option value="openai">⚡ OpenAI GPT-4o-mini (BYOK)</option>
              </select>
            </div>

            {/* API Key Input when expanded or non-offline */}
            {(showSettings || engine !== 'offline') && (
              <div style={{ background: 'rgba(28, 153, 255, 0.06)', border: '1px solid rgba(28, 153, 255, 0.25)', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-color)', display: 'block', marginBottom: '0.3rem' }}>
                  {engine === 'gemini' ? 'Gemini' : engine === 'groq' ? 'Groq' : engine === 'openai' ? 'OpenAI' : 'BYOK'} API Key:
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    localStorage.setItem('the_file_peace_gemini_key', e.target.value);
                  }}
                  placeholder="Paste private key"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', fontSize: '0.8rem', marginBottom: '0.25rem' }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>
                  🔒 Stored locally in browser only.
                </span>
              </div>
            )}
          </div>

          {/* Privacy Guarantee Card */}
          <div style={{ background: 'rgba(46, 213, 115, 0.08)', border: '1px solid rgba(46, 213, 115, 0.3)', padding: '0.85rem', borderRadius: '10px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#2ed573', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
              <FiCpu /> 100% In-Browser Ingestion
            </span>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Your document was parsed into RAM. In offline mode, search and answers run entirely locally with zero network calls.
            </p>
          </div>
        </div>

        {/* Right Chat Flow Panel */}
        <div
          className="workspace-card"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
            boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}
        >
            {/* Chat Messages Container */}
            <div ref={messagesContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {messages.map((msg, idx) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '100%',
                  }}
                >
                  {/* Message Bubble Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>{msg.role === 'user' ? 'You' : 'Document Assistant'}</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  {/* Message Bubble Body */}
                  <div
                    style={{
                      maxWidth: '85%',
                      padding: '0.9rem 1.15rem',
                      borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: msg.role === 'user' ? 'var(--primary-color)' : 'var(--subtle-bg)',
                      color: msg.role === 'user' ? '#ffffff' : 'var(--text-color)',
                      border: msg.role === 'user' ? 'none' : '1px solid var(--border-color)',
                      fontSize: '0.92rem',
                      lineHeight: 1.55,
                      boxShadow: msg.role === 'user' ? '0 4px 12px rgba(28, 153, 255, 0.25)' : 'none',
                    }}
                  >
                    {msg.role === 'user' ? (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                    ) : (
                      <div
                        className="markdown-content"
                        dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) }}
                        style={{ wordBreak: 'break-word' }}
                      />
                    )}

                    {/* Citations Chips */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.72rem', color: msg.role === 'user' ? '#fff' : 'var(--text-secondary)', fontWeight: 600 }}>
                          Sources:
                        </span>
                        {msg.citations.map((cite) => (
                          <button
                            key={cite.page}
                            onClick={() => setSelectedCitation(cite)}
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '6px',
                              background: msg.role === 'user' ? 'rgba(255,255,255,0.2)' : 'rgba(28, 153, 255, 0.12)',
                              color: msg.role === 'user' ? '#fff' : 'var(--primary-color)',
                              border: 'none',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                            }}
                          >
                            <FiBookmark size={11} /> Page {cite.page}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Copy Button for Assistant */}
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleCopyMessage(msg.content, idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        marginTop: '0.25rem',
                        padding: '0.2rem 0.4rem',
                      }}
                    >
                      {copiedIndex === idx ? <FiCheck color="#2ed573" /> : <FiCopy />}
                      <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              ))}

              {/* AI Thinking Animation */}
              {isAiThinking && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem', background: 'var(--subtle-bg)', borderRadius: '12px', width: 'fit-content', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: '18px', height: '18px', border: '2px solid var(--border-color)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Searching document context & synthesizing answer...</span>
                </div>
              )}
            </div>

            {/* Citation Excerpt Popup */}
            {selectedCitation && (
              <div style={{ background: 'var(--subtle-bg)', borderTop: '1px solid var(--border-color)', padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary-color)', display: 'block', marginBottom: '0.2rem' }}>
                    📖 Source Excerpt (Page {selectedCitation.page}):
                  </span>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic', maxHeight: '60px', overflowY: 'auto' }}>
                    "{selectedCitation.excerpt}"
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCitation(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Quick Suggested Questions */}
            <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid var(--border-color)', background: 'var(--card-bg)', overflowX: 'auto', display: 'flex', gap: '0.5rem', whiteSpace: 'nowrap' }}>
              {QUICK_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(q)}
                  disabled={isAiThinking}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '20px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--subtle-bg)',
                    color: 'var(--text-color)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: isAiThinking ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                  }}
                >
                  ✨ {q}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div style={{ padding: '0.85rem 1rem', borderTop: '1px solid var(--border-color)', background: 'var(--card-bg)', display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask any question about this document..."
                disabled={isAiThinking}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--subtle-bg)',
                  color: 'var(--text-color)',
                  fontSize: '0.92rem',
                }}
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={isAiThinking || !inputQuery.trim()}
                className="btn-primary"
                style={{
                  padding: '0.75rem 1.25rem',
                  borderRadius: '12px',
                  background: 'var(--primary-color)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: isAiThinking || !inputQuery.trim() ? 'not-allowed' : 'pointer',
                  opacity: !inputQuery.trim() ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <FiSend /> Send
              </button>
            </div>
          </div>
        </div>
    </div>
  );
}
