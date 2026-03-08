chrome.storage.sync.get("dictionaries", (r) => {
  const dicts = r.dictionaries || [];
  const pills = document.getElementById("pills");
});

document.getElementById("settings-btn").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("pages/settings.html") });
});