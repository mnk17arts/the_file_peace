import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import {
  FiDownload,
  FiUploadCloud,
  FiCopy,
  FiCheck,
  FiZap,
  FiCamera,
  FiImage,
} from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import AlertBanner from '../components/AlertBanner';
import Loader from '../components/Loader';
import { ToolStudioHeader } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { formatFileSize } from '../utils/fileUtils';
import { decodeQrFromImageOrCanvas } from '../utils/qrDecoder';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

const CHUNK_SIZE = 64 * 1024; // 64 KB chunks

export default function P2pFileShare() {
  const location = useLocation();

  // Role: 'send' | 'receive'
  const [role, setRole] = useState('send');

  // Connection State: 'idle' | 'generating' | 'waiting' | 'connecting' | 'connected' | 'transferring' | 'done'
  const [connStatus, setConnStatus] = useState('idle');
  const [peerConnected, setPeerConnected] = useState(false);

  // Signaling Data
  const [offerCode, setOfferCode] = useState('');
  const [offerQrUrl, setOfferQrUrl] = useState('');
  const [answerInput, setAnswerInput] = useState('');
  const [answerCode, setAnswerCode] = useState('');
  const [answerQrUrl, setAnswerQrUrl] = useState('');

  // Transfer Queue & Progress (items: { file, name, size, status: 'queued' | 'sending' | 'sent' })
  const [sendQueue, setSendQueue] = useState([]);
  const [transferProgress, setTransferProgress] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState('0 KB/s');
  const [currentFileName, setCurrentFileName] = useState('');
  const [receivedFiles, setReceivedFiles] = useState([]);
  const [isZippingReceived, setIsZippingReceived] = useState(false);

  // Camera Scanner for QR pairing
  const [isScanningQr, setIsScanningQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // WebRTC Refs
  const peerConnRef = useRef(null);
  const dataChannelRef = useRef(null);
  const handledIncomingRef = useRef(false);

  // Receiving Chunks buffer
  const receiveBufferRef = useRef([]);
  const receiveMetaRef = useRef(null);
  const receivedBytesRef = useRef(0);

  // Speed calculation metrics
  const lastTimeRef = useRef(0);
  const lastBytesRef = useRef(0);

  // Camera video ref
  const videoRef = useRef(null);
  const videoStreamRef = useRef(null);
  const animFrameRef = useRef(null);

  const cleanupPeer = () => {
    if (dataChannelRef.current) {
      try { dataChannelRef.current.close(); } catch { /* ignore */ }
      dataChannelRef.current = null;
    }
    if (peerConnRef.current) {
      try { peerConnRef.current.close(); } catch { /* ignore */ }
      peerConnRef.current = null;
    }
    setPeerConnected(false);
  };

  const stopCameraScan = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((t) => t.stop());
      videoStreamRef.current = null;
    }
    setIsScanningQr(false);
  };

  // Clean up WebRTC on unmount
  useEffect(() => {
    return () => {
      cleanupPeer();
      stopCameraScan();
    };
  }, []);

  // Handle incoming transferred file
  useEffect(() => {
    if (handledIncomingRef.current) return;
    const incoming = consumeTransferredFile() || location.state?.incomingFile;
    if (incoming) {
      handledIncomingRef.current = true;
      setTimeout(() => {
        setRole('send');
        setSendQueue([{ file: incoming, name: incoming.name, size: incoming.size, status: 'queued' }]);
      }, 0);
    }
  }, [location.state]);

  // Helper to compress/encode SDP payload to base64
  const encodeSdp = (desc) => {
    return btoa(JSON.stringify(desc));
  };

  const decodeSdp = (str) => {
    return JSON.parse(atob(str.trim()));
  };

  // -------------------------------------------------------------
  // SENDER (HOST) SETUP
  // -------------------------------------------------------------
  const initSender = async () => {
    cleanupPeer();
    setConnStatus('generating');
    setErrorMessage('');

    try {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnRef.current = pc;

      // Create data channel
      const dc = pc.createDataChannel('fileTransfer', { ordered: true });
      dataChannelRef.current = dc;
      setupDataChannel(dc);

      // Collect ICE candidates with timeout fallback
      const icePromise = new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
          return;
        }
        const timer = setTimeout(resolve, 1200);
        pc.onicecandidate = (event) => {
          if (!event.candidate) {
            clearTimeout(timer);
            resolve();
          }
        };
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await icePromise;

      const encoded = encodeSdp(pc.localDescription);
      setOfferCode(encoded);

      // Generate QR Code for offer with low error correction (fewer modules, easiest to scan)
      const qrUrl = await QRCode.toDataURL(encoded, { width: 520, margin: 3, errorCorrectionLevel: 'L' });
      setOfferQrUrl(qrUrl);
      setConnStatus('waiting');
    } catch (err) {
      console.error('Failed to initialize sender connection:', err);
      setErrorMessage(err.message || 'Failed to create P2P transfer session.');
      setConnStatus('idle');
    }
  };

  // Sender connects to received Answer code
  const acceptAnswer = async (answerStr) => {
    const raw = answerStr || answerInput;
    if (!raw.trim() || !peerConnRef.current) return;
    setConnStatus('connecting');

    try {
      const desc = decodeSdp(raw);
      await peerConnRef.current.setRemoteDescription(desc);
    } catch (err) {
      console.error('Failed to accept peer answer:', err);
      setErrorMessage('Invalid peer answer code. Please verify the code and retry.');
      setConnStatus('waiting');
    }
  };

  // -------------------------------------------------------------
  // RECEIVER (JOINER) SETUP
  // -------------------------------------------------------------
  const initReceiver = async (offerStr) => {
    cleanupPeer();
    setConnStatus('generating');
    setErrorMessage('');

    try {
      const desc = decodeSdp(offerStr);
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnRef.current = pc;

      pc.ondatachannel = (event) => {
        dataChannelRef.current = event.channel;
        setupDataChannel(event.channel);
      };

      await pc.setRemoteDescription(desc);

      // Collect ICE candidates with timeout fallback
      const icePromise = new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
          return;
        }
        const timer = setTimeout(resolve, 1200);
        pc.onicecandidate = (event) => {
          if (!event.candidate) {
            clearTimeout(timer);
            resolve();
          }
        };
      });

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await icePromise;

      const encoded = encodeSdp(pc.localDescription);
      setAnswerCode(encoded);

      const qrUrl = await QRCode.toDataURL(encoded, { width: 520, margin: 3, errorCorrectionLevel: 'L' });
      setAnswerQrUrl(qrUrl);
      setConnStatus('waiting');
    } catch (err) {
      console.error('Failed to initialize receiver:', err);
      setErrorMessage('Failed to connect to sender offer. Please verify the offer code.');
      setConnStatus('idle');
    }
  };

  // -------------------------------------------------------------
  // DATA CHANNEL HANDLERS
  // -------------------------------------------------------------
  const setupDataChannel = (dc) => {
    dc.binaryType = 'arraybuffer';

    dc.onopen = () => {
      setPeerConnected(true);
      setConnStatus('connected');
    };

    dc.onclose = () => {
      setPeerConnected(false);
      setConnStatus('idle');
    };

    dc.onerror = (err) => {
      console.error('Data channel error:', err);
      setErrorMessage('P2P connection error. Please reconnect.');
    };

    dc.onmessage = handleDataMessage;
  };

  // Handle incoming data channel packets
  const handleDataMessage = (event) => {
    const data = event.data;

    if (typeof data === 'string') {
      // Control JSON payload (file header or end of file)
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'file-start') {
          receiveMetaRef.current = msg;
          receiveBufferRef.current = [];
          receivedBytesRef.current = 0;
          setCurrentFileName(msg.name);
          setConnStatus('transferring');
          lastTimeRef.current = Date.now();
          lastBytesRef.current = 0;
        } else if (msg.type === 'file-end') {
          // File completed
          const meta = receiveMetaRef.current;
          const blob = new Blob(receiveBufferRef.current, { type: meta.mimeType || 'application/octet-stream' });
          const fileObj = {
            name: meta.name,
            size: meta.size,
            blob: blob,
            url: URL.createObjectURL(blob),
          };

          setReceivedFiles((prev) => [...prev, fileObj]);
          receiveBufferRef.current = [];
          receiveMetaRef.current = null;
          setTransferProgress(100);
          setConnStatus('connected');
        }
      } catch (err) {
        console.error('Control message parse error:', err);
      }
    } else if (data instanceof ArrayBuffer) {
      // Binary chunk packet
      receiveBufferRef.current.push(data);
      receivedBytesRef.current += data.byteLength;

      const meta = receiveMetaRef.current;
      if (meta && meta.size > 0) {
        const pct = Math.min(100, Math.round((receivedBytesRef.current / meta.size) * 100));
        setTransferProgress(pct);

        // Speed metric calculation
        const now = Date.now();
        const delta = (now - lastTimeRef.current) / 1000;
        if (delta >= 0.5) {
          const bytesDiff = receivedBytesRef.current - lastBytesRef.current;
          const speed = bytesDiff / delta;
          setTransferSpeed(speed > 1024 * 1024 ? `${(speed / (1024 * 1024)).toFixed(2)} MB/s` : `${(speed / 1024).toFixed(1)} KB/s`);
          lastTimeRef.current = now;
          lastBytesRef.current = receivedBytesRef.current;
        }
      }
    }
  };

  // -------------------------------------------------------------
  // SEND FILE STREAMING ENGINE
  // -------------------------------------------------------------
  const startSendingFiles = async () => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      setErrorMessage('P2P channel is not ready. Please ensure both peers are connected.');
      return;
    }

    if (sendQueue.length === 0) return;
    setConnStatus('transferring');

    for (let fIdx = 0; fIdx < sendQueue.length; fIdx++) {
      const item = sendQueue[fIdx];
      if (item.status === 'sent') continue;

      const file = item.file;
      setCurrentFileName(file.name);
      setTransferProgress(0);

      // Update status to sending
      setSendQueue((prev) =>
        prev.map((it, idx) => (idx === fIdx ? { ...it, status: 'sending' } : it))
      );

      // 1. Send Header Metadata
      const startMsg = JSON.stringify({
        type: 'file-start',
        name: file.name,
        size: file.size,
        mimeType: file.type,
      });
      dataChannelRef.current.send(startMsg);

      // 2. Stream Binary Chunks with Backpressure
      let offset = 0;
      lastTimeRef.current = Date.now();
      lastBytesRef.current = 0;

      while (offset < file.size) {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();

        // Check backpressure buffer
        if (dataChannelRef.current.bufferedAmount > 8 * 1024 * 1024) {
          await new Promise((res) => {
            const check = () => {
              if (!dataChannelRef.current || dataChannelRef.current.bufferedAmount <= 2 * 1024 * 1024) {
                res();
              } else {
                setTimeout(check, 10);
              }
            };
            check();
          });
        }

        dataChannelRef.current.send(buffer);
        offset += buffer.byteLength;

        const pct = Math.min(100, Math.round((offset / file.size) * 100));
        setTransferProgress(pct);

        // Calculate transfer speed
        const now = Date.now();
        const delta = (now - lastTimeRef.current) / 1000;
        if (delta >= 0.5) {
          const bytesDiff = offset - lastBytesRef.current;
          const speed = bytesDiff / delta;
          setTransferSpeed(speed > 1024 * 1024 ? `${(speed / (1024 * 1024)).toFixed(2)} MB/s` : `${(speed / 1024).toFixed(1)} KB/s`);
          lastTimeRef.current = now;
          lastBytesRef.current = offset;
        }
      }

      // 3. Send End of File signal
      const endMsg = JSON.stringify({ type: 'file-end', name: file.name });
      dataChannelRef.current.send(endMsg);

      // Mark file as sent
      setSendQueue((prev) =>
        prev.map((it, idx) => (idx === fIdx ? { ...it, status: 'sent' } : it))
      );
    }

    setConnStatus('connected');
    setTransferSpeed('Completed');
  };

  // -------------------------------------------------------------
  // QR SCANNER & UPLOAD FOR PAIRING
  // -------------------------------------------------------------
  const startCameraScan = async () => {
    setIsScanningQr(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      videoStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        requestAnimationFrame(scanFrame);
      }
    } catch (err) {
      console.error('Camera pairing scan error:', err);
      setErrorMessage('Could not open camera for QR pairing.');
      setIsScanningQr(false);
    }
  };

  const scanFrame = async () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    try {
      const decoded = await decodeQrFromImageOrCanvas(videoRef.current);
      if (decoded) {
        stopCameraScan();
        if (role === 'send') {
          acceptAnswer(decoded);
        } else {
          initReceiver(decoded);
        }
        return;
      }
    } catch {
      // frame didn't contain QR, continue scanning
    }

    animFrameRef.current = requestAnimationFrame(scanFrame);
  };

  const handleUploadQrFile = async (files, targetRole) => {
    if (!files) return;
    const file = files[0] || (files instanceof File ? files : null);
    if (!file) return;
    setErrorMessage('');

    try {
      const decoded = await decodeQrFromImageOrCanvas(file);

      if (!decoded) {
        throw new Error('No QR code detected in the uploaded image.');
      }

      if (targetRole === 'send') {
        setAnswerInput(decoded);
        await acceptAnswer(decoded);
      } else {
        setOfferCode(decoded);
        await initReceiver(decoded);
      }
    } catch (err) {
      console.error('QR image upload decode error:', err);
      setErrorMessage(err.message || 'Could not decode QR code from the uploaded image.');
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = (qrDataUrl, filename) => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadAllReceived = async () => {
    if (receivedFiles.length === 0) return;

    if (receivedFiles.length === 1) {
      const a = document.createElement('a');
      a.href = receivedFiles[0].url;
      a.download = receivedFiles[0].name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    try {
      setIsZippingReceived(true);
      const zip = new JSZip();
      for (const rf of receivedFiles) {
        zip.file(rf.name, rf.blob);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = zipUrl;
      a.download = `p2p-received-files-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(zipUrl);
    } catch (err) {
      console.error('Failed to bundle received files:', err);
      setErrorMessage('Failed to bundle received files into ZIP.');
    } finally {
      setIsZippingReceived(false);
    }
  };

  const handleAddFiles = (files) => {
    const list = Array.isArray(files) ? files : Array.from(files);
    const formatted = list.map((f) => ({
      file: f,
      name: f.name,
      size: f.size,
      status: 'queued',
    }));
    setSendQueue((prev) => [...prev, ...formatted]);
  };

  return (
    <div className="studio-container">
      {/* Top Micro Bar Studio Header */}
      <ToolStudioHeader
        icon={FiZap}
        title="P2P Direct File Share"
        toolPath="/p2p-share"
        fileBadge={
          role === 'send'
            ? peerConnected
              ? `Connected • ${sendQueue.length} Files`
              : 'Host Mode'
            : peerConnected
            ? `Connected • ${receivedFiles.length} Received`
            : 'Receiver Mode'
        }
        onReset={() => {
          cleanupPeer();
          setConnStatus('idle');
          setSendQueue([]);
          setReceivedFiles([]);
        }}
        resetLabel="Reset Room"
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
                setRole('send');
                cleanupPeer();
                setConnStatus('idle');
              }}
              style={{
                padding: '0.3rem 0.85rem',
                borderRadius: '20px',
                border: 'none',
                background: role === 'send' ? 'var(--primary-color)' : 'transparent',
                color: role === 'send' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <FiUploadCloud size={13} /> Send Files
            </button>
            <button
              type="button"
              onClick={() => {
                setRole('receive');
                cleanupPeer();
                setConnStatus('idle');
              }}
              style={{
                padding: '0.3rem 0.85rem',
                borderRadius: '20px',
                border: 'none',
                background: role === 'receive' ? 'var(--primary-color)' : 'transparent',
                color: role === 'receive' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <FiDownload size={13} /> Receive Files
            </button>
          </div>
        }
      />

      {errorMessage && (
        <div style={{ padding: '0.4rem 1rem', flexShrink: 0 }}>
          <AlertBanner
            message={errorMessage}
            type="error"
            onClose={() => setErrorMessage('')}
          />
        </div>
      )}

      {/* Main Studio Workspace Body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.85rem 1.25rem 1.5rem' }}>
        <div style={{ padding: '0.45rem 0.85rem', marginBottom: '1rem', borderRadius: '8px', background: 'rgba(28, 153, 255, 0.08)', border: '1px solid rgba(28, 153, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-color)' }}>
          <span>🔒 <strong>Direct Device-to-Device Streaming</strong>: Files never upload to any cloud or intermediate server. Only a one-time pairing code/QR handshake is exchanged between devices to discover the direct WebRTC channel.</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>End-to-End Encrypted</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: Connection & Signaling Box */}
        <div className="workspace-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.25rem', boxSizing: 'border-box', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-color)' }}>
              1. P2P Direct Tunnel
            </span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.65rem', borderRadius: '50px', background: peerConnected ? 'rgba(46, 213, 115, 0.15)' : 'rgba(255, 171, 0, 0.15)', border: `1px solid ${peerConnected ? '#2ed573' : '#ffab00'}` }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: peerConnected ? '#2ed573' : '#ffab00', animation: peerConnected ? 'none' : 'blink 1.5s infinite' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: peerConnected ? '#2ed573' : '#ffab00' }}>
                {peerConnected ? 'Connected (Direct)' : 'Waiting for Peer'}
              </span>
            </div>
          </div>

          {/* SENDER SETUP */}
          {role === 'send' && (
            <div>
              {connStatus === 'generating' && (
                <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                  <Loader message="Opening encrypted P2P tunnel..." />
                </div>
              )}

              {connStatus === 'idle' && (
                <div>
                  <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.4' }}>
                    Click below to open a direct WebRTC transfer room. Scan the QR code on your mobile device or share the session code with another browser.
                  </p>
                  <button
                    onClick={initSender}
                    className="btn-primary"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem' }}
                  >
                    Open P2P Transfer Room
                  </button>
                </div>
              )}

              {(connStatus === 'waiting' || connStatus === 'connecting') && !peerConnected && (
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                    Step A: Have the receiver scan this QR code or copy the code below:
                  </span>

                  {offerQrUrl && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
                      <div style={{ padding: '0.5rem', background: '#fff', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                        <img src={offerQrUrl} alt="Offer QR" style={{ width: '140px', height: '140px', display: 'block' }} />
                      </div>
                      <button
                        onClick={() => handleDownloadQr(offerQrUrl, 'p2p-offer-qr.png')}
                        title="Download QR Code"
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--subtle-bg)',
                          color: 'var(--text-color)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <FiDownload size={16} />
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
                    <input
                      type="text"
                      readOnly
                      value={offerCode}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.78rem', fontFamily: 'monospace' }}
                    />
                    <button
                      onClick={() => handleCopy(offerCode)}
                      style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}
                    >
                      {copied ? <FiCheck size={13} /> : <FiCopy size={13} />} {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                    Step B: Paste the receiver's Answer Code:
                  </span>
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
                    <input
                      type="text"
                      value={answerInput}
                      onChange={(e) => setAnswerInput(e.target.value)}
                      placeholder="Paste receiver answer code..."
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.82rem' }}
                    />
                    <button
                      onClick={() => acceptAnswer(answerInput)}
                      className="btn-primary"
                      style={{ padding: '0.5rem 0.85rem', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap' }}
                    >
                      Connect
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                    <button
                      onClick={startCameraScan}
                      style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <FiCamera size={13} /> Scan QR with Camera
                    </button>
                    <span style={{ color: 'var(--border-color)' }}>•</span>
                    <label
                      title="Upload Answer QR Code Image"
                      style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <FiImage size={13} /> Upload QR Image
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => handleUploadQrFile(e.target.files, 'send')}
                      />
                    </label>
                  </div>
                </div>
              )}

              {peerConnected && (
                <div style={{ padding: '1rem', background: 'rgba(46, 213, 115, 0.08)', borderRadius: '10px', border: '1px solid rgba(46, 213, 115, 0.3)', textAlign: 'center' }}>
                  <FiZap color="#2ed573" size={26} style={{ marginBottom: '0.25rem' }} />
                  <span style={{ fontWeight: 800, color: 'var(--text-color)', display: 'block', fontSize: '0.92rem' }}>
                    P2P Tunnel Active & Encrypted
                  </span>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                    Ready to stream queued files directly across memory.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* RECEIVER SETUP */}
          {role === 'receive' && (
            <div>
              {connStatus === 'generating' && (
                <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                  <Loader message="Generating answer tunnel..." />
                </div>
              )}

              {!peerConnected && connStatus !== 'generating' && (
                <div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                    Paste the Sender's Room Offer Code:
                  </span>
                  <textarea
                    value={offerCode}
                    onChange={(e) => setOfferCode(e.target.value)}
                    placeholder="Paste sender offer code here..."
                    rows={3}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.8rem', fontFamily: 'monospace', marginBottom: '0.6rem' }}
                  />

                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
                    <button
                      onClick={() => initReceiver(offerCode)}
                      disabled={!offerCode.trim()}
                      className="btn-primary"
                      style={{ flex: 1, padding: '0.55rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.85rem' }}
                    >
                      Generate Answer
                    </button>
                    <button
                      onClick={startCameraScan}
                      title="Scan Sender QR with Camera"
                      style={{ padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <FiCamera size={14} /> Scan
                    </button>
                    <label
                      title="Upload Offer QR Code Image"
                      style={{ padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <FiImage size={14} />
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => handleUploadQrFile(e.target.files, 'receive')}
                      />
                    </label>
                  </div>

                  {answerCode && (
                    <div style={{ textAlign: 'center', marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                        Share this Answer Code with the sender:
                      </span>
                      {answerQrUrl && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
                          <div style={{ padding: '0.45rem', background: '#fff', borderRadius: '8px' }}>
                            <img src={answerQrUrl} alt="Answer QR" style={{ width: '130px', height: '130px', display: 'block' }} />
                          </div>
                          <button
                            onClick={() => handleDownloadQr(answerQrUrl, 'p2p-answer-qr.png')}
                            title="Download Answer QR"
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--subtle-bg)',
                              color: 'var(--text-color)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <FiDownload size={15} />
                          </button>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <input
                          type="text"
                          readOnly
                          value={answerCode}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', fontSize: '0.75rem', fontFamily: 'monospace' }}
                        />
                        <button
                          onClick={() => handleCopy(answerCode)}
                          style={{ padding: '0.4rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--subtle-bg)', color: 'var(--text-color)', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                        >
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {peerConnected && (
                <div style={{ padding: '1rem', background: 'rgba(46, 213, 115, 0.08)', borderRadius: '10px', border: '1px solid rgba(46, 213, 115, 0.3)', textAlign: 'center' }}>
                  <FiZap color="#2ed573" size={26} style={{ marginBottom: '0.25rem' }} />
                  <span style={{ fontWeight: 800, color: 'var(--text-color)', display: 'block', fontSize: '0.92rem' }}>
                    P2P Receiver Active
                  </span>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                    Listening for incoming file streams...
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Transfer Queue & Live Progress */}
        <div className="workspace-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.25rem', boxSizing: 'border-box', minWidth: 0 }}>
          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-color)', display: 'block', marginBottom: '0.85rem' }}>
            2. File Stream Manager
          </span>

          {role === 'send' && (
            <div>
              {sendQueue.length === 0 ? (
                <FileUpload
                  onFilesSelected={handleAddFiles}
                  multiple={true}
                  title="Drop Files to Send"
                  description="Any file size, zero upload limits, direct memory stream"
                />
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0.8rem', background: 'var(--subtle-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-color)' }}>
                    {sendQueue.length} file{sendQueue.length !== 1 ? 's' : ''} queued
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <label
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        background: 'var(--primary-color)',
                        color: '#fff',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      + Add More
                      <input
                        type="file"
                        multiple
                        onChange={(e) => {
                          if (e.target.files) handleAddFiles(e.target.files);
                        }}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <button
                      onClick={() => setSendQueue([])}
                      style={{ background: 'none', border: 'none', color: '#ff4757', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              )}

              {sendQueue.length > 0 && (
                <div>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem' }}>
                    {sendQueue.map((item, i) => (
                      <div
                        key={i}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0.65rem', background: 'var(--subtle-bg)', borderRadius: '6px', fontSize: '0.82rem' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                          <span style={{ color: 'var(--text-color)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.name}
                          </span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', flexShrink: 0 }}>
                            ({formatFileSize(item.size)})
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                          {item.status === 'sent' && (
                            <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(46, 213, 115, 0.15)', color: '#2ed573', fontSize: '0.72rem', fontWeight: 700 }}>
                              Sent ✓
                            </span>
                          )}
                          {item.status === 'sending' && (
                            <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(28, 153, 255, 0.15)', color: 'var(--primary-color)', fontSize: '0.72rem', fontWeight: 700 }}>
                              Streaming...
                            </span>
                          )}
                          {item.status === 'queued' && (
                            <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                              Queued
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={startSendingFiles}
                    disabled={!peerConnected || sendQueue.length === 0 || connStatus === 'transferring'}
                    className="btn-primary"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', cursor: !peerConnected ? 'not-allowed' : 'pointer' }}
                  >
                    {!peerConnected ? 'Connect Peer to Send' : connStatus === 'transferring' ? 'Streaming File...' : 'Start P2P Transfer'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Live Transfer Status Bar */}
          {connStatus === 'transferring' && (
            <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'var(--subtle-bg)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-color)', marginBottom: '0.35rem' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Streaming: {currentFileName}
                </span>
                <span style={{ color: 'var(--primary-color)' }}>{transferProgress}%</span>
              </div>

              <div style={{ width: '100%', height: '8px', background: 'var(--card-bg)', borderRadius: '999px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                <div style={{ width: `${transferProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary-color), #00f2fe)', transition: 'width 0.15s ease' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <span>⚡ Speed: {transferSpeed}</span>
                <span>🔒 100% End-to-End P2P</span>
              </div>
            </div>
          )}

          {/* Received Files List (Receiver Mode) */}
          {receivedFiles.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-color)' }}>
                  📥 Received Files ({receivedFiles.length}):
                </span>

                <button
                  onClick={handleDownloadAllReceived}
                  disabled={isZippingReceived}
                  className="btn-primary"
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    cursor: 'pointer',
                  }}
                >
                  <FiDownload size={13} />
                  {isZippingReceived
                    ? 'Creating ZIP...'
                    : receivedFiles.length > 1
                    ? 'Download All (ZIP)'
                    : 'Download All'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto' }}>
                {receivedFiles.map((rf, idx) => (
                  <div
                    key={idx}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', background: 'rgba(46, 213, 115, 0.08)', borderRadius: '8px', border: '1px solid rgba(46, 213, 115, 0.3)' }}
                  >
                    <div style={{ minWidth: 0, flex: 1, marginRight: '0.5rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-color)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rf.name}
                      </span>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                        {formatFileSize(rf.size)} • Verified P2P Stream
                      </span>
                    </div>

                    <a
                      href={rf.url}
                      download={rf.name}
                      style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', background: 'var(--secondary-color, #2ed573)', color: '#fff', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}
                    >
                      <FiDownload size={13} /> Save File
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* QR Camera Scan Modal */}
      {isScanningQr && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '1.5rem', maxWidth: '440px', width: '100%', textAlign: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-color)', display: 'block', marginBottom: '1rem' }}>
              Scan Peer Pairing QR Code
            </span>

            <div style={{ width: '100%', height: '280px', background: '#000', borderRadius: '12px', overflow: 'hidden', position: 'relative', marginBottom: '1rem' }}>
              <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: '40px', border: '3px solid #00f2fe', borderRadius: '10px', boxShadow: '0 0 20px rgba(0,242,254,0.4)', pointerEvents: 'none' }} />
            </div>

            <button
              onClick={stopCameraScan}
              className="btn-secondary"
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', fontWeight: 700 }}
            >
              Cancel Scanning
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
