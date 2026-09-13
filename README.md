# ✌️ The File Peace

<div align="center">
  <img src="public/favicon.svg" alt="The File Peace Logo" width="110" />

  <h3>A secure, offline-first, client-side document and media utility suite.</h3>

  <p>
    <a href="https://mnk17arts.github.io/the-file-peace-live/"><strong>🌐 Explore the Live App »</strong></a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/version-v1.0.0-blue?style=flat-square" alt="Version v1.0.0" />
    <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React 19" />
    <img src="https://img.shields.io/badge/Vite-8.1-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite 8" />
    <img src="https://img.shields.io/badge/Architecture-100%25%20Offline--First-2ed573?style=flat-square" alt="Offline First" />
    <img src="https://img.shields.io/badge/Privacy-Zero%20Telemetry%20%7C%20Local-blue?style=flat-square" alt="Privacy First" />
    <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="MIT License" />
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome" />
  </p>
</div>

<br />

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Core Architecture & Privacy Model](#-core-architecture--privacy-model)
- [Inter-Tool Action Piping System](#-inter-tool-action-piping-system)
- [Complete Feature Catalog](#-complete-feature-catalog)
  - [1. PDF Organization & Slicing Suite](#1-pdf-organization--slicing-suite)
  - [2. PDF Editing & Design Suite](#2-pdf-editing--design-suite)
  - [3. PDF Security & Privacy Suite](#3-pdf-security--privacy-suite)
  - [4. Conversion & Document Synthesis](#4-conversion--document-synthesis)
  - [5. Optimization & Media Studio](#5-optimization--media-studio)
  - [6. Document Intelligence & AI Suite](#6-document-intelligence--ai-suite)
  - [7. Archives, Connectivity & Sharing Suite](#7-archives-connectivity--sharing-suite)
- [Tech Stack & Dependencies](#-tech-stack--dependencies)
- [Project Directory Structure](#-project-directory-structure)
- [Getting Started & Local Setup](#-getting-started--local-setup)
  - [Prerequisites](#prerequisites)
  - [Installation & Running Locally](#installation--running-locally)
  - [Building for Production](#building-for-production)
  - [Code Quality & Testing](#code-quality--testing)
  - [Deployment to GitHub Pages](#deployment-to-github-pages)
- [Contributing Guidelines](#-contributing-guidelines)
- [Browser Limitations & Notes](#-browser-limitations--notes)
- [FAQ & Troubleshooting](#-faq--troubleshooting)
- [Roadmap](#-roadmap)
- [License & Author](#-license--author)

---

## 📖 Overview

**The File Peace** is a comprehensive, client-side productivity studio built to solve a critical dilemma: **how to work with sensitive documents and media files without sacrificing data privacy.**

Most online file converters and PDF utilities upload your documents, images, and videos to remote cloud servers for processing. This presents major privacy risks when handling financial statements, contracts, identification documents, medical records, or private photographs.

**The File Peace operates with a strict 100% offline-first architecture:**
- **Zero Server Uploads:** Every single operation (PDF rendering, page extraction, watermarking, encryption, OCR/decoding, handwriting synthesis, video transcoding, and compression) is executed strictly inside your device's browser memory using WebAssembly (WASM), Web Workers, Web Audio, and native HTML5 Canvas APIs.
- **Zero Telemetry & Tracking:** No file contents, metadata, passwords, audio transcripts, or analytical payloads ever leave your device.
- **Local Asset Bundling:** All fonts (Oxanium), styling themes, worker bundles, and WebAssembly binaries (`ffmpeg-core`, `zxing-wasm`) are bundled locally to guarantee complete functionality without external CDN dependencies.

---

## 🔒 Core Architecture & Privacy Model

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                         YOUR LOCAL BROWSER                             │
 │                                                                        │
 │   User File Drop ──► HTML5 File API ──► In-Memory ArrayBuffer          │
 │                                                   │                    │
 │         ┌─────────────────────────────────────────┴───────────────┐    │
 │         ▼                                                         ▼    │
 │   [ Web Workers / WASM ]                                   [ Canvas & Web Audio ]
 │   • pdf-lib (Structure & Encryption)                       • Image Resizing & Filters
 │   • pdfjs-dist (Decryption & HiDPI Render)                 • Watermarking & Numbering
 │   • ffmpeg.wasm (Client Video & Audio Transcode)           • Audio Waveform Visualizer
 │   • zxing-wasm (C++ WebAssembly QR Engine)                 • Handwriting Synthesis
 │         │                                                         │    │
 │         └────────────────────────┬────────────────────────────────┘    │
 │                                  ▼                                     │
 │                      Output In-Memory Blob                             │
 │                                  │                                     │
 │             ┌────────────────────┴────────────────────┐                │
 │             ▼                                         ▼                │
 │   Instant File Download                   Inter-Tool In-Memory Piping  │
 └────────────────────────────────────────────────────────────────────────┘
```

1. **Memory Isolation:** Files are ingested as ephemeral `ArrayBuffer` objects in JavaScript heap memory.
2. **Deterministic Garbage Collection:** When components unmount or files are reset, object URLs (`URL.revokeObjectURL`) and canvas buffers are immediately purged.
3. **Multi-Threaded Performance:** Heavy tasks (such as PDF page rasterization, video transcode, and cryptographic hashing) run off the main UI thread via Web Workers to keep interface animations smooth and responsive.

---

## ⚡ Inter-Tool Action Piping System

The File Peace features an **Inter-Tool Action Piping Architecture** (`src/utils/fileTransfer.js` and `src/components/FileActionMenu.jsx`).

Instead of forcing you to download a file from one tool and manually re-upload it into another, processed outputs can be piped seamlessly across the entire suite with zero disk persistence or re-encoding:

* **Example Workflows:**
  - $\text{Unlock Protected PDF} \longrightarrow \text{Crop Margins} \longrightarrow \text{Add Page Numbers} \longrightarrow \text{Add Watermark} \longrightarrow \text{Compress PDF}$
  - $\text{Extract Audio from Video} \longrightarrow \text{Audio Trimmer / Boost} \longrightarrow \text{Speech Transcriber (.docx)}$
  - $\text{Text to Handwriting} \longrightarrow \text{Flatten PDF} \longrightarrow \text{P2P File Transfer}$

Every tool features the **"Use this file for..."** menu, allowing one-click routing to compatible utilities with automatic MIME validation.

---

## ✨ Complete Feature Catalog

### 1. 📄 PDF Organization & Slicing Suite

| Tool | Route | Description |
| :--- | :--- | :--- |
| **Merge PDF** | `/merge-pdf` | Combine multiple PDF documents into a single unified file with drag-and-drop page ordering. |
| **Split PDF** | `/split-pdf` | Extract specific individual pages or custom page ranges into a separate PDF document. |
| **Rotate PDF** | `/rotate-pdf` | Permanently rotate all or specific pages clockwise ($90^\circ$, $180^\circ$, $270^\circ$). |
| **Organize PDF** | `/organize-pdf` | Visual drag-and-drop page manager to sort, duplicate, delete, and rearrange pages. |
| **Crop & Trim PDF** | `/crop-pdf` | Losslessly crop page bounds, trim white margins, or adjust uniform aspect ratios across select or all pages. |
| **Flip & Mirror PDF** | `/flip-pdf` | Mirror PDF pages horizontally or vertically for heat transfers, printing, and transparencies. |

---

### 2. 🎨 PDF Editing & Design Suite

| Tool | Route | Description |
| :--- | :--- | :--- |
| **Edit PDF** | `/edit-pdf` | Annotate, draw freehand, highlight, add text boxes, and insert shapes directly onto PDF pages. |
| **Add PDF Watermark** | `/add-watermark` | Stamp dynamic text watermarks with interactive live preview, opacity, rotation, color, and multi-pattern grid tiling. |
| **Page Numbers** | `/page-numbers` | Insert sequential page numbers (`Page X of Y`, `X / Y`, Roman numerals, prefix/suffix) with a 9-point placement matrix. |
| **Invert PDF Colors** | `/invert-pdf` | Transform PDFs into Night / Dark Mode, warm Sepia, Grayscale (ink-saving), High Contrast, or Inverted color themes. |

---

### 3. 🔐 PDF Security & Privacy Suite

| Tool | Route | Description |
| :--- | :--- | :--- |
| **Protect PDF** | `/protect-pdf` | Encrypt PDF files with standard password protection directly in browser memory. |
| **Protect Image** | `/protect-image` | Protect photos with AES-256 encrypted vaults, password-locked PDFs, or hidden steganographic encoding. |
| **Unlock PDF** | `/unlock-pdf` | Decrypt password-protected PDFs and permanently strip restrictive permissions and printing locks. |
| **Flatten PDF** | `/flatten-pdf` | Bake interactive forms, signatures, and annotations permanently into non-editable vector/raster pages. |
| **Redact PDF** | `/redact-pdf` | Permanently destroy confidential text, SSNs, credit cards, and sensitive boxes with true underlying text destruction. |
| **PDF Metadata Scrub** | `/pdf-metadata` | Inspect, edit, or 1-click wipe Author names, software producer traces, creation timestamps, and hidden XMP streams. |
| **File Hash & Checksum** | `/file-hash` | Compute SHA-256, SHA-512, SHA-1, and MD5 hashes instantly with dual-file bitwise integrity diff and checksum verification. |

---

### 4. 🔄 Conversion & Document Synthesis

| Tool | Route | Description |
| :--- | :--- | :--- |
| **PDF to Image** | `/pdf-to-image` | Extract every page of your PDF into crisp, high-resolution PNG images with individual or bulk ZIP download. |
| **Image to PDF** | `/image-to-pdf` | Combine multiple JPG, PNG, or WebP images into a single structured PDF with custom margins and orientations. |
| **Convert Image** | `/convert-image` | Seamlessly convert images between PNG, JPG, WebP, and BMP formats instantly. |
| **Crop Image** | `/crop-image` | Crop and trim photos with aspect ratio presets (1:1, 4:5, 16:9), freeform marquee, circular avatar preview, and lossless export. |
| **Edit Image Studio** | `/edit-image` | Full-featured image editor with brightness/contrast filters, drawing brushes, text stamps, shape overlays, and blackout privacy redact. |
| **PDF to Word (.docx)** | `/pdf-to-docx` | Convert PDF documents into editable Word (`.docx`) files with preserved headings, paragraphs, and page breaks. |
| **PDF to Text** | `/pdf-to-text` | Extract raw text, structured JSON data, and line-by-line CSV tables from PDF files with one-click clipboard copying. |
| **Text & Code to PDF** | `/text-to-pdf` | Convert code files (JS, Python, C++, HTML), Markdown, CSV, and TXT files into formatted PDFs with PrismJS syntax highlighting. |
| **Markup Converter** | `/markup-converter` | Sandboxed, real-time live preview and rendering for Markdown and HTML files with sanitized export. |
| **Extract Audio** | `/extract-audio` | Extract pristine audio tracks from MP4, MKV, MOV, and WebM videos into MP3, WAV, AAC, or OGG locally using FFmpeg WASM. |
| **Speech Transcriber** | `/transcribe-audio` | Transcribe live voice dictation or audio files into formatted Plain Text, Word (`.docx`), and PDF documents in real time. |
| **Text to Handwriting** | `/text-to-handwriting` | Convert typed notes or PDF documents into realistic handwritten paper sheets with custom ink colors, fonts, and ruled notebook lines, or preserve original PDF layout/background/images. |

---

### 5. ⚡ Optimization & Media Studio

| Tool | Route | Description |
| :--- | :--- | :--- |
| **Compress PDF** | `/compress-pdf` | Drastically reduce PDF file sizes locally with balanced and extreme compression presets and canvas downsampling. |
| **Compress Image** | `/compress-image` | Reduce image file sizes using client-side compression with real-time size reduction analytics and quality controls. |
| **Compress Video** | `/compress-video` | Shrink MP4, WebM, and MOV video file sizes locally using WebAssembly FFmpeg with preset CRF quality controls. |
| **Add Audio to Video** | `/add-audio-to-video` | In-memory FFmpeg WebAssembly mixer to replace audio tracks or blend background music onto videos. |
| **Audio Tools & Trimmer** | `/audio-tools` | Interactive audio waveform visualizer with millisecond precision trimming, volume boost (50%-200%), and audio format transcoding. |
| **Image EXIF Wiper** | `/strip-exif` | Detect and sanitize GPS geolocation coordinates, camera serials, timestamps, and device fingerprints from photos. |

---

### 6. 🧠 Document Intelligence & AI Suite

| Tool | Route | Description |
| :--- | :--- | :--- |
| **Read PDF** | `/pdf-reader` | Fast, minimalist in-browser PDF reader with zoom, multi-page pagination, and full-screen reading mode. |
| **AI PDF Summarizer** | `/summarize-pdf` | Generate concise executive summaries, key takeaways, and in-depth analyses 100% offline or with AI. |
| **AI PDF Translator** | `/translate-pdf` | Translate foreign PDF documents across 35+ languages with side-by-side reading and audio narration. |
| **Compare & Diff PDF** | `/compare-pdf` | Visual pixel diff overlay, side-by-side synchronized view, and text diff between two PDF revisions. |
| **Chat with PDF** | `/chat-pdf` | Ask questions and explore documents with interactive in-memory search, source page citations, conversation export, and zero server uploads. |

---

### 7. 📦 Archives, Connectivity & Sharing Suite

| Tool | Route | Description |
| :--- | :--- | :--- |
| **ZIP Studio** | `/zip-tools` | Create compressed ZIP archives with custom compression levels (Store 0 to Max Deflate 9) or inspect, search, inline-preview, and extract ZIP contents in-memory. |
| **QR Code Studio** | `/qr-tools` | Multi-payload QR generator (URLs, Wi-Fi, vCard, text) with logo embedding and high-performance WebAssembly (`zxing-wasm`) scanner from webcam, image, and multi-page PDFs. |
| **P2P File Transfer** | `/p2p-share` | Direct browser-to-browser encrypted file transfer over WebRTC data channels with zero server storage, QR handshake, and one-click bulk ZIP download. |
| **Workflow Pipeline Builder** | `/workflow-builder` | Construct custom multi-step file automation pipelines (Watermark ➔ Crop ➔ Compress) with batch multi-file execution and consolidated ZIP export. |

---

## 🛠️ Tech Stack & Dependencies

| Category | Technology / Library | Purpose in Pipeline |
| :--- | :--- | :--- |
| **UI Framework** | [React 19](https://react.dev/) | Modern concurrent UI and state management |
| **Build & Dev Tool** | [Vite 8](https://vitejs.dev/) | Lightning-fast HMR and optimized production bundle |
| **Routing** | [React Router v7](https://reactrouter.com/) | Lazy-loaded client-side route code-splitting |
| **PDF Manipulation** | [pdf-lib](https://pdf-lib.js.org/) | Document synthesis, page slicing, stamping, cropping, and vector transforms |
| **PDF Rendering & Crypto** | [pdfjs-dist](https://mozilla.github.io/pdf.js/) | Multi-threaded page rasterization, password authentication, and text extraction |
| **Video & Audio Processing** | [@ffmpeg/ffmpeg](https://ffmpegwasm.netlify.app/) | In-browser WebAssembly FFmpeg encoding and transcoding runtime |
| **Image Compression** | [browser-image-compression](https://www.npmjs.com/package/browser-image-compression) | Client-side Canvas image resizer and quantization |
| **Word Document Engine** | [docx](https://docx.js.org/) | Client-side native Microsoft Word (`.docx`) synthesis |
| **Archive Packaging** | [JSZip](https://stuk.github.io/jszip/) | Client-side ZIP bundle generation and in-memory extraction |
| **QR Generation & Decoding** | [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) & [qrcode](https://www.npmjs.com/package/qrcode) | C++ WebAssembly barcode/QR decoding and SVG/canvas QR generation |
| **Syntax Highlighting** | [PrismJS](https://prismjs.com/) | Code syntax tokenization for Code-to-PDF engine |
| **Markdown Processing** | [marked](https://marked.js.org/) | Fast, compliant markdown parsing for Markup Converter |
| **Cryptography** | Web Crypto API | Native hardware-accelerated SHA/MD5 hashing |
| **Typography** | [@fontsource/oxanium](https://fontsource.org/) | Locally bundled Oxanium geometric font family |
| **Icons** | [React Icons (Feather)](https://react-icons.github.io/react-icons/icons/fi/) | Accessible, consistent vector iconography |

---

## 📂 Project Directory Structure

```text
the-file-peace/
├── public/                     # Static assets, WebAssembly binaries & icons
│   ├── favicon.png             # Application PNG icon
│   ├── favicon.svg             # Vector application logo
│   ├── ffmpeg-core.js          # Locally bundled FFmpeg WebAssembly loader
│   ├── ffmpeg-core.wasm        # Locally bundled FFmpeg WebAssembly binary
│   └── icons.svg               # SVG sprite definitions
├── src/
│   ├── assets/                 # App artwork, branding & logo assets
│   ├── components/             # Reusable UI components & modals
│   │   ├── ActionCompleted.jsx # Task completion card with preview & actions
│   │   ├── AlertBanner.jsx     # Contextual alert notifications banner
│   │   ├── FaqSection.jsx      # Frequently Asked Questions accordion
│   │   ├── FileActionMenu.jsx  # Inter-tool action piping dropdown
│   │   ├── FileUpload.jsx      # Drag-and-drop file upload zone
│   │   ├── Footer.jsx          # Application footer with categorized links
│   │   ├── Layout.jsx          # Main application header & footer shell
│   │   ├── Loader.jsx          # Animated progress phrases loader
│   │   ├── Logo.jsx            # Dynamic vector application logo
│   │   ├── Navbar.jsx          # Top navigation bar with megamenu & search pill
│   │   ├── PdfAnnotationCanvas.jsx # Interactive PDF drawing & annotation layer
│   │   ├── PdfPreviewModal.jsx # Full-screen in-memory PDF viewer modal
│   │   ├── ScrollToTop.jsx     # Route navigation scroll reset handler
│   │   ├── SpotlightSearchModal.jsx # Floating Spotlight Command Palette (Ctrl+K)
│   │   └── ToolCard.jsx        # Dashboard tool display card
│   ├── context/                # React state & theme providers
│   │   ├── ThemeContext.jsx    # Dark/Light theme state provider
│   │   └── useTheme.js         # Theme consumer hook
│   ├── data/                   # Static data stores & registries
│   │   ├── blogPosts.js        # Educational guides & blog articles
│   │   └── toolsRegistry.js    # Single source of truth for all 37 tools & categories
│   ├── pages/                  # Lazy-loaded tool studios & views
│   │   ├── AddPageNumbers.jsx  # PDF page numbering studio
│   │   ├── AddWatermark.jsx    # PDF watermark studio
│   │   ├── AudioTools.jsx      # Audio waveform trimmer & converter
│   │   ├── BlogList.jsx        # Blog & Knowledge Hub index
│   │   ├── BlogPost.jsx        # Individual blog article view
│   │   ├── ChatPdf.jsx         # Conversational Chat with PDF assistant
│   │   ├── ComparePdf.jsx      # Dual-PDF visual diff & comparison
│   │   ├── CompressImage.jsx   # Client-side image compression utility
│   │   ├── CompressPdf.jsx     # In-memory PDF size reducer
│   │   ├── CompressVideo.jsx   # Client-side FFmpeg video compression
│   │   ├── ConvertImage.jsx    # Image format converter (PNG/JPG/WebP/BMP)
│   │   ├── CropImage.jsx       # Photo cropping & aspect ratio adjuster
│   │   ├── CropPdf.jsx         # PDF margin trimmer and page cropper
│   │   ├── EditImage.jsx       # Full-featured canvas image editor
│   │   ├── EditPdf.jsx         # PDF annotation, drawing & highlighter studio
│   │   ├── ExtractAudio.jsx    # Video-to-audio extraction studio
│   │   ├── FaqPage.jsx         # Dedicated FAQ Help page
│   │   ├── FileHash.jsx        # Cryptographic checksum generator & verifier
│   │   ├── FlattenPdf.jsx      # PDF form & annotation tamper-proof flattener
│   │   ├── FlipPdf.jsx         # Horizontal & vertical PDF page mirroring
│   │   ├── Home.jsx            # Category-filtered tool explorer dashboard
│   │   ├── ImageToPdf.jsx      # Image to multi-page PDF builder
│   │   ├── InvertPdf.jsx       # Dark mode & color theme PDF transformer
│   │   ├── MarkupConverter.jsx # Markdown and HTML preview & exporter
│   │   ├── MergePdf.jsx        # PDF merge utility
│   │   ├── OrganizePdf.jsx     # Visual PDF page organizer and reorderer
│   │   ├── P2pFileShare.jsx    # Direct WebRTC peer-to-peer file transfer
│   │   ├── PdfMetadata.jsx     # PDF metadata inspector & scrubber
│   │   ├── PdfReader.jsx       # Clean in-browser PDF document reader
│   │   ├── PdfToDocx.jsx       # PDF to editable Microsoft Word (.docx) converter
│   │   ├── PdfToImage.jsx      # High-DPI PDF page rasterizer
│   │   ├── PdfToText.jsx       # Structured text, JSON, and CSV extractor
│   │   ├── ProtectImage.jsx    # Image password encryption & steganography studio
│   │   ├── ProtectPdf.jsx      # PDF password encryption studio
│   │   ├── QrTools.jsx         # QR code generator & WebAssembly scanner
│   │   ├── RedactPdf.jsx       # Permanent text & rectangular redaction tool
│   │   ├── RotatePdf.jsx       # PDF page rotation studio
│   │   ├── SplitPdf.jsx        # PDF page splitting and range extractor
│   │   ├── StripExif.jsx       # Photo EXIF metadata & GPS coordinate wiper
│   │   ├── SummarizePdf.jsx    # AI & offline heuristic PDF summarizer
│   │   ├── TextToHandwriting.jsx # Typed notes & PDF to realistic handwriting
│   │   ├── TextToPdf.jsx       # Code, text, and markdown to PDF generator
│   │   ├── TranscribeAudio.jsx # Live voice dictation & speech transcriber
│   │   ├── TranslatePdf.jsx    # Multi-language PDF translator & narrator
│   │   ├── UnlockPdf.jsx       # Hybrid PDF decryption & restriction stripper
│   │   ├── WorkflowBuilder.jsx # In-memory visual workflow pipeline studio
│   │   └── ZipTools.jsx        # In-memory ZIP archive creator & extractor
│   ├── utils/                  # In-memory helpers, engines & piping bus
│   │   ├── fileTransfer.js     # Inter-tool file piping bus
│   │   ├── fileUtils.js        # File formatting and buffer helpers
│   │   ├── qrDecoder.js        # WebAssembly QR decoding engine
│   │   ├── textSummarizer.js   # Client-side heuristic & AI summarizer
│   │   ├── textTranslator.js   # Multi-language translation engine
│   │   └── workflowEngine.js   # Pure transformation pipeline state-machine
│   ├── App.jsx                 # Lazy-loaded routing table
│   ├── index.css               # Global CSS design tokens and theme variables
│   └── main.jsx                # Application root entry point
├── tests/                      # Automated unit and smoke test suites
│   ├── build-smoke.test.js     # CDN leak & build distribution verification
│   ├── fileUtils.test.js       # Utility function tests
│   └── pdf-operations.test.js  # PDF manipulation tests
├── eslint.config.js            # ESLint flat configuration
├── index.html                  # Application HTML5 root
├── LICENSE                     # MIT License
├── package.json                # Project dependencies and script runner
├── vite.config.js              # Vite bundler configuration
└── README.md                   # Project documentation hub
```

---

## 🚀 Getting Started & Local Setup

### Prerequisites
* **Node.js**: `v18.0.0` or higher (Node `v20.x` recommended)
* **npm**: `v9.0.0` or higher

### Installation & Running Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/mnk17arts/the_file_peace.git
   cd the_file_peace
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   ```

3. **Start the local Vite development server:**
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:5173`.

---

### Building for Production

Compile and bundle the production-ready application with full minification and code-splitting:

```bash
npm run build
```

The optimized static assets will be output to the `dist/` directory.

To test and preview the production build locally:

```bash
npm run preview
```

---

### Code Quality & Testing

Run the linter to verify strict code quality rules and hook dependencies:

```bash
npm run lint
```

Run test suites:

```bash
npm test
```

---

### Deployment to GitHub Pages

Deploy the compiled build directly to the live GitHub Pages branch:

```bash
npm run deploy
```

---

## 🤝 Contributing Guidelines

We welcome contributions from developers and designers! Follow these standards when submitting code:

1. **Branch Naming:** Create a new branch dedicated to your task or Jira ticket:
   ```bash
   git checkout origin/development -b GI-<ticket-id>
   ```
2. **Commit Message Format:** Prefix commit messages with the type of change and ticket ID:
   ```text
   [IMP/FIX/REF/DOC] GI-<ticket-id>: Concise description of changes
   ```
   *Examples:*
   * `[IMP] GI-57: Add ZIP Studio, QR Code Studio & WebRTC P2P File Transfer`
   * `[FIX] GI-28: Fix page numbering offset calculation on landscape pages`
   * `[DOC] GI-45: Update Comprehensive README.md Documentation`
3. **Pull Requests:** Open a Pull Request targeting the `development` branch with a summary of changes and verification steps.

---

## ⚠️ Browser Limitations & Notes

* **Memory Footprint:** Because all operations occur entirely in browser RAM, files with hundreds of pages or videos larger than 100 MB depend on available device memory.
* **FFmpeg Multi-Threading (SharedArrayBuffer):** `ffmpeg.wasm` executes via WebAssembly threads. Some older browsers may require Cross-Origin Isolation headers (`COOP`/`COEP`) enabled for full multi-threading.
* **Transparency Handling:** JPEG does not support alpha transparency. When converting transparent PNG/WebP images to JPG, transparent areas are automatically backed with a clean white fill.

---

## ❓ FAQ & Troubleshooting

<details>
<summary><strong>Q: Are my files uploaded to any server?</strong></summary>
<br />
<strong>No, never.</strong> Every file manipulation is performed 100% locally on your computer using JavaScript, WebAssembly, and Canvas APIs. You can even disconnect your internet after loading the page and the tools will continue to work seamlessly.
</details>

<details>
<summary><strong>Q: Can I use The File Peace completely offline?</strong></summary>
<br />
Yes. Once the web application is loaded in your browser cache, all fonts, icons, and WebAssembly modules are stored locally, enabling full offline operation.
</details>

<details>
<summary><strong>Q: How does the Unlock PDF tool work?</strong></summary>
<br />
The Unlock PDF utility uses <code>pdfjs-dist</code> and <code>pdf-lib</code> to validate your password, decrypt the underlying content streams, and strip all restrictive permission flags, saving a clean, unrestricted PDF file.
</details>

<details>
<summary><strong>Q: What is the maximum file size supported?</strong></summary>
<br />
There are no arbitrary server limits. The only limit is your device's available memory. PDFs under 200 MB and videos under 100 MB typically process in seconds on modern hardware.
</details>

---

## 🗺️ Roadmap

- [ ] **PWA Support:** Offline Progressive Web App with service worker installation.
- [ ] **Batch Watermarking & Numbering:** Multi-document bulk stamping pipeline.
- [ ] **OCR Text Extraction:** Client-side optical character recognition via Tesseract.js WASM.
- [x] **Visual Workflow Builder:** Drag-and-drop node graph to build custom multi-step file automation pipelines.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

Developed and maintained with ❤️ by **Nitish Kumar (@mnk17arts)**.

* **LinkedIn:** [linkedin.com/in/mnk17arts](https://linkedin.com/in/mnk17arts)
* **GitHub:** [github.com/mnk17arts](https://github.com/mnk17arts)
* **Portfolio / Projects:** [mnk17arts.github.io/mnk17arts](https://mnk17arts.github.io/mnk17arts)
