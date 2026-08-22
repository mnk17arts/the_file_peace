import { Link, NavLink } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import Logo from './Logo';
import { useState } from 'react';
import {
  FiLayers,
  FiScissors,
  FiRefreshCw,
  FiImage,
  FiFileText,
  FiCode,
  FiLayout,
  FiLock,
  FiUnlock,
  FiEdit3,
  FiHash,
  FiPenTool,
  FiBookOpen,
  FiVideo,
} from "react-icons/fi";
const toolCategories = [
  {
    title: "ORGANIZE PDF",
    tools: [
      { title: "Merge PDF", to: "/merge-pdf" ,icon: FiLayers,iconColor :"#6366f1"},
      { title: "Split PDF", to: "/split-pdf" ,icon: FiScissors,iconColor :"#f1c40f"},
      { title: "Rotate PDF", to: "/rotate-pdf" ,icon: FiRefreshCw,iconColor :"#3498db"},
      { title: "Organize PDF", to: "/organize-pdf" ,icon: FiLayout,iconColor :"#e74c3c"},
    ],
  },
  {
    title: "OPTIMIZE",
    tools: [
      { title: "Compress Image", to: "/compress-image" ,icon: FiImage,iconColor :"#f97316"},
      { title: "Compress Video", to: "/compress-video" ,icon: FiVideo,iconColor :"#8b5cf6"},
    ],
  },
  {
    title: "CONVERT",
    tools: [
      { title: "PDF to Image", to: "/pdf-to-image" ,icon: FiFileText,iconColor :"#f59e0b"},
      { title: "Image to PDF", to: "/image-to-pdf" ,icon: FiImage,iconColor :"#43f916"},
      { title: "Convert Image", to: "/convert-image" ,icon: FiImage,iconColor :"#f97316"},
      { title: "Text & Code to PDF", to: "/text-to-pdf" ,icon: FiCode,iconColor :"#ef4444"},
      { title: "Markup Converter", to: "/markup-converter" ,icon: FiLayout,iconColor :"#3498db"},
    ],
  },
  {
    title: "EDIT PDF",
    tools: [
      { title: "Add Watermark", to: "/add-watermark" ,icon: FiPenTool,iconColor :"#d61410"},
      { title: "Page Numbers", to: "/page-numbers" ,icon: FiHash,iconColor :"#3498db"},
    ],
  },
  {
    title: "PDF SECURITY",
    tools: [
      { title: "Protect PDF", to: "/protect-pdf" ,icon: FiLock,iconColor :"#f631e2"},
    ],
  },
  {
    title: "PDF INTELLIGENCE",
    tools: [
      { title: "Read PDF", to: "/pdf-reader" ,icon: FiBookOpen,iconColor :"#10b981"},
    ],
  },
];
const Navbar = () => {
  const { theme, toggleTheme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showConvertDropdown, setShowConvertDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const getResponsiveStyles = () => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    
    return {
      header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: isMobile ? "0.75rem 1rem" : "1rem 2rem",
        backgroundColor: "var(--card-bg)",
        borderBottom: "1px solid var(--border-color)",
        position: "relative",
        flexWrap: "wrap",
        gap: isMobile ? "0.5rem" : "1rem",
      },
      brandLink: {
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? '0.5rem' : '0.75rem',
        textDecoration: 'none',
        color: 'var(--text-color)',
        fontWeight: 'bold',
        fontSize: isMobile ? '1rem' : '1.25rem',
      },
      brandText: {
        letterSpacing: '-0.5px',
      },
      badge: {
        fontSize: isMobile ? '0.6rem' : '0.7rem',
        backgroundColor: 'var(--primary-color)',
        color: 'white',
        padding: isMobile ? '0.1rem 0.3rem' : '0.15rem 0.4rem',
        borderRadius: '4px',
        fontWeight: '600',
      },
      nav: {
        display: isMobile ? (isMobileMenuOpen ? "flex" : "none") : "flex",
        alignItems: isMobile ? "stretch" : "center",
        gap: isMobile ? "0" : "1.5rem",
        flexDirection: isMobile ? "column" : "row",
        position: isMobile ? "absolute" : "relative",
        top: isMobile ? "calc(100% + 10px)" : "auto",
        left: isMobile ? "0" : "auto",
        right: isMobile ? "0" : "auto",
        width: isMobile ? "calc(100vw - 2rem)" : "auto",
        backgroundColor: isMobile ? "var(--card-bg)" : "transparent",
        borderTop: isMobile ? "1px solid var(--border-color)" : "none",
        padding: isMobile ? "1rem" : "0",
        zIndex: isMobile ? "1000" : "auto",
        margin: isMobile ? "0 1rem" : "0",
        borderRadius: isMobile ? "12px" : "0",
      },

      navLink: {
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        textDecoration: "none",
        color: "var(--text-color)",
        fontWeight: 600,
        fontSize: isMobile ? "0.95rem" : "15px",
        padding: isMobile ? "0.75rem 1rem" : "10px 0",
        transition: "color 0.25s ease",
        cursor: "pointer",
        borderRadius: isMobile ? "8px" : "0",
      },

      navButton: {
        background: isMobile ? "var(--border-color)" : "transparent",
        border: "none",
        color: "var(--text-color)",
        fontSize: isMobile ? "0.95rem" : "15px",
        fontWeight: 600,
        padding: isMobile ? "0.75rem 1rem" : "0",
        borderRadius: isMobile ? "8px" : "0",
        cursor: "pointer",
        transition: "all 0.25s ease",
        fontFamily: "inherit",
        textAlign: "left",
        width: isMobile ? "100%" : "auto",
      },

      menuToggle: {
        display: isMobile ? "flex" : "none",
        flexDirection: "column",
        gap: "4px",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "0.5rem",
      },
      hamburgerLine: {
        width: "24px",
        height: "2px",
        backgroundColor: "var(--text-color)",
        transition: "all 0.3s ease",
      },

      themeBtn: {
        background: "var(--primary-color)",
        color: "#fff",
        border: "none",
        borderRadius: "8px",
        padding: isMobile ? "6px 10px" : "8px 14px",
        cursor: "pointer",
        fontWeight: 600,
        fontSize: isMobile ? "0.8rem" : "1rem",
        order: isMobile ? "-1" : "auto",
      },

      dropdown: {
        position: isMobile ? "static" : "relative",
        display: "flex",
        alignItems: isMobile ? "stretch" : "center",
        flexDirection: isMobile ? "column" : "row",
        width: isMobile ? "100%" : "auto",
      },

      megaMenu: {
        position: isMobile ? "static" : "absolute",
        top: isMobile ? "auto" : "calc(100% + 2px)",
        left: isMobile ? "auto" : "100px",
        right: isMobile ? "auto" : "50%",
        transform: isMobile ? "none" : "translateX(-68%)",
        width: isMobile ? "100%" : "90vw",
        maxWidth: isMobile ? "100%" : "1050px",
        background: isMobile ? "transparent" : "var(--card-bg)",
        border: isMobile ? "none" : "1px solid var(--border-color)",
        borderRadius: isMobile ? "0" : "22px",
        padding: isMobile ? "1rem 0 0 0" : "42px 38px",
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(7, minmax(180px,1fr))",
        columnGap: isMobile ? "0" : "2px",
        rowGap: isMobile ? "0" : "10px",
        boxShadow: isMobile ? "none" : "0 20px 60px rgba(0,0,0,.15)",
        zIndex: 9999,
        overflow: "visible",
        maxHeight: isMobile ? "auto" : "70vh",
        overflowY: isMobile ? "visible" : "auto",
      },
      arrow: {
        display: isMobile ? "none" : "block",
        position: "absolute",
        top: isMobile ? "auto" : "-11px",
        bottom: isMobile ? "-9px" : "auto",
        left: isMobile ? "50%" : "710px",
        transform: isMobile ? "translateX(-50%) rotate(45deg)" : "translateX(-50%) rotate(45deg)",
        width: "18px",
        height: "18px",
        background: "var(--card-bg)",
        borderTop: "1px solid var(--border-color)",
        borderLeft: "1px solid var(--border-color)",
        zIndex: 10000,
      },
      megaColumn: {
        display: "flex",
        flexDirection: "column",
        gap: isMobile ? "0.25rem" : "8px",
        borderTop: isMobile ? "1px solid var(--border-color)" : "none",
        paddingTop: isMobile ? "0.75rem" : "0",
        marginTop: isMobile ? "0.75rem" : "0",
      },
      megaHeading: {
        fontSize: isMobile ? "0.75rem" : "15px",
        fontWeight: 700,
        color: "#7d828d",
        marginBottom: isMobile ? "0.5rem" : "18px",
        textTransform: "uppercase",
        letterSpacing: ".4px",
        display: isMobile ? "block" : "block",
      },

      megaItem: {
        display: "flex",
        alignItems: "center",
        gap: isMobile ? "0.5rem" : "12px",
        padding: isMobile ? "0.4rem 0" : "9px 0",
        textDecoration: "none",
        color: "var(--text-color)",
        fontSize: isMobile ? "0.85rem" : "17px",
        fontWeight: 500,
        transition: ".25s ease",
        cursor: "pointer",
        whiteSpace: "nowrap",
        borderRadius: "8px",
      },

      convertMenu: {
        position: isMobile ? "static" : "absolute",
        top: isMobile ? "auto" : "calc(100% + 2px)",
        left: isMobile ? "auto" : "50%",
        transform: isMobile ? "none" : "translateX(-50%)",
        width: isMobile ? "100%" : "650px",
        background: isMobile ? "transparent" : "var(--card-bg)",
        border: isMobile ? "none" : "1px solid var(--border-color)",
        borderRadius: isMobile ? "0" : "18px",
        padding: isMobile ? "1rem 0 0 0" : "32px",
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)",
        gap: isMobile ? "1.5rem" : "40px",
        boxShadow: isMobile ? "none" : "0 18px 50px rgba(0,0,0,.15)",
        zIndex: 9999,
        overflow: "visible",
        maxHeight: isMobile ? "auto" : "70vh",
        overflowY: isMobile ? "visible" : "auto",
      },

      convertColumn: {
        display: "flex",
        flexDirection: "column",
        borderTop: isMobile ? "1px solid var(--border-color)" : "none",
        paddingTop: isMobile ? "1rem" : "0",
        marginTop: isMobile ? "1rem" : "0",
      },

      convertHeading: {
        fontSize: isMobile ? "0.75rem" : "15px",
        fontWeight: 700,
        color: "#8b8f98",
        textTransform: "uppercase",
        marginBottom: isMobile ? "0.75rem" : "20px",
      },

      convertItem: {
        display: "flex",
        alignItems: "center",
        gap: isMobile ? "0.5rem" : "12px",
        padding: isMobile ? "0.5rem 0" : "10px 0",
        textDecoration: "none",
        color: "var(--text-color)",
        fontSize: isMobile ? "0.9rem" : "15px",
        fontWeight: 500,
        transition: "all .25s ease",
        cursor: "pointer",
      },

      convertArrow: {
        display: isMobile ? "none" : "block",
        position: "absolute",
        top: isMobile ? "auto" : "-9px",
        bottom: isMobile ? "-7px" : "auto",
        left: "50%",
        transform: "translateX(-50%) rotate(45deg)",
        width: "18px",
        height: "18px",
        background: "var(--card-bg)",
        borderTop: "1px solid var(--border-color)",
        borderLeft: "1px solid var(--border-color)",
        zIndex: 10000,
      },
    };
  };
  
  const styles = getResponsiveStyles();

  return (
    <header style={styles.header}>
      <Link to="/" style={styles.brandLink}>
        <Logo size={32} />
        <span style={styles.brandText}>The File Peace</span>
        <span style={styles.badge}>v1.0</span>
      </Link>

      <button 
        style={styles.menuToggle}
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle menu"
      >
        <div style={{
          ...styles.hamburgerLine,
          transform: isMobileMenuOpen ? 'rotate(45deg) translateY(12px)' : 'rotate(0)'
        }} />
        <div style={{
          ...styles.hamburgerLine,
          opacity: isMobileMenuOpen ? '0' : '1'
        }} />
        <div style={{
          ...styles.hamburgerLine,
          transform: isMobileMenuOpen ? 'rotate(-45deg) translateY(-12px)' : 'rotate(0)'
        }} />
      </button>

      <nav style={styles.nav}>


        <NavLink
          to="/merge-pdf"
          style={({ isActive }) => ({
    ...styles.navLink,
    color: isActive ? "var(--primary-color)" : "var(--text-color)",
    textDecoration: "none",
  })}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--primary-color)";
            
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-color)";
            
          }}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          MERGE PDF
        </NavLink>

        <NavLink
          to="/split-pdf"
           style={({ isActive }) => ({
    ...styles.navLink,
    color: isActive ? "var(--primary-color)" : "var(--text-color)",
    textDecoration: "none",
  })}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--primary-color)";
           
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-color)";
        
          }}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          SPLIT PDF
        </NavLink>

        <NavLink
  to="/compress-image"
  style={({ isActive }) => ({
    ...styles.navLink,
    color: isActive ? "var(--primary-color)" : "var(--text-color)",
    textDecoration: "none",
  })}
  onMouseEnter={(e) => {
    e.currentTarget.style.color = "var(--primary-color)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.color = "var(--text-color)";
  }}
  onClick={() => setIsMobileMenuOpen(false)}
>
  COMPRESS IMAGE 
</NavLink>
        <div
          style={styles.dropdown}
          onMouseEnter={() => setShowConvertDropdown(true)}
          onMouseLeave={() => setShowConvertDropdown(false)}
        ><button
          style={styles.navButton}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--primary-color)";
           
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-color)";
           
          }}
        >
            CONVERT ▾
          </button>

          {showConvertDropdown && (
            <div style={styles.convertMenu}>




              <div style={styles.convertArrow}></div>

              <div style={styles.convertColumn}>

                <h3 style={styles.convertHeading}>
                  CONVERT TO PDF
                </h3>

                <Link
                  to="/image-to-pdf"
                  
                  style={styles.convertItem}

                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--primary-color)";
                    e.currentTarget.style.transform = "translateX(5px)";
                  }}

                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-color)";
                    e.currentTarget.style.transform = "translateX(0)";
                  }}
                  onClick={() => {
                    setShowConvertDropdown(false);
                    setIsMobileMenuOpen(false);
                  }}
                >   <FiImage color="#8b5cf6" size={18} /> Image to PDF</Link>
                <Link
                  to="/text-to-pdf"
                  style={styles.convertItem}

                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--primary-color)";
                    e.currentTarget.style.transform = "translateX(5px)";
                  }}

                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-color)";
                    e.currentTarget.style.transform = "translateX(0)";
                  }}
                  onClick={() => {
                    setShowConvertDropdown(false);
                    setIsMobileMenuOpen(false);
                  }}
                >   <FiCode color="#ef4444" size={18} /> Text & Code to PDF</Link>
                <Link
                  to="/markup-converter"
                  style={styles.convertItem}

                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--primary-color)";
                    e.currentTarget.style.transform = "translateX(5px)";
                  }}

                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-color)";
                    e.currentTarget.style.transform = "translateX(0)";
                  }}
                  onClick={() => {
                    setShowConvertDropdown(false);
                    setIsMobileMenuOpen(false);
                  }}
                >   <FiLayout color="#3498db" size={18} /> Markup Converter</Link>




              </div>

              <div style={styles.convertColumn}>

                <h3 style={styles.convertHeading}>
                  CONVERT FROM PDF
                </h3>
                <Link
                  to="/pdf-to-image"
                  style={styles.convertItem}

                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--primary-color)";
                    e.currentTarget.style.transform = "translateX(5px)";
                  }}

                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-color)";
                    e.currentTarget.style.transform = "translateX(0)";
                  }}
                  onClick={() => {
                    setShowConvertDropdown(false);
                    setIsMobileMenuOpen(false);
                  }}
                >  <FiFileText color="#f59e0b" size={18} /> <span>PDF to Image</span></Link>

                <Link
                  to="/convert-image"
                  style={styles.convertItem}

                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--primary-color)";
                    e.currentTarget.style.transform = "translateX(5px)";
                  }}

                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-color)";
                    e.currentTarget.style.transform = "translateX(0)";
                  }}
                  onClick={() => {
                    setShowConvertDropdown(false);
                    setIsMobileMenuOpen(false);
                  }}
                >   <FiImage color="#f97316" size={18} /> Convert Image</Link>


              </div>

            </div>
          )}

        </div>

        <div
          style={styles.dropdown}
          onMouseEnter={() => setShowDropdown(true)}
          onMouseLeave={() => setShowDropdown(false)}
        >
          <button
            style={styles.navButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--primary-color)";
            
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-color)";
           
            }}
          >
            ALL TOOLS ▾
          </button>

          {showDropdown && (
            <div style={styles.megaMenu}>
              <div style={styles.arrow}></div>
              {toolCategories.map((category) => (
                <div key={category.title} style={styles.megaColumn}>
                  <h3 style={styles.megaHeading}>{category.title}</h3>

                  {category.tools.map((tool) => {
  const Icon = tool.icon;

  return (
    <Link
      key={tool.title}
      to={tool.to}
      style={styles.megaItem}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "#3b82f6";
        e.currentTarget.style.transform = "translateX(6px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--text-color)";
        e.currentTarget.style.transform = "translateX(0)";
      }}
      onClick={() => {
        setShowDropdown(false);
        setIsMobileMenuOpen(false);
      }}
    >
      <Icon
        size={18}
        color={tool.iconColor}
        style={{ flexShrink: 0 }}
      />

      <span>{tool.title}</span>
    </Link>
  );
})}
                </div>
              ))}
            </div>
          )}
        </div>
      </nav>

      <button onClick={toggleTheme} style={styles.themeBtn}>
        {theme === "light" ? "🌙 Dark" : "☀️ Light"}
      </button>
    </header>
  );
};

export default Navbar;