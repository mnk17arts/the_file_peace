import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import {
  FiMaximize2,
  FiDownload,
  FiCopy,
  FiCheck,
  FiCamera,
  FiImage,
  FiWifi,
  FiGlobe,
  FiUser,
  FiMail,
  FiFileText,
  FiExternalLink,
} from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import AlertBanner from '../components/AlertBanner';
import ActionCompleted from '../components/ActionCompleted';
import { ToolStudioHeader, ResizableSplitPane } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { decodeQrFromImageOrCanvas } from '../utils/qrDecoder';

const QR_TYPES = [
  { id: 'url', label: 'Website URL', icon: FiGlobe },
  { id: 'text', label: 'Plain Text', icon: FiFileText },
  { id: 'wifi', label: 'Wi-Fi Network', icon: FiWifi },
  { id: 'vcard', label: 'vCard Contact', icon: FiUser },
  { id: 'email', label: 'Email Address', icon: FiMail },
];

export default function QrTools() {
  const location = useLocation();

  // Mode: 'generate' | 'scan'
  const [activeTab, setActiveTab] = useState('generate');

  // Generator Payload State
  const [qrType, setQrType] = useState('url');
  const [urlInput, setUrlInput] = useState('https://thefilepeace.com');
  const [textInput, setTextInput] = useState('');
  const [wifiData, setWifiData] = useState({ ssid: '', password: '', encryption: 'WPA' });
  const [vcardData, setVcardData] = useState({ firstName: '', lastName: '', phone: '', email: '', org: '', title: '' });
  const [emailData, setEmailData] = useState({ address: '', subject: '', body: '' });

  // Generator Styling
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [errorCorrection, setErrorCorrection] = useState('M'); // L, M, Q, H
  const [qrSize, setQrSize] = useState(380);
  const [qrMargin, setQrMargin] = useState(2);
  const [logoFile, setLogoFile] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);

  // Generated Outputs
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrSvgString, setQrSvgString] = useState('');

  // Scanner State
  const [scannerMode, setScannerMode] = useState('camera'); // 'camera' | 'file'
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scannedResult, setScannedResult] = useState('');
  const [copied, setCopied] = useState(false);

  // Result & Errors
  const [savedBlob, setSavedBlob] = useState(null);
  const [savedFileName, setSavedFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const videoRef = useRef(null);
  const videoStreamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const handledIncomingRef = useRef(false);

  const savedUrl = useMemo(() => {
    return savedBlob ? URL.createObjectURL(savedBlob) : null;
  }, [savedBlob]);

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => track.stop());
      videoStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const scanVideoFrame = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      setScannedResult(code.data);
      stopCamera();
    } else {
      animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
    }
  };

  const startCamera = async () => {
    stopCamera();
    setScannedResult('');
    setErrorMessage('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      videoStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        setIsCameraActive(true);
        requestAnimationFrame(scanVideoFrame);
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setErrorMessage('Camera access denied or unavailable. Please enable camera permissions or upload an image file.');
      setIsCameraActive(false);
    }
  };

  useEffect(() => {
    return () => {
      if (savedUrl) URL.revokeObjectURL(savedUrl);
      if (logoUrl) URL.revokeObjectURL(logoUrl);
      stopCamera();
    };
  }, [savedUrl, logoUrl]);

  // Construct QR Payload string based on active type
  const rawPayload = useMemo(() => {
    switch (qrType) {
      case 'url':
        return urlInput.trim();
      case 'text':
        return textInput.trim();
      case 'wifi':
        return `WIFI:T:${wifiData.encryption};S:${wifiData.ssid};P:${wifiData.password};;`;
      case 'vcard':
        return `BEGIN:VCARD\nVERSION:3.0\nN:${vcardData.lastName};${vcardData.firstName};;;\nFN:${vcardData.firstName} ${vcardData.lastName}\nORG:${vcardData.org}\nTITLE:${vcardData.title}\nTEL:${vcardData.phone}\nEMAIL:${vcardData.email}\nEND:VCARD`;
      case 'email':
        return `mailto:${emailData.address}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`;
      default:
        return urlInput.trim();
    }
  }, [qrType, urlInput, textInput, wifiData, vcardData, emailData]);

  // Generate QR Canvas and SVG
  const generateQr = useCallback(async () => {
    if (!rawPayload) {
      setQrDataUrl('');
      setQrSvgString('');
      return;
    }

    try {
      // 1. Generate base QR data URL
      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, rawPayload, {
        width: qrSize,
        margin: qrMargin,
        errorCorrectionLevel: logoFile ? 'H' : errorCorrection, // use high error correction if logo embedded
        color: {
          dark: fgColor,
          light: bgColor,
        },
      });

      // 2. If Logo is selected, draw center badge
      if (logoUrl) {
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.src = logoUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        const logoDim = Math.round(qrSize * 0.22);
        const center = (qrSize - logoDim) / 2;

        // Draw white background backing for logo
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(center - 4, center - 4, logoDim + 8, logoDim + 8, 8);
        ctx.fill();

        ctx.drawImage(img, center, center, logoDim, logoDim);
      }

      setQrDataUrl(canvas.toDataURL('image/png'));

      // 3. Generate SVG String
      const svg = await QRCode.toString(rawPayload, {
        type: 'svg',
        margin: qrMargin,
        errorCorrectionLevel: errorCorrection,
        color: {
          dark: fgColor,
          light: bgColor,
        },
      });
      setQrSvgString(svg);
    } catch (err) {
      console.error('QR generation error:', err);
      setErrorMessage(err.message || 'Failed to generate QR code.');
    }
  }, [rawPayload, qrSize, qrMargin, errorCorrection, fgColor, bgColor, logoFile, logoUrl]);

  useEffect(() => {
    const timer = setTimeout(() => {
      generateQr();
    }, 0);
    return () => clearTimeout(timer);
  }, [generateQr]);

  // -------------------------------------------------------------
  // FILE / PDF SCANNER IMPLEMENTATION
  // -------------------------------------------------------------
  const handleScanFile = async (files) => {
    if (!files || files.length === 0) return;
    const file = Array.isArray(files) ? files[0] : files;
    setScannedResult('');
    setErrorMessage('');

    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        // Scan PDF pages for QR codes
        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({
          data: new Uint8Array(buffer),
          useWorkerFetch: false,
          isEvalSupported: false,
        }).promise;

        let foundCode = '';

        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          await page.render({ canvasContext: ctx, viewport }).promise;

          try {
            const code = await decodeQrFromImageOrCanvas(canvas);
            if (code) {
              foundCode = code;
              break;
            }
          } catch {
            // continue to next page
          }
        }

        if (foundCode) {
          setScannedResult(foundCode);
        } else {
          throw new Error('No QR code detected in the uploaded PDF.');
        }
      } else {
        // Image file scan
        const code = await decodeQrFromImageOrCanvas(file);
        if (code) {
          setScannedResult(code);
        } else {
          throw new Error('No QR code detected in the image.');
        }
      }
    } catch (err) {
      console.error('QR decode error:', err);
      setErrorMessage(err.message || 'Could not decode QR code from file.');
    }
  };

  // Handle incoming transferred file
  useEffect(() => {
    if (handledIncomingRef.current) return;
    const incoming = consumeTransferredFile() || location.state?.incomingFile;
    if (incoming) {
      handledIncomingRef.current = true;
      setTimeout(() => {
        setActiveTab('scan');
        setScannerMode('file');
        handleScanFile([incoming]);
      }, 0);
    }
  }, [location.state]);

  // Handle Logo Upload for Center badge
  const handleLogoUpload = (files) => {
    if (!files) return;
    const file = files[0] || (files instanceof File ? files : null);
    if (!file) return;
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    setLogoFile(file);
    setLogoUrl(URL.createObjectURL(file));
  };

  const handleRemoveLogo = () => {
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    setLogoFile(null);
    setLogoUrl(null);
  };

  // Export PNG
  const handleExportPng = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `qrcode-${Date.now()}.png`;
    a.click();
  };

  // Export SVG
  const handleExportSvg = () => {
    if (!qrSvgString) return;
    const blob = new Blob([qrSvgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qrcode-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export PDF
  const handleExportPdf = async () => {
    if (!qrDataUrl) return;
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4
      const pngBuffer = await fetch(qrDataUrl).then((r) => r.arrayBuffer());
      const pngImg = await pdfDoc.embedPng(pngBuffer);

      const renderDim = 320;
      const x = (595.28 - renderDim) / 2;
      const y = (841.89 - renderDim) / 2;

      page.drawImage(pngImg, { x, y, width: renderDim, height: renderDim });

      const pdfBytes = await pdfDoc.save({ updateMetadata: false });
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      setSavedBlob(blob);
      setSavedFileName(`qrcode-${Date.now()}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      setErrorMessage('Failed to generate PDF document.');
    }
  };

  const handleCopyScanned = () => {
    if (!scannedResult) return;
    navigator.clipboard.writeText(scannedResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setUrlInput('https://thefilepeace.com');
    setTextInput('');
    setLogoFile(null);
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    setLogoUrl(null);
    setSavedBlob(null);
    setScannedResult('');
    setErrorMessage('');
    stopCamera();
  };

  // -------------------------------------------------------------
  // VIEW 3: ACTION COMPLETED
  // -------------------------------------------------------------
  if (savedBlob && savedUrl) {
    return (
      <div style={{ maxHeight: 'calc(100vh - 72px)', overflowY: 'auto', padding: '1.5rem 1rem' }}>
        <ActionCompleted
          fileUrl={savedUrl}
          fileName={savedFileName}
          file={new File([savedBlob], savedFileName, { type: savedBlob.type })}
          onReset={handleReset}
          onProcessSourceAgain={() => setSavedBlob(null)}
          sourceActionLabel="Back to QR Studio"
          message="QR Code document exported successfully!"
          currentPath="/qr-tools"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: TYPE-C SELF-CONTAINED WORKSPACE (LOCKED TO VIEWPORT HEIGHT)
  // -------------------------------------------------------------
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
        overflow: 'hidden',
      }}
    >
      {/* Top Micro Bar Studio Header */}
      <ToolStudioHeader
        icon={FiMaximize2}
        title="QR Code Studio"
        toolPath="/qr-tools"
        fileBadge={
          activeTab === 'generate'
            ? `${QR_TYPES.find((t) => t.id === qrType)?.label} QR`
            : scannerMode === 'camera'
            ? 'Camera Scanner'
            : 'File Scanner'
        }
        onReset={handleReset}
        resetLabel="Reset"
        headerExtra={
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--subtle-bg)',
              padding: '0.2rem',
              borderRadius: '30px',
              border: '1px solid var(--border-color)',
              gap: '0.2rem',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setActiveTab('generate');
                stopCamera();
              }}
              style={{
                padding: '0.3rem 0.85rem',
                borderRadius: '20px',
                border: 'none',
                background: activeTab === 'generate' ? 'var(--primary-color)' : 'transparent',
                color: activeTab === 'generate' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <FiMaximize2 size={13} /> Generator
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('scan')}
              style={{
                padding: '0.3rem 0.85rem',
                borderRadius: '20px',
                border: 'none',
                background: activeTab === 'scan' ? 'var(--primary-color)' : 'transparent',
                color: activeTab === 'scan' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <FiCamera size={13} /> Scanner &amp; Decoder
            </button>
          </div>
        }
        actionButton={
          activeTab === 'generate' ? (
            <button
              type="button"
              onClick={handleExportPng}
              disabled={!qrDataUrl}
              className="btn-primary studio-header-action-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 1.1rem',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              <FiDownload size={14} />
              <span>Download PNG</span>
            </button>
          ) : null
        }
      />

      {errorMessage && (
        <div style={{ padding: '0.4rem 0', flexShrink: 0 }}>
          <AlertBanner
            message={errorMessage}
            type="error"
            onClose={() => setErrorMessage('')}
          />
        </div>
      )}

      {/* Main Studio Workspace Body */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          paddingTop: '0.5rem',
        }}
      >
        {/* TAB 1: GENERATOR */}
        {activeTab === 'generate' && (
          <ResizableSplitPane
            defaultSplit={56}
            minLeftWidth={360}
            minRightWidth={320}
            height="100%"
            leftTitle="QR Content & Styling Configuration"
            rightTitle="Live QR Preview & Export"
            storageKey="qr_tools_split"
            leftPane={
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  minWidth: 0,
                  height: '100%',
                  overflowY: 'auto',
                  padding: '0.25rem',
                  boxSizing: 'border-box',
                }}
              >
              {/* 1. Payload Type Picker */}
              <div
                className="workspace-card"
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '14px',
                  padding: '1.25rem',
                  boxSizing: 'border-box',
                  minWidth: 0,
                  flexShrink: 0,
                }}
              >
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.75rem' }}>
                  1. QR Content Type:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.45rem' }}>
                  {QR_TYPES.map((t) => {
                    const Icon = t.icon;
                    const active = qrType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setQrType(t.id)}
                        style={{
                          padding: '0.55rem 0.5rem',
                          borderRadius: '8px',
                          border: `1px solid ${active ? 'var(--primary-color)' : 'var(--border-color)'}`,
                          background: active ? 'rgba(28, 153, 255, 0.12)' : 'var(--subtle-bg)',
                          color: 'var(--text-color)',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <Icon size={14} color={active ? 'var(--primary-color)' : 'var(--text-secondary)'} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {/* Form Inputs based on Payload Type */}
                <div style={{ marginTop: '1rem', minWidth: 0 }}>
                  {qrType === 'url' && (
                    <div style={{ minWidth: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                        Website URL:
                      </label>
                      <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://example.com"
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.88rem' }}
                      />
                    </div>
                  )}

                  {qrType === 'text' && (
                    <div style={{ minWidth: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                        Message / Plain Text:
                      </label>
                      <textarea
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        placeholder="Enter your message or memo..."
                        rows={3}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.88rem', resize: 'vertical' }}
                      />
                    </div>
                  )}

                  {qrType === 'wifi' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', minWidth: 0 }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                          Network SSID:
                        </label>
                        <input
                          type="text"
                          value={wifiData.ssid}
                          onChange={(e) => setWifiData({ ...wifiData, ssid: e.target.value })}
                          placeholder="Home-WiFi"
                          style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.86rem' }}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '0.65rem' }}>
                        <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                            Password:
                          </label>
                          <input
                            type="password"
                            value={wifiData.password}
                            onChange={(e) => setWifiData({ ...wifiData, password: e.target.value })}
                            placeholder="SecretPassword"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.86rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                            Security:
                          </label>
                          <select
                            value={wifiData.encryption}
                            onChange={(e) => setWifiData({ ...wifiData, encryption: e.target.value })}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.86rem' }}
                          >
                            <option value="WPA">WPA / WPA2</option>
                            <option value="WEP">WEP</option>
                            <option value="nopass">None (Open)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {qrType === 'vcard' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', minWidth: 0 }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                          First Name:
                        </label>
                        <input
                          type="text"
                          value={vcardData.firstName}
                          onChange={(e) => setVcardData({ ...vcardData, firstName: e.target.value })}
                          placeholder="John"
                          style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.84rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                          Last Name:
                        </label>
                        <input
                          type="text"
                          value={vcardData.lastName}
                          onChange={(e) => setVcardData({ ...vcardData, lastName: e.target.value })}
                          placeholder="Doe"
                          style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.84rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                          Phone Number:
                        </label>
                        <input
                          type="tel"
                          value={vcardData.phone}
                          onChange={(e) => setVcardData({ ...vcardData, phone: e.target.value })}
                          placeholder="+1 555-0199"
                          style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.84rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                          Email:
                        </label>
                        <input
                          type="email"
                          value={vcardData.email}
                          onChange={(e) => setVcardData({ ...vcardData, email: e.target.value })}
                          placeholder="john@example.com"
                          style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.84rem' }}
                        />
                      </div>
                    </div>
                  )}

                  {qrType === 'email' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', minWidth: 0 }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                          Recipient Email:
                        </label>
                        <input
                          type="email"
                          value={emailData.address}
                          onChange={(e) => setEmailData({ ...emailData, address: e.target.value })}
                          placeholder="hello@domain.com"
                          style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.86rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                          Subject Line:
                        </label>
                        <input
                          type="text"
                          value={emailData.subject}
                          onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                          placeholder="Project Inquiry"
                          style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.86rem' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Visual Styling Card */}
              <div
                className="workspace-card"
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '14px',
                  padding: '1.25rem',
                  boxSizing: 'border-box',
                  minWidth: 0,
                  flexShrink: 0,
                }}
              >
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.85rem' }}>
                  2. Color &amp; Logo Customization:
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                      Foreground Color:
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="color"
                        value={fgColor}
                        onChange={(e) => setFgColor(e.target.value)}
                        style={{ width: '34px', height: '34px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'none' }}
                      />
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-color)', fontFamily: 'monospace' }}>{fgColor}</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                      Background Color:
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="color"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        style={{ width: '34px', height: '34px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'none' }}
                      />
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-color)', fontFamily: 'monospace' }}>{bgColor}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                      Error Correction:
                    </label>
                    <select
                      value={errorCorrection}
                      onChange={(e) => setErrorCorrection(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.82rem' }}
                    >
                      <option value="L">Low (7%)</option>
                      <option value="M">Medium (15%)</option>
                      <option value="Q">Quartile (25%)</option>
                      <option value="H">High (30% / Logo)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                      QR Size: {qrSize}px
                    </label>
                    <input
                      type="range"
                      min={240}
                      max={600}
                      step={20}
                      value={qrSize}
                      onChange={(e) => setQrSize(Number(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--primary-color)' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '0.85rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                    Quiet Zone Margin: {qrMargin} blocks
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={6}
                    step={1}
                    value={qrMargin}
                    onChange={(e) => setQrMargin(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--primary-color)' }}
                  />
                </div>

                {/* Center Logo Upload */}
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                    Center Brand Logo (Optional):
                  </label>
                  {logoUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.65rem', background: 'var(--subtle-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <img src={logoUrl} alt="Logo" style={{ width: '24px', height: '24px', objectFit: 'contain', borderRadius: '4px' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-color)', fontWeight: 600 }}>{logoFile?.name || 'logo.png'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        style={{ background: 'none', border: 'none', color: '#ff4757', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e.target.files)}
                      style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                    />
                  )}
                </div>
              </div>
            </div>
            }
            rightPane={
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  minWidth: 0,
                  padding: '0.25rem',
                  boxSizing: 'border-box',
                  overflowY: 'auto',
                }}
              >
              <div
                className="workspace-card"
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '14px',
                  padding: '1.25rem',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ fontWeight: 800, fontSize: '0.96rem', color: 'var(--text-color)', display: 'block', marginBottom: '1rem' }}>
                  Live QR Preview
                </span>

                {/* QR Display Frame */}
                <div
                  style={{
                    display: 'inline-flex',
                    padding: '0.85rem',
                    background: '#ffffff',
                    borderRadius: '12px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                    marginBottom: '1.25rem',
                  }}
                >
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR Code" style={{ width: '240px', height: '240px', display: 'block' }} />
                  ) : (
                    <div style={{ width: '240px', height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                      Enter content to preview
                    </div>
                  )}
                </div>

                {/* Export Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: '300px' }}>
                  <button
                    type="button"
                    onClick={handleExportPng}
                    disabled={!qrDataUrl}
                    className="btn-primary"
                    style={{
                      padding: '0.65rem 1.25rem',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                    }}
                  >
                    <FiDownload size={15} /> Download High-Res PNG
                  </button>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={handleExportSvg}
                      disabled={!qrSvgString}
                      className="btn-secondary"
                      style={{
                        padding: '0.5rem',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <FiDownload size={13} /> Vector SVG
                    </button>

                    <button
                      type="button"
                      onClick={handleExportPdf}
                      disabled={!qrDataUrl}
                      className="btn-secondary"
                      style={{
                        padding: '0.5rem',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <FiDownload size={13} /> PDF Sheet
                    </button>
                  </div>
                </div>
              </div>
            </div>
            }
          />
        )}

        {/* TAB 2: SCANNER */}
        {activeTab === 'scan' && (
          <div
            style={{
              maxWidth: '800px',
              margin: '0 auto',
              height: '100%',
              overflowY: 'auto',
              padding: '0.5rem',
              boxSizing: 'border-box',
            }}
          >
            <div
              className="workspace-card"
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '1.25rem',
              }}
            >
              {/* Scanner Mode Toggle */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setScannerMode('camera');
                    startCamera();
                  }}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: scannerMode === 'camera' ? 'var(--primary-color)' : 'var(--subtle-bg)',
                    color: scannerMode === 'camera' ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <FiCamera size={14} /> Device Camera
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScannerMode('file');
                    stopCamera();
                  }}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: scannerMode === 'file' ? 'var(--primary-color)' : 'var(--subtle-bg)',
                    color: scannerMode === 'file' ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <FiImage size={14} /> Upload Image / PDF
                </button>
              </div>

              {/* Sub-mode: Live Camera */}
              {scannerMode === 'camera' && (
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      maxWidth: '440px',
                      height: '300px',
                      margin: '0 auto',
                      background: '#000',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

                    {/* Targeting Reticle Frame */}
                    {isCameraActive && (
                      <div
                        style={{
                          position: 'absolute',
                          width: '200px',
                          height: '200px',
                          border: '3px solid #00f2fe',
                          borderRadius: '12px',
                          boxShadow: '0 0 25px rgba(0,242,254,0.4)',
                          pointerEvents: 'none',
                        }}
                      />
                    )}

                    {!isCameraActive && (
                      <div style={{ color: '#fff', textAlign: 'center', padding: '1rem' }}>
                        <FiCamera size={34} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                        <p style={{ margin: 0, fontSize: '0.85rem' }}>Camera is idle</p>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: '0.85rem' }}>
                    {!isCameraActive ? (
                      <button
                        type="button"
                        onClick={startCamera}
                        className="btn-primary"
                        style={{ padding: '0.55rem 1.4rem', borderRadius: '30px', fontWeight: 700, fontSize: '0.86rem' }}
                      >
                        Start Live Scanner
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="btn-secondary"
                        style={{ padding: '0.55rem 1.4rem', borderRadius: '30px', fontWeight: 700, fontSize: '0.86rem' }}
                      >
                        Stop Camera
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-mode: Upload File / PDF */}
              {scannerMode === 'file' && (
                <div>
                  <FileUpload
                    onFilesSelected={handleScanFile}
                    accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.svg'], 'application/pdf': ['.pdf'] }}
                    multiple={false}
                    title="Upload Image or PDF containing QR Code"
                    description="Auto-decodes QR codes from any photo, screenshot, or PDF document page"
                  />
                </div>
              )}

              {/* Scanned Result Banner */}
              {scannedResult && (
                <div
                  style={{
                    marginTop: '1.25rem',
                    padding: '1rem',
                    background: 'rgba(46, 213, 115, 0.08)',
                    borderRadius: '10px',
                    border: '1px solid rgba(46, 213, 115, 0.3)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        color: 'var(--secondary-color, #2ed573)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <FiCheck size={15} /> QR Code Decoded Successfully
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyScanned}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary-color)',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      {copied ? <FiCheck size={12} /> : <FiCopy size={12} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>

                  <div
                    style={{
                      background: 'var(--card-bg)',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      wordBreak: 'break-all',
                      fontSize: '0.88rem',
                      color: 'var(--text-color)',
                      fontFamily: 'monospace',
                      marginBottom: '0.6rem',
                    }}
                  >
                    {scannedResult}
                  </div>

                  {scannedResult.startsWith('http') && (
                    <a
                      href={scannedResult}
                      target="_blank"
                      rel="noreferrer noopener"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        color: 'var(--primary-color)',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      <FiExternalLink size={13} /> Open Link in New Tab
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
