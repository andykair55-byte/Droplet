# 网络盾牌 (Cyber Shield)

> 一款保护你免受网络骚扰的用户脚本，跨平台适用。

[**English**](README.en.md) | [**中文**](README.zh.md)

网络盾牌是一款浏览器用户脚本（兼容 Tampermonkey、Greasemonkey 等），能够实时检测、过滤和屏蔽网络骚扰内容。内置 **29 种语言** 支持，结合规则匹配与 AI 驱动检测，守护你的浏览安全。

---

## 功能特性

- **多语言支持** — 29 种精心编排的语言包
- **AI 检测** — 基于大语言模型的上下文分析，减少误判
- **实时拦截** — 注入任意网页，即时拦截辱骂内容
- **证据收集** — 自动保存骚扰事件证据
- **自适应学习** — 通过规则学习器适应新模式
- **零运行时依赖** — 轻量、快速、尊重隐私

---

## 项目架构

```
cyber-shield-monorepo/
├── packages/
│   ├── core/          # 检测引擎 — 扫描器、检测器、拦截器、规则管理器、国际化、事件系统
│   └── user/          # 用户脚本入口 — UI 组件 & AI 集成层
├── rules/             # 29 种语言骚扰规则 JSON 文件
├── scripts/           # 构建脚本（基于 Rollup）
├── docs/              # 设计文档、架构方案、产品路线图
└── rollup.config.js   # Rollup 打包配置
```

### 核心包

**`packages/core`** — 网络盾牌的核心引擎：

| 模块 | 说明 |
|------|------|
| `scanner.js` | 扫描页面 DOM 检测辱骂内容 |
| `detector.js` | 多策略骚扰检测 |
| `blocker.js` | 内容拦截引擎 |
| `rule-manager.js` / `rule-learner.js` | 规则生命周期与自适应学习 |
| `events.js` / `evidence.js` | 事件系统与证据存储 |
| `context-rule.js` / `context-window.js` | 上下文感知分析 |
| `i18n.js` | 国际化 |
| `text-normalizer.js` | 文本预处理 |
| `topic-filter.js` | 话题级别过滤 |
| `platforms/` | 平台适配器 |
| `store/` | 持久化存储层 |

**`packages/user`** — 在浏览器中运行的用户脚本包：

| 模块 | 说明 |
|------|------|
| `index.user.js` | 入口 + 元数据声明 |
| `ui/` | 用户界面组件 |
| `ai/` | AI 骚扰分析 |

### 语言规则

`rules/` 目录包含 29 个 JSON 文件，每个文件包含经过文化和语言精心整理的骚扰模式：

`ar` `cs` `da` `de` `en` `eo` `es` `fa` `fi` `fil` `fr` `fr-CA` `hi` `hu` `it` `ja` `kab` `ko` `nl` `no` `pl` `pt` `ru` `sv` `th` `tlh` `tr` `zh` + `default-blacklist.json`

---

## 安装

### 前置要求

- 用户脚本管理器：[Tampermonkey](https://www.tampermonkey.net/)（推荐）或 [Greasemonkey](https://www.greasespot.net/)
- [Node.js](https://nodejs.org/) >= 18（开发构建用）

### 快速安装

1. 在浏览器中安装用户脚本管理器
2. 打开最新发布的 `index.user.js` 原始文件
3. 脚本管理器会自动提示安装

### 从源码构建

```bash
# 安装依赖
npm install

# 构建用户脚本
npm run build

# 开发模式（监听文件变化）
npm run dev
```

构建产物输出到 `dist/` 目录。

### 构建命令

| 命令 | 说明 |
|------|------|
| `npm run build` | 构建生产版 |
| `npm run build:user` | 同 build |
| `npm run build:dev` | 构建开发版 |
| `npm run build:dev:watch` | 开发版 + 文件监听 |
| `npm run build:all` | 同时构建生产版和开发版 |
| `npm run dev` | 开发模式（监听） |

---

## 许可证

MIT

## 贡献

欢迎贡献！欢迎提交 Issue 或 Pull Request。
