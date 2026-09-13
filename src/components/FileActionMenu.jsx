import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiShare2,
  FiChevronDown,
  FiScissors,
  FiLayers,
  FiRotateCw,
  FiLock,
  FiUnlock,
  FiDroplet,
  FiHash,
  FiGrid,
  FiImage,
  FiBookOpen,
  FiMinimize2,
  FiRepeat,
  FiMusic,
  FiCrop,
  FiEdit3,
  FiShield,
  FiColumns,
  FiMoon,
  FiFileText,
  FiArchive,
  FiZap,
  FiVideo,
} from 'react-icons/fi';
import { setTransferredFile } from '../utils/fileTransfer';

const TOOL_DEFINITIONS = {
  pdf: [
    { name: 'Workflow Pipeline Builder', path: '/workflow-builder', icon: FiZap, desc: 'Automate multi-step pipelines' },
    { name: 'P2P File Transfer', path: '/p2p-share', icon: FiShare2, desc: 'Send peer-to-peer securely' },
    { name: 'ZIP Archive Studio', path: '/zip-tools', icon: FiArchive, desc: 'Bundle into ZIP archive' },
    { name: 'Scan PDF for QR Codes', path: '/qr-tools', icon: FiGrid, desc: 'Scan and decode QR codes' },
    { name: 'Chat with PDF', path: '/chat-pdf', icon: FiBookOpen, desc: 'Interactive Q&A and source citations' },
    { name: 'PDF to Handwriting', path: '/text-to-handwriting', icon: FiEdit3, desc: 'Convert to handwritten sheets' },
    { name: 'Split PDF', path: '/split-pdf', icon: FiScissors, desc: 'Extract pages or split into ranges' },
    { name: 'Merge PDF', path: '/merge-pdf', icon: FiLayers, desc: 'Combine with other documents' },
    { name: 'Rotate PDF', path: '/rotate-pdf', icon: FiRotateCw, desc: 'Rotate document pages' },
    { name: 'Compress PDF', path: '/compress-pdf', icon: FiMinimize2, desc: 'Reduce document file size' },
    { name: 'Crop & Trim PDF', path: '/crop-pdf', icon: FiCrop, desc: 'Trim margins or crop regions' },
    { name: 'Flip & Mirror PDF', path: '/flip-pdf', icon: FiRepeat, desc: 'Horizontal / vertical flip' },
    { name: 'Invert PDF Colors', path: '/invert-pdf', icon: FiMoon, desc: 'Night mode & color themes' },
    { name: 'Flatten PDF', path: '/flatten-pdf', icon: FiShield, desc: 'Bake forms & tamper-proof' },
    { name: 'Compare & Diff PDF', path: '/compare-pdf', icon: FiColumns, desc: 'Visual & text comparison' },
    { name: 'Protect PDF', path: '/protect-pdf', icon: FiLock, desc: 'Encrypt with password' },
    { name: 'Unlock PDF', path: '/unlock-pdf', icon: FiUnlock, desc: 'Remove password & restrictions' },
    { name: 'Add Watermark', path: '/add-watermark', icon: FiDroplet, desc: 'Stamp with text watermark' },
    { name: 'Page Numbers', path: '/page-numbers', icon: FiHash, desc: 'Number document pages' },
    { name: 'Organize Pages', path: '/organize-pdf', icon: FiGrid, desc: 'Rearrange and delete pages' },
    { name: 'Redact PDF', path: '/redact-pdf', icon: FiShield, desc: 'Permanent blackout data destruction' },
    { name: 'PDF Metadata Scrub', path: '/pdf-metadata', icon: FiFileText, desc: 'Sanitize author & XMP streams' },
    { name: 'PDF to Word (.docx)', path: '/pdf-to-docx', icon: FiFileText, desc: 'Convert to editable Word doc' },
    { name: 'PDF to Text', path: '/pdf-to-text', icon: FiFileText, desc: 'Extract text, JSON, CSV' },
    { name: 'PDF to Image', path: '/pdf-to-image', icon: FiImage, desc: 'Render pages as PNG / JPG' },
    { name: 'Read PDF', path: '/pdf-reader', icon: FiBookOpen, desc: 'Read and review in reader' },
  ],
  image: [
    { name: 'Workflow Pipeline Builder', path: '/workflow-builder', icon: FiZap, desc: 'Run multi-step image pipeline' },
    { name: 'Scan for QR Code', path: '/qr-tools', icon: FiGrid, desc: 'Scan and read QR code' },
    { name: 'P2P File Transfer', path: '/p2p-share', icon: FiShare2, desc: 'Send directly to peer' },
    { name: 'ZIP Archive Studio', path: '/zip-tools', icon: FiArchive, desc: 'Add image to ZIP archive' },
    { name: 'Crop Image', path: '/crop-image', icon: FiCrop, desc: 'Crop, aspect ratios, rotate' },
    { name: 'Edit Image Studio', path: '/edit-image', icon: FiEdit3, desc: 'Filters, drawing, blackout redact' },
    { name: 'Image EXIF Wiper', path: '/strip-exif', icon: FiShield, desc: 'Strip GPS and camera metadata' },
    { name: 'Compress Image', path: '/compress-image', icon: FiMinimize2, desc: 'Reduce image file size' },
    { name: 'Convert Format', path: '/convert-image', icon: FiRepeat, desc: 'Convert to PNG, JPG, WebP' },
    { name: 'Images to PDF', path: '/image-to-pdf', icon: FiLayers, desc: 'Bundle into a PDF document' },
    { name: 'Protect & Encrypt Image', path: '/protect-image', icon: FiLock, desc: 'AES-256 vault or steganography' },
  ],
  video: [
    { name: 'Add Audio to Video', path: '/add-audio-to-video', icon: FiVideo, desc: 'Add or replace audio track' },
    { name: 'P2P File Transfer', path: '/p2p-share', icon: FiShare2, desc: 'Send video directly to peer' },
    { name: 'ZIP Archive Studio', path: '/zip-tools', icon: FiArchive, desc: 'Bundle video into ZIP' },
    { name: 'Compress Video', path: '/compress-video', icon: FiMinimize2, desc: 'Reduce video file size' },
    { name: 'Extract Audio', path: '/extract-audio', icon: FiMusic, desc: 'Rip audio track to MP3/WAV/AAC' },
  ],
  audio: [
    { name: 'Add Audio to Video', path: '/add-audio-to-video', icon: FiVideo, desc: 'Mux audio into video file' },
    { name: 'P2P File Transfer', path: '/p2p-share', icon: FiShare2, desc: 'Send audio directly to peer' },
    { name: 'ZIP Archive Studio', path: '/zip-tools', icon: FiArchive, desc: 'Bundle audio into ZIP' },
    { name: 'Speech Transcriber', path: '/transcribe-audio', icon: FiMusic, desc: 'Transcribe audio to Text/Word/PDF' },
    { name: 'Audio Tools & Trimmer', path: '/audio-tools', icon: FiMusic, desc: 'Trim audio, volume boost, transcode' },
  ],
  text: [
    { name: 'Generate QR Code', path: '/qr-tools', icon: FiGrid, desc: 'Encode text into QR code' },
    { name: 'P2P File Transfer', path: '/p2p-share', icon: FiShare2, desc: 'Send directly to peer' },
    { name: 'ZIP Archive Studio', path: '/zip-tools', icon: FiArchive, desc: 'Add text to ZIP archive' },
    { name: 'Text to Handwriting', path: '/text-to-handwriting', icon: FiEdit3, desc: 'Synthesize handwritten notes' },
    { name: 'Text & Code to PDF', path: '/text-to-pdf', icon: FiFileText, desc: 'Convert TXT/code to PDF' },
    { name: 'Markup Converter', path: '/markup-converter', icon: FiFileText, desc: 'Live Markdown/HTML preview' },
  ],
  archive: [
    { name: 'ZIP Archive Studio', path: '/zip-tools', icon: FiArchive, desc: 'Inspect, extract, or unpack' },
    { name: 'P2P File Transfer', path: '/p2p-share', icon: FiShare2, desc: 'Send archive directly to peer' },
  ],
};

const FileActionMenu = ({ file, fileUrl, fileName = 'file', currentPath = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const lowerName = fileName.toLowerCase();
  let category = null;
  if (lowerName.endsWith('.pdf') || (file && file.type === 'application/pdf')) {
    category = 'pdf';
  } else if (
    lowerName.endsWith('.zip') || lowerName.endsWith('.tar') || lowerName.endsWith('.gz') ||
    (file && (file.type === 'application/zip' || file.type === 'application/x-zip-compressed'))
  ) {
    category = 'archive';
  } else if (
    lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.webp') || lowerName.endsWith('.bmp') || lowerName.endsWith('.gif') ||
    (file && file.type?.startsWith('image/'))
  ) {
    category = 'image';
  } else if (
    lowerName.endsWith('.mp4') || lowerName.endsWith('.mov') || lowerName.endsWith('.webm') ||
    lowerName.endsWith('.avi') || lowerName.endsWith('.mkv') || lowerName.endsWith('.m4v') ||
    (file && file.type?.startsWith('video/'))
  ) {
    category = 'video';
  } else if (
    lowerName.endsWith('.mp3') || lowerName.endsWith('.wav') || lowerName.endsWith('.aac') ||
    lowerName.endsWith('.ogg') || lowerName.endsWith('.m4a') || lowerName.endsWith('.flac') ||
    (file && file.type?.startsWith('audio/'))
  ) {
    category = 'audio';
  } else if (
    lowerName.endsWith('.txt') || lowerName.endsWith('.md') || lowerName.endsWith('.html') ||
    lowerName.endsWith('.js') || lowerName.endsWith('.py') || lowerName.endsWith('.cpp') ||
    (file && (file.type?.startsWith('text/') || file.type === 'application/json'))
  ) {
    category = 'text';
  }

  const availableTools = (TOOL_DEFINITIONS[category] || []).filter(t => t.path !== currentPath);

  const handleSelectTool = async (targetPath) => {
    setIsOpen(false);
    let readyFile = file;

    // If file is not a File instance (e.g. only blob or url passed), convert it
    if (!readyFile && fileUrl) {
      try {
        const res = await fetch(fileUrl);
        const blob = await res.blob();
        let mimeType = 'application/pdf';
        if (category === 'image') mimeType = 'image/png';
        if (category === 'video') mimeType = 'video/mp4';
        if (category === 'audio') mimeType = 'audio/mp3';
        if (category === 'text') mimeType = 'text/plain';
        readyFile = new File([blob], fileName, { type: blob.type || mimeType });
      } catch (err) {
        console.error("Could not construct File for inter-tool navigation:", err);
      }
    } else if (readyFile && !(readyFile instanceof File) && (readyFile instanceof Blob)) {
      readyFile = new File([readyFile], fileName, { type: readyFile.type });
    }

    if (readyFile) {
      setTransferredFile(readyFile);
    }

    navigate(targetPath);
  };

  if (availableTools.length === 0) return null;

  return (
    <div style={styles.container} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={styles.triggerBtn}
        title="Send this file to another tool"
      >
        <FiShare2 style={styles.icon} />
        Use this file for...
        <FiChevronDown style={{ ...styles.chevron, transform: isOpen ? 'rotate(180deg)' : 'none' }} />
      </button>

      {isOpen && (
        <div className="file-action-menu-dropdown" style={styles.dropdown}>
          <div style={styles.dropdownHeader}>
            <span style={styles.dropdownTitle}>Available Tools for this File</span>
          </div>
          <div style={styles.itemsList}>
            {availableTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.path}
                  onClick={() => handleSelectTool(tool.path)}
                  className="file-action-menu-item"
                  style={styles.menuItem}
                >
                  <div style={styles.itemIconWrapper}>
                    <Icon style={styles.itemIcon} />
                  </div>
                  <div style={styles.itemText}>
                    <span style={styles.itemName}>{tool.name}</span>
                    <span style={styles.itemDesc}>{tool.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    position: 'relative',
    display: 'inline-block',
  },
  triggerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem',
    backgroundColor: 'var(--card-bg)',
    color: 'var(--text-color)',
    border: '2px solid var(--border-color)',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  icon: {
    fontSize: '1.1rem',
    color: 'var(--primary-color)',
  },
  chevron: {
    fontSize: '1rem',
    transition: 'transform 0.2s ease',
  },
  dropdown: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: '0.5rem',
    width: '280px',
    backgroundColor: 'var(--bg-surface-elevated)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    boxShadow: '0 12px 36px -4px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.2)',
    zIndex: 1000,
    overflow: 'hidden',
    textAlign: 'left',
  },
  dropdownHeader: {
    padding: '0.6rem 1rem',
    backgroundColor: 'var(--subtle-bg)',
    borderBottom: '1px solid var(--border-color)',
  },
  dropdownTitle: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 'bold',
    opacity: 0.7,
    color: 'var(--text-color)',
  },
  itemsList: {
    maxHeight: '260px',
    overflowY: 'auto',
    padding: '0.4rem',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    width: '100%',
    padding: '0.6rem 0.75rem',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    color: 'var(--text-color)',
    textAlign: 'left',
    transition: 'background-color 0.15s ease',
  },
  itemIconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    color: 'var(--primary-color)',
    flexShrink: 0,
  },
  itemIcon: {
    fontSize: '1rem',
  },
  itemText: {
    display: 'flex',
    flexDirection: 'column',
  },
  itemName: {
    fontSize: '0.9rem',
    fontWeight: '600',
  },
  itemDesc: {
    fontSize: '0.75rem',
    opacity: 0.7,
  },
};

export default FileActionMenu;
