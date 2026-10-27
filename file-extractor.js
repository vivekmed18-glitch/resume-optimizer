/**
 * File Extractor Utility - Phase 8 Resume Upload
 * Performs local browser-based text extraction from PDF, DOCX, and TXT files.
 * Enforces strict limits, signature checks, and timeout terminations.
 */

const IMPORT_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,      // 5 MB Limit
  maxExtractedCharacters: 50000,      // Character Cap
  maxPdfPages: 20,                    // Page Cap
  maxExtractedLines: 5000,            // Line Cap
  extractionTimeoutMs: 15000,         // Extraction Timer
  parsingTimeoutMs: 20000             // Parsing Timer
};

/**
 * Validates initial file header bytes to confirm format signatures
 */
function detectFileSignature(bytes) {
  if (bytes.length < 4) return "unknown";
  
  const header = new TextDecoder("latin1").decode(bytes.slice(0, 8));
  if (header.startsWith("%PDF-")) {
    return "pdf";
  }
  
  // DOCX files are ZIP containers (starts with PK)
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return "docx";
  }
  
  return "unknown";
}

/**
 * Local validator checking sizes, extensions, and headers before parsing
 */
async function validateFileHeader(file) {
  if (!file) throw new Error("No file selected.");
  
  if (file.size > IMPORT_LIMITS.maxFileBytes) {
    throw new Error(`The selected file is larger than 5 MB.`);
  }
  
  if (file.size === 0) {
    throw new Error("The selected file is empty.");
  }

  const name = file.name.toLowerCase();
  const ext = name.split(".").pop();
  const allowedExts = ["txt", "pdf", "docx"];
  
  if (!allowedExts.includes(ext)) {
    throw new Error("This file type is not supported. Upload a PDF, DOCX, or TXT file.");
  }

  // Load first 8 bytes for signature validation
  const buffer = await file.slice(0, 8).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const signature = detectFileSignature(bytes);

  if (ext === "pdf" && signature !== "pdf") {
    throw new Error("This file's content does not match its extension. Select a valid PDF resume.");
  }
  if (ext === "docx" && signature !== "docx") {
    throw new Error("This file's content does not match its extension. Select a valid DOCX resume.");
  }

  return { ext, signature };
}

/**
 * Extracts plain text from TXT files
 */
async function extractTextFromTxt(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  // Reject binary files by checking for null bytes
  let nullCount = 0;
  for (let i = 0; i < Math.min(bytes.length, 1000); i++) {
    if (bytes[i] === 0x00) {
      nullCount++;
    }
  }
  
  if (nullCount > 5) {
    throw new Error("TXT file contains invalid binary content.");
  }

  const text = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true }).decode(bytes);
  if (!text.trim()) {
    throw new Error("TXT file has no readable text content.");
  }
  
  if (text.length > IMPORT_LIMITS.maxExtractedCharacters) {
    throw new Error("TXT file content exceeds the maximum character limit.");
  }

  return {
    text: text,
    pageCount: 1,
    warnings: []
  };
}

/**
 * Extracts raw paragraphs from DOCX files using Mammoth.js run in Web Worker
 */
function extractTextFromDocx(file) {
  return new Promise(async (resolve, reject) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const worker = new Worker("file-extractor-worker.js");
      
      // Cleanup helper to avoid leaks
      const cleanup = () => {
        clearTimeout(timeoutId);
        worker.terminate();
      };

      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("DOCX text extraction timed out after 15 seconds."));
      }, IMPORT_LIMITS.extractionTimeoutMs);

      worker.onmessage = function(e) {
        cleanup();
        const data = e.data;
        if (data.success) {
          const text = data.value || "";
          
          // Apply validation caps
          if (text.length > IMPORT_LIMITS.maxExtractedCharacters) {
            reject(new Error("DOCX content exceeds the maximum character limit."));
            return;
          }
          
          const lines = text.split(/\r?\n/);
          if (lines.length > IMPORT_LIMITS.maxExtractedLines) {
            reject(new Error("DOCX content exceeds the maximum line limit."));
            return;
          }

          resolve({
            text: text,
            pageCount: 1,
            warnings: data.messages || []
          });
        } else {
          reject(new Error(data.error || "DOCX parser failed."));
        }
      };

      worker.postMessage({ arrayBuffer }, [arrayBuffer]);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Extracts selectable text from PDF page by page using PDF.js
 */
async function extractTextFromPdf(file) {
  // Pin matching worker source
  pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.js";

  const buffer = await file.arrayBuffer();
  const startTime = Date.now();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true  // Run on main thread to avoid nested worker errors in workers
  });

  const pdf = await loadingTask.promise;
  
  if (pdf.numPages > IMPORT_LIMITS.maxPdfPages) {
    throw new Error(`The selected PDF contains ${pdf.numPages} pages, exceeding the ${IMPORT_LIMITS.maxPdfPages}-page limit.`);
  }

  const pages = [];
  let totalChars = 0;
  let totalLines = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    // Timeout check
    if (Date.now() - startTime > IMPORT_LIMITS.extractionTimeoutMs) {
      throw new Error("PDF text extraction timed out after 15 seconds.");
    }

    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    const pageText = textContent.items
      .map(item => item.str)
      .join(" ");

    totalChars += pageText.length;
    if (totalChars > IMPORT_LIMITS.maxExtractedCharacters) {
      throw new Error("PDF text content exceeds the maximum character limit.");
    }

    const pageLines = pageText.split(/\r?\n/).length;
    totalLines += pageLines;
    if (totalLines > IMPORT_LIMITS.maxExtractedLines) {
      throw new Error("PDF content exceeds the maximum line limit.");
    }

    pages.push(pageText);
  }

  const fullText = pages.join("\n\n");
  if (!fullText.trim() || fullText.trim().length < 10) {
    throw new Error("Resume.AI found little or no selectable text. The document may be scanned, image-based, password-protected, or use unsupported text encoding.");
  }

  return {
    text: fullText,
    pageCount: pdf.numPages,
    warnings: []
  };
}

/**
 * Unified extraction selector
 */
async function extractResumeText(file) {
  const { ext } = await validateFileHeader(file);

  if (ext === "txt") {
    return extractTextFromTxt(file);
  } else if (ext === "docx") {
    return extractTextFromDocx(file);
  } else if (ext === "pdf") {
    return extractTextFromPdf(file);
  } else {
    throw new Error("Unsupported file type.");
  }
}
