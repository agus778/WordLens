chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "WORDLENS_PLAY_AUDIO_OFFSCREEN") {
    new Audio(msg.url).play().catch(() => {});
  }
});