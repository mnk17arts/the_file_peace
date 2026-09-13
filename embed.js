/**
 * The File Peace — Official Embed SDK (v2.0)
 * 100% In-Memory Private File Utilities
 * 
 * Embed anywhere with auto-resizing and host theme synchronization.
 * Docs & Source: https://github.com/mnk17arts/the_file_peace
 */
(function () {
  'use strict';

  function getHostTheme() {
    const html = document.documentElement;
    const body = document.body;
    if (html.getAttribute('data-theme') === 'dark' || body.getAttribute('data-theme') === 'dark') return 'dark';
    if (html.getAttribute('data-theme') === 'light' || body.getAttribute('data-theme') === 'light') return 'light';
    if (html.classList.contains('dark') || body.classList.contains('dark')) return 'dark';
    if (html.classList.contains('light') || body.classList.contains('light')) return 'light';
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }

  function getEmbedIframes() {
    return Array.from(document.querySelectorAll('iframe[src*="/embed/"], iframe[data-filepeace-embed]'));
  }

  function handleMessage(event) {
    if (!event.data || typeof event.data !== 'object') return;
    const { type, height, toolId } = event.data;

    if (type === 'filepeace:resize' && typeof height === 'number') {
      const iframes = getEmbedIframes();
      for (const iframe of iframes) {
        if (iframe.contentWindow === event.source || (toolId && iframe.src.includes(toolId))) {
          iframe.style.height = `${Math.ceil(height)}px`;
          iframe.style.transition = 'height 0.15s ease';
          iframe.dispatchEvent(new CustomEvent('filepeace:resize', { detail: { height, toolId } }));
          break;
        }
      }
    }

    if (type === 'filepeace:ready') {
      const iframes = getEmbedIframes();
      for (const iframe of iframes) {
        if (iframe.contentWindow === event.source || (toolId && iframe.src.includes(toolId))) {
          // Sync current host theme to newly loaded widget
          const theme = getHostTheme();
          try {
            iframe.contentWindow.postMessage({ type: 'filepeace:setTheme', theme }, '*');
          } catch {
            // cross-origin silent fallback
          }
          iframe.dispatchEvent(new CustomEvent('filepeace:ready', { detail: { toolId } }));
          break;
        }
      }
    }
  }

  function syncThemeToAll(theme) {
    const targetTheme = theme || getHostTheme();
    const iframes = getEmbedIframes();
    for (const iframe of iframes) {
      try {
        iframe.contentWindow.postMessage({ type: 'filepeace:setTheme', theme: targetTheme }, '*');
      } catch {
        // cross-origin silent fallback
      }
    }
  }

  function init() {
    window.removeEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);

    // Watch for host theme changes
    const observer = new MutationObserver(function () {
      syncThemeToAll();
    });

    if (document.documentElement) {
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    }
    if (document.body) {
      observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    }

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        syncThemeToAll();
      });
    }

    // Initial sync
    setTimeout(syncThemeToAll, 300);
  }

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose global controller
  window.FilePeaceEmbed = {
    init: init,
    syncTheme: syncThemeToAll,
    getIframes: getEmbedIframes,
  };
})();
