const STORAGE_KEY = "fragment-writing-system:v0.2";
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
if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
saveFragment();
}
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
elements.fragmentList.innerHTML =
`<div class="empty-state"></div>`;

```
return;
```

}

state.fragments.forEach((fragment) => {
const node =
elements.fragmentTemplate.content.firstElementChild.cloneNode(true);

```
const checkbox = node.querySelector("input");

const choice =
  fragment.decision_text || findChoiceLine(fragment.text);

checkbox.checked =
  state.selectedIds.has(fragment.id);

checkbox.addEventListener("change", () => {
  if (checkbox.checked) {
    state.selectedIds.add(fragment.id);
  } else {
    state.selectedIds.delete(fragment.id);
  }
});

node.querySelector(".fragment-date").textContent =
  formatRecordDate(fragment.createdAt);

node.querySelector(".fragment-line").textContent =
  firstLine(fragment.text);

node.querySelector(".choice-line").textContent =
  choice;

node.querySelector(".choice-line").hidden =
  !choice;

elements.fragmentList.appendChild(node);
```

});
}

async function tightenSelected() {
const fragments = getSelectedFragments();

if (fragments.length === 0) {
renderOutput("");
return;
}

const missingChoice = fragments.find(
(fragment) =>
!(fragment.decision_text || findChoiceLine(fragment.text))
);

if (missingChoice) {
state.pendingTightenIds =
fragments.map((fragment) => fragment.id);

```
state.selectedIds.clear();

state.selectedIds.add(missingChoice.id);

renderFragments();

elements.choiceInput.value = "";

elements.choiceDialog.showModal();

setTimeout(() => elements.choiceInput.focus(), 50);

return;
```

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
const selected = state.fragments.filter((fragment) =>
state.selectedIds.has(fragment.id)
);

return selected.length > 0
? selected
: state.fragments.slice(0, 1);
}

async function tightenWithApi(fragments) {
setBusy(elements.tightenBtn, "收紧中");

renderOutput("正在收紧。");

try {
const content = await callDeepSeek([
{
role: "system",
content:
"你是一个删减型私人编辑。只顺句子、删冗余、保留真实感。不要解释，不要总结，不要升华。",
},
{
role: "user",
content: buildTightenPrompt(fragments),
},
]);

```
state.lastOutput = content;

renderOutput(content);
```

} catch (error) {
console.error(error);

```
renderOutput(
  `DeepSeek 请求失败：${error.message}`
);
```

} finally {
clearBusy(elements.tightenBtn, "收紧");
}
}

function buildTightenPrompt(fragments) {
return [
"按“留痕写作”规则收紧下面内容。",
"",
"规则：",
"- 删解释",
"- 删总结",
"- 保留动作",
"- 保留停顿",
"- 不拔高",
"",
"记录：",
fragments
.map((fragment) => fragment.text)
.join("\n\n"),
].join("\n");
}

async function callDeepSeek(messages) {
const apiKey =
elements.apiKeyInput.value.trim();

if (!apiKey) {
throw new Error("请填写 API Key");
}

const response = await fetch("/api/deepseek", {
method: "POST",

```
headers: {
  "Content-Type": "application/json",
  Authorization: `Bearer ${apiKey}`,
},

body: JSON.stringify({
  model: "deepseek-chat",
  messages,
  temperature: 0.25,
  stream: false,
}),
```

});

const payload =
await response.json().catch(() => ({}));

console.log("DeepSeek payload:", payload);

if (!response.ok) {
const message =
payload?.error?.message ||
payload?.message ||
JSON.stringify(payload) ||
`请求失败：${response.status}`;

```
throw new Error(message);
```

}

const content =
payload?.choices?.[0]?.message?.content ||
payload?.data?.choices?.[0]?.message?.content;

if (!content) {
throw new Error(
JSON.stringify(payload)
);
}

updateApiStatus("已启用");

return content.trim();
}

function loadApiSettings() {
const settings = getApiSettings();

elements.apiKeyInput.value =
settings.apiKey;

updateApiStatus();
}

function getApiSettings() {
try {
return (
JSON.parse(
localStorage.getItem(API_SETTINGS_KEY)
) ?? {
apiKey: "",
}
);
} catch {
return {
apiKey: "",
};
}
}

function saveApiSettings() {
const settings = {
apiKey:
elements.apiKeyInput.value.trim(),
};

localStorage.setItem(
API_SETTINGS_KEY,
JSON.stringify(settings)
);

updateApiStatus("已保存");
}

function clearApiSettings() {
localStorage.removeItem(API_SETTINGS_KEY);

elements.apiKeyInput.value = "";

updateApiStatus("未启用");
}

function hasApiSettings() {
return Boolean(
elements.apiKeyInput.value.trim()
);
}

function updateApiStatus(message) {
elements.apiStatus.textContent =
message ||
(hasApiSettings()
? "已启用"
: "未启用");
}

async function addChoiceAndTighten() {
const addition =
elements.choiceInput.value.trim();

const pendingFragments =
getPendingTightenFragments();

const selectedFragment =
state.fragments.find((fragment) =>
state.selectedIds.has(fragment.id)
);

if (addition && selectedFragment) {
selectedFragment.text =
`${selectedFragment.text.trim()}\n${addition}`;

```
selectedFragment.decision_text =
  findChoiceLine(selectedFragment.text);

persist();
```

}

elements.choiceDialog.close();

elements.choiceInput.value = "";

renderFragments();

await tightenFragments(
pendingFragments
);
}

async function keepAsIsAndTighten() {
const pendingFragments =
getPendingTightenFragments();

elements.choiceDialog.close();

elements.choiceInput.value = "";

await tightenFragments(
pendingFragments
);
}

function getPendingTightenFragments() {
const pending =
state.fragments.filter((fragment) =>
state.pendingTightenIds.includes(
fragment.id
)
);

return pending.length > 0
? pending
: getSelectedFragments();
}

function renderOutput(markdown) {
state.lastOutput = markdown;

elements.outputView.innerHTML =
markdown
.split("\n")
.map((line) => {
if (line.startsWith("## ")) {
return `<section><h3>${escapeHtml(
            line.slice(3)
          )}</h3>`;
}

```
    if (line === "---") {
      return "</section><hr />";
    }

    if (!line.trim()) {
      return "";
    }

    return `<p>${escapeHtml(line)}</p>`;
  })
  .join("");
```

}

function findChoiceLine(text) {
const lines = text
.split(/\n|。|！|？|；/)
.map((line) => line.trim())
.filter(Boolean);

const choicePatterns = [
/我.*(还是|决定|选择|没|没有|离开|留下|放弃|停下|沉默)/,
];

return (
lines.find((line) =>
choicePatterns.some((pattern) =>
pattern.test(line)
)
) || ""
);
}

function tightenTextLocally(text) {
return text
.split(/\n+/)
.slice(0, 3)
.join("\n");
}

function firstLine(text) {
const line = text
.split(/\n|。|！|？/)
.find((item) => item.trim());

return (line || text)
.trim()
.slice(0, 52);
}

function formatRecordDate(iso) {
const date = new Date(iso);

const month = String(
date.getMonth() + 1
).padStart(2, "0");

const day = String(
date.getDate()
).padStart(2, "0");

return `${month}${day}`;
}

function setBusy(button, label) {
button.disabled = true;

button.dataset.originalText =
button.textContent;

button.textContent = label;
}

function clearBusy(button, fallback) {
button.disabled = false;

button.textContent =
button.dataset.originalText ||
fallback;
}

function createId() {
if (crypto.randomUUID) {
return crypto.randomUUID();
}

return `fragment-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function escapeHtml(value) {
return String(value)
.replaceAll("&", "&")
.replaceAll("<", "<")
.replaceAll(">", ">")
.replaceAll('"', """)
.replaceAll("'", "'");
}
