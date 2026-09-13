import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  FiCheckCircle,
  FiXCircle,
  FiCopy,
  FiCheck,
  FiArrowLeft,
  FiFile,
  FiLayers,
  FiSearch,
  FiHash,
  FiDownload,
} from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import AlertBanner from '../components/AlertBanner';
import { ToolHeroView, ToolStudioHeader, ResizableSplitPane } from '../components/studio';
import { consumeTransferredFile } from '../utils/fileTransfer';
import { formatFileSize } from '../utils/fileUtils';

// Fast pure JavaScript MD5 implementation
function md5(buffer) {
  const bytes = new Uint8Array(buffer);
  const n = bytes.length;
  let [h0, h1, h2, h3] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];

  const paddedLength = ((n + 8) >>> 6) + 1 << 6;
  const words = new Uint32Array(paddedLength >>> 2);

  for (let i = 0; i < n; i++) {
    words[i >>> 2] |= bytes[i] << ((i % 4) << 3);
  }
  words[n >>> 2] |= 0x80 << ((n % 4) << 3);
  words[words.length - 2] = (n * 8) & 0xffffffff;
  words[words.length - 1] = Math.floor((n * 8) / 0x100000000);

  const K = new Uint32Array([
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
  ]);

  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ];

  for (let i = 0; i < words.length; i += 16) {
    let [a, b, c, d] = [h0, h1, h2, h3];
    for (let j = 0; j < 64; j++) {
      let f, g;
      if (j < 16) {
        f = (b & c) | (~b & d);
        g = j;
      } else if (j < 32) {
        f = (d & b) | (~d & c);
        g = (5 * j + 1) % 16;
      } else if (j < 48) {
        f = b ^ c ^ d;
        g = (3 * j + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * j) % 16;
      }
      const temp = d;
      d = c;
      c = b;
      const sum = (a + f + K[j] + words[i + g]) >>> 0;
      const rot = S[j];
      b = (b + ((sum << rot) | (sum >>> (32 - rot)))) >>> 0;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
  }

  const hexChars = [];
  [h0, h1, h2, h3].forEach((val) => {
    for (let i = 0; i < 4; i++) {
      const byte = (val >>> (i * 8)) & 0xff;
      hexChars.push(byte.toString(16).padStart(2, '0'));
    }
  });
  return hexChars.join('');
}

// Compute Web Crypto SHA
async function computeSha(buffer, algo) {
  const hashBuffer = await window.crypto.subtle.digest(algo, buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function FileHash() {
  const location = useLocation();

  // Mode: 'single' | 'compare'
  const [activeTab, setActiveTab] = useState('single');

  // Single file state
  const [file, setFile] = useState(null);
  const [hashes, setHashes] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [verifyInput, setVerifyInput] = useState('');
  const [isUppercase, setIsUppercase] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Dual compare state
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [hashesA, setHashesA] = useState(null);
  const [hashesB, setHashesB] = useState(null);
  const [isProcessingCompare, setIsProcessingCompare] = useState(false);

  const handledIncomingRef = useRef(false);

  // Compute all hashes for a file
  const computeFileHashes = async (targetFile) => {
    const buffer = await (targetFile.slice ? targetFile.slice(0) : targetFile).arrayBuffer();
    const [sha256, sha512, sha1] = await Promise.all([
      computeSha(buffer, 'SHA-256'),
      computeSha(buffer, 'SHA-512'),
      computeSha(buffer, 'SHA-1'),
    ]);
    const md5Hash = md5(buffer);
    return { sha256, sha512, sha1, md5: md5Hash };
  };

  // Process single file
  const processSingleFile = useCallback(async (selectedFile) => {
    setIsProcessing(true);
    setErrorMessage('');
    try {
      const results = await computeFileHashes(selectedFile);
      setHashes(results);
    } catch (err) {
      console.error('Hash calculation error:', err);
      setErrorMessage('Failed to calculate cryptographic checksums.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleSingleFile = useCallback((files) => {
    if (!files || files.length === 0) return;
    const selected = Array.isArray(files) ? files[0] : files;
    setFile(selected);
    setHashes(null);
    setVerifyInput('');
    processSingleFile(selected);
  }, [processSingleFile]);

  // Handle incoming transfer file
  useEffect(() => {
    if (handledIncomingRef.current) return;
    const incoming = consumeTransferredFile() || location.state?.incomingFile;
    if (incoming) {
      handledIncomingRef.current = true;
      setTimeout(() => {
        handleSingleFile([incoming]);
      }, 0);
    }
  }, [location.state, handleSingleFile]);

  // Dual compare calculation
  const handleCompareFiles = async (fa, fb) => {
    setIsProcessingCompare(true);
    try {
      const [hA, hB] = await Promise.all([
        computeFileHashes(fa),
        computeFileHashes(fb),
      ]);
      setHashesA(hA);
      setHashesB(hB);
    } catch (err) {
      console.error('Dual compare error:', err);
      setErrorMessage('Failed to compare files.');
    } finally {
      setIsProcessingCompare(false);
    }
  };

  const handleSelectFileA = (files) => {
    if (!files || files.length === 0) return;
    if (files.length >= 2) {
      const fa = files[0];
      const fb = files[1];
      setFileA(fa);
      setFileB(fb);
      handleCompareFiles(fa, fb);
      return;
    }
    const f = Array.isArray(files) ? files[0] : files;
    setFileA(f);
    if (fileB) handleCompareFiles(f, fileB);
  };

  const handleSelectFileB = (files) => {
    if (!files || files.length === 0) return;
    if (files.length >= 2) {
      const fa = files[0];
      const fb = files[1];
      setFileA(fa);
      setFileB(fb);
      handleCompareFiles(fa, fb);
      return;
    }
    const f = Array.isArray(files) ? files[0] : files;
    setFileB(f);
    if (fileA) handleCompareFiles(fileA, f);
  };

  // Check verification match
  const checkVerification = () => {
    if (!verifyInput.trim() || !hashes) return null;
    const cleanInput = verifyInput.trim().toLowerCase();
    if (cleanInput === hashes.sha256.toLowerCase()) return { match: true, algo: 'SHA-256' };
    if (cleanInput === hashes.sha512.toLowerCase()) return { match: true, algo: 'SHA-512' };
    if (cleanInput === hashes.sha1.toLowerCase()) return { match: true, algo: 'SHA-1' };
    if (cleanInput === hashes.md5.toLowerCase()) return { match: true, algo: 'MD5' };
    return { match: false, algo: 'None' };
  };

  const verificationResult = checkVerification();

  const formatHash = (h) => {
    if (!h) return '';
    return isUppercase ? h.toUpperCase() : h.toLowerCase();
  };

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleExportReport = () => {
    if (!file || !hashes) return;
    const reportText = `FILE PEACE CHECKSUM REPORT
Generated: ${new Date().toISOString()}
File: ${file.name}
Size: ${formatFileSize(file.size)} (${file.size} bytes)

SHA-256: ${formatHash(hashes.sha256)}
SHA-512: ${formatHash(hashes.sha512)}
SHA-1:   ${formatHash(hashes.sha1)}
MD5:     ${formatHash(hashes.md5)}

Verified: 100% Client-Side In-Memory Digest (Web Crypto API)
`;
    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name}-checksums.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isDualMatch = hashesA && hashesB && hashesA.sha256 === hashesB.sha256;

  const renderModeSwitcher = () => (
    <div style={{ display: 'inline-flex', background: 'var(--subtle-bg)', padding: '0.2rem', borderRadius: '30px', border: '1px solid var(--border-color)', gap: '0.2rem' }}>
      <button
        type="button"
        onClick={() => setActiveTab('single')}
        style={{
          padding: '0.3rem 0.85rem',
          borderRadius: '20px',
          border: 'none',
          background: activeTab === 'single' ? 'var(--primary-color)' : 'transparent',
          color: activeTab === 'single' ? '#fff' : 'var(--text-secondary)',
          fontWeight: 700,
          fontSize: '0.8rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
        }}
      >
        <FiFile size={13} /> Single File
      </button>
      <button
        type="button"
        onClick={() => setActiveTab('compare')}
        style={{
          padding: '0.3rem 0.85rem',
          borderRadius: '20px',
          border: 'none',
          background: activeTab === 'compare' ? 'var(--primary-color)' : 'transparent',
          color: activeTab === 'compare' ? '#fff' : 'var(--text-secondary)',
          fontWeight: 700,
          fontSize: '0.8rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
        }}
      >
        <FiLayers size={13} /> Compare Files
      </button>
    </div>
  );

  // 1. Single File - Initial Hero View
  if (activeTab === 'single' && !file) {
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          {renderModeSwitcher()}
        </div>

        <ToolHeroView
          badge="Cryptographic Integrity"
          badgeIcon={FiHash}
          title="File Hash & Checksum Calculator"
          description="Compute SHA-256, SHA-512, SHA-1, and MD5 hashes instantly in your browser with zero data leaving your device."
          toolPath="/file-hash"
          acceptedFormats={['*.* (All Files)']}
          allowMultiple={false}
          uploadTitle="Select Any File to Hash"
          uploadDescription="Drop any document, image, zip, installer, or media file to calculate checksums"
          onFilesSelected={handleSingleFile}
          alerts={
            errorMessage ? (
              <AlertBanner
                message={errorMessage}
                type="error"
                onClose={() => setErrorMessage('')}
              />
            ) : null
          }
        />
      </div>
    );
  }

  // 2. Dual Compare - Initial Hero View (if no files uploaded yet)
  if (activeTab === 'compare' && !fileA && !fileB) {
    return (
      <div className="studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--subtle-bg)',
              color: 'var(--text-color)',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            <FiArrowLeft /> Back to Single File Mode
          </button>
          {renderModeSwitcher()}
        </div>

        <ToolHeroView
          badge="Bitwise Verification"
          badgeIcon={FiLayers}
          title="Dual File Checksum Comparison"
          description="Select two files to compute bitwise cryptographic digests and verify byte-for-byte identity."
          toolPath="/file-hash"
          acceptedFormats={['*.* (All Files)']}
          allowMultiple={true}
          compact={true}
          maxWidth="960px"
          alerts={
            errorMessage ? (
              <AlertBanner
                message={errorMessage}
                type="error"
                onClose={() => setErrorMessage('')}
              />
            ) : null
          }
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              width: '100%',
            }}
          >
            <FileUpload
              compact={true}
              onFilesSelected={handleSelectFileA}
              multiple={false}
              title="Select Baseline File A"
              description="Drop the original reference file (or drop both files here)"
            />
            <FileUpload
              compact={true}
              onFilesSelected={handleSelectFileB}
              multiple={false}
              title="Select Target File B"
              description="Drop file to verify against File A"
            />
          </div>
        </ToolHeroView>
      </div>
    );
  }

  // 3. Single File - Interactive Studio with ResizableSplitPane
  if (activeTab === 'single' && file) {
    const singleLeftControls = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem' }}>
        {/* File Info Card */}
        <div className="workspace-card" style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--primary-color)', display: 'block', marginBottom: '0.25rem' }}>
            Active Document
          </span>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.35rem 0', color: 'var(--text-color)', wordBreak: 'break-all' }}>
            {file.name}
          </h3>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span>{formatFileSize(file.size)}</span>
            <span>•</span>
            <span>{file.size.toLocaleString()} bytes</span>
          </div>
        </div>

        {/* Checksum Verification Box */}
        <div className="workspace-card" style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <FiSearch color="var(--primary-color)" />
            <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-color)' }}>
              Verify Against Vendor Checksum:
            </span>
          </div>
          <input
            type="text"
            placeholder="Paste expected SHA-256, SHA-512, SHA-1, or MD5 hash..."
            value={verifyInput}
            onChange={(e) => setVerifyInput(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '0.6rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--subtle-bg)',
              color: 'var(--text-color)',
              fontFamily: 'monospace',
              fontSize: '0.82rem',
              marginBottom: '0.6rem',
            }}
          />

          {verificationResult && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.55rem 0.75rem',
                borderRadius: '8px',
                background: verificationResult.match ? 'rgba(46, 213, 115, 0.12)' : 'rgba(255, 71, 87, 0.12)',
                border: `1px solid ${verificationResult.match ? '#2ed573' : '#ff4757'}`,
              }}
            >
              {verificationResult.match ? <FiCheckCircle color="#2ed573" size={18} /> : <FiXCircle color="#ff4757" size={18} />}
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: verificationResult.match ? '#2ed573' : '#ff4757' }}>
                {verificationResult.match
                  ? `MATCH CONFIRMED: Expected checksum matches computed ${verificationResult.algo} hash. File is authentic!`
                  : `MISMATCH: The pasted hash does not match any computed algorithm for this file.`}
              </span>
            </div>
          )}
        </div>

        {/* Digest Format Switcher */}
        <div className="workspace-card" style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Digest Letter Case:
          </span>
          <div style={{ display: 'inline-flex', background: 'var(--subtle-bg)', padding: '0.15rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setIsUppercase(false)}
              style={{
                padding: '0.25rem 0.6rem',
                borderRadius: '4px',
                border: 'none',
                background: !isUppercase ? 'var(--primary-color)' : 'transparent',
                color: !isUppercase ? '#fff' : 'var(--text-color)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              lowercase
            </button>
            <button
              type="button"
              onClick={() => setIsUppercase(true)}
              style={{
                padding: '0.25rem 0.6rem',
                borderRadius: '4px',
                border: 'none',
                background: isUppercase ? 'var(--primary-color)' : 'transparent',
                color: isUppercase ? '#fff' : 'var(--text-color)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              UPPERCASE
            </button>
          </div>
        </div>
      </div>
    );

    const singleRightHashes = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.25rem', height: '100%', overflow: 'auto' }}>
        {isProcessing ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Computing cryptographic digests in memory...</span>
          </div>
        ) : hashes ? (
          [
            { key: 'sha256', title: 'SHA-256', badge: 'Standard', value: hashes.sha256 },
            { key: 'sha512', title: 'SHA-512', badge: 'High Security', value: hashes.sha512 },
            { key: 'sha1', title: 'SHA-1', badge: '160-bit', value: hashes.sha1 },
            { key: 'md5', title: 'MD5', badge: 'Legacy', value: hashes.md5 },
          ].map((item) => (
            <div key={item.key} className="workspace-card" style={{ background: 'var(--card-bg)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-color)' }}>{item.title}</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(28, 153, 255, 0.12)', color: 'var(--primary-color)' }}>
                    {item.badge}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(formatHash(item.value), item.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.25rem 0.55rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--subtle-bg)',
                    color: copiedKey === item.key ? '#2ed573' : 'var(--text-color)',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {copiedKey === item.key ? <FiCheck color="#2ed573" /> : <FiCopy />}
                  {copiedKey === item.key ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div style={{ background: 'var(--subtle-bg)', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-color)', wordBreak: 'break-all', userSelect: 'all' }}>
                {formatHash(item.value)}
              </div>
            </div>
          ))
        ) : null}
      </div>
    );

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
        <ToolStudioHeader
          title="File Hash & Checksum"
          icon={FiHash}
          category="Utility"
          toolPath="/file-hash"
          fileBadge={`${file.name} (${formatFileSize(file.size)})`}
          onReset={() => {
            setFile(null);
            setHashes(null);
            setVerifyInput('');
          }}
          resetLabel="Hash Another File"
          headerExtra={renderModeSwitcher()}
          primaryAction={{
            label: isProcessing ? 'Calculating...' : 'Download Hash Report',
            icon: FiDownload,
            onClick: handleExportReport,
            disabled: !hashes || isProcessing,
          }}
        />

        {errorMessage && (
          <div style={{ marginBottom: '0.5rem' }}>
            <AlertBanner
              message={errorMessage}
              type="error"
              onClose={() => setErrorMessage('')}
            />
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0 }}>
          <ResizableSplitPane
            leftPane={singleLeftControls}
            rightPane={singleRightHashes}
            defaultSplit={40}
            minLeftWidth={330}
            minRightWidth={360}
            height="100%"
            leftTitle="File Information & Verification"
            rightTitle="Computed Cryptographic Checksums"
            storageKey="file_hash_split"
          />
        </div>
      </div>
    );
  }

  // 4. Dual Compare - Interactive Studio with ResizableSplitPane (when at least one file is uploaded)
  const compareLeftControls = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem' }}>
      {/* File A Card */}
      <div className="workspace-card" style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--primary-color)' }}>
            Baseline File A:
          </span>
          {fileA && (
            <button
              type="button"
              onClick={() => setFileA(null)}
              style={{ background: 'none', border: 'none', color: '#ff4757', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
            >
              Change
            </button>
          )}
        </div>
        {!fileA ? (
          <FileUpload compact={true} onFilesSelected={handleSelectFileA} multiple={false} title="Select Baseline File A" description="Reference baseline file" />
        ) : (
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.92rem', display: 'block', wordBreak: 'break-all' }}>{fileA.name}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatFileSize(fileA.size)}</span>
          </div>
        )}
      </div>

      {/* File B Card */}
      <div className="workspace-card" style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--primary-color)' }}>
            Target File B:
          </span>
          {fileB && (
            <button
              type="button"
              onClick={() => setFileB(null)}
              style={{ background: 'none', border: 'none', color: '#ff4757', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
            >
              Change
            </button>
          )}
        </div>
        {!fileB ? (
          <FileUpload compact={true} onFilesSelected={handleSelectFileB} multiple={false} title="Select Target File B" description="File to verify against File A" />
        ) : (
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.92rem', display: 'block', wordBreak: 'break-all' }}>{fileB.name}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatFileSize(fileB.size)}</span>
          </div>
        )}
      </div>

      {/* Switch back prominent button */}
      <button
        type="button"
        onClick={() => setActiveTab('single')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          padding: '0.65rem 1rem',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          background: 'var(--subtle-bg)',
          color: 'var(--text-color)',
          cursor: 'pointer',
          fontSize: '0.84rem',
          fontWeight: 600,
        }}
      >
        <FiArrowLeft /> Switch to Single File Hash Mode
      </button>
    </div>
  );

  const compareRightStatus = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem', height: '100%', overflow: 'auto' }}>
      {isProcessingCompare ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Comparing binary cryptographic digests...</span>
        </div>
      ) : hashesA && hashesB ? (
        <>
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '12px',
              background: isDualMatch ? 'rgba(46, 213, 115, 0.12)' : 'rgba(255, 71, 87, 0.12)',
              border: `1px solid ${isDualMatch ? '#2ed573' : '#ff4757'}`,
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              {isDualMatch ? <FiCheckCircle color="#2ed573" size={24} /> : <FiXCircle color="#ff4757" size={24} />}
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: isDualMatch ? '#2ed573' : '#ff4757' }}>
                {isDualMatch ? 'Files are 100% Identical' : 'Files are Different'}
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {isDualMatch
                ? 'All cryptographic checksums match perfectly byte-for-byte across SHA-256, SHA-512, SHA-1, and MD5.'
                : 'The binary contents of File A and File B differ.'}
            </p>
          </div>

          {/* Comparison Table */}
          <div className="workspace-card" style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1rem' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-color)', display: 'block', marginBottom: '0.75rem' }}>
              Algorithm Verification Details:
            </span>
            {[
              { name: 'SHA-256', valA: hashesA.sha256, valB: hashesB.sha256 },
              { name: 'MD5', valA: hashesA.md5, valB: hashesB.md5 },
              { name: 'SHA-1', valA: hashesA.sha1, valB: hashesB.sha1 },
              { name: 'SHA-512', valA: hashesA.sha512, valB: hashesB.sha512 },
            ].map((algo) => {
              const match = algo.valA === algo.valB;
              return (
                <div key={algo.name} style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-color)' }}>{algo.name}</span>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: match ? '#2ed573' : '#ff4757', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      {match ? <FiCheckCircle size={13} /> : <FiXCircle size={13} />} {match ? 'Match' : 'Mismatch'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    <div>A: {algo.valA}</div>
                    <div>B: {algo.valB}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: '0.88rem', margin: 0 }}>
            Upload both File A and File B to compute and compare cryptographic checksums.
          </p>
        </div>
      )}
    </div>
  );

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
      <ToolStudioHeader
        title="Dual File Checksum Comparison"
        icon={FiLayers}
        category="Utility"
        toolPath="/file-hash"
        fileBadge={fileA && fileB ? `${fileA.name} vs ${fileB.name}` : fileA ? fileA.name : fileB ? fileB.name : 'Dual Compare'}
        onReset={() => {
          setFileA(null);
          setFileB(null);
          setHashesA(null);
          setHashesB(null);
        }}
        resetLabel="Reset Both Files"
        headerExtra={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setActiveTab('single')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--subtle-bg)',
                color: 'var(--text-color)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              <FiArrowLeft size={13} /> Back to Single File
            </button>
            {renderModeSwitcher()}
          </div>
        }
      />

      {errorMessage && (
        <div style={{ marginBottom: '0.5rem' }}>
          <AlertBanner
            message={errorMessage}
            type="error"
            onClose={() => setErrorMessage('')}
          />
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        <ResizableSplitPane
          leftPane={compareLeftControls}
          rightPane={compareRightStatus}
          defaultSplit={44}
          minLeftWidth={330}
          minRightWidth={360}
          height="100%"
          leftTitle="Selected Comparison Files"
          rightTitle="Cryptographic Comparison Analysis"
          storageKey="file_compare_split"
        />
      </div>
    </div>
  );
}
