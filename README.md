<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/droplet-38bdf8?style=for-the-badge&logo=drop&logoColor=white">
    <img alt="Droplet" src="https://img.shields.io/badge/droplet-0284c7?style=for-the-badge&logo=drop&logoColor=white">
  </picture>
</p>

<h1 align="center">Droplet / 网络盾牌</h1>

<p align="center">
  <b>A userscript that protects you from online harassment — across any platform.</b><br>
  一款保护你免受网络骚扰的用户脚本，跨平台适用。
</p>

<p align="center">
  <a href="README.en.md"><img src="https://img.shields.io/badge/lang-English-blue?style=flat-square" alt="English"></a>
  <a href="README.zh.md"><img src="https://img.shields.io/badge/lang-简体中文-red?style=flat-square" alt="简体中文"></a>
  <a href="#"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT"></a>
  <a href="#"><img src="https://img.shields.io/badge/platform-Tampermonkey%20%7C%20Greasemonkey-lightgrey?style=flat-square" alt="Platform"></a>
</p>

---

## ✨ Overview

Droplet detects, filters, and blocks online harassment in real time. It supports **29 languages** and combines pattern-based detection with AI-driven analysis to keep you safe while browsing — all running client-side with zero external dependencies.

- **29 language packs** — Culturally curated harassment patterns
- **AI-powered analysis** — LLM-based context detection
- **Real-time blocking** — Injects into any web page
- **Evidence collection** — Automatic proof of harassment events  
- **Self-learning rules** — Adapts to new abusive patterns over time
- **Privacy-first** — Everything runs locally in your browser

---

## 📖 Documentation

| Language | Link |
|----------|------|
| 🇬🇧 English | [README.en.md](README.en.md) |
| 🇨🇳 简体中文 | [README.zh.md](README.zh.md) |

## 📦 Quick Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser
2. Open the raw `index.user.js` from the latest release — your script manager will prompt you to install

## 🛠 Build from Source

```bash
npm install
npm run build
```

Output goes to `dist/`. See the language-specific READMEs for detailed build commands.

## 📄 License

[MIT](LICENSE)
