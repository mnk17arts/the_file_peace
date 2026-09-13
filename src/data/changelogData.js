/**
 * The File Peace — Master Changelog & Release History
 */

export const CHANGELOG_RELEASES = [
  {
    version: '2.0.0',
    date: 'September 2026',
    codename: 'The Privacy & Studio Overhaul',
    isLatest: true,
    summary:
      'A massive leap forward: The File Peace v2.0 introduces 24+ new offline studios, a visual Workflow Pipeline Builder, global Spotlight command search (Ctrl+K), standalone embeddable widgets with auto-resizing SDK, and Obsidian Dark / Arctic Light theme overhauls.',
    highlights: [
      {
        title: 'Workflow Pipeline Builder',
        description: 'Automate multi-step file processing pipelines with visual drag-and-drop actions and batch ZIP export.',
        to: '/workflow-builder',
        icon: 'FiZap',
        tag: 'Feature',
      },
      {
        title: 'Embeddable IFrame Widgets & SDK',
        description: 'Embed any offline tool onto your blog or website with auto-resizing postMessage bus and host theme sync.',
        to: '/embed/file-hash',
        icon: 'FiCode',
        tag: 'Feature',
      },
      {
        title: 'Global Spotlight Search (Ctrl + K)',
        description: 'Instant keyboard-driven fuzzy search across 37+ offline tools, categories, and educational guides.',
        to: '/',
        icon: 'FiSearch',
        tag: 'Feature',
      },
      {
        title: 'Image Password & Privacy Studio',
        description: 'AES-256 password-encrypted ZIP vaults and steganographic image hiding inside pixel data (LSB).',
        to: '/protect-image',
        icon: 'FiShield',
        tag: 'Security',
      },
      {
        title: 'Audio & Video Studios',
        description: 'Add audio/music to video, client-side speech transcription, in-browser FFmpeg video compression, and audio extraction.',
        to: '/add-audio-to-video',
        icon: 'FiVideo',
        tag: 'Feature',
      },
      {
        title: 'Two-Column Draggable Studio Layout',
        description: 'Universal ResizableSplitPane architecture keeping document previews and control desks at 100vh without page scrolling.',
        to: '/file-hash',
        icon: 'FiColumns',
        tag: 'Improvement',
      },
    ],
    categories: {
      features: [
        'Added Add Audio to Video Studio (/add-audio-to-video) for in-memory audio replacement, background music mixing, and interactive sync preview.',
        'Added visual Workflow Pipeline Builder (/workflow-builder) with presets and batch execution.',
        'Added isolated Embeddable Widget routes (/embed/:toolId) and auto-resizing public/embed.js SDK.',
        'Added Image Password & Privacy Studio (/protect-image) with AES-256 ZIP vaults and Steganography.',
        'Added Client-Side Speech Transcriber (/transcribe-audio) with real-time dictation.',
        'Added P2P WebRTC Direct File Share (/p2p-share) with zero intermediary storage.',
        'Added QR Code Studio (/qr-tools) with SVG generator, logo overlay, and camera barcode scanner.',
        'Added ZIP Archive Studio (/zip-tools) with in-browser compression, encryption, and inspection.',
        'Added Text & Code to PDF Studio (/text-to-pdf) with Prism.js syntax highlighting and Raw Source view.',
        'Added Markup Converter Studio (/markup-converter) supporting Markdown, HTML, and rich formatting.',
        'Added Dual File Checksum Comparison mode in File Hash tool (/file-hash).',
      ],
      security: [
        'Enforced strict 100% client-side privacy contract with zero telemetry or network tracking.',
        'Implemented Web Crypto API for SHA-256, SHA-512, SHA-1, and MD5 cryptographic integrity checks.',
        'Added in-memory file buffers with automatic memory garbage collection upon task completion.',
        'Created isolated sandbox embed frames with clipboard-safe permissions.',
      ],
      improvements: [
        'Migrated all configuration tools to ResizableSplitPane draggable two-column layout.',
        'Introduced ToolHeroView and ToolStudioHeader standard archetypes for clean responsive UX.',
        'Created UniversalPreviewModal supporting instant preview for PDF, Image, Video, Audio, and Text.',
        'Obsidian Cyber Dark and Crisp Arctic Light themes with fluid glassmorphism tokens.',
        'Universal 6px custom scrollbars matching theme colors and eliminating bulky OS scrollbars.',
        'Added responsive mobile drawer navigation with quick search trigger.',
      ],
      performance: [
        'Implemented Vite lazy-loaded route code splitting to keep initial bundle size under 200 KB.',
        'Loaded WebAssembly engines (FFmpeg, pdfjs-dist) on-demand to minimize memory overhead.',
        'Utilized Web Workers for compute-intensive tasks without blocking the main browser UI thread.',
      ],
    },
  },
  {
    version: '1.0.0',
    date: 'August 2026',
    codename: 'The Core PDF Foundation',
    isLatest: false,
    summary:
      'The initial public launch of The File Peace: establishing the 100% in-browser, privacy-first alternative to cloud PDF converters.',
    highlights: [
      {
        title: 'Core PDF Manipulation Suite',
        description: 'Merge, split, rotate, invert, and watermark PDF documents entirely in your browser using pdf-lib.',
        to: '/merge-pdf',
        icon: 'FiLayers',
        tag: 'Feature',
      },
      {
        title: 'Image Conversion Engine',
        description: 'Convert between PNG, JPG, WebP, and PDF with client-side canvas processing.',
        to: '/convert-image',
        icon: 'FiImage',
        tag: 'Feature',
      },
      {
        title: 'Zero-Upload Architecture',
        description: 'Pioneered zero-server document handling ensuring sensitive files never leave user devices.',
        to: '/',
        icon: 'FiShield',
        tag: 'Security',
      },
    ],
    categories: {
      features: [
        'Merge PDF (/merge-pdf): Combine multiple documents with custom drag-and-drop page ordering.',
        'Split PDF (/split-pdf): Extract single pages or custom ranges into separate files.',
        'Rotate PDF (/rotate-pdf): Rotate pages clockwise (90°, 180°, 270°) permanently.',
        'Add Watermark (/add-watermark): Stamp text watermarks with custom opacity and angles.',
        'Page Numbers (/page-numbers): Number documents with header and footer positions.',
        'Compress PDF (/compress-pdf): Reduce file size via client-side canvas resampling.',
        'Image to PDF (/image-to-pdf) & PDF to Image (/pdf-to-image) rendering.',
      ],
      security: [
        'Pure client-side offline execution: zero telemetry, zero server storage, zero third-party fonts.',
        'Document processing operates strictly in ephemeral browser memory.',
      ],
      improvements: [
        'Drag-and-drop upload zone with multi-file selection.',
        'Initial light/dark theme toggle with persistent user preference.',
      ],
      performance: [
        'Instant client-side generation without uploading to or downloading from remote conversion servers.',
      ],
    },
  },
];
