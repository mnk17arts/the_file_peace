/**
 * Advanced Client-Side Text Summarizer Utility
 * Provides:
 * 1. High-Quality 100% Offline Multi-Section Document Summarizer (Executive Briefing)
 * 2. Multi-Model Cloud AI Connectors (Google Gemini, Groq, OpenAI) with auto-fallbacks
 * 3. Robust PDF text cleaning, section extraction, metrics detection, and keyword tagging.
 */

// Common English stop words
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot',
  'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 'each',
  'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d',
  'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i',
  'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s',
  'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or',
  'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll',
  'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll',
  'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while',
  'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll',
  'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves', 'also', 'just', 'like', 'even', 'many', 'much',
  'first', 'well', 'way', 'may', 'one', 'two', 'new', 'page', 'pdf', 'document', 'fig', 'table', 'et', 'al', 'e.g',
  'i.e', 'etc', 'via', 'using', 'per', 'within', 'since'
]);

/**
 * Clean and normalize raw extracted PDF text
 */
export function cleanPdfText(rawText) {
  if (!rawText) return '';

  return rawText
    .replace(/--- Page \d+ ---/g, '\n')
    .replace(/^\s*\d+\s*$/gm, '')
    .replace(/(\b[a-zA-Z]+)-\n\s*([a-zA-Z]+\b)/g, '$1$2')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Clean and split text into individual sentences
 */
export function splitIntoSentences(text) {
  if (!text) return [];
  const cleaned = cleanPdfText(text);

  const rawSentences = cleaned.match(/[^.!?\n]+[.!?]+(?:\s+|$)|[^.!?\n]+$/g) || [];

  return rawSentences
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => {
      if (s.length < 25) return false;
      const wordCount = s.split(/\s+/).length;
      return wordCount >= 5 && wordCount <= 90;
    });
}

/**
 * Tokenize sentence into lowercase clean words
 */
export function tokenizeWords(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Extract top keywords / key concepts from document text
 */
export function extractKeywords(text, topN = 8) {
  const words = tokenizeWords(text);
  const freqMap = new Map();

  words.forEach((w) => {
    freqMap.set(w, (freqMap.get(w) || 0) + 1);
  });

  return Array.from(freqMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
}

/**
 * Extract key quantitative data points / metrics
 */
export function extractMetrics(sentences, maxItems = 4) {
  const metricPattern = /\b\d+(\.\d+)?%|\$\d+(\.\d+)?([MBKmbk])?|\b\d{4}\b|\b\d+\s+(percent|million|billion|thousand|users|hours|days|years|pages|items)\b/i;
  const metrics = [];

  for (const s of sentences) {
    if (metricPattern.test(s.text) && !metrics.some((m) => m.text === s.text)) {
      metrics.push(s);
      if (metrics.length >= maxItems) break;
    }
  }

  return metrics;
}

/**
 * Calculate document statistics (word count, reading time in minutes)
 */
export function calculateTextStats(text) {
  if (!text) return { words: 0, chars: 0, readingTimeMinutes: 0 };
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const chars = text.length;
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));
  return { words, chars, readingTimeMinutes };
}

/**
 * High-Quality Client-Side Multi-Section Document Summarizer
 */
export function generateOfflineSummary(text, depth = 'medium') {
  if (!text || text.trim().length === 0) {
    return {
      summary: 'No readable text content found in this PDF document to summarize.',
      keyTakeaways: [],
      keywords: [],
      stats: { originalWords: 0, summaryWords: 0, reductionPct: 0, readingTimeSaved: 0 }
    };
  }

  const rawSentences = splitIntoSentences(text);
  if (rawSentences.length === 0) {
    const rawClean = cleanPdfText(text).slice(0, 400).trim();
    return {
      summary: rawClean,
      keyTakeaways: [rawClean],
      keywords: extractKeywords(text),
      stats: { originalWords: text.split(/\s+/).length, summaryWords: rawClean.split(/\s+/).length, reductionPct: 0, readingTimeSaved: 0 }
    };
  }

  // Calculate global word frequencies (TF)
  const wordFreq = new Map();
  let maxFreq = 1;

  rawSentences.forEach((s) => {
    const words = tokenizeWords(s);
    words.forEach((w) => {
      const count = (wordFreq.get(w) || 0) + 1;
      wordFreq.set(w, count);
      if (count > maxFreq) maxFreq = count;
    });
  });

  const wordWeights = new Map();
  wordFreq.forEach((count, word) => {
    wordWeights.set(word, count / maxFreq);
  });

  // Score sentences using hybrid scoring
  const scoredSentences = rawSentences.map((sentence, index) => {
    const words = tokenizeWords(sentence);
    let tfScore = 0;
    let numericBonus = 0;
    let transitionBonus = 0;

    // Detect numeric data
    if (/\b\d+(\.\d+)?%?\b|\$\d+/.test(sentence)) {
      numericBonus = 0.3;
    }

    // Detect high-value semantic trigger words
    if (/conclude|result|found|discover|demonstrate|show|indicate|significant|key|vital|essential|objective|aim|summary|strategy|growth|primary|impact|solution|challenge/i.test(sentence)) {
      transitionBonus = 0.4;
    }

    words.forEach((w) => {
      tfScore += wordWeights.get(w) || 0;
    });

    const lengthScore = words.length > 0 ? tfScore / Math.sqrt(words.length) : 0;

    // Position weighting
    let posBonus = 1.0;
    if (index < 3) posBonus = 1.45;
    else if (index < 8) posBonus = 1.25;
    else if (index > rawSentences.length - 4) posBonus = 1.3;

    return {
      text: sentence,
      index,
      score: (lengthScore + numericBonus + transitionBonus) * posBonus,
      words
    };
  });

  // Extract quantitative metrics
  const metricItems = extractMetrics(scoredSentences, 3);

  // Target sentence count by depth
  let count;
  if (depth === 'short') {
    count = Math.max(3, Math.min(5, Math.ceil(rawSentences.length * 0.1)));
  } else if (depth === 'detailed') {
    count = Math.max(8, Math.min(18, Math.ceil(rawSentences.length * 0.35)));
  } else {
    // Medium
    count = Math.max(5, Math.min(10, Math.ceil(rawSentences.length * 0.2)));
  }

  const ranked = [...scoredSentences].sort((a, b) => b.score - a.score);
  const selected = ranked.slice(0, count).sort((a, b) => a.index - b.index);

  // Key Takeaways list
  const keyTakeaways = ranked
    .slice(0, depth === 'short' ? 4 : 6)
    .map((s) => s.text.replace(/^[-*•\d.]+\s*/, ''));

  let formattedSummary;

  if (depth === 'short') {
    formattedSummary =
      '### ⚡ Executive Summary & Key Takeaways\n\n' +
      selected.map((s) => `• **${s.text.replace(/^[-*•\d.]+\s*/, '')}**`).join('\n\n') +
      (metricItems.length > 0
        ? '\n\n### 📊 Key Data Points & Evidence\n\n' + metricItems.map((m) => `• ${m.text}`).join('\n')
        : '');
  } else if (depth === 'detailed') {
    const half = Math.ceil(selected.length / 2);
    const overviewText = selected.slice(0, half).map((s) => s.text).join(' ');
    const analysisText = selected.slice(half).map((s) => s.text).join(' ');

    formattedSummary =
      '### 📌 Document Overview & Objectives\n\n' +
      overviewText +
      '\n\n### 🔍 Detailed Analysis & Core Findings\n\n' +
      analysisText +
      '\n\n### 💡 Key Actionable Takeaways\n\n' +
      keyTakeaways.slice(0, 5).map((t) => `• **${t}**`).join('\n') +
      (metricItems.length > 0
        ? '\n\n### 📊 Key Quantitative Highlights\n\n' + metricItems.map((m) => `• ${m.text}`).join('\n')
        : '');
  } else {
    // Medium / Standard Executive Brief
    const overviewSentences = selected.slice(0, Math.min(3, selected.length)).map((s) => s.text).join(' ');
    const findingsSentences = selected.slice(3).map((s) => s.text).join(' ');

    formattedSummary =
      '### 📄 Executive Overview\n\n' +
      overviewSentences +
      (findingsSentences ? '\n\n### 🔬 Key Findings & Core Evidence\n\n' + findingsSentences : '') +
      '\n\n### 🔑 Strategic Highlights\n\n' +
      keyTakeaways.slice(0, 4).map((t) => `• **${t}**`).join('\n') +
      (metricItems.length > 0
        ? '\n\n### 📊 Data & Metrics\n\n' + metricItems.slice(0, 2).map((m) => `• ${m.text}`).join('\n')
        : '');
  }

  const originalStats = calculateTextStats(text);
  const summaryStats = calculateTextStats(formattedSummary);
  const reductionPct = Math.max(0, Math.round(((originalStats.words - summaryStats.words) / originalStats.words) * 100));
  const readingTimeSaved = Math.max(0, originalStats.readingTimeMinutes - summaryStats.readingTimeMinutes);

  return {
    summary: formattedSummary,
    keyTakeaways,
    keywords: extractKeywords(text),
    stats: {
      originalWords: originalStats.words,
      summaryWords: summaryStats.words,
      reductionPct,
      readingTimeSaved
    }
  };
}

// Normalize and sanitize arguments for cloud AI summarizers
function normalizeSummarizerArgs(arg1, arg2, arg3) {
  let apiKey;
  let text;
  let depth;

  if (typeof arg1 === 'string' && typeof arg2 === 'string') {
    if (arg1.length > 200 || arg1.includes('\n') || ['short', 'medium', 'detailed'].includes(arg2)) {
      text = arg1;
      if (['short', 'medium', 'detailed'].includes(arg2)) {
        depth = arg2;
        apiKey = typeof arg3 === 'string' ? arg3 : '';
      } else {
        apiKey = arg2;
        depth = typeof arg3 === 'string' ? arg3 : 'medium';
      }
    } else {
      apiKey = arg1;
      text = arg2;
      depth = typeof arg3 === 'string' ? arg3 : 'medium';
    }
  } else {
    apiKey = typeof arg1 === 'string' ? arg1 : '';
    text = typeof arg2 === 'string' ? arg2 : '';
    depth = typeof arg3 === 'string' ? arg3 : 'medium';
  }

  const cleanKey = apiKey ? apiKey.trim().replace(/[^\x20-\x7E]/g, '') : '';
  return { apiKey: cleanKey, text, depth };
}

/**
 * BYOK Gemini API Summarizer
 */
export async function summarizeWithGemini(arg1, arg2, arg3 = 'medium') {
  const { apiKey, text, depth } = normalizeSummarizerArgs(arg1, arg2, arg3);
  if (!apiKey) throw new Error('Google Gemini API Key is required.');

  const promptText = depth === 'short'
    ? 'Provide a concise executive summary of the following document with 4-6 high-impact bullet points. Highlight essential takeaways in clean markdown.'
    : depth === 'detailed'
      ? 'Provide a comprehensive, detailed executive briefing of the following document with structured sections: Overview, In-Depth Findings, Key Metrics, and Strategic Conclusions. Use clean markdown formatting.'
      : 'Provide a structured executive summary of the following document with clear sections: Overview, Key Findings, and Core Highlights in clean markdown.';

  const cleanedText = cleanPdfText(text).slice(0, 100000);
  const key = apiKey;

  let availableModels = [];

  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const listData = await listRes.json().catch(() => ({}));

    if (!listRes.ok) {
      console.warn('Could not query model list, trying default models');
    } else if (listData.models && Array.isArray(listData.models)) {
      availableModels = listData.models
        .filter((m) => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
        .map((m) => m.name.replace(/^models\//, ''));
    }
  } catch (err) {
    console.warn('Could not query model list, trying default models:', err);
  }

  const preferredModels = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-001',
    'gemini-1.5-flash-002',
    'gemini-2.0-flash-exp',
    'gemini-1.5-pro'
  ];

  let modelsToTry;
  if (availableModels.length > 0) {
    const sorted = preferredModels.filter((p) => availableModels.includes(p));
    modelsToTry = sorted.length > 0 ? sorted : availableModels;
  } else {
    modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro'];
  }

  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${promptText}\n\n--- DOCUMENT CONTENT ---\n${cleanedText}` }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2048,
            }
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const summaryResult = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (summaryResult) {
          const originalStats = calculateTextStats(text);
          const summaryStats = calculateTextStats(summaryResult);
          const reductionPct = Math.max(0, Math.round(((originalStats.words - summaryStats.words) / originalStats.words) * 100));
          const readingTimeSaved = Math.max(0, originalStats.readingTimeMinutes - summaryStats.readingTimeMinutes);

          return {
            summary: summaryResult,
            keyTakeaways: [],
            keywords: extractKeywords(text),
            stats: {
              originalWords: originalStats.words,
              summaryWords: summaryStats.words,
              reductionPct,
              readingTimeSaved
            }
          };
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        lastError = errorData.error?.message || `Model ${model} returned HTTP ${response.status}`;
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  throw new Error(`Gemini API Error: ${lastError || 'Could not connect to Gemini models.'}`);
}

/**
 * BYOK Groq API Summarizer (Llama 3.1 8B Instant & Mixtral)
 */
export async function summarizeWithGroq(arg1, arg2, arg3 = 'medium') {
  const { apiKey, text, depth } = normalizeSummarizerArgs(arg1, arg2, arg3);
  if (!apiKey) throw new Error('Groq API Key is required.');

  const promptText = depth === 'short'
    ? 'Provide a concise summary of the following document in 4-6 high-impact bullet points.'
    : depth === 'detailed'
      ? 'Provide a detailed, thorough section-by-section breakdown and executive summary of the following document with clear markdown headings.'
      : 'Provide a clean, structured executive summary of the following document with main takeaways and conclusions in markdown.';

  const cleanedText = cleanPdfText(text).slice(0, 100000);
  const key = apiKey;

  // Universally active models on free Groq keys
  const models = ['groq/compound-mini', 'llama-3.1-8b-instant', 'gemma2-9b-it', 'mixtral-8x7b-32768'];
  let lastError = null;

  for (const model of models) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are an expert document summarizer. Output clear, well-structured markdown.' },
            { role: 'user', content: `${promptText}\n\n--- DOCUMENT CONTENT ---\n${cleanedText}` }
          ],
          temperature: 0.2
        })
      });

      if (response.ok) {
        const data = await response.json();
        const summaryResult = data.choices?.[0]?.message?.content || '';

        const originalStats = calculateTextStats(text);
        const summaryStats = calculateTextStats(summaryResult);
        const reductionPct = Math.max(0, Math.round(((originalStats.words - summaryStats.words) / originalStats.words) * 100));
        const readingTimeSaved = Math.max(0, originalStats.readingTimeMinutes - summaryStats.readingTimeMinutes);

        return {
          summary: summaryResult,
          keyTakeaways: [],
          keywords: extractKeywords(text),
          stats: {
            originalWords: originalStats.words,
            summaryWords: summaryStats.words,
            reductionPct,
            readingTimeSaved
          }
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        lastError = errorData.error?.message || `Groq returned HTTP ${response.status}`;
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  throw new Error(`Groq API Error: ${lastError || 'Could not connect to Groq models.'}`);
}

/**
 * BYOK OpenAI API Summarizer
 */
export async function summarizeWithOpenAI(arg1, arg2, arg3 = 'medium') {
  const { apiKey, text, depth } = normalizeSummarizerArgs(arg1, arg2, arg3);
  if (!apiKey) throw new Error('OpenAI API Key is required.');

  const promptText = depth === 'short'
    ? 'Provide a concise summary of the following document in 4-6 high-impact bullet points.'
    : depth === 'detailed'
      ? 'Provide a detailed, thorough section-by-section breakdown and executive summary of the following document with clear markdown headings.'
      : 'Provide a clean, structured executive summary of the following document with main takeaways and conclusions in markdown.';

  const cleanedText = cleanPdfText(text).slice(0, 100000);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert document summarizer. Output clear, well-structured markdown.' },
        { role: 'user', content: `${promptText}\n\n--- DOCUMENT CONTENT ---\n${cleanedText}` }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `OpenAI API request failed with status ${response.status}`;
    if (response.status === 429 || message.includes('quota') || message.includes('credits')) {
      throw new Error(`OpenAI Credit Error: ${message}\n\nYour OpenAI account does not have available credits. You can use our 100% Offline Smart NLP Engine for free without any API keys.`);
    }
    throw new Error(`OpenAI API Error: ${message}`);
  }

  const data = await response.json();
  const summaryResult = data.choices?.[0]?.message?.content || '';

  const originalStats = calculateTextStats(text);
  const summaryStats = calculateTextStats(summaryResult);
  const reductionPct = Math.max(0, Math.round(((originalStats.words - summaryStats.words) / originalStats.words) * 100));
  const readingTimeSaved = Math.max(0, originalStats.readingTimeMinutes - summaryStats.readingTimeMinutes);

  return {
    summary: summaryResult,
    keyTakeaways: [],
    keywords: extractKeywords(text),
    stats: {
      originalWords: originalStats.words,
      summaryWords: summaryStats.words,
      reductionPct,
      readingTimeSaved
    }
  };
}
