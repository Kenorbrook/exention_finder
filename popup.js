const wordInput = document.getElementById("word-input");
const addWordButton = document.getElementById("add-word");
const wordList = document.getElementById("word-list");
const status = document.getElementById("status");
const importFile = document.getElementById("import-file");
const importButton = document.getElementById("import-words");
const exportButton = document.getElementById("export-words");
const targetUrlInput = document.getElementById("target-url");
const useCurrentButton = document.getElementById("use-current");
const highlightColorInput = document.getElementById("highlight-color");

const setStatus = (message) => {
  status.textContent = message;
  if (message) {
    setTimeout(() => {
      status.textContent = "";
    }, 3000);
  }
};

const loadState = async () => {
  const data = await chrome.storage.local.get(["words", "targetUrl", "highlightColor"]);
  const words = Array.isArray(data.words) ? data.words : [];
  renderWords(words);
  targetUrlInput.value = data.targetUrl || "";
  highlightColorInput.value = data.highlightColor || "#ffeb3b";
};

const saveWords = async (words) => {
  await chrome.storage.local.set({ words });
  renderWords(words);
};

const renderWords = (words) => {
  wordList.innerHTML = "";
  if (words.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "Список пуст";
    wordList.appendChild(empty);
    return;
  }
  words.forEach((word) => {
    const item = document.createElement("li");
    item.className = "word-item";
    const label = document.createElement("span");
    label.textContent = word;
    const removeButton = document.createElement("button");
    removeButton.textContent = "Удалить";
    removeButton.addEventListener("click", async () => {
      const next = words.filter((entry) => entry !== word);
      await saveWords(next);
      setStatus("Слово удалено");
    });
    item.appendChild(label);
    item.appendChild(removeButton);
    wordList.appendChild(item);
  });
};

addWordButton.addEventListener("click", async () => {
  const value = wordInput.value.trim();
  if (!value) {
    return;
  }
  const data = await chrome.storage.local.get(["words"]);
  const words = Array.isArray(data.words) ? data.words : [];
  if (words.includes(value)) {
    setStatus("Слово уже есть в списке");
    return;
  }
  words.push(value);
  await saveWords(words);
  wordInput.value = "";
  setStatus("Слово добавлено");
});

wordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addWordButton.click();
  }
});

importFile.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  const text = await file.text();
  let imported = [];
  if (file.name.endsWith(".json")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        imported = parsed;
      }
    } catch (error) {
      setStatus("Не удалось прочитать JSON");
      return;
    }
  } else {
    imported = text.split(/\r?\n/);
  }

  const normalized = imported
    .map((word) => String(word).trim())
    .filter((word) => word.length > 0);
  if (normalized.length === 0) {
    setStatus("Файл не содержит слов");
    return;
  }
  const unique = Array.from(new Set(normalized));
  await saveWords(unique);
  setStatus("Слова импортированы");
  importFile.value = "";
});

importButton.addEventListener("click", () => {
  importFile.click();
});

exportButton.addEventListener("click", async () => {
  const data = await chrome.storage.local.get(["words"]);
  const words = Array.isArray(data.words) ? data.words : [];
  const blob = new Blob([JSON.stringify(words, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "words.json";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("Экспорт готов");
});

useCurrentButton.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    setStatus("Не удалось получить URL");
    return;
  }
  const url = new URL(tab.url);
  const value = `${url.host}${url.pathname}`.replace(/\/$/, "");
  targetUrlInput.value = value;
  await chrome.storage.local.set({ targetUrl: value });
  setStatus("URL сохранен");
});

targetUrlInput.addEventListener("change", async () => {
  const value = targetUrlInput.value.trim();
  await chrome.storage.local.set({ targetUrl: value });
  setStatus("URL сохранен");
});

highlightColorInput.addEventListener("change", async () => {
  const value = highlightColorInput.value;
  await chrome.storage.local.set({ highlightColor: value });
  setStatus("Цвет подсветки сохранен");
});

loadState();
