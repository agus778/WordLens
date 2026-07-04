// ─── State ────────────────────────────────────────────────────────────────────
let panel = null;
let isDragging = false, dragOX = 0, dragOY = 0, dragW = 0, dragH = 0;
let isResizing = false, resStartX, resStartY, resStartW, resStartH;

// ─── Listen for trigger from background ──────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "WORDLENS_OPEN") {
    showPanel(msg.word, msg.dictionaries);
  }
});

// ─── Main panel entry point ───────────────────────────────────────────────────
function showPanel(word, dictionaries) {
  removePanel();

  panel = document.createElement("div");
  panel.id = "wl-panel";
  panel.innerHTML = skeletonHTML(word, dictionaries);
  document.body.appendChild(panel);
  positionPanel();
  wireEvents(word, dictionaries);
  fetchDefinition(word);
}

function removePanel() {
  if (panel) { panel.remove(); panel = null; }
}

// ─── HTML Templates ───────────────────────────────────────────────────────────
function skeletonHTML(word, dicts) {
  const links = dicts.map(d =>
    `<a class="wl-ext-link" href="${d.url.replace("{word}", encodeURIComponent(word))}" target="_blank" title="Open in ${d.name}">${d.name} </a>`
  ).join("");

  return `
    <div class="wl-titlebar" id="wl-drag">
      <span class="wl-logo">W</span>
      <span class="wl-word-title">${esc(word)}</span>
      <div class="wl-titlebar-actions">
        <button class="wl-icon-btn" id="wl-close" title="Close (Esc)">X</button>
      </div>
    </div>
    <div class="wl-content" id="wl-content">
      <div class="wl-loading">
        <div class="wl-spinner"></div>
        <span>Looking up <em>${esc(word)}</em>.../span>
      </div>
    </div>
    <div class="wl-footer">
      <span class="wl-footer-label">Open in:</span>
      <div class="wl-ext-links">${links}</div>
    </div>
    <div class="wl-resizer" id="wl-resizer"></div>
  `;
}

function definitionHTML(entries) {
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return notFoundHTML();
  }

  const entry = entries[0];
  const phonetic = entry.phonetic || (entry.phonetics || []).find(p => p.text)?.text || "";
  const audioUrl = (entry.phonetics || []).find(p => p.audio)?.audio || "";

  let html = `<div class="wl-entry">`;

  html += `<div class="wl-phonetic-row">`;
  if (phonetic) html += `<span class="wl-phonetic">${esc(phonetic)}</span>`;
  if (audioUrl) html += `<button class="wl-audio-btn" data-audio="${audioUrl}" title="Listen">🔊</button>`;
  html += `</div>`;

  (entry.meanings || []).forEach(meaning => {
    html += `<div class="wl-meaning">`;
    html += `<div class="wl-pos">${esc(meaning.partOfSpeech)}</div>`;

    (meaning.definitions || []).slice(0, 4).forEach((def, i) => {
      html += `<div class="wl-def">
        <span class="wl-def-num">${i + 1}</span>
        <div class="wl-def-body">
          <p class="wl-def-text">${esc(def.definition)}</p>
          ${def.example ? `<p class="wl-example">"${esc(def.example)}"</p>` : ""}
        </div>
      </div>`;
    });

    const syns = (meaning.synonyms || []).slice(0, 6);
    if (syns.length > 0) {
      html += `<div class="wl-syns"><span class="wl-syns-label">Synonyms:</span> `;
      html += syns.map(s => `<span class="wl-syn">${esc(s)}</span>`).join(" ");
      html += `</div>`;
    }

    html += `</div>`;
  });

  html += `</div>`;
  return html;
}

function notFoundHTML(word) {
  return `
    <div class="wl-not-found">
      <div class="wl-not-found-icon">?</div>
      <p>No definition found for <strong>"${esc(word || "")}"</strong></p>
      <p class="wl-not-found-hint">Try opening one of the dictionaries below.</p>
    </div>
  `;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────
function fetchDefinition(word) {
  chrome.runtime.sendMessage({ type: "WORDLENS_FETCH", word }, (response) => {
    const content = document.getElementById("wl-content");
    if (!content) return;
    if (response && response.ok && Array.isArray(response.data)) {
      content.innerHTML = definitionHTML(response.data);
      content.querySelectorAll(".wl-audio-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          chrome.runtime.sendMessage({ type: "WORDLENS_PLAY_AUDIO", url: btn.dataset.audio });
        });
      });
    } else {
      content.innerHTML = notFoundHTML(word);
    }
  });
}

// ─── Positioning ──────────────────────────────────────────────────────────────
function positionPanel() {
  const sel = window.getSelection();
  let x = window.innerWidth / 2 - 210;
  let y = window.scrollY + 80;

  if (sel && sel.rangeCount > 0) {
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    x = rect.left + window.scrollX;
    y = rect.bottom + window.scrollY + 14;
    if (rect.bottom + 480 > window.innerHeight) y = rect.top + window.scrollY - 480 - 14;
    x = Math.max(8, Math.min(x, window.innerWidth - 430));
    y = Math.max(window.scrollY + 8, y);
  }

  panel.style.left = x + "px";
  panel.style.top  = y + "px";
}

// ─── Events ───────────────────────────────────────────────────────────────────
function wireEvents(word, dicts) {
  panel.querySelector("#wl-close").addEventListener("click", removePanel);

  const onKey = (e) => { if (e.key === "Escape") { removePanel(); document.removeEventListener("keydown", onKey); } };
  document.addEventListener("keydown", onKey);

  setTimeout(() => {
    const onOutside = (e) => {
      if (panel && !panel.contains(e.target)) {
        removePanel();
        document.removeEventListener("mousedown", onOutside);
      }
    };
    document.addEventListener("mousedown", onOutside);
  }, 200);

  const handle = panel.querySelector("#wl-drag");
  handle.addEventListener("mousedown", (e) => {
    if (e.target.closest("button")) return;
    const rect = panel.getBoundingClientRect();
    isDragging = true;
    dragOX = e.clientX - rect.left;
    dragOY = e.clientY - rect.top;
    dragW = rect.width; dragH = rect.height; // cache once; don't read layout each move
    panel.style.transition = "none";
    startDragListeners();
    e.preventDefault();
  });

  const resizer = panel.querySelector("#wl-resizer");
  resizer.addEventListener("mousedown", (e) => {
    isResizing = true;
    resStartX = e.clientX; resStartY = e.clientY;
    resStartW = panel.offsetWidth; resStartH = panel.offsetHeight;
    startDragListeners();
    e.preventDefault(); e.stopPropagation();
  });
}

// Global move/up listeners live only for the duration of a drag/resize —
// added on mousedown, removed on mouseup — so they never accumulate or fire idle.
function startDragListeners() {
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup",   onMouseUp);
}

function onMouseMove(e) {
  if (isDragging && panel) {
    let x = e.clientX - dragOX;
    let y = e.clientY - dragOY;
    x = Math.max(0, Math.min(x, window.innerWidth  - dragW));
    y = Math.max(0, Math.min(y, window.innerHeight - dragH));
    panel.style.left = x + "px";
    panel.style.top  = (y + window.scrollY) + "px";
  }
  if (isResizing && panel) {
    panel.style.width  = Math.max(340, resStartW + (e.clientX - resStartX)) + "px";
    panel.style.height = Math.max(280, resStartH + (e.clientY - resStartY)) + "px";
  }
}

function onMouseUp() {
  isDragging = false; isResizing = false;
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup",   onMouseUp);
}

function esc(str) {
  return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
