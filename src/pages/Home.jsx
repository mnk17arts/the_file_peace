import React, { useState } from 'react';
import ToolCard from '../components/ToolCard';
import { FiLayers, FiScissors, FiImage, FiVideo, FiLock, FiRefreshCw, FiFileText, FiBookOpen, FiCode, FiLayout, FiUnlock, FiEdit3, FiHash } from 'react-icons/fi';

const Home = () => {
  const [activeCategory, setActiveCategory] = useState("All");
const categories = [
  "All",
  "Organize PDF",
  "Optimize",
  "Convert",
  "Edit PDF",
  "PDF Security",
  "View PDF",
];
const tools = [
  {
    title: "Merge PDF",
    category: "Organize PDF",
    icon: FiLayers,
    iconColor: "var(--primary-color)",
    description: "Combine multiple PDFs into one unified document.",
    to: "/merge-pdf",
  },
  {
    title: "Split PDF",
    category: "Organize PDF",
    icon: FiScissors,
    iconColor: "var(--secondary-color)",
    description: "Extract pages or split a PDF into multiple files.",
    to: "/split-pdf",
  },
  {
    title: "Rotate PDF",
    category: "Organize PDF",
    icon: FiRefreshCw,
    iconColor: "#3498db",
    description: "Rotate your PDFs exactly how you want them.",
    to: "/rotate-pdf",
  },
  {
    title: "PDF to Image",
    category: "Convert",
    icon: FiFileText,
    iconColor: "#f1c40f",
    description: "Convert every page of a PDF into high-quality JPG/PNG images.",
    to: "/pdf-to-image",
  },
  {
    title: "Compress Image",
    category: "Optimize",
    icon: FiImage,
    iconColor: "var(--accent-color)",
    description: "Reduce the file size of your JPGs, PNGs, and WebPs.",
    to: "/compress-image",
  },
  {
    title: "Compress Video",
    category: "Optimize",
    icon: FiVideo,
    iconColor: "#ff4757",
    description: "Shrink video file sizes without losing quality.",
    to: "/compress-video",
  },
  {
    title: "Protect PDF",
    category: "PDF Security",
    icon: FiLock,
    iconColor: "#2ed573",
    description: "Encrypt your PDF files with a secure password.",
    to: "/protect-pdf",
  },
  {
    title: "Convert Image",
    category: "Convert",
    icon: FiImage,
    iconColor: "#f39c12",
    description: "Seamlessly convert images between PNG, JPG, WebP, and BMP formats.",
    to: "/convert-image",
  },
  {
    title: "Image to PDF",
    category: "Convert",
    icon: FiFileText,
    iconColor: "#9b59b6",
    description: "Combine multiple JPG or PNG images into a single PDF.",
    to: "/image-to-pdf",
  },
  {
    title: "Read PDF",
    category: "View PDF",
    icon: FiBookOpen,
    iconColor: "#27ae60",
    description: "Read PDF documents entirely in your browser.",
    to: "/pdf-reader",
  },
  {
    title: "Text & Code to PDF",
    category: "Convert",
    icon: FiCode,
    iconColor: "#e74c3c",
    description: "Convert TXT, CSV, Code, and Markdown files to PDF.",
    to: "/text-to-pdf",
  },
  {
    title: "Markup Converter",
    category: "Convert",
    icon: FiLayout,
    iconColor: "#3498db",
    description: "Preview Markdown and HTML files in real-time.",
    to: "/markup-converter",
  },
  {
    title: "Add PDF Watermark",
    category: "Edit PDF",
    icon: FiEdit3,
    iconColor: "#e67e22",
    description: "Stamp customized text over your PDF.",
    to: "/add-watermark",
  },
  {
    title: "Page Numbers",
    category: "Edit PDF",
    icon: FiHash,
    iconColor: "#3498db",
    description: "Add page numbers into PDFs with ease.",
    to: "/page-numbers",
  },
  {
    title: "Organize PDF",
    category: "Organize PDF",
    icon: FiLayers,
    iconColor: "#9b59b6",
    description: "Sort, add, and delete PDF pages.",
    to: "/organize-pdf",
},
/*{
  title: "Unlock PDF",
  category: "PDF Security",
  icon: FiUnlock,
  iconColor: "#3498db",
  description: "Remove password protection from your PDF files.",
  to: "/unlock-pdf",
},*/
];

const filteredTools =
  activeCategory === "All"
    ? tools
    : tools.filter((tool) => tool.category === activeCategory);
  return (
    <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', color: 'var(--text-color)' }}>
          Every tool you need to work with files
        </h1>
        <p style={{ fontSize: '1.1rem', opacity: 0.7, color: 'var(--text-color)' }}>
          100% Free. Secure. Processed locally on your device.
        </p>
      </div>
      <div className="category-filter">
  {categories.map((category) => (
    <button
      key={category}
      className={`category-pill ${
        activeCategory === category ? "active" : ""
      }`}
      onClick={() => setActiveCategory(category)}
    >
      {category}
    </button>
  ))}
</div>

      <div className="tools-grid">
        {filteredTools.map((tool) => (
    <ToolCard
      key={tool.title}
      to={tool.to}
      icon={tool.icon}
      title={tool.title}
      description={tool.description}
      iconColor={tool.iconColor}
    />
  ))}
      
      </div>
    </div>
  );
};

export default Home;  