chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["words", "targetUrl"], (data) => {
    const next = {};
    if (!Array.isArray(data.words)) {
      next.words = [];
    }
    if (typeof data.targetUrl !== "string") {
      next.targetUrl = "";
    }
    if (Object.keys(next).length > 0) {
      chrome.storage.local.set(next);
    }
  });
});
