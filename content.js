let lastNotificationAt = 0;
const NOTIFICATION_COOLDOWN_MS = 5000;
const SCAN_DEBOUNCE_MS = 500;
const SCAN_INTERVAL_MS = 5000;
let scanTimeout = null;

const HIGHLIGHT_CLASS = "exention-highlight";
const STYLE_ID = "exention-highlight-style";

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const shouldScanPage = async () => {
  const { targetUrl } = await chrome.storage.local.get(["targetUrl"]);
  if (!targetUrl) {
    return false;
  }
  return window.location.href.includes(targetUrl);
};

const getWords = async () => {
  const { words } = await chrome.storage.local.get(["words"]);
  if (!Array.isArray(words)) {
    return [];
  }
  return words
    .map((word) => word.trim())
    .filter((word) => word.length > 0);
};

const highlightMatches = (regex) => {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (!node.nodeValue || !node.nodeValue.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        const parent = node.parentElement;
        if (!parent) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.closest(`.${HIGHLIGHT_CLASS}`)) {
          return NodeFilter.FILTER_REJECT;
        }
        const tagName = parent.tagName.toLowerCase();
        if (["script", "style", "noscript", "textarea", "input"].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let matchesFound = false;

  const nodesToProcess = [];
  while (walker.nextNode()) {
    nodesToProcess.push(walker.currentNode);
  }

  nodesToProcess.forEach((textNode) => {
    const text = textNode.nodeValue;
    if (!regex.test(text)) {
      return;
    }
    regex.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      matchesFound = true;
      const matchText = match[0];
      const start = match.index;
      if (start > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
      }
      const mark = document.createElement("span");
      mark.className = HIGHLIGHT_CLASS;
      mark.textContent = matchText;
      fragment.appendChild(mark);
      lastIndex = start + matchText.length;
    }
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    textNode.parentNode.replaceChild(fragment, textNode);
  });

  return matchesFound;
};

const playNotification = () => {
  const now = Date.now();
  if (now - lastNotificationAt < NOTIFICATION_COOLDOWN_MS) {
    return;
  }
  lastNotificationAt = now;

  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);

    oscillator.onended = () => {
      audioContext.close();
    };
  } catch (error) {
    console.warn("Audio notification failed", error);
  }
};

const runScan = async () => {
  if (!(await shouldScanPage())) {
    return;
  }

  const words = await getWords();
  if (words.length === 0) {
    return;
  }

  const pattern = words.map(escapeRegExp).join("|");
  const regex = new RegExp(pattern, "gi");

  const found = highlightMatches(regex);
  if (found) {
    playNotification();
  }
};

const scheduleScan = () => {
  if (scanTimeout) {
    clearTimeout(scanTimeout);
  }
  scanTimeout = setTimeout(runScan, SCAN_DEBOUNCE_MS);
};

const initObserver = () => {
  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
};

const init = () => {
  if (!document.body) {
    window.addEventListener("DOMContentLoaded", init, { once: true });
    return;
  }

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${HIGHLIGHT_CLASS} {
        background: #ffeb3b;
        color: #000;
        padding: 0 2px;
        border-radius: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  initObserver();
  scheduleScan();
  setInterval(runScan, SCAN_INTERVAL_MS);
};

init();
