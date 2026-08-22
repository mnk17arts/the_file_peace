
# ✌️ The File Peace

<div align="center">
  <img src="public/favicon.svg" alt="The File Peace Logo" width="120" />
</div>

<br />

<div align="center">
  <strong>A secure, offline-first, client-side document and media utility suite.</strong>
</div>

<br />

## 📖 Overview

**The File Peace** is a privacy-first web application designed to handle complex document manipulations and image conversions directly within the browser. Built with a strict **offline-first architecture**, it ensures absolute data security by completely eliminating the need for server-side processing or cloud uploads. Your files never leave your device.

Currently at **v1.1.0**, the application features a dynamic tool categorizer, a modern UI styled with the Oxanium font family, and a custom-built Web Worker pipeline for non-blocking, low-latency file processing.

---

## ✨ Core Features

### 📄 PDF Manipulation Suite
* **Merge PDF:** Combine multiple PDF documents into a single cohesive file utilizing `pdf-lib`.
* **Split PDF:** Extract specific page ranges or burst a document into individual pages.
* **Compress PDF:** Efficiently reduce file sizes for easy sharing.
* **Rotate PDF:** Adjust page orientations dynamically (90°, 180°, 270°).
* **Watermark PDF:** Stamp custom vector text with flexible opacity, rotation, size, and color controls across every page.
* **Page Numbers:** Insert sequential page numbering with custom alignments and styling.
* **Organize & Reorder:** An interactive visual thumbnail manager utilizing `pdf.js` and Web Workers to sort, delete, and append pages seamlessly via drag-and-drop.

### 🖼️ Image & Media Conversion
* **Image to PDF:** Convert multi-format images (JPG, PNG) into structured PDF documents.
* **PDF to Images:** Extract individual PDF pages into crisp image files.
* **Format Conversion:** Fast client-side image format conversion (JPG to PNG, PNG to JPG).
* **Advanced Media Processing:** Integrated `ffmpeg.wasm` for robust client-side media handling.

### 🎨 UI & Architecture
* **Dynamic Tool Categorizer:** Instant, zero-latency filtering of utility modules.
* **Theme Support:** Fully optimized light and dark mode integration.
* **100% Client-Side:** No backend required. Utlilizes browser memory and local execution environments.

---

## 🛠️ Tech Stack

* **Core Framework:** React 18
* **Build Tool:** Vite
* **Document Processing:** `pdf-lib`, `pdf.js`
* **Media Processing:** `ffmpeg.wasm` (FFmpeg WebAssembly)
* **Performance:** Web Workers (for off-thread rendering and processing)
* **Styling:** Custom CSS with CSS Variables for dynamic theming, featuring the **Oxanium** typography.

---

## 🚀 Getting Started (Local Development)

To run **The File Peace** locally on your machine, follow these steps:

### Prerequisites
* [Node.js](https://nodejs.org/) (v16.0.0 or higher recommended)
* npm or yarn

### Installation

1. **Clone the repository:**
```bash
   git clone [https://github.com/mnk17arts/the_file_peace.git](https://github.com/mnk17arts/the_file_peace.git)
   cd the_file_peace

```

2. **Install dependencies:**
```bash
npm install

```


3. **Start the development server:**
```bash
npm run dev

```


The application will be available at `http://localhost:5173`.

---

## 📦 Building for Production

To create a highly optimized, production-ready build:

```bash
npm run build

```

This will compile the application into the `dist/` directory.

To preview the production build locally:

```bash
npm run preview

```

---

## 🔒 Privacy & Security

**The File Peace** operates strictly within the confines of your browser's execution environment.

* **Zero Uploads:** Files are processed using HTML5 File API and `ArrayBuffer` streams.
* **Stateless:** No data is stored, tracked, or analyzed. Refreshing the page completely clears the memory heap.

---

## 👨‍💻 Author

Developed and maintained by **@mnk17arts**.

Connect with me on [LinkedIn](https://linkedin.com/in/mnk17arts) or check out my other projects on [GitHub](https://github.com/mnk17arts).

