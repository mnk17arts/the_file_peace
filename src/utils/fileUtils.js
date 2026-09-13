/**
 * Shared utility helpers for file operations, formatting, and validation.
 */

/**
 * Formats a byte number into human-readable KB, MB, or GB.
 * @param {number} bytes 
 * @returns {string}
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/**
 * Triggers a file download using a temporary anchor element.
 * @param {string} url - Object URL or download URL
 * @param {string} fileName - Destination filename
 */
export const triggerDownload = (url, fileName) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Validates a PDF file by extension and size limit.
 * @param {File} file 
 * @param {number} maxBytes 
 * @returns {{ valid: boolean, error: string | null }}
 */
export const validatePdfFile = (file, maxBytes = 100 * 1024 * 1024) => {
  if (!file) return { valid: false, error: 'No file selected.' };
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: `"${file.name}" is not a PDF. Please select a valid .pdf file.` };
  }
  if (file.size > maxBytes) {
    return { 
      valid: false, 
      error: `"${file.name}" (${formatFileSize(file.size)}) exceeds the maximum allowed size of ${formatFileSize(maxBytes)}.` 
    };
  }
  return { valid: true, error: null };
};

/**
 * Validates an image file for supported formats and size limits.
 * @param {File} file 
 * @param {string[]} allowedExtensions 
 * @param {number} maxBytes 
 * @returns {{ valid: boolean, error: string | null }}
 */
export const validateImageFile = (
  file, 
  allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'], 
  maxBytes = 50 * 1024 * 1024
) => {
  if (!file) return { valid: false, error: 'No file selected.' };
  const lowerName = file.name.toLowerCase();
  const hasValidExt = allowedExtensions.some(ext => lowerName.endsWith(ext));

  if (!hasValidExt) {
    return { 
      valid: false, 
      error: `"${file.name}" format is not supported. Allowed formats: ${allowedExtensions.join(', ')}` 
    };
  }

  if (file.size > maxBytes) {
    return { 
      valid: false, 
      error: `"${file.name}" (${formatFileSize(file.size)}) exceeds the ${formatFileSize(maxBytes)} size limit.` 
    };
  }

  return { valid: true, error: null };
};

/**
 * Validates a video file for supported formats and size limits.
 * @param {File} file 
 * @param {string[]} allowedExtensions 
 * @param {number} maxBytes 
 * @returns {{ valid: boolean, error: string | null }}
 */
export const validateVideoFile = (
  file,
  allowedExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv'],
  maxBytes = 150 * 1024 * 1024
) => {
  const actualFile = (file && typeof file === 'object' && 'length' in file && !('name' in file))
    ? file[0]
    : file;
  if (!actualFile || !actualFile.name) return { valid: false, error: 'No file selected.' };
  const lowerName = actualFile.name.toLowerCase();
  const hasValidExt = allowedExtensions.some(ext => lowerName.endsWith(ext));

  if (!hasValidExt) {
    return {
      valid: false,
      error: `"${actualFile.name}" format is not supported. Allowed video formats: ${allowedExtensions.join(', ')}`
    };
  }

  if (actualFile.size > maxBytes) {
    return {
      valid: false,
      error: `"${actualFile.name}" (${formatFileSize(actualFile.size)}) exceeds the ${formatFileSize(maxBytes)} size limit.`
    };
  }

  return { valid: true, error: null };
};

/**
 * Validates an audio file for supported formats and size limits.
 * @param {File} file 
 * @param {string[]} allowedExtensions 
 * @param {number} maxBytes 
 * @returns {{ valid: boolean, error: string | null }}
 */
export const validateAudioFile = (
  file,
  allowedExtensions = ['.mp3', '.wav', '.aac', '.ogg', '.m4a', '.flac', '.weba'],
  maxBytes = 250 * 1024 * 1024
) => {
  const actualFile = (file && typeof file === 'object' && 'length' in file && !('name' in file))
    ? file[0]
    : file;
  if (!actualFile || !actualFile.name) return { valid: false, error: 'No file selected.' };
  const lowerName = actualFile.name.toLowerCase();
  const hasValidExt = allowedExtensions.some(ext => lowerName.endsWith(ext));

  if (!hasValidExt) {
    return {
      valid: false,
      isValid: false,
      error: `"${actualFile.name}" format is not supported. Allowed audio formats: ${allowedExtensions.join(', ')}`
    };
  }

  if (actualFile.size > maxBytes) {
    return {
      valid: false,
      isValid: false,
      error: `"${actualFile.name}" (${formatFileSize(actualFile.size)}) exceeds the ${formatFileSize(maxBytes)} size limit.`
    };
  }

  return { valid: true, error: null };
};
