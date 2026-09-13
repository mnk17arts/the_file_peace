import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFileSize, validatePdfFile, validateImageFile, validateVideoFile, validateAudioFile } from '../src/utils/fileUtils.js';
import { setTransferredFile, consumeTransferredFile } from '../src/utils/fileTransfer.js';

test('formatFileSize formats byte values correctly', () => {
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(500), '500 B');
  assert.equal(formatFileSize(1024), '1.0 KB');
  assert.equal(formatFileSize(1536), '1.5 KB');
  assert.equal(formatFileSize(1024 * 1024), '1.00 MB');
  assert.equal(formatFileSize(2.5 * 1024 * 1024), '2.50 MB');
  assert.equal(formatFileSize(1024 * 1024 * 1024), '1.00 GB');
});

test('validatePdfFile validates PDF extensions and size limits', () => {
  const validFile = { name: 'document.pdf', size: 5 * 1024 * 1024 };
  const res1 = validatePdfFile(validFile);
  assert.equal(res1.valid, true);
  assert.equal(res1.error, null);

  const invalidExt = { name: 'document.docx', size: 1024 };
  const res2 = validatePdfFile(invalidExt);
  assert.equal(res2.valid, false);
  assert.match(res2.error, /not a PDF/);

  const oversized = { name: 'large.pdf', size: 120 * 1024 * 1024 };
  const res3 = validatePdfFile(oversized, 100 * 1024 * 1024);
  assert.equal(res3.valid, false);
  assert.match(res3.error, /exceeds/);
});

test('validateImageFile validates allowed extensions and size limits', () => {
  const validJpg = { name: 'photo.jpg', size: 2 * 1024 * 1024 };
  assert.equal(validateImageFile(validJpg).valid, true);

  const validPng = { name: 'icon.png', size: 500 * 1024 };
  assert.equal(validateImageFile(validPng).valid, true);

  const invalidExe = { name: 'program.exe', size: 500 };
  const resExe = validateImageFile(invalidExe);
  assert.equal(resExe.valid, false);
  assert.match(resExe.error, /format is not supported/);

  const oversized = { name: 'massive.png', size: 60 * 1024 * 1024 };
  const resOver = validateImageFile(oversized, ['.png'], 50 * 1024 * 1024);
  assert.equal(resOver.valid, false);
  assert.match(resOver.error, /size limit/);
});

test('validateVideoFile validates video extensions and size limits', () => {
  const validMp4 = { name: 'clip.mp4', size: 10 * 1024 * 1024 };
  assert.equal(validateVideoFile(validMp4).valid, true);

  // FileList-like object or array
  const mockFileList = { 0: validMp4, length: 1 };
  assert.equal(validateVideoFile(mockFileList).valid, true);
  assert.equal(validateVideoFile([validMp4]).valid, true);

  const invalidExt = { name: 'clip.txt', size: 500 };
  const resExt = validateVideoFile(invalidExt);
  assert.equal(resExt.valid, false);
  assert.match(resExt.error, /format is not supported/);

  const oversized = { name: 'movie.mp4', size: 160 * 1024 * 1024 };
  const resOver = validateVideoFile(oversized, ['.mp4'], 150 * 1024 * 1024);
  assert.equal(resOver.valid, false);
  assert.match(resOver.error, /size limit/);
});

test('validateAudioFile validates audio extensions and size limits', () => {
  const validMp3 = { name: 'song.mp3', size: 5 * 1024 * 1024 };
  assert.equal(validateAudioFile(validMp3).valid, true);

  // FileList-like object or array
  const mockFileList = { 0: validMp3, length: 1 };
  assert.equal(validateAudioFile(mockFileList).valid, true);
  assert.equal(validateAudioFile([validMp3]).valid, true);

  const validWav = { name: 'sample.wav', size: 12 * 1024 * 1024 };
  assert.equal(validateAudioFile(validWav).valid, true);

  const invalidExt = { name: 'audio.txt', size: 500 };
  const resExt = validateAudioFile(invalidExt);
  assert.equal(resExt.valid, false);
  assert.match(resExt.error, /format is not supported/);

  const oversized = { name: 'heavy.wav', size: 120 * 1024 * 1024 };
  const resOver = validateAudioFile(oversized, ['.wav', '.mp3'], 100 * 1024 * 1024);
  assert.equal(resOver.valid, false);
  assert.match(resOver.error, /size limit/);
});

test('in-memory fileTransfer sets and consumes files cleanly without persistence', () => {
  assert.equal(consumeTransferredFile(), null);

  const mockFile = { name: 'document.pdf', size: 1024 };
  setTransferredFile(mockFile);

  const retrieved = consumeTransferredFile();
  assert.equal(retrieved, mockFile);

  // Subsequent call must return null immediately
  assert.equal(consumeTransferredFile(), null);
});


