/**
 * Agentation Visual Feedback Module
 * Enables live element selection, visual annotation, CSS selector path extraction,
 * and AI prompt generation directly on the web page.
 */
(function initAgentation() {
  let active = false;
  let hoveredEl = null;

  // Create floating trigger widget
  const widget = document.createElement("div");
  widget.id = "agentation-widget";
  widget.innerHTML = `
    <button id="btn-agentation-toggle" title="Toggle Agentation Visual Inspector">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="16"></line>
        <line x1="8" y1="12" x2="16" y2="12"></line>
      </svg>
      <span>Inspect UI</span>
    </button>
  `;
  document.body.appendChild(widget);

  // Overlay element highlighter box
  const highlightBox = document.createElement("div");
  highlightBox.id = "agentation-highlight-box";
  highlightBox.style.display = "none";
  document.body.appendChild(highlightBox);

  // Modal dialog for annotation prompt payload
  const modal = document.createElement("div");
  modal.id = "agentation-modal";
  modal.style.display = "none";
  modal.innerHTML = `
    <div class="agentation-modal-content">
      <div class="agentation-modal-header">
        <h3>Agentation Visual Feedback</h3>
        <button id="btn-agentation-close">&times;</button>
      </div>
      <div class="agentation-modal-body">
        <div class="agentation-meta-row">
          <strong>Target Selector:</strong>
          <code id="agentation-target-path"></code>
        </div>
        <div class="form-group" style="margin-top: 12px;">
          <label for="agentation-notes">Describe UI Modification / Fix:</label>
          <textarea id="agentation-notes" placeholder="e.g. Change background color to dark purple, increase font size to 16px, or fix alignment..."></textarea>
        </div>
        <div class="form-group">
          <label>Generated Payload for AI Agent:</label>
          <textarea id="agentation-payload-output" readonly style="height: 120px; font-family: monospace; font-size: 0.75rem;"></textarea>
        </div>
      </div>
      <div class="agentation-modal-footer">
        <button id="btn-agentation-copy" class="btn btn-primary">Copy Payload for AI Agent</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const toggleBtn = document.getElementById("btn-agentation-toggle");
  const closeBtn = document.getElementById("btn-agentation-close");
  const copyBtn = document.getElementById("btn-agentation-copy");
  const notesArea = document.getElementById("agentation-notes");
  const targetPathCode = document.getElementById("agentation-target-path");
  const payloadOutput = document.getElementById("agentation-payload-output");

  toggleBtn.addEventListener("click", () => {
    active = !active;
    toggleBtn.classList.toggle("active", active);
    if (!active) {
      highlightBox.style.display = "none";
    }
  });

  closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });

  function getSelectorPath(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return "";
    const path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();
      if (el.id) {
        selector += `#${el.id}`;
        path.unshift(selector);
        break;
      } else if (el.className && typeof el.className === "string") {
        const classes = el.className.split(/\s+/).filter(c => c && !c.startsWith("agentation")).join(".");
        if (classes) selector += `.${classes}`;
      }
      path.unshift(selector);
      el = el.parentElement;
    }
    return path.join(" > ");
  }

  document.addEventListener("mousemove", (e) => {
    if (!active) return;
    const target = e.target;
    if (target.closest("#agentation-widget") || target.closest("#agentation-modal")) {
      highlightBox.style.display = "none";
      return;
    }
    hoveredEl = target;
    const rect = target.getBoundingClientRect();
    highlightBox.style.display = "block";
    highlightBox.style.top = `${rect.top + window.scrollY}px`;
    highlightBox.style.left = `${rect.left + window.scrollX}px`;
    highlightBox.style.width = `${rect.width}px`;
    highlightBox.style.height = `${rect.height}px`;
  });

  document.addEventListener("click", (e) => {
    if (!active || !hoveredEl) return;
    if (e.target.closest("#agentation-widget") || e.target.closest("#agentation-modal")) return;

    e.preventDefault();
    e.stopPropagation();

    const selectorPath = getSelectorPath(hoveredEl);
    const computedStyle = window.getComputedStyle(hoveredEl);

    targetPathCode.textContent = selectorPath;
    notesArea.value = "";

    function updatePayload() {
      const payload = {
        agentationVersion: "1.0",
        target: {
          selectorPath: selectorPath,
          tagName: hoveredEl.tagName.toLowerCase(),
          id: hoveredEl.id || "",
          classList: Array.from(hoveredEl.classList).filter(c => !c.startsWith("agentation")),
          computedStyles: {
            color: computedStyle.color,
            backgroundColor: computedStyle.backgroundColor,
            fontSize: computedStyle.fontSize,
            padding: computedStyle.padding,
            margin: computedStyle.margin
          }
        },
        userInstruction: notesArea.value.trim()
      };
      payloadOutput.value = JSON.stringify(payload, null, 2);
    }

    updatePayload();
    notesArea.oninput = updatePayload;

    modal.style.display = "flex";
    active = false;
    toggleBtn.classList.remove("active");
    highlightBox.style.display = "none";
  }, true);

  copyBtn.addEventListener("click", () => {
    payloadOutput.select();
    navigator.clipboard.writeText(payloadOutput.value);
    copyBtn.textContent = "Copied to Clipboard!";
    setTimeout(() => {
      copyBtn.textContent = "Copy Payload for AI Agent";
      modal.style.display = "none";
    }, 1500);
  });
})();
