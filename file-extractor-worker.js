/**
 * Web Worker for off-thread text extraction (Mammoth.js for DOCX parsing)
 * Avoids freezing the main UI thread during synchronous ZIP/XML parsing.
 */

// Import Mammoth from vendor directory relative to worker location
importScripts("vendor/mammoth.browser.min.js");

self.onmessage = async function(e) {
  const { arrayBuffer } = e.data;
  
  try {
    if (!arrayBuffer) {
      throw new Error("No arrayBuffer provided to worker.");
    }
    
    // Mammoth raw text extraction
    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    
    self.postMessage({
      success: true,
      value: result.value,
      messages: result.messages || []
    });
  } catch (err) {
    self.postMessage({
      success: false,
      error: err.message || "Failed to extract DOCX text."
    });
  }
};
