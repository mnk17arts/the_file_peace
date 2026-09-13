import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTheme } from '../context/useTheme';
import Logo from './Logo';
import { CATEGORIES, TOOLS } from '../data/toolsRegistry';
import { FiSearch, FiCommand, FiGrid, FiBookOpen, FiZap, FiChevronDown, FiX, FiMenu, FiTag } from 'react-icons/fi';
import WhatsNewModal from './WhatsNewModal';

const Navbar = () => {
  const { theme, toggleTheme } = useTheme();
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);
  const [isMac] = useState(() => {
    if (typeof navigator !== 'undefined') {
      return /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent || navigator.platform);
    }
    return false;
  });

  const dropdownRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  // Open dropdown immediately & clear close timer
  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setShowToolsDropdown(true);
  };

  // Graceful debounce on mouse leave (300ms cushion)
  const handleMouseLeave = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setShowToolsDropdown(false);
    }, 300);
  };

  // Close when clicked outside
  const handleClickOutside = useCallback((e) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
      setShowToolsDropdown(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    const handleEsc = (e) => {
      if (e.key === 'Escape') setShowToolsDropdown(false);
    };
    window.addEventListener('keydown', handleEsc);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEsc);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, [handleClickOutside]);

  const handleOpenSpotlight = () => {
    window.dispatchEvent(new CustomEvent('open-spotlight-search'));
    setIsMobileMenuOpen(false);
    setShowToolsDropdown(false);
  };

  // Group tools by category
  const categorizedTools = CATEGORIES.filter(c => c.id !== 'All').map(cat => ({
    category: cat,
    tools: TOOLS.filter(t => t.category === cat.id)
  }));

  return (
    <header className="site-navbar">
      <div className="navbar-container">
        {/* 1. Brand Logo */}
        <div className="navbar-left">
          <Link to="/" className="brand-link" onClick={() => setIsMobileMenuOpen(false)}>
            <Logo size={32} />
            <span className="brand-title">The File Peace</span>
            <span
              className="brand-version-badge"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsWhatsNewOpen(true);
              }}
              title="What's New in v2.0? Click to view release highlights"
              style={{ cursor: 'pointer' }}
            >
              v2.0
            </span>
          </Link>
        </div>

        {/* 2. Global Spotlight Search Pill (Desktop Center) */}
        <div className="navbar-center">
          <button
            type="button"
            className="spotlight-nav-trigger"
            onClick={handleOpenSpotlight}
            aria-label="Open Spotlight Search (Ctrl + K)"
            title="Press Ctrl+K or / to search tools anywhere"
          >
            <FiSearch className="spotlight-trigger-icon" />
            <span className="spotlight-trigger-placeholder">Search 40+ offline tools...</span>
            <span className="spotlight-trigger-shortcut">
              {isMac ? <FiCommand size={11} style={{ marginRight: 2 }} /> : <span style={{ fontSize: 10, fontWeight: 700, marginRight: 2 }}>Ctrl</span>}
              <span>K</span>
            </span>
          </button>
        </div>

        {/* 3. Navigation Links & Actions (Right) */}
        <div className="navbar-right">
          <nav className="desktop-nav-links">
            {/* All Tools Mega Dropdown */}
            <div
              ref={dropdownRef}
              className="tools-dropdown-wrapper"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <button
                type="button"
                className={`nav-btn-dropdown ${showToolsDropdown ? 'active' : ''}`}
                aria-expanded={showToolsDropdown}
                onClick={() => setShowToolsDropdown((prev) => !prev)}
              >
                <FiGrid size={15} />
                <span>All Tools</span>
                <FiChevronDown size={14} className={`dropdown-chevron ${showToolsDropdown ? 'rotated' : ''}`} />
              </button>

              {showToolsDropdown && (
                <div
                  className="mega-menu-popover"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="mega-menu-grid">
                    {categorizedTools.map(({ category, tools }) => (
                      <div key={category.id} className="mega-menu-column">
                        <div className="mega-menu-category-title">
                          <span>{category.label}</span>
                        </div>
                        <div className="mega-menu-items-list">
                          {tools.map((tool) => {
                            const Icon = tool.icon;
                            return (
                              <Link
                                key={tool.title}
                                to={tool.to}
                                className="mega-menu-item"
                                onClick={() => setShowToolsDropdown(false)}
                              >
                                <div className="mega-menu-icon-wrap" style={{ color: tool.iconColor }}>
                                  <Icon size={16} />
                                </div>
                                <span className="mega-menu-item-text">{tool.title}</span>
                                {tool.badge && (
                                  <span className="mega-menu-badge">{tool.badge}</span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <NavLink
              to="/workflow-builder"
              className={({ isActive }) => `nav-link-item ${isActive ? 'active' : ''}`}
            >
              <FiZap size={15} />
              <span>Pipelines</span>
            </NavLink>

            <NavLink
              to="/blog"
              className={({ isActive }) => `nav-link-item ${isActive ? 'active' : ''}`}
            >
              <FiBookOpen size={15} />
              <span>Blog</span>
            </NavLink>

            <NavLink
              to="/changelog"
              className={({ isActive }) => `nav-link-item ${isActive ? 'active' : ''}`}
            >
              <FiTag size={15} />
              <span>Changelog</span>
            </NavLink>
          </nav>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle-btn"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            aria-label="Toggle dark/light theme"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="mobile-menu-toggle-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Close Menu' : 'Open Menu'}
          >
            {isMobileMenuOpen ? <FiX size={22} /> : <FiMenu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="mobile-nav-drawer">
          <div className="mobile-search-trigger-wrap">
            <button
              type="button"
              className="mobile-spotlight-btn"
              onClick={handleOpenSpotlight}
            >
              <FiSearch size={16} />
              <span>Search 40+ offline tools...</span>
              <span className="mobile-shortcut-badge">Ctrl+K</span>
            </button>
          </div>

          <div className="mobile-nav-links-list">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <FiGrid size={18} />
              <span>Home & All Tools</span>
            </NavLink>

            <NavLink
              to="/workflow-builder"
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <FiZap size={18} />
              <span>Workflow Pipeline Builder</span>
            </NavLink>

            <NavLink
              to="/blog"
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <FiBookOpen size={18} />
              <span>Blog &amp; Guides</span>
            </NavLink>

            <NavLink
              to="/changelog"
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <FiTag size={18} />
              <span>Release Changelog</span>
            </NavLink>
          </div>

          <div className="mobile-categories-section">
            <h4 className="mobile-categories-heading">Explore Tools by Category</h4>
            <div className="mobile-categories-grid">
              {categorizedTools.map(({ category, tools }) => (
                <div key={category.id} className="mobile-category-block">
                  <div className="mobile-category-name">{category.label}</div>
                  <div className="mobile-category-items">
                    {tools.map((tool) => (
                      <Link
                        key={tool.title}
                        to={tool.to}
                        className="mobile-tool-item"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <tool.icon size={15} color={tool.iconColor} />
                        <span>{tool.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* What's New Update Modal */}
      <WhatsNewModal
        isOpen={isWhatsNewOpen}
        onClose={() => setIsWhatsNewOpen(false)}
      />
    </header>
  );
};

export default Navbar;
