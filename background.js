const DEFAULT_DICTIONARIES = [
  { id: "cambridge", name: "Cambridge", url: "https://dictionary.cambridge.org/dictionary/english/{word}" },
  { id: "merriam",   name: "Merriam-Webster", url: "https://www.merriam-webster.com/dictionary/{word}" },
  { id: "oxford",    name: "Oxford",  url: "https://www.oxfordlearnersdictionaries.com/definition/english/{word}" },
  { id: "wordref",   name: "WordReference", url: "https://www.wordreference.com/definition/{word}" },
  {id : "linguee",   name: "Linguee", url: "https://www.linguee.es/espanol-ingles/search?source=ingles&query={word}"}

];

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["dictionaries", "nativeLanguage"], (result) => {
    if (!result.dictionaries)   chrome.storage.sync.set({ dictionaries: DEFAULT_DICTIONARIES });
    if (!result.nativeLanguage) chrome.storage.sync.set({ nativeLanguage: "en" });
  });
  buildContextMenu();
});

function buildContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "wordlens-lookup",
      title: "WordLens - Dictionary Lookup",
      contexts: ["selection"]
    });
  });
}

async function playAudioOffscreen(url) {
  try {
    const existing = await chrome.offscreen.hasDocument();
    if (!existing) {
      await chrome.offscreen.createDocument({
        url: chrome.runtime.getURL("pages/offscreen.html"),
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Play pronunciation audio free from page CSP"
      });
    }
    chrome.runtime.sendMessage({ type: "WORDLENS_PLAY_AUDIO_OFFSCREEN", url });
  } catch (err) {
    console.warn("Audio playback failed:", err.message);
  }
}

// Content scripts can't do cross-origin fetch, so background does it and relays
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === "WORDLENS_FETCH") {
    // Free Dictionary API — no key needed
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(msg.word)}`;
    fetch(url)
      .then(r => r.json())
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (msg.type === "WORDLENS_PLAY_AUDIO") {
    playAudioOffscreen(msg.url);
  }

});

// Send WORDLENS_OPEN; if the tab has no content script yet (e.g. it was open
// before the extension loaded/reloaded), inject it on demand and retry once.
async function openLookup(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    try {
      await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      await chrome.tabs.sendMessage(tabId, message);
    } catch (err) {
      // Restricted page (chrome://, Web Store, PDF viewer) — nothing we can do.
      console.warn("WordLens can't run on this page:", err.message);
    }
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "wordlens-lookup") {
    const word = info.selectionText.trim();
    chrome.storage.sync.get("dictionaries", (result) => {
      const dicts = result.dictionaries || DEFAULT_DICTIONARIES;
      openLookup(tab.id, { type: "WORDLENS_OPEN", word, dictionaries: dicts });
    });
  }
});
