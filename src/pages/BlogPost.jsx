import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FiArrowLeft,
  FiClock,
  FiCalendar,
  FiUser,
  FiShield,
  FiArrowRight,
  FiCheckCircle,
  FiShare2,
  FiBookOpen,
  FiExternalLink,
  FiList,
  FiHeadphones,
  FiPlay,
  FiPause,
  FiSquare,
  FiAlertTriangle,
  FiCpu,
  FiServer,
  FiUserCheck,
} from 'react-icons/fi';
import { getBlogPostBySlug, getRelatedPosts, BLOG_CATEGORIES } from '../data/blogPosts';

const renderIcon = (Icon, size = 24) => {
  if (!Icon) return null;
  if (typeof Icon === 'function') {
    return <Icon size={size} />;
  }
  return Icon;
};

function formatInlineText(text) {
  if (!text) return null;
  const parts = [];
  const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.substring(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(<code key={match.index} className="blog-inline-code">{token.slice(1, -1)}</code>);
    } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const linkText = token.substring(1, token.indexOf(']('));
      const linkUrl = token.substring(token.indexOf('](') + 2, token.length - 1);
      const isInternal = linkUrl.startsWith('/') || linkUrl.startsWith('#');
      if (isInternal) {
        parts.push(
          <Link key={match.index} to={linkUrl} className="blog-content-link">
            {linkText}
          </Link>
        );
      } else {
        parts.push(
          <a
            key={match.index}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="blog-content-link"
          >
            {linkText}
          </a>
        );
      }
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push(text.substring(lastIdx));
  }

  return parts.length > 0 ? parts : text;
}

function renderFormattedContent(rawContent) {
  if (!rawContent) return null;

  const rawBlocks = rawContent.split(/\n\s*\n/);

  return rawBlocks.map((block, bIdx) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);

    // Check if entire block is a bullet list
    const isBulletList = lines.every((line) => line.startsWith('•') || line.startsWith('-') || line.startsWith('*'));
    if (isBulletList) {
      return (
        <ul key={bIdx} className="blog-content-list blog-bullet-list">
          {lines.map((line, lIdx) => {
            const cleanLine = line.replace(/^[•\-*]\s*/, '');
            return (
              <li key={lIdx} className="blog-list-item">
                <span className="blog-bullet-dot">•</span>
                <div className="blog-list-text">{formatInlineText(cleanLine)}</div>
              </li>
            );
          })}
        </ul>
      );
    }

    // Check if entire block is a numbered list
    const isNumberedList = lines.every((line) => /^\d+\.\s+/.test(line));
    if (isNumberedList) {
      return (
        <ol key={bIdx} className="blog-content-list blog-numbered-list">
          {lines.map((line, lIdx) => {
            const cleanLine = line.replace(/^\d+\.\s+/, '');
            return (
              <li key={lIdx} className="blog-list-item">
                <span className="blog-number-badge">{lIdx + 1}</span>
                <div className="blog-list-text">{formatInlineText(cleanLine)}</div>
              </li>
            );
          })}
        </ol>
      );
    }

    // Mixed lines within a block: check if some lines are bullet or numbered
    const hasListItems = lines.some((l) => l.startsWith('•') || l.startsWith('-') || /^\d+\.\s+/.test(l));
    if (hasListItems) {
      return (
        <div key={bIdx} className="blog-content-mixed-block">
          {lines.map((line, lIdx) => {
            if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
              const clean = line.replace(/^[•\-*]\s*/, '');
              return (
                <div key={lIdx} className="blog-list-item">
                  <span className="blog-bullet-dot">•</span>
                  <div className="blog-list-text">{formatInlineText(clean)}</div>
                </div>
              );
            }
            if (/^\d+\.\s+/.test(line)) {
              const numMatch = line.match(/^(\d+)\.\s+/);
              const clean = line.replace(/^\d+\.\s+/, '');
              return (
                <div key={lIdx} className="blog-list-item">
                  <span className="blog-number-badge">{numMatch ? numMatch[1] : lIdx + 1}</span>
                  <div className="blog-list-text">{formatInlineText(clean)}</div>
                </div>
              );
            }
            return (
              <p key={lIdx} className="blog-content-paragraph-text">
                {formatInlineText(line)}
              </p>
            );
          })}
        </div>
      );
    }

    // Standard paragraph
    return (
      <p key={bIdx} className="blog-content-paragraph-text">
        {lines.map((line, lIdx) => (
          <span key={lIdx}>
            {formatInlineText(line)}
            {lIdx < lines.length - 1 && ' '}
          </span>
        ))}
      </p>
    );
  });
}

function splitIntoSentences(text) {
  if (!text) return [];
  const clean = text.replace(/[*#_`~[\]()]/g, ' ').replace(/\n+/g, ' ').trim();
  const raw = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
  const results = [];
  let cur = '';
  for (const s of raw) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if ((cur + ' ' + trimmed).length < 180) {
      cur = cur ? `${cur} ${trimmed}` : trimmed;
    } else {
      if (cur) results.push(cur);
      cur = trimmed;
    }
  }
  if (cur) results.push(cur);
  return results;
}

function BlogAudioPlayer({ post }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState(1.0);
  const [currentChunkIdx, setCurrentChunkIdx] = useState(0);
  const [currentHeading, setCurrentHeading] = useState('');
  const chunksRef = useRef([]);
  const chunkIndexRef = useRef(0);
  const rateRef = useRef(1.0);
  const isPlayingRef = useRef(false);

  // Build audio chunks
  const chunks = useMemo(() => {
    if (!post) return [];
    const list = [];

    if (post.title) {
      list.push({ text: post.title, heading: 'Article Introduction' });
    }
    if (post.description) {
      splitIntoSentences(post.description).forEach((s) =>
        list.push({ text: s, heading: 'Overview' })
      );
    }

    (post.sections || []).forEach((sec) => {
      const heading = sec.heading || 'Next Section';
      if (sec.heading) {
        list.push({ text: sec.heading, heading });
      }
      if (sec.background) {
        splitIntoSentences(sec.background).forEach((s) => list.push({ text: s, heading }));
      }
      if (sec.scenario) {
        splitIntoSentences(sec.scenario).forEach((s) => list.push({ text: s, heading }));
      }
      if (sec.content) {
        splitIntoSentences(sec.content).forEach((s) => list.push({ text: s, heading }));
      }
      if (sec.steps) {
        sec.steps.forEach((step, sIdx) => {
          splitIntoSentences(`Step ${sIdx + 1}: ${step}`).forEach((s) => list.push({ text: s, heading }));
        });
      }
    });

    return list;
  }, [post]);

  useEffect(() => {
    chunksRef.current = chunks;
  }, [chunks]);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakChunk = (idx) => {
    if (!window.speechSynthesis || idx >= chunksRef.current.length || !isPlayingRef.current) {
      setIsPlaying(false);
      setIsPaused(false);
      isPlayingRef.current = false;
      return;
    }

    window.speechSynthesis.cancel();

    const chunk = chunksRef.current[idx];
    chunkIndexRef.current = idx;
    setCurrentChunkIdx(idx);
    setCurrentHeading(chunk.heading);

    const utterance = new SpeechSynthesisUtterance(chunk.text);
    utterance.rate = rateRef.current;
    utterance.lang = 'en-US';

    const voices = window.speechSynthesis.getVoices();
    const enVoice =
      voices.find((v) => v.lang.toLowerCase().startsWith('en') && !v.name.includes('Google')) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('en')) ||
      voices[0];
    if (enVoice) utterance.voice = enVoice;

    utterance.onend = () => {
      if (isPlayingRef.current) {
        speakChunk(idx + 1);
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('Audio reading error:', e);
      }
      if (isPlayingRef.current && idx + 1 < chunksRef.current.length) {
        speakChunk(idx + 1);
      } else {
        setIsPlaying(false);
        setIsPaused(false);
        isPlayingRef.current = false;
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const handlePlay = () => {
    if (!window.speechSynthesis) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      isPlayingRef.current = true;
      return;
    }

    isPlayingRef.current = true;
    setIsPlaying(true);
    setIsPaused(false);
    speakChunk(chunkIndexRef.current < chunksRef.current.length ? chunkIndexRef.current : 0);
  };

  const handlePause = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
    isPlayingRef.current = false;
  };

  const handleStop = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
    chunkIndexRef.current = 0;
    setCurrentChunkIdx(0);
    setCurrentHeading('');
  };

  const handleSpeedChange = (newRate) => {
    setRate(newRate);
    rateRef.current = newRate;
    if (isPlaying) {
      speakChunk(chunkIndexRef.current);
    }
  };

  const progressPercent = chunks.length > 0 ? Math.min(100, Math.round(((currentChunkIdx + 1) / chunks.length) * 100)) : 0;

  return (
    <div className={`blog-audio-player ${isPlaying ? 'is-active' : ''}`} aria-label="Article Audio Reading Mode">
      <div className="blog-audio-top-row">
        <div className="blog-audio-label-group">
          <div className={`blog-audio-icon-wrap ${isPlaying ? 'is-pulse' : ''}`}>
            <FiHeadphones size={18} />
          </div>
          <div>
            <span className="blog-audio-title-text">Audio Reading Mode</span>
            <span className="blog-audio-status-text">
              {isPlaying
                ? `Playing: ${currentHeading}`
                : isPaused
                ? 'Paused'
                : 'Listen to full guide offline'}
            </span>
          </div>
        </div>

        <div className="blog-audio-speed-controls" aria-label="Playback speed">
          {[0.75, 1.0, 1.25, 1.5].map((s) => (
            <button
              key={s}
              type="button"
              className={`blog-audio-speed-btn ${rate === s ? 'active' : ''}`}
              onClick={() => handleSpeedChange(s)}
              title={`Set speed to ${s}x`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className="blog-audio-bottom-row">
        {isPlaying ? (
          <button
            type="button"
            className="blog-audio-main-btn"
            onClick={handlePause}
            aria-label="Pause audio"
          >
            <FiPause size={15} />
            <span>Pause</span>
          </button>
        ) : (
          <button
            type="button"
            className="blog-audio-main-btn"
            onClick={handlePlay}
            aria-label="Play audio"
          >
            <FiPlay size={15} />
            <span>{isPaused ? 'Resume' : 'Listen Now'}</span>
          </button>
        )}

        {(isPlaying || isPaused || currentChunkIdx > 0) && (
          <button
            type="button"
            className="blog-audio-stop-btn"
            onClick={handleStop}
            title="Stop & Reset"
            aria-label="Stop audio"
          >
            <FiSquare size={14} />
          </button>
        )}

        <div className="blog-audio-progress-bar-wrap">
          <div className="blog-audio-progress-track">
            <div
              className="blog-audio-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="blog-audio-progress-info">
            <span>{chunks.length > 0 ? `${currentChunkIdx + 1} / ${chunks.length} parts` : 'Ready'}</span>
            <span>{progressPercent}% completed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BlogPost() {
  const { slug } = useParams();

  const post = useMemo(() => getBlogPostBySlug(slug), [slug]);
  const relatedPosts = useMemo(() => getRelatedPosts(slug, 3), [slug]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: post?.title,
        text: post?.description,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  if (!post) {
    return (
      <div className="blog-not-found-container">
        <div className="blog-empty-icon">
          <FiBookOpen size={48} style={{ color: 'var(--primary-color)', opacity: 0.6 }} />
        </div>
        <h2>Article Not Found</h2>
        <p>The guide or tutorial you are looking for does not exist or has been moved.</p>
        <Link to="/blog" className="blog-back-btn-primary">
          <FiArrowLeft /> Return to Knowledge Hub
        </Link>
      </div>
    );
  }

  const categoryObj = BLOG_CATEGORIES.find((c) => c.id === post.category);

  return (
    <div className="blog-post-page">
      {/* Top Breadcrumb & Back Nav */}
      <div className="blog-nav-bar">
        <Link to="/blog" className="blog-back-link">
          <FiArrowLeft />
          <span>Back to all guides</span>
        </Link>

        <nav className="blog-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span className="crumb-sep">/</span>
          <Link to="/blog">Blog</Link>
          <span className="crumb-sep">/</span>
          <span className="crumb-current">{post.title}</span>
        </nav>
      </div>

      {/* Main Article Container */}
      <article className="blog-article-container">
        {/* Article Header */}
        <header className="blog-article-header">
          <div className="blog-article-top-meta">
            <span className="blog-article-category-badge">
              {categoryObj?.label || 'Tutorial'}
            </span>
            <span className="blog-privacy-pill">
              <FiShield size={12} /> 100% Client-Side
            </span>
          </div>

          <h1 className="blog-article-main-title">{post.title}</h1>

          <div className="blog-article-meta-bar">
            <div className="blog-author-info">
              <div className="blog-author-avatar">{renderIcon(post.icon, 22)}</div>
              <div className="blog-author-details">
                <span className="blog-author-name">
                  <FiUser size={13} style={{ marginRight: '4px' }} />
                  {post.author}
                </span>
                <span className="blog-post-date">
                  <FiCalendar size={13} style={{ marginRight: '4px' }} />
                  {post.publishedDate}
                </span>
              </div>
            </div>

            <div className="blog-meta-right">
              <span className="blog-read-time-badge">
                <FiClock size={13} /> {post.readTime}
              </span>
              <button
                className="blog-share-btn"
                onClick={handleShare}
                title="Share this article"
                aria-label="Share article"
              >
                <FiShare2 size={14} />
                <span>Share</span>
              </button>
            </div>
          </div>
        </header>

        {/* Quick Tool Callout Header Banner */}
        {post.toolPath && (
          <div className="blog-tool-callout-header">
            <div className="blog-tool-callout-left">
              <span className="blog-tool-callout-emoji">{renderIcon(post.icon, 26)}</span>
              <div>
                <strong>Want to execute this right now?</strong>
                <p>Use our zero-upload {post.toolName} tool in your browser.</p>
              </div>
            </div>
            <Link to={post.toolPath} className="blog-tool-callout-btn">
              <span>Launch {post.toolName}</span>
              <FiExternalLink />
            </Link>
          </div>
        )}

        {/* Audio Reading Mode Player */}
        <BlogAudioPlayer post={post} />

        {/* Table of Contents */}
        {post.sections && post.sections.length > 1 && (
          <nav className="blog-toc-card" aria-label="Table of Contents">
            <div className="blog-toc-header">
              <FiList className="blog-toc-icon" />
              <span className="blog-toc-heading">Table of Contents</span>
            </div>
            <ol className="blog-toc-list">
              {post.sections.map((sec, sIdx) => {
                if (!sec.heading) return null;
                const targetId = `section-${sIdx}`;
                return (
                  <li key={sIdx} className="blog-toc-item">
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById(targetId);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                      className="blog-toc-link blog-toc-btn"
                    >
                      <span className="blog-toc-num">{sIdx + 1}</span>
                      <span className="blog-toc-text">{sec.heading}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        {/* Article Content Body */}
        <div className="blog-article-body">
          {post.sections &&
            post.sections.map((sec, idx) => (
              <section key={idx} id={`section-${idx}`} className="blog-content-section">
                {sec.heading && <h2 className="blog-content-heading">{sec.heading}</h2>}

                {/* Problem Background Box */}
                {sec.background && (
                  <div className="blog-background-card">
                    <div className="blog-card-pill">
                      <FiAlertTriangle size={14} />
                      <span>Problem Background &amp; Security Risks</span>
                    </div>
                    <div className="blog-card-content">{formatInlineText(sec.background)}</div>
                  </div>
                )}

                {/* Industry / Real-world Scenario Box */}
                {sec.scenario && (
                  <div className="blog-scenario-card">
                    <div className="blog-scenario-pill">
                      <FiUserCheck size={14} />
                      <span>Real-World Practical Scenario</span>
                    </div>
                    <div className="blog-card-content">{formatInlineText(sec.scenario)}</div>
                  </div>
                )}

                {/* Architecture Flowchart comparison */}
                {sec.flowchart && (
                  <div className="blog-flowchart-card">
                    <div className="blog-flowchart-header">
                      <FiCpu size={16} />
                      <span>Architecture Comparison: Local In-Memory RAM vs. Cloud Servers</span>
                    </div>
                    <div className="blog-flowchart-grid">
                      <div className="flowchart-column flowchart-local">
                        <div className="flowchart-title">
                          <FiShield size={15} />
                          <span>The File Peace (100% In-Memory)</span>
                        </div>
                        <ol className="flowchart-steps">
                          {(sec.flowchart.clientSide || []).map((step, fIdx) => (
                            <li key={fIdx}>
                              <span className="flow-step-num">{fIdx + 1}</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                      <div className="flowchart-column flowchart-cloud">
                        <div className="flowchart-title">
                          <FiServer size={15} />
                          <span>Traditional Remote Converters</span>
                        </div>
                        <ol className="flowchart-steps">
                          {(sec.flowchart.cloudServer || []).map((step, fIdx) => (
                            <li key={fIdx}>
                              <span className="flow-step-num">{fIdx + 1}</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  </div>
                )}

                {sec.content && (
                  <div className="blog-content-rendered">
                    {renderFormattedContent(sec.content)}
                  </div>
                )}

                {/* Step-by-Step Box */}
                {sec.steps && (
                  <div className="blog-steps-container">
                    {sec.steps.map((step, sIdx) => (
                      <div key={sIdx} className="blog-step-item">
                        <div className="blog-step-number">{sIdx + 1}</div>
                        <div className="blog-step-text">
                          <FiCheckCircle className="blog-step-check-icon" />
                          <span>{formatInlineText(step)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
        </div>

        {/* Interactive "Try Tool Now" Bottom Box */}
        {post.toolPath && (
          <div className="blog-article-cta-box">
            <div className="blog-cta-icon-wrapper">{renderIcon(post.icon, 40)}</div>
            <div className="blog-cta-text-content">
              <h3>Try {post.toolName} For Free</h3>
              <p>
                Experience fast, distraction-free in-memory processing. No sign-up required, no file
                limits, and zero cloud uploads.
              </p>
            </div>
            <Link to={post.toolPath} className="blog-cta-primary-btn">
              <span>Open {post.toolName}</span>
              <FiArrowRight />
            </Link>
          </div>
        )}

        {/* Article Tags Footer */}
        <div className="blog-article-tags-footer">
          <span className="blog-tags-label">Related Topics:</span>
          <div className="blog-tags-pills">
            {post.tags.map((tag) => (
              <span key={tag} className="blog-tag-badge">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </article>

      {/* Related Articles Section */}
      {relatedPosts.length > 0 && (
        <section className="blog-related-section">
          <div className="blog-section-header">
            <h2 className="blog-section-title">
              <FiBookOpen style={{ marginRight: '8px', color: 'var(--primary-color)' }} />
              Related Guides &amp; Tutorials
            </h2>
          </div>

          <div className="blog-related-grid">
            {relatedPosts.map((rPost) => (
              <article key={rPost.id} className="blog-card">
                <div className="blog-card-visual">
                  <div className="blog-visual-icon">{renderIcon(rPost.icon, 28)}</div>
                  <span className="blog-visual-cat">
                    {BLOG_CATEGORIES.find((c) => c.id === rPost.category)?.label || 'Guide'}
                  </span>
                </div>

                <div className="blog-card-body">
                  <div className="blog-card-meta">
                    <span className="blog-meta-item">
                      <FiCalendar size={13} /> {rPost.publishedDate}
                    </span>
                    <span className="blog-meta-dot">•</span>
                    <span className="blog-meta-item">
                      <FiClock size={13} /> {rPost.readTime}
                    </span>
                  </div>

                  <h3 className="blog-card-title">
                    <Link to={`/blog/${rPost.slug}`}>{rPost.title}</Link>
                  </h3>

                  <p className="blog-card-desc">{rPost.description}</p>

                  <div className="blog-card-footer">
                    <Link to={`/blog/${rPost.slug}`} className="blog-read-btn">
                      <span>Read Guide</span>
                      <FiArrowRight />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
