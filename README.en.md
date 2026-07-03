# Droplet

> A userscript that protects you from online harassment — across any platform.

[**中文**](README.zh.md) | [**English**](README.en.md)

Droplet is a browser userscript (compatible with Tampermonkey, Greasemonkey, etc.) that detects, filters, and blocks online harassment in real time. It supports **29 languages** out of the box and uses both pattern-based and AI-driven detection to keep you safe while browsing.

---

## Features

- **Multi-language support** — 29 curated language packs
- **AI-powered detection** — LLM-based context analysis to reduce false positives
- **Real-time blocking** — Injects into any webpage and intercepts abusive content
- **Evidence collection** — Automatically saves proof of harassment events
- **Self-learning rules** — Adapts to new patterns via the rule learner
- **Zero external dependency at runtime** — Lightweight, fast, and privacy-respecting

---

## Architecture

```
cyber-shield-monorepo/
├── packages/
│   ├── core/          # Detection engine — scanner, detector, blocker, rule manager, i18n, event system
│   └── user/          # Userscript entry point — UI components & AI integration layer
├── rules/             # 29 language-specific harassment pattern JSON files
├── scripts/           # Build scripts (Rollup-based)
├── docs/              # Design docs, architecture plans, product roadmap
└── rollup.config.js   # Rollup bundler configuration
```

### Packages

**`packages/core`** — The heart of Droplet:

| Module | Description |
|--------|-------------|
| `scanner.js` | Scans page DOM for abusive content |
| `detector.js` | Multi-strategy harassment detection |
| `blocker.js` | Content blocking engine |
| `rule-manager.js` / `rule-learner.js` | Rule lifecycle & adaptive learning |
| `events.js` / `evidence.js` | Event system & evidence storage |
| `context-rule.js` / `context-window.js` | Context-aware analysis |
| `i18n.js` | Internationalization |
| `text-normalizer.js` | Text preprocessing |
| `topic-filter.js` | Topic-level filtering |
| `platforms/` | Platform-specific adapters |
| `store/` | Persistent storage layer |

**`packages/user`** — The userscript bundle that runs in the browser:

| Module | Description |
|--------|-------------|
| `index.user.js` | Entry point with metadata block |
| `ui/` | User interface components |
| `ai/` | AI-powered harassment analysis |

### Pattern Rules

The `rules/` directory contains 29 JSON files, each with culturally and linguistically curated harassment patterns:

`ar` `cs` `da` `de` `en` `eo` `es` `fa` `fi` `fil` `fr` `fr-CA` `hi` `hu` `it` `ja` `kab` `ko` `nl` `no` `pl` `pt` `ru` `sv` `th` `tlh` `tr` `zh` + `default-blacklist.json`

---

## Installation

### Prerequisites

- A userscript manager: [Tampermonkey](https://www.tampermonkey.net/) (recommended) or [Greasemonkey](https://www.greasespot.net/)
- [Node.js](https://nodejs.org/) >= 18 (for development/building)

### Quick Install

1. Install a userscript manager in your browser
2. Open the raw `index.user.js` from the latest release
3. Your userscript manager will prompt you to install

### Build from Source

```bash
# Install dependencies
npm install

# Build the userscript
npm run build

# Development mode with watch
npm run dev
```

The built userscript will be output to the `dist/` directory.

### Build Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build production userscript |
| `npm run build:user` | Same as build |
| `npm run build:dev` | Build development version |
| `npm run build:dev:watch` | Dev build with file watching |
| `npm run build:all` | Build both user and dev versions |
| `npm run dev` | Dev build with watch (alias) |

---

## License

MIT

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.
