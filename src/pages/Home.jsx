import { useState, useRef, useEffect, useMemo } from 'react';
import ToolCard from '../components/ToolCard';
import FaqSection from '../components/FaqSection';
import { CATEGORIES, TOOLS } from '../data/toolsRegistry';
import {
  FiSearch,
  FiX,
  FiShield,
  FiZap,
  FiShare2,
  FiLock,
  FiUploadCloud,
  FiCpu,
  FiDownload,
} from 'react-icons/fi';

const Home = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);

  // Keyboard shortcut listener: Press '/' or 'Ctrl+K' / 'Cmd+K' to focus or open spotlight
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute category counts
  const categoryCounts = useMemo(() => {
    const counts = { All: TOOLS.length };
    TOOLS.forEach((tool) => {
      counts[tool.category] = (counts[tool.category] || 0) + 1;
    });
    return counts;
  }, []);

  // Filter tools based on category and search query
  const filteredTools = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return TOOLS.filter((tool) => {
      // Category match
      const matchesCategory = activeCategory === 'All' || tool.category === activeCategory;

      if (!matchesCategory) return false;
      if (!query) return true;

      // Search match across title, description, category, and keywords
      const inTitle = tool.title.toLowerCase().includes(query);
      const inDesc = tool.description.toLowerCase().includes(query);
      const inCat = tool.category.toLowerCase().includes(query);
      const inKeywords = tool.keywords?.some((k) => k.toLowerCase().includes(query));

      return inTitle || inDesc || inCat || inKeywords;
    });
  }, [activeCategory, searchQuery]);

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
      {/* 1. Hero Section */}
      <section className="hero-section">
        <div className="hero-pill-badge">
          <span>✌️ 100% Client-Side Privacy</span>
        </div>

        <h1 className="hero-title">
          Every tool you need to work with files.
          <br />
          <span className="hero-gradient-text">Private. Fast. Offline.</span>
        </h1>

        <p className="hero-subtitle">
          Lightning-fast PDF, image, video, and archive utilities executed entirely in your browser memory.
          Zero file uploads. Zero server tracking. Complete peace of mind.
        </p>

        {/* Feature Badges */}
        <div className="hero-badges-row">
          <span className="hero-trust-tag">
            <FiShield style={{ color: 'var(--accent-color)' }} /> 0 Cloud Uploads
          </span>
          <span className="hero-trust-tag">
            <FiZap style={{ color: '#f1c40f' }} /> In-Memory WASM Speed
          </span>
          <span className="hero-trust-tag">
            <FiShare2 style={{ color: 'var(--primary-color)' }} /> Inter-Tool Action Piping
          </span>
          <span className="hero-trust-tag">
            <FiLock style={{ color: '#ff4757' }} /> 100% Free & Secure
          </span>
        </div>

        {/* 2. Interactive Search Bar */}
        <div className="search-container">
          <div className="search-input-wrapper">
            <FiSearch className="search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="search-input"
              placeholder="Search tools (e.g., watermark, compress, merge, qr, zip, protect)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search tools"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
                aria-label="Clear search"
              >
                <FiX size={18} />
              </button>
            )}
            <span className="search-shortcut-hint">/</span>
          </div>
        </div>
      </section>

      {/* 3. Category Filter Navigation */}
      <nav className="category-filter" aria-label="Tool Categories">
        {CATEGORIES.map((category) => {
          const Icon = category.icon;
          const isActive = activeCategory === category.id;
          const count = categoryCounts[category.id] || 0;

          return (
            <button
              key={category.id}
              className={`category-pill ${isActive ? 'active' : ''}`}
              onClick={() => setActiveCategory(category.id)}
              aria-pressed={isActive}
            >
              <Icon size={16} />
              <span>{category.label}</span>
              <span className="category-pill-count">{count}</span>
            </button>
          );
        })}
      </nav>

      {/* 4. Tools Grid Header & Results */}
      <div className="tools-grid-header">
        <span className="tools-count-text">
          {filteredTools.length === TOOLS.length
            ? `All Tools (${filteredTools.length})`
            : `Showing ${filteredTools.length} of ${TOOLS.length} tools`}
        </span>
      </div>

      {filteredTools.length > 0 ? (
        <div className="tools-grid">
          {filteredTools.map((tool) => (
            <ToolCard
              key={tool.title}
              to={tool.to}
              icon={tool.icon}
              title={tool.title}
              description={tool.description}
              iconColor={tool.iconColor}
              category={tool.category}
              badge={tool.badge}
            />
          ))}
        </div>
      ) : (
        /* Empty Search Results */
        <div className="empty-search-state">
          <FiSearch className="empty-search-icon" />
          <h3 className="empty-search-title">No tools found</h3>
          <p className="empty-search-desc">
            We couldn&apos;t find any tools matching &ldquo;<strong>{searchQuery}</strong>&rdquo;
            {activeCategory !== 'All' ? ` in ${activeCategory}` : ''}.
          </p>
          <button
            type="button"
            className="empty-search-reset-btn"
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('All');
            }}
          >
            Show All Tools
          </button>
        </div>
      )}

      {/* 5. "Why Choose The File Peace" Value Propositions Section */}
      <section className="value-props-section">
        <span className="section-tag">Privacy by Design</span>
        <h2 className="section-heading">Why Choose The File Peace?</h2>
        <p className="section-subheading">
          Engineered for users and professionals who refuse to sacrifice security for convenience.
        </p>

        <div className="value-props-grid">
          <div className="value-prop-card">
            <div
              className="value-prop-icon-wrap"
              style={{ backgroundColor: 'rgba(46, 213, 115, 0.12)', color: '#2ed573' }}
            >
              <FiShield />
            </div>
            <h3 className="value-prop-title">100% Client-Side Privacy</h3>
            <p className="value-prop-desc">
              Your files and passwords are never transmitted over the internet or saved to remote databases.
              All operations execute strictly within local browser memory.
            </p>
          </div>

          <div className="value-prop-card">
            <div
              className="value-prop-icon-wrap"
              style={{ backgroundColor: 'rgba(28, 153, 255, 0.12)', color: '#1c99ff' }}
            >
              <FiZap />
            </div>
            <h3 className="value-prop-title">Instant In-Memory Speed</h3>
            <p className="value-prop-desc">
              Powered by WebAssembly (WASM), Web Workers, and HTML5 Canvas streams. No upload latency,
              no server queue delays, and zero download bandwidth consumption.
            </p>
          </div>

          <div className="value-prop-card">
            <div
              className="value-prop-icon-wrap"
              style={{ backgroundColor: 'rgba(168, 85, 247, 0.12)', color: '#a855f7' }}
            >
              <FiShare2 />
            </div>
            <h3 className="value-prop-title">Inter-Tool Action Piping</h3>
            <p className="value-prop-desc">
              Chain multiple actions seamlessly. Unlock an encrypted PDF, watermark it, organize its pages,
              and convert it to images without saving intermediate files to disk.
            </p>
          </div>
        </div>
      </section>

      {/* 6. "How It Works" 3-Step Guide */}
      <section className="workflow-section">
        <span className="section-tag">Simple & Intuitive</span>
        <h2 className="section-heading">How It Works</h2>
        <p className="section-subheading">
          Three simple steps to process any file securely on your device.
        </p>

        <div className="workflow-steps-grid">
          <div className="workflow-step-card">
            <span className="workflow-step-number">01</span>
            <div
              className="value-prop-icon-wrap"
              style={{ backgroundColor: 'rgba(28, 153, 255, 0.1)', color: 'var(--primary-color)' }}
            >
              <FiUploadCloud />
            </div>
            <h3 className="workflow-step-title">Select or Drop Your File</h3>
            <p className="workflow-step-desc">
              Drag and drop your PDF, image, or video directly into any tool. The file loads instantly in memory.
            </p>
          </div>

          <div className="workflow-step-card">
            <span className="workflow-step-number">02</span>
            <div
              className="value-prop-icon-wrap"
              style={{ backgroundColor: 'rgba(255, 153, 28, 0.1)', color: 'var(--secondary-color)' }}
            >
              <FiCpu />
            </div>
            <h3 className="workflow-step-title">Process & Customize</h3>
            <p className="workflow-step-desc">
              Configure watermarks, page numbers, encryption keys, or compression ratios with real-time feedback.
            </p>
          </div>

          <div className="workflow-step-card">
            <span className="workflow-step-number">03</span>
            <div
              className="value-prop-icon-wrap"
              style={{ backgroundColor: 'rgba(46, 213, 115, 0.1)', color: '#2ed573' }}
            >
              <FiDownload />
            </div>
            <h3 className="workflow-step-title">Download or Pipe Forward</h3>
            <p className="workflow-step-desc">
              Download your modified document immediately or route it to another tool using the action menu.
            </p>
          </div>
        </div>
      </section>

      {/* 7. Frequently Asked Questions Section */}
      <FaqSection />
    </div>
  );
};

export default Home;
