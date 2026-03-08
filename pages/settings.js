const DEFAULTS = [
  { id:"cambridge", name:"Cambridge",       url:"https://dictionary.cambridge.org/dictionary/english/{word}" },
  { id:"merriam",   name:"Merriam-Webster", url:"https://www.merriam-webster.com/dictionary/{word}" },
  { id:"oxford",    name:"Oxford",          url:"https://www.oxfordlearnersdictionaries.com/definition/english/{word}" },
  { id:"wordref",   name:"WordReference",   url:"https://www.wordreference.com/definition/{word}" },
  { id:"linguee",  name:"Linguee",          url:"https://www.linguee.es/espanol-ingles/search?source=ingles&query={word}"}
];

let dicts = [];
let editingIndex = null; // tracks which card is currently open for editing

const toast = (msg) => {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2000);
};

function save() {
  chrome.storage.sync.set({ dictionaries: dicts }, () => toast("✓ Saved"));
}

// ─── Render the full dictionary list ─────────────────────────────────────────
// Each card has two states:
//   - View mode:  shows name + url + edit/delete buttons
//   - Edit mode:  shows inline input fields for name and url
function render() {
  const list = document.getElementById("dict-list");
  list.innerHTML = "";

  dicts.forEach((d, i) => {
    const card = document.createElement("div");
    card.className = "dict-card" + (editingIndex === i ? " editing" : "");

    if (editingIndex === i) {
      // ── Edit mode ──────────────────────────────────────────────────────────
      // We reuse the same card element but swap its contents for input fields.
      // The ID field is intentionally not editable — changing it could break
      // references if you later build features that rely on stable IDs.
      card.innerHTML = `
        <div class="edit-form">
          <div class="edit-row">
            <div class="fg">
              <label>Name</label>
              <input type="text" class="edit-name" value="${esc(d.name)}" />
            </div>
          </div>
          <div class="fg" style="margin-top:8px">
            <label>URL</label>
            <input type="text" class="edit-url" value="${esc(d.url)}" />
            <div class="url-hint">Use <code>{word}</code> as the placeholder.</div>
          </div>
          <div class="edit-actions">
            <button class="btn btn-ghost btn-sm cancel-edit">Cancel</button>
            <button class="btn btn-primary btn-sm save-edit">Save changes</button>
          </div>
        </div>
      `;

      // Save changes
      card.querySelector(".save-edit").addEventListener("click", () => {
        const newName = card.querySelector(".edit-name").value.trim();
        const newUrl  = card.querySelector(".edit-url").value.trim();
        if (!newName)                    return toast("⚠ Name can't be empty");
        if (!newUrl)                     return toast("⚠ URL can't be empty");
        if (!newUrl.includes("{word}"))  return toast("⚠ URL must include {word}");
        dicts[i].name = newName;
        dicts[i].url  = newUrl;
        editingIndex = null;
        render();
        save();
      });

      // Cancel — just close the edit form without saving
      card.querySelector(".cancel-edit").addEventListener("click", () => {
        editingIndex = null;
        render();
      });

    } else {
      // ── View mode ──────────────────────────────────────────────────────────
      card.innerHTML = `
        <div class="dict-info">
          <div class="dict-name">${esc(d.name)}</div>
          <div class="dict-url">${esc(d.url)}</div>
        </div>
        <div class="card-actions">
          <button class="edit-btn" data-i="${i}" title="Edit">✏️</button>
          <button class="del-btn"  data-i="${i}" title="Remove">🗑</button>
        </div>
      `;

      card.querySelector(".edit-btn").addEventListener("click", () => {
        // If another card was being edited, close it first
        editingIndex = i;
        render();
      });

      card.querySelector(".del-btn").addEventListener("click", () => {
        dicts.splice(i, 1);
        if (editingIndex === i) editingIndex = null;
        render();
        save();
      });
    }

    list.appendChild(card);
  });
}

// ─── Load from storage ────────────────────────────────────────────────────────
chrome.storage.sync.get(["dictionaries","nativeLanguage"], (r) => {
  dicts = r.dictionaries || DEFAULTS;
  render();
  document.getElementById("lang").value = r.nativeLanguage || "en";
});

document.getElementById("lang").addEventListener("change", (e) => {
  chrome.storage.sync.set({ nativeLanguage: e.target.value }, () => toast("✓ Saved"));
});

// ─── Add new dictionary form ──────────────────────────────────────────────────
const addForm   = document.getElementById("add-form");
const showAddBtn = document.getElementById("show-add");

showAddBtn.addEventListener("click", () => {
  // Close any open edit form first so the page doesn't get cluttered
  editingIndex = null;
  render();
  addForm.style.display = "block";
  showAddBtn.style.display = "none";
});

document.getElementById("cancel-add").addEventListener("click", () => {
  addForm.style.display = "none";
  showAddBtn.style.display = "";
  ["new-name","new-id","new-url"].forEach(id => document.getElementById(id).value = "");
});

document.getElementById("save-add").addEventListener("click", () => {
  const name = document.getElementById("new-name").value.trim();
  const id   = document.getElementById("new-id").value.trim().replace(/\s+/g,"-").toLowerCase();
  const url  = document.getElementById("new-url").value.trim();
  if (!name || !id || !url)     return toast("Fill in all fields");
  if (!url.includes("{word}"))  return toast("URL must include {word}");
  if (dicts.find(d => d.id === id)) return toast("ID already exists");
  dicts.push({ id, name, url });
  render(); save();
  addForm.style.display = "none";
  showAddBtn.style.display = "";
  ["new-name","new-id","new-url"].forEach(id => document.getElementById(id).value = "");
});

function esc(str) {
  return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
