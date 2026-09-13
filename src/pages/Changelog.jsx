import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FiTag,
  FiCalendar,
  FiCheckCircle,
  FiShield,
  FiZap,
  FiCode,
  FiSearch,
  FiArrowRight,
  FiExternalLink,
  FiLayers,
  FiMic,
  FiColumns,
  FiImage,
  FiVideo,
} from 'react-icons/fi';
import { CHANGELOG_RELEASES } from '../data/changelogData';

// Icon lookup for highlights
const HIGHLIGHT_ICONS = {
  FiZap,
  FiCode,
  FiSearch,
  FiShield,
  FiMic,
  FiColumns,
  FiLayers,
  FiImage,
  FiVideo,
};

export default function Changelog() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered releases and items
  const filteredReleases = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return CHANGELOG_RELEASES.map((rel) => {
      // Filter category lists
      const matchesCategory = (cat) => {
        if (activeCategory === 'all') return true;
        return activeCategory === cat;
      };

      const filterList = (items) => {
        if (!items) return [];
        return items.filter((item) => !q || item.toLowerCase().includes(q));
      };

      const features = matchesCategory('features') ? filterList(rel.categories.features) : [];
      const security = matchesCategory('security') ? filterList(rel.categories.security) : [];
      const improvements = matchesCategory('improvements') ? filterList(rel.categories.improvements) : [];
      const performance = matchesCategory('performance') ? filterList(rel.categories.performance) : [];

      // Filter highlights
      const highlights = rel.highlights.filter((h) => {
        if (activeCategory !== 'all' && h.tag.toLowerCase() !== activeCategory) return false;
        if (!q) return true;
        return (
          h.title.toLowerCase().includes(q) ||
          h.description.toLowerCase().includes(q)
        );
      });

      const hasContent =
        features.length > 0 ||
        security.length > 0 ||
        improvements.length > 0 ||
        performance.length > 0 ||
        highlights.length > 0 ||
        (!q && activeCategory === 'all');

      return {
        ...rel,
        visibleHighlights: highlights,
        visibleCategories: {
          features,
          security,
          improvements,
          performance,
        },
        hasContent,
      };
    }).filter((rel) => rel.hasContent);
  }, [activeCategory, searchQuery]);

  return (
    <div
      className="changelog-page"
      style={{
        maxWidth: '1080px',
        margin: '0 auto',
        padding: '2rem 1.25rem 4rem',
      }}
    >
      {/* 1. Header Banner */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.25rem 0.85rem',
            borderRadius: '999px',
            background: 'rgba(28, 153, 255, 0.1)',
            border: '1px solid rgba(28, 153, 255, 0.25)',
            color: 'var(--primary-color)',
            fontSize: '0.78rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '0.75rem',
          }}
        >
          <FiTag size={13} />
          <span>Release Notes &amp; Roadmap</span>
        </div>

        <h1
          style={{
            fontSize: '2.4rem',
            fontWeight: 900,
            letterSpacing: '-0.03em',
            color: 'var(--text-color)',
            margin: '0 0 0.75rem 0',
          }}
        >
          Version Changelog
        </h1>

        <p
          style={{
            fontSize: '1rem',
            color: 'var(--text-muted)',
            maxWidth: '680px',
            margin: '0 auto 1.5rem',
            lineHeight: 1.55,
          }}
        >
          Continuous evolution of The File Peace: tracking feature launches, cryptographic security enhancements,
          and offline architectural upgrades with 100% client-side privacy.
        </p>

        {/* Quick Links / Badges */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.3rem 0.75rem',
              borderRadius: '8px',
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'var(--text-color)',
            }}
          >
            <FiCheckCircle color="#2ed573" size={13} />
            <span>Active Release: v2.0.0</span>
          </span>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.3rem 0.75rem',
              borderRadius: '8px',
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'var(--text-color)',
            }}
          >
            <FiShield color="var(--primary-color)" size={13} />
            <span>43+ Offline Studios</span>
          </span>

          <a
            href="https://github.com/mnk17arts/the_file_peace"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.3rem 0.75rem',
              borderRadius: '8px',
              background: 'var(--subtle-bg)',
              border: '1px solid var(--border-color)',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--text-color)',
              textDecoration: 'none',
            }}
          >
            <span>GitHub Commits</span>
            <FiExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* 2. Interactive Filter & Search Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '0.85rem 1.25rem',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          boxShadow: 'var(--card-shadow)',
          marginBottom: '2rem',
        }}
      >
        {/* Category Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Updates' },
            { id: 'features', label: 'Features' },
            { id: 'security', label: 'Security' },
            { id: 'improvements', label: 'Improvements' },
            { id: 'performance', label: 'Performance' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: activeCategory === cat.id ? 'var(--primary-color)' : 'var(--border-color)',
                background: activeCategory === cat.id ? 'var(--primary-color)' : 'transparent',
                color: activeCategory === cat.id ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Live Search Input */}
        <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 240px', maxWidth: '360px' }}>
          <FiSearch
            size={14}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Search changes by keyword…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '0.45rem 0.75rem 0.45rem 2rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--subtle-bg)',
              color: 'var(--text-color)',
              fontSize: '0.84rem',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* 3. Timeline Releases */}
      {filteredReleases.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
          }}
        >
          <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            No release notes found matching <code>&quot;{searchQuery}&quot;</code> in {activeCategory}.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('all');
            }}
            className="btn-primary"
            style={{ padding: '0.45rem 1rem', borderRadius: '8px', fontSize: '0.84rem', fontWeight: 700 }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {filteredReleases.map((release) => (
            <article
              key={release.version}
              className="changelog-release-card"
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '18px',
                padding: '1.75rem',
                boxShadow: 'var(--card-shadow)',
                position: 'relative',
              }}
            >
              {/* Release Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '1.25rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '1.4rem',
                        fontWeight: 900,
                        color: 'var(--text-color)',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      v{release.version}
                    </span>

                    {release.isLatest && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '0.15rem 0.55rem',
                          borderRadius: '999px',
                          background: '#2ed573',
                          color: '#0b0f17',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Latest Release
                      </span>
                    )}

                    <span
                      style={{
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        color: 'var(--primary-color)',
                      }}
                    >
                      — {release.codename}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {release.summary}
                  </p>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)',
                    background: 'var(--subtle-bg)',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <FiCalendar size={13} />
                  <span>{release.date}</span>
                </div>
              </div>

              {/* Major Feature Highlights Grid */}
              {release.visibleHighlights.length > 0 && (
                <div style={{ marginBottom: '1.75rem' }}>
                  <h3
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--text-muted)',
                      marginBottom: '0.85rem',
                    }}
                  >
                    Key Highlights &amp; New Studios
                  </h3>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: '0.85rem',
                    }}
                  >
                    {release.visibleHighlights.map((hl) => {
                      const IconComponent = HIGHLIGHT_ICONS[hl.icon] || FiCheckCircle;
                      return (
                        <div
                          key={hl.title}
                          style={{
                            background: 'var(--subtle-bg)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <IconComponent size={16} color="var(--primary-color)" />
                                <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-color)' }}>
                                  {hl.title}
                                </span>
                              </div>
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '4px',
                                  background: hl.tag === 'Security' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(28, 153, 255, 0.12)',
                                  color: hl.tag === 'Security' ? '#a855f7' : 'var(--primary-color)',
                                }}
                              >
                                {hl.tag}
                              </span>
                            </div>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem 0', lineHeight: 1.45 }}>
                              {hl.description}
                            </p>
                          </div>

                          <Link
                            to={hl.to}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              color: 'var(--primary-color)',
                              textDecoration: 'none',
                            }}
                          >
                            <span>Open Studio</span>
                            <FiArrowRight size={12} />
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Categorized Detailed Updates */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* 1. Features */}
                {release.visibleCategories.features.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: 'rgba(46, 213, 115, 0.12)',
                          color: '#2ed573',
                          textTransform: 'uppercase',
                        }}
                      >
                        Features
                      </span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {release.visibleCategories.features.map((item, idx) => (
                        <li key={idx} style={{ fontSize: '0.84rem', color: 'var(--text-color)', lineHeight: 1.5 }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 2. Security */}
                {release.visibleCategories.security.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: 'rgba(168, 85, 247, 0.12)',
                          color: '#a855f7',
                          textTransform: 'uppercase',
                        }}
                      >
                        Security &amp; Privacy
                      </span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {release.visibleCategories.security.map((item, idx) => (
                        <li key={idx} style={{ fontSize: '0.84rem', color: 'var(--text-color)', lineHeight: 1.5 }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 3. Improvements */}
                {release.visibleCategories.improvements.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: 'rgba(28, 153, 255, 0.12)',
                          color: 'var(--primary-color)',
                          textTransform: 'uppercase',
                        }}
                      >
                        Architecture &amp; UX Improvements
                      </span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {release.visibleCategories.improvements.map((item, idx) => (
                        <li key={idx} style={{ fontSize: '0.84rem', color: 'var(--text-color)', lineHeight: 1.5 }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 4. Performance */}
                {release.visibleCategories.performance.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: 'rgba(245, 158, 11, 0.12)',
                          color: '#f59e0b',
                          textTransform: 'uppercase',
                        }}
                      >
                        Performance
                      </span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {release.visibleCategories.performance.map((item, idx) => (
                        <li key={idx} style={{ fontSize: '0.84rem', color: 'var(--text-color)', lineHeight: 1.5 }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
