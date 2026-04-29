# 留痕系统 v5

一个不会打断你的记录环境。

## 当前原则

- 写的时候，不被打断
- 判断在写完之后出现
- 所有提示都是延迟的

## 页面结构

- 输入区：唯一主界面
- 今日记录：只显示日期、最多两行内容、选择句
- 收紧区：只保留一个按钮

## 选择痕迹

如果点击收紧时没有明显选择，系统会问：

- 补一句
- 就这样

平时不提前提示，不显示判断。

## DeepSeek

DeepSeek 设置藏在“高级设置”里。

推荐用本地服务打开：

```text
node server.js
```

然后访问：

```text
http://127.0.0.1:8787
```

接口地址保持：

```text
/api/deepseek
```

不填 API Key 时，会使用本地收紧规则。

## 部署到 GitHub Pages

这个版本可以作为纯前端部署到 GitHub Pages。部署后，手机可以直接访问网址，并添加到主屏幕。

步骤：

1. 把这些文件放进 GitHub 仓库：
   - `index.html`
   - `styles.css`
   - `app.js`
   - `manifest.webmanifest`
   - `sw.js`
   - `icon.svg`
   - `README.md`
2. 打开 GitHub 仓库页面
3. 进入 `Settings`
4. 找到 `Pages`
5. Source 选择 `Deploy from a branch`
6. Branch 选择 `main`，目录选择 `/root`
7. 保存

几分钟后，GitHub 会生成一个网址。

## iPhone 使用

1. 用 Safari 打开 GitHub Pages 网址
2. 点底部分享按钮
3. 选择“添加到主屏幕”
4. 之后就可以像 App 一样打开

注意：GitHub Pages 只能安全使用本地收紧规则。真实 DeepSeek API 更适合后续放到后端服务里。

## 数据结构

新记录会保存：

```text
id
time
content
has_decision
decision_text
raw_text
```
