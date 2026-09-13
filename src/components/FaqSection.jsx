import { useState, useMemo } from 'react';
import {
  FiChevronDown,
  FiHelpCircle,
  FiShield,
  FiZap,
  FiLayers,
  FiSearch,
  FiMessageSquare,
  FiExternalLink
} from 'react-icons/fi';

const FAQ_DATA = [
  {
    id: 1,
    category: 'Privacy & Security',
    question: 'Are my files or passwords uploaded to any remote server?',
    answer:
      'No, never. The File Peace operates under a strict 100% offline-first architecture. All document parsing, image rendering, encryption, watermarking, and video encoding execute entirely inside your local browser memory using WebAssembly, Web Workers, and HTML5 Canvas. Your files and passwords never leave your device.',
  },
  {
    id: 2,
    category: 'Privacy & Security',
    question: 'Can I use The File Peace completely offline without internet?',
    answer:
      'Yes! Once the application is loaded in your browser cache, all fonts, icons, scripts, and WebAssembly runtimes (including FFmpeg) are stored locally on your machine. You can disconnect your Wi-Fi or go offline and all tools will continue to work seamlessly.',
  },
  {
    id: 3,
    category: 'Privacy & Security',
    question: 'How do the PDF Unlock and Protect PDF tools work?',
    answer:
      'Protect PDF encrypts your document with standard password security directly in browser memory. Unlock PDF validates your existing password, decrypts the underlying document streams, and permanently strips all restrictive permissions (such as printing, copying, and editing locks) to produce a clean, unlocked PDF.',
  },
  {
    id: 4,
    category: 'Tools & Features',
    question: 'What is the Inter-Tool Action Piping system?',
    answer:
      'Inter-Tool Piping allows you to seamlessly chain multiple operations without downloading and re-uploading intermediate files. For example, you can Unlock a PDF, pass it immediately to Add Watermark, organize its pages, and extract PNG images—all in a single fluid workflow in browser memory.',
  },
  {
    id: 5,
    category: 'Tools & Features',
    question: 'Which file formats and document types are supported?',
    answer:
      'The File Peace supports PDF documents, all major image formats (PNG, JPG, JPEG, WebP, BMP), video formats (MP4, WebM, MOV), code and data files (JavaScript, Python, C++, Java, HTML, CSS, Markdown, TXT, CSV), and sandboxed HTML markup.',
  },
  {
    id: 6,
    category: 'Performance & Limits',
    question: 'What are the file size and performance limits?',
    answer:
      'Because all processing occurs in local device RAM, there are no artificial server quotas or paywalled size limits. For optimal performance on standard laptops and mobile phones, we recommend PDFs under 200 MB and video files under 100 MB.',
  },
  {
    id: 7,
    category: 'Tools & Features',
    question: 'Is The File Peace 100% free with no hidden charges or limits?',
    answer:
      'Yes, The File Peace is completely free and open-source under the MIT license. There are no subscriptions, no forced watermarks added to your outputs, no account sign-up requirements, and no daily file limits.',
  },
  {
    id: 8,
    category: 'Performance & Limits',
    question: 'Why does video compression take longer than image compression?',
    answer:
      'Video compression utilizes a full FFmpeg encoder compiled to WebAssembly running directly on your CPU. Processing millions of video frames and re-encoding audio tracks locally is CPU-intensive, taking slightly longer on low-power mobile processors compared to desktop multi-core CPUs.',
  },
];

const FAQ_CATEGORIES = [
  { id: 'All', label: 'All Questions', icon: FiHelpCircle },
  { id: 'Privacy & Security', label: 'Privacy & Security', icon: FiShield },
  { id: 'Tools & Features', label: 'Tools & Features', icon: FiLayers },
  { id: 'Performance & Limits', label: 'Performance & Limits', icon: FiZap },
];

const FaqSection = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [openIds, setOpenIds] = useState(new Set([1])); // First question open by default
  const [searchQuery, setSearchQuery] = useState('');

  const toggleQuestion = (id) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredFaqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return FAQ_DATA.filter((item) => {
      const matchesCat = activeCategory === 'All' || item.category === activeCategory;
      if (!matchesCat) return false;
      if (!query) return true;

      const inQ = item.question.toLowerCase().includes(query);
      const inA = item.answer.toLowerCase().includes(query);
      return inQ || inA;
    });
  }, [activeCategory, searchQuery]);

  return (
    <section className="faq-section" id="faq" aria-labelledby="faq-heading">
      <div className="faq-header">
        <span className="section-tag">Frequently Asked Questions</span>
        <h2 id="faq-heading" className="section-heading">
          Everything You Need to Know
        </h2>
        <p className="section-subheading">
          Clear answers about our 100% offline-first security, file handling, performance, and supported tools.
        </p>

        {/* Search within FAQ */}
        <div className="faq-search-wrapper">
          <FiSearch className="faq-search-icon" />
          <input
            type="text"
            className="faq-search-input"
            placeholder="Search answers (e.g. offline, password, privacy, video)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search frequently asked questions"
          />
        </div>

        {/* Category Pills */}
        <div className="faq-category-row" role="tablist" aria-label="FAQ Categories">
          {FAQ_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;

            return (
              <button
                key={cat.id}
                role="tab"
                aria-selected={isActive}
                className={`faq-cat-pill ${isActive ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <Icon size={15} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accordion List */}
      <div className="faq-accordion-list">
        {filteredFaqs.length > 0 ? (
          filteredFaqs.map((faq) => {
            const isOpen = openIds.has(faq.id);

            return (
              <div
                key={faq.id}
                className={`faq-item ${isOpen ? 'open' : ''}`}
              >
                <button
                  type="button"
                  className="faq-question-btn"
                  onClick={() => toggleQuestion(faq.id)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${faq.id}`}
                >
                  <span className="faq-question-text">{faq.question}</span>
                  <div className={`faq-chevron-wrap ${isOpen ? 'rotate' : ''}`}>
                    <FiChevronDown />
                  </div>
                </button>

                {isOpen && (
                  <div
                    id={`faq-answer-${faq.id}`}
                    className="faq-answer-panel"
                    role="region"
                  >
                    <p className="faq-answer-text">{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="faq-empty">
            <FiHelpCircle size={36} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
            <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-color)' }}>
              No matching questions found for &ldquo;{searchQuery}&rdquo;.
            </p>
            <button
              type="button"
              className="faq-reset-btn"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('All');
              }}
            >
              Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* Bottom Help Card */}
      <div className="faq-help-card">
        <div className="faq-help-icon-wrap">
          <FiMessageSquare size={24} />
        </div>
        <div className="faq-help-content">
          <h3 className="faq-help-title">Still have questions or suggestions?</h3>
          <p className="faq-help-desc">
            The File Peace is open source and actively developed. Submit an issue or request a feature directly on GitHub.
          </p>
        </div>
        <a
          href="https://github.com/mnk17arts/the_file_peace/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="faq-help-btn"
        >
          <span>GitHub Issues</span>
          <FiExternalLink size={16} />
        </a>
      </div>
    </section>
  );
};

export default FaqSection;
