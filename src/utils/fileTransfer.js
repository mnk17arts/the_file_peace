/**
 * Utility for in-memory file transfer between tools in The File Peace.
 * Avoids browser history state pollution, serialization limits, and navigation loops.
 */

let transferredFile = null;

/**
 * Stage a file to be piped to another tool.
 * @param {File|Blob} file 
 */
export const setTransferredFile = (file) => {
  transferredFile = file;
};

/**
 * Ingest and immediately consume (clear) the transferred file.
 * @returns {File|Blob|null}
 */
export const consumeTransferredFile = () => {
  const file = transferredFile;
  transferredFile = null;
  return file;
};
