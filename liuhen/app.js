function bind(element, event, handler) {
if (element) {
element.addEventListener(event, handler);
}
}

const STORAGE_KEY = "fragment-writing-system:v0.3";
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
if (elements.todayLabel) {
elements.todayLabel.textContent =
new Intl.DateTimeFormat("zh-CN", {
year: "numeric",
month: "long",
day: "numeric",
weekday: "long",
}).format(new Date());
}

bind(
elements.saveFragmentBtn,
"click",
saveFragment
);

bind(
elements.clearInputBtn,
"click",
() => {
elements.fragmentInput.value = "";
elements.fragmentInput.focus();
}
);

bind(
elements.tightenBtn,
"click",
tightenSelected
);

bind(
elements.addChoiceBtn,
"click",
addChoiceAndTighten
);

bind(
elements.keepAsIsBtn,
"click",
keepAsIsAndTighten
);

bind(
elements.saveApiBtn,
"click",
saveApiSettings
);

bind(
elements.clearApiBtn,
"click",
clearApiSettings
);

bind(
elements.fragmentInput,
"keydown",
(event) => {
if (
(event.metaKey || event.ctrlKey) &&
event.key === "Enter"
) {
saveFragment();
}
}
);

loadApiSettings();

renderFragments();

renderOutput("");
}

function loadFragments() {
try {
return (
JSON.parse(
localStorage.getItem(STORAGE_KEY)
) ?? []
);
} catch {
return [];
}
}

function persist() {
localStorage.setItem(
STORAGE_KEY,
JSON.stringify(state.fragments)
);
}

function saveFragment() {
const text =
elements.fragmentInput.value.trim();

if (!text) {
elements.fragmentInput.focus();
return;
}

const now = new Date().toISOString();

const fragment = {
id: createId(),
text,
createdAt: now,
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
return;
}

state.fragments.forEach((fragment) => {
const node =
elements.fragmentTemplate.content.firstElementChild.cloneNode(true);

```
const checkbox =
  node.querySelector("input");

checkbox.checked =
  state.selectedIds.has(fragment.id);

checkbox.addEventListener(
  "change",
  () => {
    if (checkbox.checked) {
      state.selectedIds.add(fragment.id);
    } else {
      state.selectedIds.delete(fragment.id);
    }
  }
);

node.querySelector(
  ".fragment-date"
).textContent =
  formatRecordDate(fragment.createdAt);

node.querySelector(
  ".fragment-line"
).textContent =
  firstLine(fragment.text);

elements.fragmentList.appendChild(node);
```

});
}

async function tightenSelected() {
const fragments =
getSelectedFragments();

if (fragments.length === 0) {
return;
}

await tightenFragments(fragments);
}

async function tightenFragments(
fragments
) {
if (hasApiSettings()) {
await tightenWithApi(fragments);
return;
}

const output =
buildLocalTightening(fragments);

renderOutput(output);
}

function getSelectedFragments() {
const selected =
state.fragments.filter((fragment) =>
state.selectedIds.has(fragment.id)
);

return selected.length > 0
? selected
: state.fragments.slice(0, 1);
}

function buildLocalTightening(
fragments
) {
return fragments
.map((fragment) =>
fragment.text
.split("\n")
.slice(0, 3)
.join("\n")
)
.join("\n\n");
}

async function tightenWithApi(
fragments
) {
setBusy(
elements.tightenBtn,
"收紧中"
);

renderOutput("正在收紧。");

try {
const content =
await callDeepSeek([
{
role: "system",
content:
"你是一个删减型私人编辑。只顺句子、删冗余、保留真实感。不要解释，不要总结，不要升华。",
},
{
role: "user",
content:
buildTightenPrompt(
fragments
),
},
]);

```
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
clearBusy(
elements.tightenBtn,
"收紧"
);
}
}

function buildTightenPrompt(
fragments
) {
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
.map(
(fragment) => fragment.text
)
.join("\n\n"),
].join("\n");
}

async function callDeepSeek(messages) {
const apiKey =
elements.apiKeyInput.value.trim();

if (!apiKey) {
throw new Error("请填写 API Key");
}

const response = await fetch(
"/api/deepseek",
{
method: "POST",

```
  headers: {
    "Content-Type":
      "application/json",

    Authorization: `Bearer ${apiKey}`,
  },

  body: JSON.stringify({
    model: "deepseek-chat",
    messages,
    temperature: 0.25,
    stream: false,
  }),
}
```

);

const payload =
await response.json();

console.log(
"DeepSeek payload:",
payload
);

if (!response.ok) {
throw new Error(
payload?.error?.message ||
"请求失败"
);
}

const content =
payload?.choices?.[0]?.message
?.content;

if (!content) {
throw new Error(
"模型没有返回内容"
);
}

updateApiStatus("已启用");

return content.trim();
}

function loadApiSettings() {
const settings =
getApiSettings();

elements.apiKeyInput.value =
settings.apiKey || "";

updateApiStatus();
}

function getApiSettings() {
try {
return (
JSON.parse(
localStorage.getItem(
API_SETTINGS_KEY
)
) ?? {}
);
} catch {
return {};
}
}

function saveApiSettings() {
localStorage.setItem(
API_SETTINGS_KEY,
JSON.stringify({
apiKey:
elements.apiKeyInput.value.trim(),
})
);

updateApiStatus("已保存");
}

function clearApiSettings() {
localStorage.removeItem(
API_SETTINGS_KEY
);

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

async function addChoiceAndTighten() {}

async function keepAsIsAndTighten() {}

function renderOutput(markdown) {
elements.outputView.innerHTML =
markdown
.split("\n")
.map((line) => {
if (!line.trim()) {
return "";
}

```
    return `<p>${escapeHtml(
      line
    )}</p>`;
  })
  .join("");
```

}

function firstLine(text) {
return (
text
.split(/\n|。|！|？/)
.find((line) => line.trim()) ||
text
)
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
