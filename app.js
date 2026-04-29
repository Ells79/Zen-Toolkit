const STORAGE_KEY = "fragment-writing-system:v0.1";
const API_SETTINGS_KEY = "fragment-writing-system:deepseek";

const state = {
  fragments: loadFragments(),
  selectedIds: new Set(),
  lastOutput: "",
  pendingTightenIds: [],
};

const elements = {
  todayLabel: document.querySelector("#todayLabel"),
  fragmentInput: document.querySelector("#fragmentInput"),
  saveFragmentBtn: document.querySelector("#saveFragmentBtn"),
  clearInputBtn: document.querySelector("#clearInputBtn"),
  fragmentList: document.querySelector("#fragmentList"),
  tightenBtn: document.querySelector("#tightenBtn"),
  outputView: document.querySelector("#outputView"),
  choiceDialog: document.querySelector("#choiceDialog"),
  choiceInput: document.querySelector("#choiceInput"),
  addChoiceBtn: document.querySelector("#addChoiceBtn"),
  keepAsIsBtn: document.querySelector("#keepAsIsBtn"),
  apiStatus: document.querySelector("#apiStatus"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  modelInput: document.querySelector("#modelInput"),
  baseUrlInput: document.querySelector("#baseUrlInput"),
  saveApiBtn: document.querySelector("#saveApiBtn"),
  clearApiBtn: document.querySelector("#clearApiBtn"),
  fragmentTemplate: document.querySelector("#fragmentTemplate"),
};

init();

function init() {
  elements.todayLabel.textContent = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());

  elements.saveFragmentBtn.addEventListener("click", saveFragment);
  elements.clearInputBtn.addEventListener("click", () => {
    elements.fragmentInput.value = "";
    elements.fragmentInput.focus();
  });
  elements.tightenBtn.addEventListener("click", tightenSelected);
  elements.addChoiceBtn.addEventListener("click", addChoiceAndTighten);
  elements.keepAsIsBtn.addEventListener("click", keepAsIsAndTighten);
  elements.saveApiBtn.addEventListener("click", saveApiSettings);
  elements.clearApiBtn.addEventListener("click", clearApiSettings);
  elements.fragmentInput.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") saveFragment();
  });

  loadApiSettings();
  renderFragments();
  renderOutput("");
}

function loadFragments() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.fragments));
}

function saveFragment() {
  const text = elements.fragmentInput.value.trim();
  if (!text) {
    elements.fragmentInput.focus();
    return;
  }

  const now = new Date().toISOString();
  const decisionText = findChoiceLine(text);
  const fragment = {
    id: createId(),
    time: now,
    content: text,
    text,
    has_decision: Boolean(decisionText),
    decision_text: decisionText,
    mood: "留痕",
    createdAt: now,
    raw_text: text,
  };

  state.fragments.unshift(fragment);
  state.selectedIds.clear();
  state.selectedIds.add(fragment.id);
  elements.fragmentInput.value = "";
  persist();
  renderFragments();
}

function renderFragments() {
  elements.fragmentList.innerHTML = "";

  if (state.fragments.length === 0) {
    elements.fragmentList.innerHTML = `<div class="empty-state"></div>`;
    return;
  }

  state.fragments.forEach((fragment) => {
    const node = elements.fragmentTemplate.content.firstElementChild.cloneNode(true);
    const checkbox = node.querySelector("input");
    const choice = fragment.decision_text || findChoiceLine(fragment.text);
    checkbox.checked = state.selectedIds.has(fragment.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selectedIds.add(fragment.id);
      else state.selectedIds.delete(fragment.id);
    });

    node.querySelector(".fragment-date").textContent = formatRecordDate(fragment.createdAt);
    node.querySelector(".fragment-line").textContent = firstLine(fragment.text);
    node.querySelector(".choice-line").textContent = choice;
    node.querySelector(".choice-line").hidden = !choice;
    elements.fragmentList.appendChild(node);
  });
}

async function tightenSelected() {
  const fragments = getSelectedFragments();
  if (fragments.length === 0) {
    renderOutput("");
    return;
  }

  const missingChoice = fragments.find((fragment) => !(fragment.decision_text || findChoiceLine(fragment.text)));
  if (missingChoice) {
    state.pendingTightenIds = fragments.map((fragment) => fragment.id);
    state.selectedIds.clear();
    state.selectedIds.add(missingChoice.id);
    renderFragments();
    elements.choiceInput.value = "";
    elements.choiceDialog.showModal();
    setTimeout(() => elements.choiceInput.focus(), 50);
    return;
  }

  await tightenFragments(fragments);
}

async function tightenFragments(fragments) {
  if (hasApiSettings()) {
    await tightenWithApi(fragments);
    return;
  }
  const output = buildLocalTightening(fragments);
  state.lastOutput = output;
  renderOutput(output);
}

function getSelectedFragments() {
  const selected = state.fragments.filter((fragment) => state.selectedIds.has(fragment.id));
  return selected.length > 0 ? selected : state.fragments.slice(0, 1);
}

function buildLocalTightening(fragments) {
  const lines = fragments.map((fragment) => {
    const choice = fragment.decision_text || findChoiceLine(fragment.text);
    const tightened = tightenTextLocally(fragment.text);
    return [
      "## 最后一版",
      tightened,
      "",
      "## 保留的选择",
      choice || "这条还没有明显选择。可以补一句：我当时选了什么，或没选什么。",
      "",
      "## 删掉的方向",
      "解释、总结、替读者想、把话说满。",
    ].join("\n");
  });
  return lines.join("\n\n---\n\n");
}

async function tightenWithApi(fragments) {
  setBusy(elements.tightenBtn, "收紧中");
  renderOutput("正在收紧。");
  try {
    const content = await callDeepSeek([
      {
        role: "system",
        content:
          "你是一个删减型私人编辑。必须先交付一版可直接保存的最终文本。只顺句子、删冗余、保留选择。不要只提修改意见，不要解释、不要总结、不要升华、不要替作者判断。输出要短，宁可停住。",
      },
      {
        role: "user",
        content: buildTightenPrompt(fragments),
      },
    ]);
    state.lastOutput = content;
    renderOutput(content);
  } catch (error) {
    renderOutput(`DeepSeek 请求失败：${error.message}\n\n可以检查 API Key，或清除设置先用本地收紧。`);
  } finally {
    clearBusy(elements.tightenBtn, "收紧");
  }
}

function buildTightenPrompt(fragments) {
  return [
    "按“留痕写作”规则收紧下面的记录。",
    "",
    "规则：",
    "- 写下当下，不负责解释",
    "- 只做：删解释、删多余句、保留一个选择",
    "- 不做：判断、总结、解释、拔高、漂亮结尾",
    "- 90% 保真：发生了什么、我当时怎样、停住",
    "- 结尾停在动作、普通话或未完成",
    "",
    "输出格式：",
    "## 最后一版",
    "这里必须写出一版可直接保存的最终文本。不要写建议，不要写分析，不要用项目符号。只输出改好的正文。",
    "## 保留的选择",
    "摘出一句选择；没有就写“没有明显选择”。",
    "## 删掉的方向",
    "列 1-3 个被删掉的东西。",
    "",
    "重要：如果你只给修改意见，没有给“最后一版”正文，就是失败。",
    "",
    "记录：",
    fragments.map((fragment, index) => `${index + 1}. ${fragment.text}`).join("\n"),
  ].join("\n");
}

async function callDeepSeek(messages) {
  const settings = {
    apiKey: elements.apiKeyInput.value.trim(),
    model: elements.modelInput.value.trim() || "deepseek-chat",
    baseUrl: elements.baseUrlInput.value.trim() || "/api/deepseek",
  };
  if (!settings.apiKey) throw new Error("请先填写 DeepSeek API Key。");

  const response = await fetch(settings.baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: 0.25,
      stream: false,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `请求失败：${response.status}`;
    throw new Error(message);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek 没有返回可展示的内容。");
  updateApiStatus(`已启用 · ${settings.model}`);
  return content.trim();
}

function loadApiSettings() {
  const settings = getApiSettings();
  elements.apiKeyInput.value = settings.apiKey;
  elements.modelInput.value = settings.model;
  elements.baseUrlInput.value = settings.baseUrl;
  updateApiStatus();
}

function getApiSettings() {
  const defaults = {
    apiKey: "",
    model: "deepseek-chat",
    baseUrl: "/api/deepseek",
  };
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(API_SETTINGS_KEY)) ?? {}) };
  } catch {
    return defaults;
  }
}

function saveApiSettings() {
  const settings = {
    apiKey: elements.apiKeyInput.value.trim(),
    model: elements.modelInput.value.trim() || "deepseek-chat",
    baseUrl: elements.baseUrlInput.value.trim() || "/api/deepseek",
  };
  localStorage.setItem(API_SETTINGS_KEY, JSON.stringify(settings));
  updateApiStatus("已保存");
}

function clearApiSettings() {
  localStorage.removeItem(API_SETTINGS_KEY);
  elements.apiKeyInput.value = "";
  elements.modelInput.value = "deepseek-chat";
  elements.baseUrlInput.value = "/api/deepseek";
  updateApiStatus("未启用");
}

function hasApiSettings() {
  return Boolean(elements.apiKeyInput.value.trim());
}

function updateApiStatus(message) {
  elements.apiStatus.textContent = message || (hasApiSettings() ? "已启用" : "未启用");
}

async function addChoiceAndTighten() {
  const addition = elements.choiceInput.value.trim();
  const pendingFragments = getPendingTightenFragments();
  const selectedFragment = state.fragments.find((fragment) => state.selectedIds.has(fragment.id));
  if (addition && selectedFragment) {
    selectedFragment.text = `${selectedFragment.text.trim()}\n${addition}`;
    selectedFragment.content = selectedFragment.text;
    selectedFragment.raw_text = selectedFragment.raw_text || selectedFragment.content;
    selectedFragment.decision_text = findChoiceLine(selectedFragment.text);
    selectedFragment.has_decision = Boolean(selectedFragment.decision_text);
    persist();
  }
  elements.choiceDialog.close();
  elements.choiceInput.value = "";
  renderFragments();
  await tightenFragments(pendingFragments.map((fragment) => state.fragments.find((item) => item.id === fragment.id)).filter(Boolean));
}

async function keepAsIsAndTighten() {
  const pendingFragments = getPendingTightenFragments();
  elements.choiceDialog.close();
  elements.choiceInput.value = "";
  await tightenFragments(pendingFragments);
}

function getPendingTightenFragments() {
  const pending = state.fragments.filter((fragment) => state.pendingTightenIds.includes(fragment.id));
  return pending.length > 0 ? pending : getSelectedFragments();
}

function renderOutput(markdown) {
  state.lastOutput = markdown;
  elements.outputView.innerHTML = markdown
    .split("\n")
    .map((line) => {
      if (line.startsWith("## ")) return `<section><h3>${escapeHtml(line.slice(3))}</h3>`;
      if (line === "---") return "</section><hr />";
      if (!line.trim()) return "";
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join("");
}

function findChoiceLine(text) {
  const lines = text
    .split(/\n|。|！|？|；/)
    .map((line) => line.trim())
    .filter(Boolean);
  const pseudoWords = ["我觉得", "我意识到", "我发现", "我认为", "我明白"];
  const choicePatterns = [
    /我.*(还是|决定|选择|没|没有|不再|走开|离开|留下|放弃|改成|换成|停下|开车|下车|说话|沉默)/,
    /(要不要|去不去|说不说|留不留|走不走|开不开)/,
  ];
  return (
    lines.find(
      (line) => !pseudoWords.some((word) => line.includes(word)) && choicePatterns.some((pattern) => pattern.test(line)),
    ) || ""
  );
}

function tightenTextLocally(text) {
  const banned = ["所以", "其实", "我觉得", "这说明", "意义", "本质", "最终", "真正", "也许"];
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !banned.some((word) => line.includes(word)));
  return lines.slice(0, 3).join("\n") || firstLine(text);
}

function firstLine(text) {
  const line = text.split(/\n|。|！|？/).find((item) => item.trim());
  return (line || text).trim().slice(0, 52);
}

function formatRecordDate(iso) {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}${day}`;
}

function setBusy(button, label) {
  button.disabled = true;
  button.dataset.originalText = button.textContent;
  button.textContent = label;
}

function clearBusy(button, fallback) {
  button.disabled = false;
  button.textContent = button.dataset.originalText || fallback;
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `fragment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
