import { useState, useRef, useEffect, useCallback } from 'react';
import { FiSliders, FiEye } from 'react-icons/fi';

/**
 * ResizableSplitPane — Draggable Two-Column Studio Layout
 * 
 * - Left Pane: Controls, settings, tool configurations
 * - Right Pane: Canvas, document preview, interactive viewer
 * - Middle Divider: Draggable resize handle with neon hover glow and double-click reset
 * - Mobile Fallback (<992px): Automatic segmented tabs switching between Settings and Preview
 */
export default function ResizableSplitPane({
  leftPane,
  rightPane,
  defaultSplit = 42, // percent
  minLeftWidth = 300, // px
  minRightWidth = 340, // px
  mobileBreakpoint = 992, // px
  height = 'calc(100vh - 145px)',
  storageKey = null,
  leftTitle = 'Controls',
  rightTitle = 'Live Preview',
}) {
  const containerRef = useRef(null);
  const [splitPercent, setSplitPercent] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`tfp_split_${storageKey}`);
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 20 && val <= 80) return val;
      }
    }
    return defaultSplit;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < mobileBreakpoint;
    }
    return false;
  });

  // Mobile active tab: 'controls' | 'preview'
  const [activeMobileTab, setActiveMobileTab] = useState('controls');

  // Handle window resizing to detect mobile layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < mobileBreakpoint);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mobileBreakpoint]);

  // Dragging logic
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleTouchStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
      const offsetX = clientX - rect.left;
      const totalWidth = rect.width;

      if (totalWidth <= 0) return;

      // Check min width constraints
      const proposedLeftPx = offsetX;
      const proposedRightPx = totalWidth - offsetX;

      if (proposedLeftPx < minLeftWidth || proposedRightPx < minRightWidth) {
        return;
      }

      let newPercent = (proposedLeftPx / totalWidth) * 100;
      newPercent = Math.max(20, Math.min(80, newPercent));

      setSplitPercent(newPercent);
      if (storageKey) {
        localStorage.setItem(`tfp_split_${storageKey}`, newPercent.toFixed(1));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, minLeftWidth, minRightWidth, storageKey]);

  // Double click resets split to default
  const handleDoubleClick = () => {
    setSplitPercent(defaultSplit);
    if (storageKey) {
      localStorage.removeItem(`tfp_split_${storageKey}`);
    }
  };

  // MOBILE VIEW (<992px): Segmented Tabs with full viewport pane
  if (isMobile) {
    return (
      <div className="mobile-studio-container" style={{ display: 'flex', flexDirection: 'column', height, minHeight: '500px' }}>
        {/* Mobile Tab Switcher */}
        <div
          style={{
            display: 'flex',
            background: 'var(--subtle-bg)',
            padding: '0.25rem',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            marginBottom: '0.75rem',
            gap: '0.25rem',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveMobileTab('controls')}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              padding: '0.5rem',
              borderRadius: '8px',
              border: 'none',
              background: activeMobileTab === 'controls' ? 'var(--card-bg)' : 'transparent',
              color: activeMobileTab === 'controls' ? 'var(--primary-color)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: activeMobileTab === 'controls' ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <FiSliders size={14} />
            <span>{leftTitle}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMobileTab('preview')}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              padding: '0.5rem',
              borderRadius: '8px',
              border: 'none',
              background: activeMobileTab === 'preview' ? 'var(--card-bg)' : 'transparent',
              color: activeMobileTab === 'preview' ? 'var(--primary-color)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: activeMobileTab === 'preview' ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <FiEye size={14} />
            <span>{rightTitle}</span>
          </button>
        </div>

        {/* Active Pane */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          {activeMobileTab === 'controls' ? leftPane : rightPane}
        </div>
      </div>
    );
  }

  // DESKTOP & TABLET VIEW: Draggable Split Pane
  return (
    <div
      ref={containerRef}
      className="resizable-studio-split"
      style={{
        display: 'flex',
        width: '100%',
        height,
        minHeight: '520px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left Pane (Controls / Settings) */}
      <div
        className="split-pane-left"
        style={{
          width: `${splitPercent}%`,
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingRight: '0.5rem',
          boxSizing: 'border-box',
        }}
      >
        {leftPane}
      </div>

      {/* Draggable Divider Separator */}
      <div
        role="separator"
        aria-orientation="vertical"
        tabIndex={0}
        title="Drag to resize columns • Double-click to reset"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={handleDoubleClick}
        style={{
          width: '12px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'col-resize',
          zIndex: 10,
          userSelect: 'none',
          touchAction: 'none',
          margin: '0 -2px',
        }}
        className="split-handle-wrapper"
      >
        {/* Visual Line */}
        <div
          style={{
            width: '2px',
            height: '100%',
            background: isDragging ? 'var(--primary-color)' : 'var(--border-color)',
            boxShadow: isDragging ? '0 0 10px var(--primary-glow)' : 'none',
            transition: 'background 0.15s ease, box-shadow 0.15s ease',
            borderRadius: '2px',
            position: 'relative',
          }}
        >
          {/* Centered Grabber Dot Badge */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '14px',
              height: '32px',
              borderRadius: '6px',
              background: isDragging ? 'var(--primary-color)' : 'var(--card-bg)',
              border: `1px solid ${isDragging ? 'var(--primary-color)' : 'var(--border-color)'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: isDragging ? '#fff' : 'var(--text-dim)' }} />
            <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: isDragging ? '#fff' : 'var(--text-dim)' }} />
            <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: isDragging ? '#fff' : 'var(--text-dim)' }} />
          </div>
        </div>
      </div>

      {/* Right Pane (Preview / Canvas) */}
      <div
        className="split-pane-right"
        style={{
          width: `${100 - splitPercent}%`,
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingLeft: '0.5rem',
          boxSizing: 'border-box',
        }}
      >
        {rightPane}
      </div>
    </div>
  );
}
