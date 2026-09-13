import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FiSearch,
  FiClock,
  FiCalendar,
  FiArrowRight,
  FiBookOpen,
  FiShield,
  FiStar,
  FiX
} from 'react-icons/fi';
import { BLOG_CATEGORIES, BLOG_POSTS } from '../data/blogPosts';

const renderIcon = (Icon, size = 24) => {
  if (!Icon) return null;
  if (typeof Icon === 'function') {
    return <Icon size={size} />;
  }
  return Icon;
};

export default function BlogList() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = { all: BLOG_POSTS.length };
    BLOG_CATEGORIES.forEach((cat) => {
      if (cat.id !== 'all') {
        counts[cat.id] = BLOG_POSTS.filter((p) => p.category === cat.id).length;
      }
    });
    return counts;
  }, []);

  // Filtered posts
  const filteredPosts = useMemo(() => {
    return BLOG_POSTS.filter((post) => {
      const matchesCategory =
        selectedCategory === 'all' || post.category === selectedCategory;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        post.title.toLowerCase().includes(q) ||
        post.description.toLowerCase().includes(q) ||
        post.tags.some((t) => t.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const featuredPosts = useMemo(() => {
    return BLOG_POSTS.filter((p) => p.featured);
  }, []);

  return (
    <div className="blog-hub-page">
      {/* Blog Hero Section */}
      <section className="blog-hero">
        <div className="blog-hero-badge">
          <FiStar className="blog-hero-badge-icon" />
          <span>Knowledge Hub & Tool Guides</span>
        </div>
        <h1 className="blog-hero-title">Latest Updates & In-Browser Guides</h1>
        <p className="blog-hero-desc">
          Discover tutorials, productivity tips, security explanations, and practical walkthroughs
          for 100% client-side document and media processing.
        </p>

        {/* Live Search Input */}
        <div className="blog-search-wrapper">
          <FiSearch className="blog-search-icon" />
          <input
            type="text"
            className="blog-search-input"
            placeholder="Search guides, tools, tutorials, or topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search blog posts"
          />
          {searchQuery && (
            <button
              className="blog-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <FiX size={14} />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="blog-categories-pills">
          {BLOG_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            const count = categoryCounts[cat.id] || 0;
            return (
              <button
                key={cat.id}
                className={`blog-cat-pill ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                <span>{cat.label}</span>
                <span className="blog-cat-count">{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Featured Section (when no search query is active and "all" category is selected) */}
      {!searchQuery && selectedCategory === 'all' && (
        <section className="blog-featured-section">
          <div className="blog-section-header">
            <h2 className="blog-section-title">
              <FiBookOpen style={{ marginRight: '8px', color: 'var(--primary-color)' }} />
              Featured Deep Dives
            </h2>
            <span className="blog-section-sub">Hand-picked guides to get the most out of The File Peace</span>
          </div>

          <div className="blog-featured-grid">
            {featuredPosts.map((post) => (
              <article key={post.id} className="blog-featured-card">
                <div className="blog-featured-card-top">
                  <div className="blog-post-icon-badge">{renderIcon(post.icon, 26)}</div>
                  <span className="blog-featured-tag">Featured Guide</span>
                </div>

                <div className="blog-card-meta">
                  <span className="blog-meta-item">
                    <FiCalendar size={13} /> {post.publishedDate}
                  </span>
                  <span className="blog-meta-dot">•</span>
                  <span className="blog-meta-item">
                    <FiClock size={13} /> {post.readTime}
                  </span>
                </div>

                <h3 className="blog-featured-title">
                  <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                </h3>

                <p className="blog-featured-excerpt">{post.excerpt || post.description}</p>

                <div className="blog-card-footer">
                  <div className="blog-tags-list">
                    {post.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="blog-mini-tag">
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <Link to={`/blog/${post.slug}`} className="blog-read-btn">
                    <span>Read Article</span>
                    <FiArrowRight />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Main Articles Grid */}
      <section className="blog-main-grid-section">
        <div className="blog-section-header">
          <h2 className="blog-section-title">
            {selectedCategory === 'all'
              ? (searchQuery ? `Search Results (${filteredPosts.length})` : 'All Articles & Tool Tutorials')
              : `${BLOG_CATEGORIES.find((c) => c.id === selectedCategory)?.label} (${filteredPosts.length})`}
          </h2>
          {searchQuery && (
            <span className="blog-section-sub">
              Showing matching articles for &ldquo;{searchQuery}&rdquo;
            </span>
          )}
        </div>

        {filteredPosts.length === 0 ? (
          <div className="blog-empty-state">
            <div className="blog-empty-icon">
              <FiSearch size={44} style={{ color: 'var(--primary-color)', opacity: 0.6 }} />
            </div>
            <h3>No matching guides found</h3>
            <p>Try searching for a different keyword or choose another category.</p>
            <button
              className="blog-empty-reset-btn"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="blog-grid">
            {filteredPosts.map((post) => (
              <article key={post.id} className="blog-card">
                <div className="blog-card-visual">
                  <div className="blog-visual-icon">{renderIcon(post.icon, 28)}</div>
                  <span className="blog-visual-cat">
                    {BLOG_CATEGORIES.find((c) => c.id === post.category)?.label || 'Guide'}
                  </span>
                </div>

                <div className="blog-card-body">
                  <div className="blog-card-meta">
                    <span className="blog-meta-item">
                      <FiCalendar size={13} /> {post.publishedDate}
                    </span>
                    <span className="blog-meta-dot">•</span>
                    <span className="blog-meta-item">
                      <FiClock size={13} /> {post.readTime}
                    </span>
                  </div>

                  <h3 className="blog-card-title">
                    <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                  </h3>

                  <p className="blog-card-desc">{post.description}</p>

                  <div className="blog-card-footer">
                    <div className="blog-tags-list">
                      {post.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="blog-mini-tag">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <Link to={`/blog/${post.slug}`} className="blog-read-btn">
                      <span>Read Article</span>
                      <FiArrowRight />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Bottom Privacy Callout Banner */}
      <section className="blog-privacy-banner">
        <div className="blog-privacy-content">
          <FiShield className="blog-privacy-banner-icon" />
          <div>
            <h3>Built for Total Privacy</h3>
            <p>
              Every tool detailed in our guides runs 100% inside your browser using WebAssembly &amp; JavaScript.
              No document ever leaves your device.
            </p>
          </div>
        </div>
        <Link to="/" className="blog-privacy-action-btn">
          Explore All Tools
        </Link>
      </section>
    </div>
  );
}
