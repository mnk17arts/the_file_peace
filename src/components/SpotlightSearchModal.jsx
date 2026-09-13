import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiSearch,
  FiX,
  FiClock,
  FiBookOpen,
  FiCornerDownLeft
} from 'react-icons/fi';
import { TOOLS, CATEGORIES } from '../data/toolsRegistry';
import { BLOG_POSTS } from '../data/blogPosts';

const RECENT_SEARCHES_KEY = 'the-file-peace-recent-searches';

const SpotlightSearchModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Lazy initialization of recent searches from localStorage
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
        return stored ? JSON.parse(stored).slice(0, 5) : [];
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();

  // Save query to recent searches
  const saveRecentSearch = useCallback((term) => {
    if (!term || term.trim().length < 2) return;
    try {
      const trimmed = term.trim();
      setRecentSearches((prev) => {
        const updated = [trimmed, ...prev.filter(s => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5);
        if (typeof window !== 'undefined') {
          localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        }
        return updated;
      });
    } catch {
      // ignore
    }
  }, []);

  // Selection handler
  const handleSelectResult = useCallback((item) => {
    saveRecentSearch(query || item.title);
    setIsOpen(false);
    navigate(item.to);
  }, [navigate, query, saveRecentSearch]);

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check for Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      // Check for '/' when not focused on an input element
      if (
        e.key === '/' &&
        !isOpen &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setIsOpen(true);
        return;
      }

      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    const handleCustomOpen = () => {
      setIsOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-spotlight-search', handleCustomOpen);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-spotlight-search', handleCustomOpen);
    };
  }, [isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Filter matching tools and blog articles
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();

    // 1. Filter tools
    const matchedTools = TOOLS.filter((tool) => {
      const matchCat = activeCategory === 'All' || tool.category === activeCategory;
      if (!matchCat) return false;
      if (!q) return true;

      const inTitle = tool.title.toLowerCase().includes(q);
      const inDesc = tool.description.toLowerCase().includes(q);
      const inCat = tool.category.toLowerCase().includes(q);
      const inKeywords = tool.keywords?.some((k) => k.toLowerCase().includes(q));
      const inRoute = tool.to.toLowerCase().includes(q);

      return inTitle || inDesc || inCat || inKeywords || inRoute;
    }).map((t) => ({ ...t, type: 'tool' }));

    // 2. Filter blog posts if query exists or "Blog Articles" category
    let matchedArticles = [];
    if (q.length > 1 || activeCategory === 'Blog Articles') {
      matchedArticles = BLOG_POSTS.filter((post) => {
        if (!q) return true;
        const inTitle = post.title.toLowerCase().includes(q);
        const inExcerpt = post.excerpt?.toLowerCase().includes(q);
        const inTags = post.tags?.some((t) => t.toLowerCase().includes(q));
        return inTitle || inExcerpt || inTags;
      }).slice(0, 4).map((p) => ({
        title: p.title,
        description: p.excerpt || p.description,
        to: `/blog/${p.slug}`,
        category: 'Blog Guide',
        icon: FiBookOpen,
        iconColor: '#a855f7',
        badge: 'Article',
        type: 'article'
      }));
    }

    if (activeCategory === 'Blog Articles') {
      return matchedArticles;
    }

    return [...matchedTools, ...matchedArticles];
  }, [query, activeCategory]);

  // Handle arrow key navigation
  useEffect(() => {
    const handleNavigationKeys = (e) => {
      if (!isOpen || searchResults.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % searchResults.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = searchResults[selectedIndex];
        if (selected) {
          handleSelectResult(selected);
        }
      }
    };

    window.addEventListener('keydown', handleNavigationKeys);
    return () => window.removeEventListener('keydown', handleNavigationKeys);
  }, [isOpen, searchResults, selectedIndex, handleSelectResult]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.children[selectedIndex];
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 15, 0.75)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '4rem 1rem 1rem 1rem',
        animation: 'spotlightFadeIn 0.15s ease-out'
      }}
      onClick={() => setIsOpen(false)}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '18px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '80vh',
          animation: 'spotlightSlideDown 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.8rem',
            padding: '1.1rem 1.4rem',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-color)',
            position: 'relative'
          }}
        >
          <FiSearch style={{ color: 'var(--primary-color)', fontSize: '1.25rem', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search 40+ offline tools, features, or guides..."
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-color)',
              fontSize: '1.05rem',
              fontWeight: 600,
              fontFamily: 'inherit'
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-color)',
                opacity: 0.6,
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <FiX size={18} />
            </button>
          )}
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--text-color)',
              opacity: 0.6,
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              padding: '0.2rem 0.5rem',
              borderRadius: '6px'
            }}
          >
            ESC
          </span>
        </div>

        {/* 2. Category Filter Pills Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.65rem 1rem',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            overflowX: 'auto',
            scrollbarWidth: 'none'
          }}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  setSelectedIndex(0);
                }}
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: '20px',
                  border: isActive ? '1px solid var(--primary-color)' : '1px solid transparent',
                  backgroundColor: isActive ? 'rgba(28, 153, 255, 0.15)' : 'transparent',
                  color: isActive ? 'var(--primary-color)' : 'var(--text-color)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* 3. Recent Searches (Shown when query is empty) */}
        {!query && recentSearches.length > 0 && activeCategory === 'All' && (
          <div style={{ padding: '0.75rem 1.2rem 0.2rem 1.2rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-color)', opacity: 0.5, marginBottom: '0.4rem' }}>
              Recent Searches
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
              {recentSearches.map((term, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setQuery(term);
                    setSelectedIndex(0);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-color)',
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                >
                  <FiClock size={12} style={{ opacity: 0.6 }} />
                  <span>{term}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4. Results List */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.6rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.3rem',
            maxHeight: '420px'
          }}
        >
          {searchResults.length > 0 ? (
            searchResults.map((item, idx) => {
              const isSelected = selectedIndex === idx;
              const Icon = item.icon || FiSearch;

              return (
                <div
                  key={`${item.to}-${idx}`}
                  onClick={() => handleSelectResult(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.7rem 0.9rem',
                    borderRadius: '10px',
                    backgroundColor: isSelected ? 'rgba(28, 153, 255, 0.12)' : 'transparent',
                    border: isSelected ? '1px solid rgba(28, 153, 255, 0.35)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.1s ease',
                    gap: '0.8rem'
                  }}
                >
                  {/* Left: Icon & Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        backgroundColor: `${item.iconColor || '#3498db'}20`,
                        color: item.iconColor || 'var(--primary-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Icon size={18} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: isSelected ? 'var(--primary-color)' : 'var(--text-color)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.title}
                        </span>
                        {item.badge && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(255, 255, 255, 0.08)',
                              color: 'var(--text-color)',
                              opacity: 0.8
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-color)',
                          opacity: 0.65,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {item.description}
                      </span>
                    </div>
                  </div>

                  {/* Right: Category badge & arrow */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-color)', opacity: 0.5, backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {item.category}
                    </span>
                    {isSelected && (
                      <FiCornerDownLeft size={14} style={{ color: 'var(--primary-color)' }} />
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-color)', opacity: 0.6 }}>
              <FiSearch size={28} style={{ opacity: 0.3, marginBottom: '0.6rem' }} />
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>No matching tools or guides</div>
              <div style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                Try searching for &ldquo;watermark&rdquo;, &ldquo;webrtc&rdquo;, &ldquo;compress&rdquo;, or &ldquo;pdf&rdquo;.
              </div>
            </div>
          )}
        </div>

        {/* 5. Footer Quick Keyboard Hints */}
        <div
          style={{
            padding: '0.6rem 1.2rem',
            backgroundColor: 'var(--bg-color)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.74rem',
            color: 'var(--text-color)',
            opacity: 0.7
          }}
        >
          <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'center' }}>
            <span><strong style={{ padding: '1px 4px', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>↑</strong> <strong style={{ padding: '1px 4px', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>↓</strong> to navigate</span>
            <span><strong style={{ padding: '1px 4px', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>↵</strong> to select</span>
            <span><strong style={{ padding: '1px 4px', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>esc</strong> to close</span>
          </div>
          <span>100% Offline & Private</span>
        </div>
      </div>

      <style>{`
        @keyframes spotlightFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes spotlightSlideDown {
          from { opacity: 0; transform: translateY(-16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default SpotlightSearchModal;
