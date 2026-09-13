import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import imageCompression from 'browser-image-compression';
import { Document, Packer, Paragraph, TextRun } from 'docx';

// Set up pdf.worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  // fallback for test runners
}

/**
 * Step Definitions Catalog for Workflow Engine
 */
export const WORKFLOW_ACTIONS = [
  {
    id: 'watermark',
    name: 'Add Watermark',
    category: 'PDF',
    description: 'Stamp custom diagonal text watermark across pages',
    icon: 'FiEdit3',
    iconColor: '#e67e22',
    acceptTypes: ['application/pdf'],
    outputType: 'application/pdf',
    defaultConfig: {
      text: 'CONFIDENTIAL',
      opacity: 0.25,
      color: '#ff4757',
      fontSize: 48,
      rotation: 45
    },
    configSchema: [
      { key: 'text', label: 'Watermark Text', type: 'text', default: 'CONFIDENTIAL' },
      { key: 'opacity', label: 'Opacity (0.1 - 1.0)', type: 'number', min: 0.05, max: 1, step: 0.05, default: 0.25 },
      { key: 'fontSize', label: 'Font Size', type: 'number', min: 12, max: 120, step: 2, default: 48 },
      { key: 'rotation', label: 'Angle (Degrees)', type: 'select', options: [0, 30, 45, 60, 90, -45], default: 45 },
      { key: 'color', label: 'Color', type: 'color', default: '#ff4757' }
    ]
  },
  {
    id: 'pageNumbers',
    name: 'Page Numbers',
    category: 'PDF',
    description: 'Insert sequential page numbers into document footer/header',
    icon: 'FiHash',
    iconColor: '#3498db',
    acceptTypes: ['application/pdf'],
    outputType: 'application/pdf',
    defaultConfig: {
      format: 'Page {n} of {total}',
      position: 'bottom-center',
      fontSize: 10,
      startNumber: 1,
      color: '#555555'
    },
    configSchema: [
      { key: 'format', label: 'Number Format', type: 'select', options: ['Page {n} of {total}', '{n} / {total}', 'Page {n}', '- {n} -'], default: 'Page {n} of {total}' },
      { key: 'position', label: 'Position', type: 'select', options: ['bottom-center', 'bottom-right', 'bottom-left', 'top-center', 'top-right', 'top-left'], default: 'bottom-center' },
      { key: 'fontSize', label: 'Font Size', type: 'number', min: 8, max: 24, default: 10 },
      { key: 'startNumber', label: 'Starting Number', type: 'number', min: 1, max: 999, default: 1 }
    ]
  },
  {
    id: 'rotate',
    name: 'Rotate Pages',
    category: 'PDF',
    description: 'Rotate all pages by a designated angle',
    icon: 'FiRefreshCw',
    iconColor: '#3498db',
    acceptTypes: ['application/pdf'],
    outputType: 'application/pdf',
    defaultConfig: {
      angle: 90
    },
    configSchema: [
      { key: 'angle', label: 'Rotation Angle', type: 'select', options: [90, 180, 270], default: 90 }
    ]
  },
  {
    id: 'cropMargins',
    name: 'Crop Margins',
    category: 'PDF',
    description: 'Trim outer margins uniformly across all pages',
    icon: 'FiCrop',
    iconColor: '#e67e22',
    acceptTypes: ['application/pdf'],
    outputType: 'application/pdf',
    defaultConfig: {
      marginPercent: 5
    },
    configSchema: [
      { key: 'marginPercent', label: 'Margin Trim (%)', type: 'number', min: 1, max: 25, step: 1, default: 5 }
    ]
  },
  {
    id: 'metadataScrub',
    name: 'Scrub Metadata',
    category: 'Security',
    description: 'Wipe Author, Producer, Creator, and timestamps',
    icon: 'FiShield',
    iconColor: '#2ed573',
    acceptTypes: ['application/pdf'],
    outputType: 'application/pdf',
    defaultConfig: {
      wipeAll: true
    },
    configSchema: [
      { key: 'wipeAll', label: 'Wipe All Identifying Tags', type: 'checkbox', default: true }
    ]
  },
  {
    id: 'flatten',
    name: 'Flatten PDF',
    category: 'Security',
    description: 'Bake forms and annotations permanently to prevent tampering',
    icon: 'FiLock',
    iconColor: '#9b59b6',
    acceptTypes: ['application/pdf'],
    outputType: 'application/pdf',
    defaultConfig: {},
    configSchema: []
  },
  {
    id: 'compressPdf',
    name: 'Compress PDF',
    category: 'Optimize',
    description: 'Apply Flate stream compression and discard unused objects',
    icon: 'FiZap',
    iconColor: '#1cff99',
    acceptTypes: ['application/pdf'],
    outputType: 'application/pdf',
    defaultConfig: {
      level: 'medium'
    },
    configSchema: [
      { key: 'level', label: 'Compression Level', type: 'select', options: ['balanced', 'maximum'], default: 'balanced' }
    ]
  },
  {
    id: 'pdfToDocx',
    name: 'Convert PDF to Word',
    category: 'Convert',
    description: 'Extract structured text and output an editable .docx file',
    icon: 'FiFileText',
    iconColor: '#2b579a',
    acceptTypes: ['application/pdf'],
    outputType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    outputExt: 'docx',
    defaultConfig: {},
    configSchema: []
  },
  {
    id: 'pdfToText',
    name: 'Extract PDF to Text',
    category: 'Convert',
    description: 'Extract raw text stream into a .txt file',
    icon: 'FiFileText',
    iconColor: '#3498db',
    acceptTypes: ['application/pdf'],
    outputType: 'text/plain',
    outputExt: 'txt',
    defaultConfig: {},
    configSchema: []
  },
  {
    id: 'stripExif',
    name: 'Strip Image EXIF',
    category: 'Security',
    description: 'Remove GPS coordinates, camera serial, and date from photos',
    icon: 'FiImage',
    iconColor: '#2ed573',
    acceptTypes: ['image/jpeg', 'image/png', 'image/webp'],
    outputType: 'image/jpeg',
    defaultConfig: {},
    configSchema: []
  },
  {
    id: 'compressImage',
    name: 'Compress Image',
    category: 'Optimize',
    description: 'Reduce image file size with client-side canvas compression',
    icon: 'FiImage',
    iconColor: '#10b981',
    acceptTypes: ['image/jpeg', 'image/png', 'image/webp'],
    outputType: 'image/jpeg',
    defaultConfig: {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      quality: 0.8
    },
    configSchema: [
      { key: 'maxSizeMB', label: 'Max Target Size (MB)', type: 'number', min: 0.1, max: 10, step: 0.1, default: 1 },
      { key: 'maxWidthOrHeight', label: 'Max Width / Height (px)', type: 'number', min: 640, max: 3840, step: 100, default: 1920 }
    ]
  },
  {
    id: 'convertImage',
    name: 'Convert Image Format',
    category: 'Convert',
    description: 'Convert between PNG, JPG, or WebP',
    icon: 'FiImage',
    iconColor: '#f39c12',
    acceptTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'],
    outputType: 'image/webp',
    defaultConfig: {
      format: 'image/webp'
    },
    configSchema: [
      { key: 'format', label: 'Target Format', type: 'select', options: ['image/webp', 'image/png', 'image/jpeg'], default: 'image/webp' }
    ]
  }
];

/**
 * Pre-built Workflow Templates
 */
export const WORKFLOW_TEMPLATES = [
  {
    id: 'clean-and-secure',
    name: 'Clean & Secure PDF',
    description: 'Wipe all author metadata tags, stamp a confidential watermark, and flatten form annotations.',
    badge: 'Popular',
    icon: 'FiShield',
    iconColor: '#2ed573',
    steps: [
      { actionId: 'metadataScrub', config: { wipeAll: true } },
      { actionId: 'watermark', config: { text: 'CONFIDENTIAL', opacity: 0.2, color: '#ff4757', fontSize: 44, rotation: 45 } },
      { actionId: 'flatten', config: {} }
    ]
  },
  {
    id: 'publish-prep',
    name: 'Publishing & Page Numbering',
    description: 'Trim excess page borders, insert sequential footer page numbers, and apply stream compression.',
    badge: 'Productivity',
    icon: 'FiLayers',
    iconColor: '#3498db',
    steps: [
      { actionId: 'cropMargins', config: { marginPercent: 4 } },
      { actionId: 'pageNumbers', config: { format: 'Page {n} of {total}', position: 'bottom-center', fontSize: 10, startNumber: 1, color: '#555555' } },
      { actionId: 'compressPdf', config: { level: 'balanced' } }
    ]
  },
  {
    id: 'pdf-to-editable',
    name: 'PDF to Word Extraction',
    description: 'Scrub PDF metadata and restructure pages into an editable Microsoft Word (.docx) document.',
    badge: 'Convert',
    icon: 'FiFileText',
    iconColor: '#2b579a',
    steps: [
      { actionId: 'metadataScrub', config: { wipeAll: true } },
      { actionId: 'pdfToDocx', config: {} }
    ]
  },
  {
    id: 'photo-privacy-optimizer',
    name: 'Photo Privacy & Compression',
    description: 'Strip GPS coordinates and camera fingerprints from photos, then optimize file size to WebP.',
    badge: 'Media',
    icon: 'FiImage',
    iconColor: '#10b981',
    steps: [
      { actionId: 'stripExif', config: {} },
      { actionId: 'compressImage', config: { maxSizeMB: 0.8, maxWidthOrHeight: 1920 } },
      { actionId: 'convertImage', config: { format: 'image/webp' } }
    ]
  }
];

// Helper: Hex color to RGB object
function hexToRgb(hex) {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return { r: isNaN(r) ? 0 : r, g: isNaN(g) ? 0 : g, b: isNaN(b) ? 0 : b };
}

/**
 * Pure Transformation Handlers
 */
const TRANSFORM_HANDLERS = {
  // 1. Watermark PDF
  async watermark(file, config) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();
    const color = hexToRgb(config.color || '#ff4757');
    const opacity = Number(config.opacity) || 0.25;
    const fontSize = Number(config.fontSize) || 48;
    const text = config.text || 'CONFIDENTIAL';
    const angle = Number(config.rotation) || 45;

    for (const page of pages) {
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      page.drawText(text, {
        x: (width - textWidth) / 2,
        y: (height - textHeight) / 2,
        size: fontSize,
        font,
        color: rgb(color.r, color.g, color.b),
        opacity,
        rotate: degrees(angle)
      });
    }

    const outputBytes = await pdfDoc.save();
    return new File([outputBytes], file.name.replace(/\.pdf$/i, '_watermarked.pdf'), { type: 'application/pdf' });
  },

  // 2. Add Page Numbers
  async pageNumbers(file, config) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const total = pages.length;
    const format = config.format || 'Page {n} of {total}';
    const position = config.position || 'bottom-center';
    const fontSize = Number(config.fontSize) || 10;
    const startNumber = Number(config.startNumber) || 1;
    const textColor = hexToRgb(config.color || '#555555');

    pages.forEach((page, idx) => {
      const currentNumber = startNumber + idx;
      const text = format.replace('{n}', currentNumber).replace('{total}', total);
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const margin = 28;

      let x = (width - textWidth) / 2;
      let y = margin;

      if (position === 'bottom-left') {
        x = margin;
        y = margin;
      } else if (position === 'bottom-right') {
        x = width - textWidth - margin;
        y = margin;
      } else if (position === 'top-center') {
        x = (width - textWidth) / 2;
        y = height - margin;
      } else if (position === 'top-left') {
        x = margin;
        y = height - margin;
      } else if (position === 'top-right') {
        x = width - textWidth - margin;
        y = height - margin;
      }

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(textColor.r, textColor.g, textColor.b),
        opacity: 0.85
      });
    });

    const outputBytes = await pdfDoc.save();
    return new File([outputBytes], file.name.replace(/\.pdf$/i, '_numbered.pdf'), { type: 'application/pdf' });
  },

  // 3. Rotate PDF
  async rotate(file, config) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const angle = Number(config.angle) || 90;
    const pages = pdfDoc.getPages();

    for (const page of pages) {
      const currentRot = page.getRotation().angle;
      page.setRotation(degrees((currentRot + angle) % 360));
    }

    const outputBytes = await pdfDoc.save();
    return new File([outputBytes], file.name.replace(/\.pdf$/i, '_rotated.pdf'), { type: 'application/pdf' });
  },

  // 4. Crop Margins
  async cropMargins(file, config) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pct = (Number(config.marginPercent) || 5) / 100;
    const pages = pdfDoc.getPages();

    for (const page of pages) {
      const { width, height } = page.getSize();
      const trimX = width * pct;
      const trimY = height * pct;

      page.setCropBox(trimX, trimY, width - 2 * trimX, height - 2 * trimY);
    }

    const outputBytes = await pdfDoc.save();
    return new File([outputBytes], file.name.replace(/\.pdf$/i, '_cropped.pdf'), { type: 'application/pdf' });
  },

  // 5. Metadata Scrub
  async metadataScrub(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer('');
    pdfDoc.setCreator('');
    pdfDoc.setCreationDate(new Date(0));
    pdfDoc.setModificationDate(new Date(0));

    const outputBytes = await pdfDoc.save();
    return new File([outputBytes], file.name.replace(/\.pdf$/i, '_cleaned.pdf'), { type: 'application/pdf' });
  },

  // 6. Flatten PDF
  async flatten(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    try {
      const form = pdfDoc.getForm();
      form.flatten();
    } catch {
      // Form was not present or already flat
    }

    const outputBytes = await pdfDoc.save({ useObjectStreams: true });
    return new File([outputBytes], file.name.replace(/\.pdf$/i, '_flattened.pdf'), { type: 'application/pdf' });
  },

  // 7. Compress PDF
  async compressPdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    // Save with stream compression & stripped duplicates
    const outputBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false
    });

    return new File([outputBytes], file.name.replace(/\.pdf$/i, '_compressed.pdf'), { type: 'application/pdf' });
  },

  // 8. PDF to Word (.docx)
  async pdfToDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const docxParagraphs = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items;

      items.sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > 5) return yDiff;
        return a.transform[4] - b.transform[4];
      });

      let currentLineY = null;
      let currentLineText = [];

      for (const item of items) {
        const itemY = Math.round(item.transform[5]);
        if (currentLineY === null) {
          currentLineY = itemY;
          currentLineText.push(item.str);
        } else if (Math.abs(currentLineY - itemY) <= 5) {
          currentLineText.push(item.str);
        } else {
          const lineString = currentLineText.join(' ').replace(/\s+/g, ' ').trim();
          if (lineString) {
            docxParagraphs.push(new Paragraph({ children: [new TextRun(lineString)], spacing: { after: 120 } }));
          }
          currentLineY = itemY;
          currentLineText = [item.str];
        }
      }

      if (currentLineText.length > 0) {
        const lineString = currentLineText.join(' ').replace(/\s+/g, ' ').trim();
        if (lineString) {
          docxParagraphs.push(new Paragraph({ children: [new TextRun(lineString)] }));
        }
      }

      if (pageNum < numPages) {
        docxParagraphs.push(new Paragraph({ pageBreakBefore: true }));
      }
    }

    const doc = new Document({ sections: [{ properties: {}, children: docxParagraphs }] });
    const blob = await Packer.toBlob(doc);
    return new File([blob], file.name.replace(/\.pdf$/i, '.docx'), {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  },

  // 9. PDF to Text
  async pdfToText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const textChunks = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageStr = textContent.items.map(item => item.str).join(' ');
      textChunks.push(`--- Page ${i} ---\n${pageStr}`);
    }

    const fullText = textChunks.join('\n\n');
    return new File([fullText], file.name.replace(/\.pdf$/i, '.txt'), { type: 'text/plain' });
  },

  // 10. Strip EXIF Image
  async stripExif(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Canvas rasterization failed'));
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '_clean.jpg'), { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.95);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image for EXIF stripping'));
      };
      img.src = url;
    });
  },

  // 11. Compress Image
  async compressImage(file, config) {
    const options = {
      maxSizeMB: Number(config.maxSizeMB) || 1,
      maxWidthOrHeight: Number(config.maxWidthOrHeight) || 1920,
      useWebWorker: true
    };
    const compressedBlob = await imageCompression(file, options);
    return new File([compressedBlob], file.name.replace(/\.[^.]+$/, '_compressed.jpg'), { type: compressedBlob.type || 'image/jpeg' });
  },

  // 12. Convert Image
  async convertImage(file, config) {
    const format = config.format || 'image/webp';
    const ext = format === 'image/webp' ? 'webp' : format === 'image/png' ? 'png' : 'jpg';

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');

        if (format === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Canvas export failed'));
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), { type: format }));
        }, format, 0.92);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image for conversion'));
      };
      img.src = url;
    });
  }
};

/**
 * Execute a Pipeline Sequence on a Single File
 * @param {File} initialFile 
 * @param {Array<{actionId: string, config: Object}>} steps 
 * @param {Function} onStepProgress - callback (stepIndex, totalSteps, stepName)
 * @returns {Promise<File>}
 */
export async function executeWorkflowPipeline(initialFile, steps, onStepProgress = () => {}) {
  let currentFile = initialFile;
  const total = steps.length;

  for (let i = 0; i < total; i++) {
    const step = steps[i];
    const actionDef = WORKFLOW_ACTIONS.find(a => a.id === step.actionId);
    if (!actionDef) {
      throw new Error(`Unknown action: ${step.actionId}`);
    }

    onStepProgress(i, total, actionDef.name);

    const handler = TRANSFORM_HANDLERS[step.actionId];
    if (!handler) {
      throw new Error(`Handler not implemented for action: ${step.actionId}`);
    }

    currentFile = await handler(currentFile, step.config || {});
  }

  onStepProgress(total, total, 'Complete');
  return currentFile;
}
