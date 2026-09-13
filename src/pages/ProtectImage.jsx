import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite';
import {
  FiLock,
  FiUnlock,
  FiShield,
  FiEye,
  FiEyeOff,
  FiDownload,
  FiTrash2,
  FiFileText,
  FiKey,
  FiCheckCircle,
  FiCopy
} from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import Loader from '../components/Loader';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import { ToolHeroView, ToolStudioHeader } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { formatFileSize } from '../utils/fileUtils';

/* ==========================================================================
   CRYPTOGRAPHY & STEGANOGRAPHY CORE ENGINES (100% Client-Side Web Crypto)
   ========================================================================== */

const VAULT_MAGIC = 'TFPV1'; // 5 bytes
const STEGO_MAGIC = 'TFPSTEG1'; // 8 bytes

// Derive 256-bit AES key from password via PBKDF2 (100,000 iterations SHA-256)
async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt Uint8Array payload with AES-256-GCM
async function encryptWithPassword(dataBytes, password) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBytes
  );

  const magicBytes = new TextEncoder().encode(VAULT_MAGIC);
  const cipherBytes = new Uint8Array(cipherBuffer);
  const out = new Uint8Array(magicBytes.length + salt.length + iv.length + cipherBytes.length);

  out.set(magicBytes, 0);
  out.set(salt, magicBytes.length);
  out.set(iv, magicBytes.length + salt.length);
  out.set(cipherBytes, magicBytes.length + salt.length + iv.length);

  return out;
}

// Decrypt encrypted payload with AES-256-GCM
async function decryptWithPassword(encryptedBytes, password) {
  const magicLen = VAULT_MAGIC.length;
  const magic = new TextDecoder().decode(encryptedBytes.slice(0, magicLen));
  if (magic !== VAULT_MAGIC) {
    throw new Error('Invalid vault file. Magic header mismatch or unsupported format.');
  }

  const salt = encryptedBytes.slice(magicLen, magicLen + 16);
  const iv = encryptedBytes.slice(magicLen + 16, magicLen + 28);
  const ciphertext = encryptedBytes.slice(magicLen + 28);

  const key = await deriveKey(password, salt);
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new Uint8Array(decryptedBuffer);
}

// PNG CRC32 table & calculation (RFC 2083 standard)
let crcTable = null;
function getCrcTable() {
  if (!crcTable) {
    const cTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        if (c & 1) {
          c = 0xedb88320 ^ (c >>> 1);
        } else {
          c = c >>> 1;
        }
      }
      cTable[n] = c;
    }
    crcTable = cTable;
  }
  return crcTable;
}

function crc32(buf) {
  const table = getCrcTable();
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Inject an ancillary PNG chunk (tfpS) before the final IEND chunk
function injectPngChunk(pngBytes, chunkTypeStr, chunkData) {
  if (pngBytes.length < 12) return pngBytes;
  const typeBytes = new TextEncoder().encode(chunkTypeStr);
  const dataLen = chunkData.length;

  const crcTarget = new Uint8Array(4 + dataLen);
  crcTarget.set(typeBytes, 0);
  crcTarget.set(chunkData, 4);
  const crc = crc32(crcTarget);

  const chunkTotalLen = 4 + 4 + dataLen + 4;
  const chunk = new Uint8Array(chunkTotalLen);

  chunk[0] = (dataLen >> 24) & 0xff;
  chunk[1] = (dataLen >> 16) & 0xff;
  chunk[2] = (dataLen >> 8) & 0xff;
  chunk[3] = dataLen & 0xff;

  chunk.set(typeBytes, 4);
  chunk.set(chunkData, 8);

  chunk[8 + dataLen] = (crc >> 24) & 0xff;
  chunk[8 + dataLen + 1] = (crc >> 16) & 0xff;
  chunk[8 + dataLen + 2] = (crc >> 8) & 0xff;
  chunk[8 + dataLen + 3] = crc & 0xff;

  const iendOffset = pngBytes.length - 12;
  const out = new Uint8Array(pngBytes.length + chunkTotalLen);
  out.set(pngBytes.subarray(0, iendOffset), 0);
  out.set(chunk, iendOffset);
  out.set(pngBytes.subarray(iendOffset), iendOffset + chunkTotalLen);

  return out;
}

// Extract an ancillary PNG chunk by 4-letter type string
function extractPngChunk(pngBytes, chunkTypeStr) {
  if (pngBytes.length < 8) return null;
  const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for (let i = 0; i < 8; i++) {
    if (pngBytes[i] !== sig[i]) return null;
  }

  let offset = 8;
  while (offset + 8 <= pngBytes.length) {
    const len = (pngBytes[offset] << 24) | (pngBytes[offset + 1] << 16) | (pngBytes[offset + 2] << 8) | pngBytes[offset + 3];
    const type = String.fromCharCode(
      pngBytes[offset + 4],
      pngBytes[offset + 5],
      pngBytes[offset + 6],
      pngBytes[offset + 7]
    );

    if (type === chunkTypeStr) {
      const dataStart = offset + 8;
      const dataEnd = dataStart + len;
      if (dataEnd <= pngBytes.length) {
        return pngBytes.slice(dataStart, dataEnd);
      }
    }

    offset += 12 + len;
    if (type === 'IEND') break;
  }

  return null;
}

// Parse structured Steganography Envelope:
// [MAGIC (8)] + [isEncrypted (1)] + [filenameLen (1)] + [filename (...)] + [payloadLen (4)] + [payloadBytes (...)]
function parseStegoEnvelope(envelope) {
  if (!envelope || envelope.length < STEGO_MAGIC.length + 6) {
    throw new Error('No hidden File Peace steganographic data detected in this image.');
  }

  const magic = new TextDecoder().decode(envelope.subarray(0, STEGO_MAGIC.length));
  if (magic !== STEGO_MAGIC) {
    throw new Error('No hidden File Peace steganographic data detected in this image.');
  }

  let offset = STEGO_MAGIC.length;
  const isEncrypted = envelope[offset] === 1;
  offset += 1;

  const fnLen = envelope[offset];
  offset += 1;

  let filename = '';
  if (fnLen > 0) {
    filename = new TextDecoder().decode(envelope.subarray(offset, offset + fnLen));
    offset += fnLen;
  }

  const payloadLen = (envelope[offset] << 24) | (envelope[offset + 1] << 16) | (envelope[offset + 2] << 8) | envelope[offset + 3];
  offset += 4;

  const payloadBytes = envelope.subarray(offset, offset + payloadLen);
  return {
    isEncrypted,
    filename,
    payloadBytes,
  };
}

// LSB Steganography: Embed bytes into canvas pixel data
function embedDataIntoImageData(imageData, payloadBytes) {
  const { data } = imageData;
  const totalChannels = (data.length / 4) * 3; // R, G, B channels (A untouched)
  const totalPayloadBits = payloadBytes.length * 8;

  if (totalPayloadBits > totalChannels) {
    throw new Error(
      `Cover image capacity exceeded. Need ${Math.ceil(totalPayloadBits / 8)} bytes, but image can hold ${Math.floor(totalChannels / 8)} bytes.`
    );
  }

  let bitIdx = 0;
  for (let i = 0; i < data.length && bitIdx < totalPayloadBits; i += 4) {
    for (let c = 0; c < 3 && bitIdx < totalPayloadBits; c++) {
      const byteIdx = Math.floor(bitIdx / 8);
      const bitOffset = 7 - (bitIdx % 8);
      const bit = (payloadBytes[byteIdx] >> bitOffset) & 1;

      data[i + c] = (data[i + c] & 0xfe) | bit;
      bitIdx++;
    }
  }
}

// LSB Steganography: Extract raw envelope bytes from canvas pixel data
function extractRawEnvelopeFromImageData(imageData) {
  const { data } = imageData;
  const totalChannels = (data.length / 4) * 3;

  const readBits = (startBit, count) => {
    let val = 0;
    for (let b = 0; b < count; b++) {
      const currentBit = startBit + b;
      const pixelIdx = Math.floor(currentBit / 3) * 4;
      const channelOffset = currentBit % 3;
      const bit = data[pixelIdx + channelOffset] & 1;
      val = (val << 1) | bit;
    }
    return val;
  };

  const readBytes = (startBit, byteCount) => {
    const bytes = new Uint8Array(byteCount);
    for (let i = 0; i < byteCount; i++) {
      bytes[i] = readBits(startBit + i * 8, 8);
    }
    return bytes;
  };

  // 1. Read and check magic header (8 bytes = 64 bits)
  const magicBytes = readBytes(0, STEGO_MAGIC.length);
  const magic = new TextDecoder().decode(magicBytes);
  if (magic !== STEGO_MAGIC) {
    throw new Error('No hidden File Peace steganographic data detected in this image.');
  }

  let bitCursor = STEGO_MAGIC.length * 8;

  // 2. Read isEncrypted flag (1 byte = 8 bits)
  const isEncrypted = readBits(bitCursor, 8);
  bitCursor += 8;

  // 3. Read filename length (1 byte = 8 bits)
  const filenameLen = readBits(bitCursor, 8);
  bitCursor += 8;

  // 4. Read filename string
  let filename = '';
  if (filenameLen > 0) {
    const fnBytes = readBytes(bitCursor, filenameLen);
    filename = new TextDecoder().decode(fnBytes);
    bitCursor += filenameLen * 8;
  }

  // 5. Read payload length (4 bytes = 32 bits, big-endian)
  const lenBytes = readBytes(bitCursor, 4);
  const payloadLen = (lenBytes[0] << 24) | (lenBytes[1] << 16) | (lenBytes[2] << 8) | lenBytes[3];
  bitCursor += 32;

  if (payloadLen <= 0 || bitCursor + payloadLen * 8 > totalChannels) {
    throw new Error('Corrupted steganographic payload header.');
  }

  // 6. Read payload data bytes
  const payloadBytes = readBytes(bitCursor, payloadLen);

  // Re-assemble envelope
  const fnBytes = new TextEncoder().encode(filename);
  const totalLen = STEGO_MAGIC.length + 1 + 1 + fnBytes.length + 4 + payloadBytes.length;
  const envelope = new Uint8Array(totalLen);
  let offset = 0;
  envelope.set(magicBytes, offset);
  offset += magicBytes.length;
  envelope[offset] = isEncrypted;
  offset += 1;
  envelope[offset] = fnBytes.length;
  offset += 1;
  if (fnBytes.length > 0) {
    envelope.set(fnBytes, offset);
    offset += fnBytes.length;
  }
  envelope[offset] = (payloadLen >> 24) & 0xff;
  envelope[offset + 1] = (payloadLen >> 16) & 0xff;
  envelope[offset + 2] = (payloadLen >> 8) & 0xff;
  envelope[offset + 3] = payloadLen & 0xff;
  offset += 4;
  envelope.set(payloadBytes, offset);

  return envelope;
}

/* ==========================================================================
   REACT COMPONENT — PROTECT IMAGE STUDIO
   ========================================================================== */

export default function ProtectImage() {
  const location = useLocation();

  // Active Main Mode: 'vault' | 'pdf' | 'stego'
  const [activeTab, setActiveTab] = useState('vault');

  // Subtabs
  const [vaultSubtab, setVaultSubtab] = useState('encrypt'); // 'encrypt' | 'decrypt'
  const [stegoSubtab, setStegoSubtab] = useState('hide'); // 'hide' | 'extract'

  // Common Passwords
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // --- MODE 1: AES-256 VAULT STATE ---
  const [vaultFiles, setVaultFiles] = useState([]); // Array of File objects
  const [encryptedVaultFile, setEncryptedVaultFile] = useState(null); // File to decrypt
  const [decryptedFiles, setDecryptedFiles] = useState([]); // Extracted from vault { name, url, size }

  // --- MODE 2: IMAGE TO ENCRYPTED PDF STATE ---
  const [pdfImages, setPdfImages] = useState([]); // Array of File objects

  // --- MODE 3: STEGANOGRAPHY STATE ---
  const [coverImage, setCoverImage] = useState(null); // File
  const [coverPreviewUrl, setCoverPreviewUrl] = useState(null);
  const [coverDimensions, setCoverDimensions] = useState(null);
  const [stegoSecretType, setStegoSecretType] = useState('text'); // 'text' | 'file'
  const [stegoSecretText, setStegoSecretText] = useState('');
  const [stegoSecretFile, setStegoSecretFile] = useState(null);
  const [stegoImageToExtract, setStegoImageToExtract] = useState(null);
  const [extractedSecret, setExtractedSecret] = useState(null); // { type: 'text'|'file', content, filename }

  // Processing & UI Feedback
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // ActionCompleted Output
  const [resultBlob, setResultBlob] = useState(null);
  const [resultFileName, setResultFileName] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);

  const handledIncomingRef = useRef(false);

  // Dynamic Output Object URL
  const resultUrl = useMemo(() => {
    return resultBlob ? URL.createObjectURL(resultBlob) : null;
  }, [resultBlob]);

  // Cleanup Object URLs on unmount / change
  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
      decryptedFiles.forEach((f) => {
        if (f.url) URL.revokeObjectURL(f.url);
      });
    };
  }, [resultUrl, coverPreviewUrl, decryptedFiles]);

  // Handle Piped File from Another Tool
  useEffect(() => {
    if (handledIncomingRef.current) return;
    const incoming = consumeTransferredFile() || location.state?.incomingFile;
    if (incoming) {
      handledIncomingRef.current = true;
      if (incoming.type.startsWith('image/')) {
        setTimeout(() => {
          setVaultFiles([incoming]);
          setPdfImages([incoming]);
          setCoverImage(incoming);
          setCoverPreviewUrl(URL.createObjectURL(incoming));
        }, 0);
      }
    }
  }, [location.state]);

  // Calculate Steganography Capacity
  const coverCapacityBytes = useMemo(() => {
    if (!coverDimensions) return 0;
    const { width, height } = coverDimensions;
    // (width * height * 3 channels) / 8 bits minus header overhead
    return Math.max(0, Math.floor((width * height * 3) / 8) - 100);
  }, [coverDimensions]);

  // Handle Cover Image Upload
  const handleCoverUpload = useCallback((files) => {
    if (!files || files.length === 0) return;
    const file = Array.isArray(files) ? files[0] : files;
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a valid image file (PNG or JPG).');
      return;
    }
    setErrorMessage(null);
    setCoverImage(file);

    const url = URL.createObjectURL(file);
    setCoverPreviewUrl(url);

    const img = new window.Image();
    img.onload = () => {
      setCoverDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = url;
  }, []);

  // Compute Password Strength
  const passwordStrength = useMemo(() => {
    if (!password) return { label: 'Empty', color: 'var(--text-dim)', pct: 0 };
    let score = 0;
    if (password.length >= 6) score += 25;
    if (password.length >= 10) score += 25;
    if (/[A-Z]/.test(password)) score += 15;
    if (/[0-9]/.test(password)) score += 15;
    if (/[^A-Za-z0-9]/.test(password)) score += 20;

    if (score < 40) return { label: 'Weak', color: '#ff4757', pct: score };
    if (score < 75) return { label: 'Moderate', color: '#f1c40f', pct: score };
    return { label: 'Strong (AES-256)', color: 'var(--accent-color)', pct: 100 };
  }, [password]);

  /* ==========================================================================
     ACTION HANDLERS
     ========================================================================== */

  // 1. Encrypt Images into AES-256 Vault Container
  const handleEncryptVault = async () => {
    if (vaultFiles.length === 0) {
      setErrorMessage('Please select at least one image to encrypt into the vault.');
      return;
    }
    if (!password || password.length < 4) {
      setErrorMessage('Please enter a password with at least 4 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);
    setLoadingMessage('Creating secure in-memory ZIP container...');
    setErrorMessage(null);

    try {
      // 1. Pack all images into an in-memory ZIP archive using JSZip
      const zip = new JSZip();
      for (const file of vaultFiles) {
        const buf = await file.arrayBuffer();
        zip.file(file.name, buf);
      }

      setLoadingMessage('Encrypting vault with AES-256-GCM & PBKDF2...');
      const zipBytes = await zip.generateAsync({
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      // 2. Encrypt the raw zip binary with AES-GCM
      const encryptedVaultBytes = await encryptWithPassword(zipBytes, password);

      const blob = new Blob([encryptedVaultBytes], { type: 'application/octet-stream' });
      const baseName = vaultFiles[0].name.replace(/\.[^.]+$/, '');
      const outName = `${baseName}_secure_vault.vault`;

      setResultBlob(blob);
      setResultFileName(outName);
      setSuccessMessage('Images securely locked in AES-256 Encrypted Vault!');
      setIsCompleted(true);
    } catch (err) {
      console.error('Vault encryption failed:', err);
      setErrorMessage(err.message || 'Failed to encrypt images into vault.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Decrypt AES-256 Vault Container
  const handleDecryptVault = async () => {
    if (!encryptedVaultFile) {
      setErrorMessage('Please upload a .vault file to unlock.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter the vault password.');
      return;
    }

    setLoading(true);
    setLoadingMessage('Authenticating and decrypting vault with AES-256-GCM...');
    setErrorMessage(null);

    try {
      const fileBytes = new Uint8Array(await encryptedVaultFile.arrayBuffer());
      const decryptedZipBytes = await decryptWithPassword(fileBytes, password);

      setLoadingMessage('Extracting decrypted image files...');
      const zip = await JSZip.loadAsync(decryptedZipBytes);

      const extracted = [];
      for (const [filename, fileEntry] of Object.entries(zip.files)) {
        if (!fileEntry.dir) {
          const blob = await fileEntry.async('blob');
          const url = URL.createObjectURL(blob);
          extracted.push({
            name: filename,
            size: blob.size,
            url,
            blob,
          });
        }
      }

      if (extracted.length === 0) {
        throw new Error('Vault decrypted successfully, but no files were found inside.');
      }

      setDecryptedFiles(extracted);
      setSuccessMessage(`Vault unlocked successfully! Extracted ${extracted.length} image(s).`);
    } catch (err) {
      console.error('Vault decryption failed:', err);
      setErrorMessage('Decryption failed. Please check that the password is correct.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Convert Images into Password-Protected PDF
  const handleCreateProtectedPdf = async () => {
    if (pdfImages.length === 0) {
      setErrorMessage('Please select at least one photo to convert to a protected PDF.');
      return;
    }
    if (!password || password.length < 3) {
      setErrorMessage('Please enter a password with at least 3 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);
    setLoadingMessage('Rendering high-DPI PDF document...');
    setErrorMessage(null);

    try {
      const pdfDoc = await PDFDocument.create();

      for (const file of pdfImages) {
        const arrayBuf = await file.arrayBuffer();
        let embeddedImage;

        if (file.type === 'image/jpeg' || file.name.match(/\.(jpe?g)$/i)) {
          embeddedImage = await pdfDoc.embedJpg(arrayBuf);
        } else if (file.type === 'image/png' || file.name.match(/\.png$/i)) {
          embeddedImage = await pdfDoc.embedPng(arrayBuf);
        } else {
          // Convert other image types (WebP, GIF, BMP) via offscreen canvas
          const imgBitmap = await createImageBitmap(file);
          const canvas = document.createElement('canvas');
          canvas.width = imgBitmap.width;
          canvas.height = imgBitmap.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(imgBitmap, 0, 0);

          const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
          const pngBuf = await pngBlob.arrayBuffer();
          embeddedImage = await pdfDoc.embedPng(pngBuf);
        }

        const { width, height } = embeddedImage;
        const page = pdfDoc.addPage([width, height]);
        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width,
          height,
        });
      }

      setLoadingMessage('Applying PDF password encryption (@pdfsmaller)...');
      const rawPdfBytes = await pdfDoc.save();
      const protectedPdfBytes = await encryptPDF(new Uint8Array(rawPdfBytes), password);

      const blob = new Blob([protectedPdfBytes], { type: 'application/pdf' });
      const baseName = pdfImages[0].name.replace(/\.[^.]+$/, '');
      const outName = `${baseName}_protected.pdf`;

      setResultBlob(blob);
      setResultFileName(outName);
      setSuccessMessage('Password-protected PDF created successfully!');
      setIsCompleted(true);
    } catch (err) {
      console.error('PDF creation failed:', err);
      setErrorMessage(err.message || 'Failed to create password-protected PDF.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Steganography: Hide Secret Text or File in Cover Photo
  const handleHideSteganography = async () => {
    if (!coverImage) {
      setErrorMessage('Please upload a cover image first.');
      return;
    }

    let payloadBytes;
    let secretFilename = '';

    if (stegoSecretType === 'text') {
      if (!stegoSecretText.trim()) {
        setErrorMessage('Please enter the secret text message you wish to conceal.');
        return;
      }
      payloadBytes = new TextEncoder().encode(stegoSecretText);
    } else {
      if (!stegoSecretFile) {
        setErrorMessage('Please select the secret file you wish to conceal.');
        return;
      }
      payloadBytes = new Uint8Array(await stegoSecretFile.arrayBuffer());
      secretFilename = stegoSecretFile.name;
    }

    setLoading(true);
    setLoadingMessage('Analyzing pixels and encoding hidden payload...');
    setErrorMessage(null);

    try {
      // Optional passphrase encryption
      let isEncrypted = 0;
      if (password && password.trim().length > 0) {
        isEncrypted = 1;
        setLoadingMessage('Encrypting secret payload with AES-256-GCM...');
        payloadBytes = await encryptWithPassword(payloadBytes, password);
      }

      // Build structured Steganography Envelope:
      // [MAGIC (8)] + [isEncrypted (1)] + [filenameLen (1)] + [filename (...)] + [payloadLen (4)] + [payloadBytes (...)]
      const magicBytes = new TextEncoder().encode(STEGO_MAGIC);
      const fnBytes = new TextEncoder().encode(secretFilename);
      const fnLen = fnBytes.length;
      const payloadLen = payloadBytes.length;

      const totalEnvelopeSize = magicBytes.length + 1 + 1 + fnLen + 4 + payloadLen;
      const envelope = new Uint8Array(totalEnvelopeSize);

      let offset = 0;
      envelope.set(magicBytes, offset);
      offset += magicBytes.length;

      envelope[offset] = isEncrypted;
      offset += 1;

      envelope[offset] = fnLen;
      offset += 1;

      if (fnLen > 0) {
        envelope.set(fnBytes, offset);
        offset += fnLen;
      }

      envelope[offset] = (payloadLen >> 24) & 0xff;
      envelope[offset + 1] = (payloadLen >> 16) & 0xff;
      envelope[offset + 2] = (payloadLen >> 8) & 0xff;
      envelope[offset + 3] = payloadLen & 0xff;
      offset += 4;

      envelope.set(payloadBytes, offset);

      // Render cover photo on canvas and embed LSB bits
      let imgBitmap;
      try {
        imgBitmap = await createImageBitmap(coverImage, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
      } catch {
        imgBitmap = await createImageBitmap(coverImage);
      }

      const canvas = document.createElement('canvas');
      canvas.width = imgBitmap.width;
      canvas.height = imgBitmap.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(imgBitmap, 0, 0);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Ensure all alpha channels are 255 to eliminate premultiplication distortion
      for (let i = 3; i < imgData.data.length; i += 4) {
        imgData.data[i] = 255;
      }
      embedDataIntoImageData(imgData, envelope);
      ctx.putImageData(imgData, 0, 0);

      setLoadingMessage('Generating lossless steganographic PNG...');
      const rawBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const rawBuffer = await rawBlob.arrayBuffer();

      // Inject lossless ancillary tfpS chunk for guaranteed immunity across display profiles
      const injectedBytes = injectPngChunk(new Uint8Array(rawBuffer), 'tfpS', envelope);
      const stegoBlob = new Blob([injectedBytes], { type: 'image/png' });

      const baseName = coverImage.name.replace(/\.[^.]+$/, '');
      const outName = `${baseName}_stego_vault.png`;

      setResultBlob(stegoBlob);
      setResultFileName(outName);
      setSuccessMessage('Secret concealed inside cover photo with zero visual distortion!');
      setIsCompleted(true);
    } catch (err) {
      console.error('Steganography embed failed:', err);
      setErrorMessage(err.message || 'Failed to embed secret into cover image.');
    } finally {
      setLoading(false);
    }
  };

  // 5. Steganography: Extract Secret from Stego Image
  const handleExtractSteganography = async () => {
    if (!stegoImageToExtract) {
      setErrorMessage('Please upload a steganographic photo to analyze.');
      return;
    }

    setLoading(true);
    setLoadingMessage('Scanning photo for hidden steganographic vault...');
    setErrorMessage(null);
    setExtractedSecret(null);

    try {
      // 1. Try fast, lossless PNG chunk extraction first (immune to display profile alterations)
      const fileBytes = new Uint8Array(await stegoImageToExtract.arrayBuffer());
      const chunkData = extractPngChunk(fileBytes, 'tfpS');

      let envelope;
      if (chunkData) {
        envelope = chunkData;
      } else {
        // Fallback: Canvas LSB pixel scan
        let imgBitmap;
        try {
          imgBitmap = await createImageBitmap(stegoImageToExtract, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
        } catch {
          imgBitmap = await createImageBitmap(stegoImageToExtract);
        }
        const canvas = document.createElement('canvas');
        canvas.width = imgBitmap.width;
        canvas.height = imgBitmap.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(imgBitmap, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        envelope = extractRawEnvelopeFromImageData(imgData);
      }

      const { isEncrypted, filename, payloadBytes } = parseStegoEnvelope(envelope);

      let finalBytes = payloadBytes;
      if (isEncrypted) {
        if (!password || password.trim().length === 0) {
          throw new Error('This hidden vault is passphrase-protected. Please enter your passphrase in the input field above and click Scan & Extract Secret.');
        }
        setLoadingMessage('Decrypting hidden payload with AES-256-GCM...');
        try {
          finalBytes = await decryptWithPassword(payloadBytes, password);
        } catch (decryptErr) {
          console.error('Steganography decrypt error:', decryptErr);
          throw new Error('Decryption failed. Please verify that your passphrase is correct.', { cause: decryptErr });
        }
      }

      if (filename && filename.length > 0) {
        // Extracted file
        const blob = new Blob([finalBytes], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        setExtractedSecret({
          type: 'file',
          filename,
          size: blob.size,
          url,
        });
        setSuccessMessage(`Secret file "${filename}" extracted successfully!`);
      } else {
        // Extracted text
        const text = new TextDecoder().decode(finalBytes);
        setExtractedSecret({
          type: 'text',
          content: text,
        });
        setSuccessMessage('Secret message extracted successfully!');
      }
    } catch (err) {
      console.error('Steganography extract failed:', err);
      setErrorMessage(err.message || 'Failed to extract hidden data from image.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultBlob(null);
    setResultFileName('');
    setIsCompleted(false);
    setPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
    setSuccessMessage(null);
    setDecryptedFiles([]);
    setExtractedSecret(null);
  };

  const hasFiles = Boolean(
    (activeTab === 'vault' && ((vaultSubtab === 'encrypt' && vaultFiles.length > 0) || (vaultSubtab === 'decrypt' && encryptedVaultFile))) ||
    (activeTab === 'pdf' && pdfImages.length > 0) ||
    (activeTab === 'stego' && ((stegoSubtab === 'hide' && coverImage) || (stegoSubtab === 'extract' && stegoImageToExtract)))
  );

  // -------------------------------------------------------------
  // VIEW 3: ACTION COMPLETED
  // -------------------------------------------------------------
  if (isCompleted && resultBlob) {
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          toolTitle="Protect Image Studio"
          fileUrl={resultUrl}
          fileName={resultFileName}
          file={resultBlob}
          message={successMessage || 'File secured successfully!'}
          onReset={handleReset}
          onProcessSourceAgain={() => setIsCompleted(false)}
          sourceActionLabel="Adjust Protection Settings"
          currentPath="/protect-image"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: STUDIO VIEW (When files are active)
  // -------------------------------------------------------------
  if (hasFiles) {
    return (
      <div
        className="studio-page-container"
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '0.75rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 72px)',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
      >
        {/* Compact Micro-bar Studio Header */}
        <ToolStudioHeader
          icon={FiShield}
          title="Image Protection Studio"
          fileBadge={
            activeTab === 'vault'
              ? vaultSubtab === 'encrypt'
                ? `${vaultFiles.length} Photos • AES Vault`
                : encryptedVaultFile?.name
              : activeTab === 'pdf'
              ? `${pdfImages.length} Photos • PDF Lock`
              : coverImage?.name || stegoImageToExtract?.name || 'Steganography'
          }
          onReset={handleReset}
          resetLabel="Reset Tool"
        />

        {/* Micro Mode Switcher */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.4rem 1rem',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--card-bg)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className={`category-pill ${activeTab === 'vault' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('vault');
              setErrorMessage(null);
            }}
            style={{ padding: '0.35rem 0.85rem', fontSize: '0.82rem' }}
          >
            <FiLock size={13} />
            <span>AES-256 Vault Container</span>
          </button>
          <button
            type="button"
            className={`category-pill ${activeTab === 'pdf' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('pdf');
              setErrorMessage(null);
            }}
            style={{ padding: '0.35rem 0.85rem', fontSize: '0.82rem' }}
          >
            <FiFileText size={13} />
            <span>Password-Protected PDF</span>
          </button>
          <button
            type="button"
            className={`category-pill ${activeTab === 'stego' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('stego');
              setErrorMessage(null);
            }}
            style={{ padding: '0.35rem 0.85rem', fontSize: '0.82rem' }}
          >
            <FiEye size={13} />
            <span>Steganographic Image Vault</span>
          </button>
        </div>

        {/* Global Feedback Alerts */}
        {errorMessage && (
          <div style={{ padding: '0.35rem 1rem', flexShrink: 0 }}>
            <AlertBanner type="error" message={errorMessage} onClose={() => setErrorMessage(null)} />
          </div>
        )}
        {successMessage && (
          <div style={{ padding: '0.35rem 1rem', flexShrink: 0 }}>
            <AlertBanner type="success" message={successMessage} onClose={() => setSuccessMessage(null)} />
          </div>
        )}

        {/* Studio Content Pane (Independently scrolling, 0 outer scroll) */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.25rem' }}>
          {/* TAB 1: AES-256 VAULT CONTAINER */}
          {activeTab === 'vault' && (
            <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setVaultSubtab('encrypt');
                    setErrorMessage(null);
                  }}
                  style={{
                    padding: '0.45rem 1.15rem',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: vaultSubtab === 'encrypt' ? 'var(--primary-color)' : 'transparent',
                    color: vaultSubtab === 'encrypt' ? '#ffffff' : 'var(--text-color)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <FiLock style={{ marginRight: 6 }} /> Encrypt Images
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVaultSubtab('decrypt');
                    setErrorMessage(null);
                  }}
                  style={{
                    padding: '0.45rem 1.15rem',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: vaultSubtab === 'decrypt' ? 'var(--primary-color)' : 'transparent',
                    color: vaultSubtab === 'decrypt' ? '#ffffff' : 'var(--text-color)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <FiUnlock style={{ marginRight: 6 }} /> Unlock / Decrypt Vault
                </button>
              </div>

              {vaultSubtab === 'encrypt' ? (
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.4rem 0' }}>
                    Package Photos into AES-256 Encrypted Vault (.vault)
                  </h3>
                  <p style={{ color: 'var(--text-color)', opacity: 0.75, fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                    Compresses your photos into an authenticated, military-grade AES-256-GCM container derived with 100,000 PBKDF2 iterations.
                  </p>

                  <div className="studio-grid">
                    {/* Left: Selected Images & Add More */}
                    <div className="studio-left-pane">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                          Selected Images ({vaultFiles.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setVaultFiles([])}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ff4757',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                          }}
                        >
                          Clear All
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px', marginBottom: '1rem' }}>
                        {vaultFiles.map((file, idx) => (
                          <div
                            key={`${file.name}-${idx}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.65rem 0.85rem',
                              background: 'var(--subtle-bg)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.85rem',
                            }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }} title={file.name}>
                              {file.name}
                            </span>
                            <span style={{ opacity: 0.6, fontSize: '0.78rem' }}>{formatFileSize(file.size)}</span>
                            <button
                              type="button"
                              onClick={() => setVaultFiles(vaultFiles.filter((_, i) => i !== idx))}
                              style={{ background: 'transparent', border: 'none', color: '#ff4757', cursor: 'pointer', padding: 2 }}
                              title="Remove file"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <FileUpload
                        onFilesSelected={(files) => setVaultFiles((prev) => [...prev, ...files])}
                        accept="image/*"
                        multiple
                        title="Add more images..."
                      />
                    </div>

                    {/* Right: Security Configuration & Password */}
                    <div className="studio-right-pane">
                      <div style={{
                        background: 'var(--card-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1.5rem',
                        boxShadow: 'var(--card-shadow)',
                      }}>
                        <h4 style={{ margin: '0 0 1.25rem 0', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FiLock style={{ color: 'var(--primary-color)' }} /> Vault Passphrase
                        </h4>

                        <div style={{ marginBottom: '1.25rem' }}>
                          <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                            Passphrase <span style={{ color: '#ff4757' }}>*</span>
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="Minimum 6 characters..."
                              style={{
                                width: '100%',
                                padding: '0.75rem 2.5rem 0.75rem 0.85rem',
                                background: 'var(--bg-color)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-color)',
                                fontSize: '0.95rem',
                                boxSizing: 'border-box',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              style={{
                                position: 'absolute',
                                right: '0.75rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-color)',
                                cursor: 'pointer',
                                opacity: 0.6,
                              }}
                            >
                              {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                            </button>
                          </div>
                          {password && (
                            <div style={{ fontSize: '0.75rem', color: passwordStrength.color, marginTop: '0.25rem', fontWeight: 600 }}>
                              Passphrase Security: {passwordStrength.label}
                            </div>
                          )}
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                          <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                            Confirm Password <span style={{ color: '#ff4757' }}>*</span>
                          </label>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter your password..."
                            style={{
                              width: '100%',
                              padding: '0.75rem 0.85rem',
                              background: 'var(--bg-color)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--text-color)',
                              fontSize: '0.95rem',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        <button
                          type="button"
                          disabled={loading || vaultFiles.length === 0 || !password || password !== confirmPassword}
                          onClick={handleEncryptVault}
                          style={{
                            width: '100%',
                            padding: '0.85rem',
                            fontSize: '1rem',
                            fontWeight: 700,
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            background: 'var(--gradient-primary)',
                            color: '#ffffff',
                            cursor: loading || vaultFiles.length === 0 || !password || password !== confirmPassword ? 'not-allowed' : 'pointer',
                            opacity: loading || vaultFiles.length === 0 || !password || password !== confirmPassword ? 0.6 : 1,
                            boxShadow: 'var(--card-shadow)',
                          }}
                        >
                          <FiLock style={{ marginRight: 8 }} /> Encrypt & Export Vault (.vault)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* UNLOCK VAULT VIEW */
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.4rem 0' }}>
                    Unlock & Decrypt AES-256 Vault (.vault)
                  </h3>
                  <div className="studio-grid">
                    <div className="studio-left-pane">
                      <div style={{
                        padding: '1.25rem',
                        background: 'var(--subtle-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '1rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-color)' }}>
                              {encryptedVaultFile?.name}
                            </div>
                            <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.25rem' }}>
                              Size: {formatFileSize(encryptedVaultFile?.size || 0)} • AES-256-GCM Container
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEncryptedVaultFile(null);
                              setDecryptedFiles([]);
                            }}
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--border-color)',
                              color: '#ff4757',
                              cursor: 'pointer',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '0.35rem 0.75rem',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            <FiTrash2 size={13} /> Change Vault File
                          </button>
                        </div>
                      </div>

                      {decryptedFiles.length > 0 && (
                        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
                            Decrypted Photos ({decryptedFiles.length})
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', maxHeight: '420px', overflowY: 'auto' }}>
                            {decryptedFiles.map((file, idx) => (
                              <div
                                key={idx}
                                style={{
                                  border: '1px solid var(--border-color)',
                                  borderRadius: 'var(--radius-md)',
                                  overflow: 'hidden',
                                  background: 'var(--card-bg)',
                                }}
                              >
                                <img
                                  src={file.url}
                                  alt={file.name}
                                  style={{ width: '100%', height: '140px', objectFit: 'cover' }}
                                />
                                <div style={{ padding: '0.65rem 0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>
                                    {file.name}
                                  </span>
                                  <a
                                    href={file.url}
                                    download={file.name}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      fontSize: '0.78rem',
                                      color: 'var(--primary-color)',
                                      textDecoration: 'none',
                                      fontWeight: 700,
                                    }}
                                  >
                                    <FiDownload size={13} /> Save
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="studio-right-pane">
                      <div style={{
                        background: 'var(--card-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1.5rem',
                        boxShadow: 'var(--card-shadow)',
                      }}>
                        <h4 style={{ margin: '0 0 1.25rem 0', fontSize: '1.05rem', fontWeight: 700 }}>
                          Decryption Passphrase
                        </h4>
                        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter vault passphrase..."
                            style={{
                              width: '100%',
                              padding: '0.75rem 2.5rem 0.75rem 0.85rem',
                              background: 'var(--bg-color)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--text-color)',
                              fontSize: '0.95rem',
                              boxSizing: 'border-box',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                              position: 'absolute',
                              right: '0.75rem',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-color)',
                              cursor: 'pointer',
                              opacity: 0.6,
                            }}
                          >
                            {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                          </button>
                        </div>

                        <button
                          type="button"
                          disabled={loading || !encryptedVaultFile || !password}
                          onClick={handleDecryptVault}
                          style={{
                            width: '100%',
                            padding: '0.85rem',
                            fontSize: '1rem',
                            fontWeight: 700,
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            background: 'var(--gradient-primary)',
                            color: '#ffffff',
                            cursor: loading || !encryptedVaultFile || !password ? 'not-allowed' : 'pointer',
                            opacity: loading || !encryptedVaultFile || !password ? 0.6 : 1,
                            boxShadow: 'var(--card-shadow)',
                          }}
                        >
                          <FiUnlock style={{ marginRight: 6 }} /> Decrypt & Unlock Images
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PASSWORD-PROTECTED PDF */}
          {activeTab === 'pdf' && (
            <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: 'var(--radius-xl)' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.4rem 0' }}>
                Convert Photos into Password-Protected Encrypted PDF
              </h3>
              <p style={{ color: 'var(--text-color)', opacity: 0.75, fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                Generates a secure PDF containing your photos with AES-256 standard encryption requiring password on open.
              </p>

              <div className="studio-grid">
                <div className="studio-left-pane">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      Selected Photos ({pdfImages.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setPdfImages([])}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ff4757',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                      }}
                    >
                      Clear All
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px', marginBottom: '1rem' }}>
                    {pdfImages.map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.65rem 0.85rem',
                          background: 'var(--subtle-bg)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.85rem',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }} title={file.name}>
                          {file.name}
                        </span>
                        <span style={{ opacity: 0.6, fontSize: '0.78rem' }}>{formatFileSize(file.size)}</span>
                        <button
                          type="button"
                          onClick={() => setPdfImages(pdfImages.filter((_, i) => i !== idx))}
                          style={{ background: 'transparent', border: 'none', color: '#ff4757', cursor: 'pointer', padding: 2 }}
                          title="Remove file"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <FileUpload
                    onFilesSelected={(files) => setPdfImages((prev) => [...prev, ...files])}
                    accept="image/*"
                    multiple
                    title="Add more photos to PDF..."
                  />
                </div>

                <div className="studio-right-pane">
                  <div style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.5rem',
                    boxShadow: 'var(--card-shadow)',
                  }}>
                    <h4 style={{ margin: '0 0 1.25rem 0', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FiLock style={{ color: 'var(--primary-color)' }} /> PDF Security Options
                    </h4>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                        Document Password <span style={{ color: '#ff4757' }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password to open PDF..."
                          style={{
                            width: '100%',
                            padding: '0.75rem 2.5rem 0.75rem 0.85rem',
                            background: 'var(--bg-color)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-color)',
                            fontSize: '0.95rem',
                            boxSizing: 'border-box',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            position: 'absolute',
                            right: '0.75rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-color)',
                            cursor: 'pointer',
                            opacity: 0.6,
                          }}
                        >
                          {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                        Confirm Password <span style={{ color: '#ff4757' }}>*</span>
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter document password..."
                        style={{
                          width: '100%',
                          padding: '0.75rem 0.85rem',
                          background: 'var(--bg-color)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-color)',
                          fontSize: '0.95rem',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={loading || pdfImages.length === 0 || !password || password !== confirmPassword}
                      onClick={handleCreateProtectedPdf}
                      style={{
                        width: '100%',
                        padding: '0.85rem',
                        fontSize: '1rem',
                        fontWeight: 700,
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        background: 'var(--gradient-primary)',
                        color: '#ffffff',
                        cursor: loading || pdfImages.length === 0 || !password || password !== confirmPassword ? 'not-allowed' : 'pointer',
                        opacity: loading || pdfImages.length === 0 || !password || password !== confirmPassword ? 0.6 : 1,
                        boxShadow: 'var(--card-shadow)',
                      }}
                    >
                      <FiFileText style={{ marginRight: 8 }} /> Generate Encrypted PDF (.pdf)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STEGANOGRAPHY */}
          {activeTab === 'stego' && (
            <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setStegoSubtab('hide');
                    setErrorMessage(null);
                  }}
                  style={{
                    padding: '0.45rem 1.15rem',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: stegoSubtab === 'hide' ? 'var(--primary-color)' : 'transparent',
                    color: stegoSubtab === 'hide' ? '#ffffff' : 'var(--text-color)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <FiEyeOff style={{ marginRight: 6 }} /> Hide Secret Inside Image
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStegoSubtab('extract');
                    setErrorMessage(null);
                  }}
                  style={{
                    padding: '0.45rem 1.15rem',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: stegoSubtab === 'extract' ? 'var(--primary-color)' : 'transparent',
                    color: stegoSubtab === 'extract' ? '#ffffff' : 'var(--text-color)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <FiEye style={{ marginRight: 6 }} /> Extract Secret From Image
                </button>
              </div>

              {stegoSubtab === 'hide' ? (
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.4rem 0' }}>
                    Conceal Files or Text Inside Carrier Image
                  </h3>
                  <div className="studio-grid">
                    <div className="studio-left-pane">
                      <div style={{
                        padding: '1.25rem',
                        background: 'var(--subtle-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '1rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Cover Image: {coverImage?.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setCoverImage(null);
                              if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
                              setCoverPreviewUrl(null);
                            }}
                            style={{ background: 'transparent', border: 'none', color: '#ff4757', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                          >
                            Change Cover
                          </button>
                        </div>
                        {coverPreviewUrl && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <img
                              src={coverPreviewUrl}
                              alt="Cover preview"
                              style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '6px' }}
                            />
                            {coverDimensions && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                                Dimensions: {coverDimensions.width} × {coverDimensions.height} px • Max Payload: {formatFileSize(coverCapacityBytes)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Secret Type Selector */}
                      <div style={{ background: 'var(--card-bg)', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>
                          Secret to Embed:
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <button
                            type="button"
                            onClick={() => setStegoSecretType('text')}
                            className={`category-pill ${stegoSecretType === 'text' ? 'active' : ''}`}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                          >
                            Secret Message / Note
                          </button>
                          <button
                            type="button"
                            onClick={() => setStegoSecretType('file')}
                            className={`category-pill ${stegoSecretType === 'file' ? 'active' : ''}`}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                          >
                            Secret File / Document
                          </button>
                        </div>

                        {stegoSecretType === 'text' ? (
                          <textarea
                            value={stegoSecretText}
                            onChange={(e) => setStegoSecretText(e.target.value)}
                            placeholder="Type confidential message to conceal inside image pixels..."
                            rows={4}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-color)',
                              color: 'var(--text-color)',
                              boxSizing: 'border-box',
                            }}
                          />
                        ) : (
                          <FileUpload
                            onFilesSelected={(files) => setStegoSecretFile(files[0])}
                            multiple={false}
                            title={stegoSecretFile ? `Selected: ${stegoSecretFile.name}` : "Upload secret file to hide"}
                          />
                        )}
                      </div>
                    </div>

                    <div className="studio-right-pane">
                      <div style={{
                        background: 'var(--card-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1.5rem',
                        boxShadow: 'var(--card-shadow)',
                      }}>
                        <h4 style={{ margin: '0 0 1.25rem 0', fontSize: '1.05rem', fontWeight: 700 }}>
                          Steganography Encryption
                        </h4>
                        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                          <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                            Passphrase (Optional)
                          </label>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Add optional AES encryption..."
                            style={{
                              width: '100%',
                              padding: '0.75rem 2.5rem 0.75rem 0.85rem',
                              background: 'var(--bg-color)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--text-color)',
                              fontSize: '0.95rem',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        <button
                          type="button"
                          disabled={loading || !coverImage || (stegoSecretType === 'text' ? !stegoSecretText.trim() : !stegoSecretFile)}
                          onClick={handleHideSteganography}
                          style={{
                            width: '100%',
                            padding: '0.85rem',
                            fontSize: '1rem',
                            fontWeight: 700,
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            background: 'var(--gradient-primary)',
                            color: '#ffffff',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            boxShadow: 'var(--card-shadow)',
                          }}
                        >
                          <FiEyeOff style={{ marginRight: 6 }} /> Embed Secret & Download PNG
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* EXTRACT STEGO VIEW */
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.4rem 0' }}>
                    Extract Concealed Secret From Image
                  </h3>
                  <div className="studio-grid">
                    <div className="studio-left-pane">
                      <div style={{
                        padding: '1.25rem',
                        background: 'var(--subtle-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '1rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{stegoImageToExtract?.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setStegoImageToExtract(null);
                              setExtractedSecret(null);
                            }}
                            style={{ background: 'transparent', border: 'none', color: '#ff4757', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                          >
                            Change Image
                          </button>
                        </div>
                      </div>

                      {extractedSecret && (
                        <div style={{ background: 'var(--card-bg)', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                          <h4 style={{ margin: '0 0 0.75rem 0', color: '#2ed573' }}>
                            <FiCheckCircle style={{ marginRight: 6 }} /> Secret Extracted!
                          </h4>
                          {extractedSecret.type === 'text' ? (
                            <div>
                              <div style={{ padding: '0.85rem', background: 'var(--subtle-bg)', borderRadius: '6px', whiteSpace: 'pre-wrap', marginBottom: '0.75rem' }}>
                                {extractedSecret.content}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(extractedSecret.content);
                                  alert('Secret copied to clipboard!');
                                }}
                                className="btn-secondary"
                                style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}
                              >
                                <FiCopy size={13} /> Copy Text
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{extractedSecret.filename}</span>
                              <a
                                href={extractedSecret.url}
                                download={extractedSecret.filename}
                                className="btn-primary"
                                style={{ padding: '0.45rem 1rem', textDecoration: 'none', fontSize: '0.84rem' }}
                              >
                                <FiDownload size={14} /> Download File
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="studio-right-pane">
                      <div style={{
                        background: 'var(--card-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1.5rem',
                        boxShadow: 'var(--card-shadow)',
                      }}>
                        <h4 style={{ margin: '0 0 1.25rem 0', fontSize: '1.05rem', fontWeight: 700 }}>
                          Passphrase (If Encrypted)
                        </h4>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Passphrase if encrypted..."
                          style={{
                            width: '100%',
                            padding: '0.75rem 0.85rem',
                            background: 'var(--bg-color)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-color)',
                            fontSize: '0.95rem',
                            boxSizing: 'border-box',
                            marginBottom: '1.5rem',
                          }}
                        />
                        <button
                          type="button"
                          disabled={loading || !stegoImageToExtract}
                          onClick={handleExtractSteganography}
                          style={{
                            width: '100%',
                            padding: '0.85rem',
                            fontSize: '1rem',
                            fontWeight: 700,
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            background: 'var(--gradient-primary)',
                            color: '#ffffff',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            boxShadow: 'var(--card-shadow)',
                          }}
                        >
                          <FiKey style={{ marginRight: 6 }} /> Scan & Extract Secret
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {loading && <Loader message={loadingMessage || 'Securing image data in memory...'} />}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: HERO VIEW (Empty upload state)
  // -------------------------------------------------------------
  return (
    <>
      <ToolHeroView
      compact={true}
      title="Protect Image Studio"
      description="Encrypt photos into AES-256 vaults, password-locked PDFs, or steganographic image files."
      badge="Image Privacy"
      badgeIcon={FiShield}
      toolPath="/protect-image"
      acceptedFormats={
        activeTab === 'vault'
          ? vaultSubtab === 'encrypt' ? ['.jpg', '.png', '.webp', '.gif'] : ['.vault', '.enc', '.tfpvault']
          : activeTab === 'pdf' ? ['.jpg', '.png', '.webp', '.jpeg']
          : stegoSubtab === 'hide' ? ['.png', '.jpg', '.webp'] : ['.png']
      }
      allowMultiple={(activeTab === 'vault' && vaultSubtab === 'encrypt') || activeTab === 'pdf'}
      maxSizeText="50 MB"
      accept={
        activeTab === 'vault'
          ? vaultSubtab === 'encrypt' ? { 'image/*': ['.jpg', '.png', '.webp', '.gif'] } : { 'application/octet-stream': ['.vault', '.enc', '.tfpvault'] }
          : activeTab === 'pdf' ? { 'image/*': ['.jpg', '.png', '.webp', '.jpeg'] }
          : stegoSubtab === 'hide' ? { 'image/*': ['.png', '.jpg', '.webp'] } : { 'image/png': ['.png'] }
      }
      onFilesSelected={(files) => {
        if (activeTab === 'vault') {
          if (vaultSubtab === 'encrypt') setVaultFiles(files);
          else setEncryptedVaultFile(files[0]);
        } else if (activeTab === 'pdf') {
          setPdfImages(files);
        } else if (activeTab === 'stego') {
          if (stegoSubtab === 'hide') handleCoverUpload(files);
          else setStegoImageToExtract(files[0]);
        }
      }}
      alerts={
        <>
          {errorMessage && (
            <AlertBanner type="error" message={errorMessage} onClose={() => setErrorMessage(null)} />
          )}
          {successMessage && (
            <AlertBanner type="success" message={successMessage} onClose={() => setSuccessMessage(null)} />
          )}

          {/* Mode Switcher Tabs */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem', marginBottom: (activeTab === 'vault' || activeTab === 'stego') ? '0.35rem' : '0.1rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`category-pill ${activeTab === 'vault' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('vault');
                setErrorMessage(null);
              }}
              style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem' }}
            >
              <FiLock size={12} />
              <span>AES-256 Vault</span>
            </button>
            <button
              type="button"
              className={`category-pill ${activeTab === 'pdf' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('pdf');
                setErrorMessage(null);
              }}
              style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem' }}
            >
              <FiFileText size={12} />
              <span>Password PDF</span>
            </button>
            <button
              type="button"
              className={`category-pill ${activeTab === 'stego' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('stego');
                setErrorMessage(null);
              }}
              style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem' }}
            >
              <FiEye size={12} />
              <span>Steganography</span>
            </button>
          </div>

          {/* Subtabs if vault or stego */}
          {(activeTab === 'vault' || activeTab === 'stego') && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem', marginBottom: '0.1rem' }}>
              {activeTab === 'vault' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setVaultSubtab('encrypt')}
                    className={`category-pill ${vaultSubtab === 'encrypt' ? 'active' : ''}`}
                    style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem' }}
                  >
                    <FiLock size={11} /> Encrypt Images
                  </button>
                  <button
                    type="button"
                    onClick={() => setVaultSubtab('decrypt')}
                    className={`category-pill ${vaultSubtab === 'decrypt' ? 'active' : ''}`}
                    style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem' }}
                  >
                    <FiUnlock size={11} /> Unlock .vault File
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setStegoSubtab('hide')}
                    className={`category-pill ${stegoSubtab === 'hide' ? 'active' : ''}`}
                    style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem' }}
                  >
                    <FiEyeOff size={11} /> Hide in Image
                  </button>
                  <button
                    type="button"
                    onClick={() => setStegoSubtab('extract')}
                    className={`category-pill ${stegoSubtab === 'extract' ? 'active' : ''}`}
                    style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem' }}
                  >
                    <FiEye size={11} /> Extract Secret
                  </button>
                </>
              )}
            </div>
          )}
        </>
      }
      />
      {loading && <Loader message={loadingMessage || 'Securing image data in memory...'} />}
    </>
  );
}
