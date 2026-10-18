<div align="center">

<img src="asset/studyts-logo.svg" alt="StudyTS Logo" width="360" />

<br/><br/>

**Interactive Computer Science Study & Visual Canvas Platform**

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.12.0-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![Model Context Protocol](https://img.shields.io/badge/MCP-Enabled-8A2BE2)](https://modelcontextprotocol.io)
[![Bilingual](https://img.shields.io/badge/i18n-English%20%7C%20Hebrew%20(RTL)-008080)](src/i18n/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<p align="center">
  A local-first, interactive learning platform for computer science courses (Algorithms, Complexity, Automata, Computability, Networking). Combines interactive algorithmic canvases, a Mario-Maker style visual step builder, an extensible Model Context Protocol (MCP) AI assistant, and full bilingual (Hebrew/English RTL) support.
</p>

[Screenshots & Demos](#screenshots--demos) •
[AI & MCP Capabilities](#ai-assistant--mcp-superpowers) •
[Features](#features) •
[Quick Start](#quick-start) •
[User Guide](#user-guide) •
[Support Me](#support-me) •
[License](#license--acknowledgements)

---

</div>

## Screenshots & Demos

### Overview Demo
<div align="center">
  <img src="docs/images/demo-overview.gif" alt="StudyTS Walkthrough Demo" width="100%" />
  <p><em>Interactive algorithmic animations, step-by-step state machines, and real-time AI canvas mutations.</em></p>
</div>

<br/>

| Course Hub & Catalog | Visual Canvas Editor |
|:---:|:---:|
| <img src="docs/images/screenshot-lobby.png" alt="Course Hub & Catalog" width="100%" /> | <img src="docs/images/screenshot-canvas.png" alt="Canvas Visual Editor" width="100%" /> |
| *Browse structured weekly lectures, topics, and interactive materials.* | *Full-featured vector canvas with snap guides, shapes, formulas, and layers.* |

| Visual Step Player & Builder | AI Assistant & MCP Tools |
|:---:|:---:|
| <img src="docs/images/screenshot-step-player.png" alt="Step Player & Visual Builder" width="100%" /> | <img src="docs/images/screenshot-ai-mcp.png" alt="AI Assistant and MCP Integration" width="100%" /> |
| *Mario-Maker style step authoring with keyframes, tweens, and timeline.* | *Chat assistant with direct LLM APIs and bundled MCP tool supervisor.* |

| Bilingual Hebrew / English (RTL & LTR) | System Overview |
|:---:|:---:|
| <img src="docs/images/screenshot-bilingual-rtl.png" alt="Bilingual RTL Support" width="100%" /> | <img src="docs/images/graphify-overview.png" alt="Knowledge Graph Architecture Overview" width="100%" /> |
| *Complete UI mirroring, localized typography, and KaTeX math formulas.* | *Modular architecture organized into decoupled domain and visualization engines.* |

---

## AI Assistant & MCP Superpowers

StudyTS features a local-first AI assistant built to understand CS curricula and interact directly with your open canvas scenes:

- **Multi-Provider LLM Integration**: Direct connection with Anthropic (Claude 3.5 Sonnet / Opus / Haiku), OpenAI (GPT-4o, o1, o3-mini), Google Gemini (Gemini 2.0 Flash / Pro), DeepSeek, xAI (Grok), Groq, Mistral, Cohere, Perplexity, or local OmniRoute proxies.
- **Model Context Protocol (MCP) Hub**: Ships with bundled stdio MCP servers managed locally:
  - `course-author`: Programmatically creates courses, lectures, network topologies, and animated step specs.
  - `sqlite-course-db`: Read-only, schema-validated database inspection and querying.
  - `notebook-bridge`: Extracts research snippets and syncs study notes.
- **Granular Canvas Mutations (`apply_scene_ops`)**: The AI modifies diagrams in place with atomic micro-operations (inserting nodes, moving geometries, updating formulas, tidying layouts, and creating slide decks) without destructive full-scene rewrites.
- **Local & Private**: All chat sessions and SQLite data stay on your machine. API keys reside in your browser localStorage or local `.env`.

---

## Features

- **Academic Course Catalog**: Authored interactive curricula for Algorithms, Complexity Theory, Automata & Formal Languages, Computability, and Computer Networking in `data/`.
- **Specialized CS Visualization Engines**:
  - **Graph Theory**: Graph traversal canvases supporting BFS/DFS vertex coloring, bipartite matchings, shortest paths, and topological layouts.
  - **Turing Machines**: Animated multi-tape simulations, head tape pointers, and state transition matrices.
  - **Reduction Chains**: Interactive polynomial-time reduction pipelines ($3\text{-SAT} \to \text{Independent Set} \to \text{Vertex Cover}$).
  - **Linear Programming**: 2D/3D simplex geometric polytope search, constraint boundaries, and duality cards.
  - **Mathematical Formulas**: KaTeX mathematical typography rendered inside diagrams, shapes, and formulas.
- **Visual Step Player (`/visual-steps`)**:
  - Mario-Maker style vector authoring with snapping, ports, and connector lines.
  - Property tween animations (opacity, translations, dash offsets, durations) with interactive timeline scrubber.
  - One-click publishing directly into course lectures.
- **Native Bilingualism (Hebrew / English)**: Instant one-click toggle with complete RTL layout mirroring, localized typography, and bilingual dictionaries.
- **Zero-Cloud & Privacy First**: SQLite local storage (`studyts.db`), backend bound strictly to `127.0.0.1`.

---

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org) >= `22.12.0` (LTS recommended)
- [Git](https://git-scm.com)

### One-Click Launch

- **Windows**: Double-click `run.bat`
  *(Checks Node.js, installs LTS automatically via winget if needed, sets up the database, builds, and opens the app).*
- **macOS / Linux**:
  ```bash
  ./studyts
  ```

> **WARNING: THIS PROJECT IS STILL IN DEV.**

---

### Terminal Setup

```bash
# 1. Clone repository
git clone https://github.com/ShacharTs/StudyTs.git
cd StudyTs

# 2. Install dependencies & initialize SQLite
npm install
npm run setup

# 3. Start StudyTS (all three run the same server)
npm start        # any OS
./studyts        # macOS/Linux, also opens the QA browser
studyts          # Windows, also opens the QA browser
```

- **App (UI + API, one port)**: [http://localhost:7301](http://localhost:7301)
  If 7301 is busy, the app uses 7302–7304 and the launchers find it.

> To stop the application at any time, press **`Ctrl + C`** in your terminal.

**Developers only:** `npm run dev` runs Vite with hot reload on [http://localhost:7300](http://localhost:7300) plus the API on 7301. Do not use it for normal runs.

---

## User Guide

- 🎓 **Explore Topics**: Choose a course from the Lobby (Algorithms, Complexity, Automata, Networking) to open interactive lessons.
- ⏯️ **Step & Experiment**: Step forward and backward through algorithm transitions, drag vertices, test Turing machines, or scrub the timeline.
- 🎨 **Draw & Author**: Open the canvas editor to place shapes, connect ports, write LaTeX formulas, and export visual slides.
- 🤖 **Chat with AI**: Ask the assistant to explain tough proofs, suggest exercise hints, or build new diagram layouts live on your canvas.
- 🌐 **One-Click Bilingual**: Tap the language button in the top bar to mirror the full interface between English and Hebrew (RTL).

---

## Support Me

If you find StudyTS helpful for your studies, teaching, or research, please consider supporting the project:

<div align="center">

<a href="https://www.buymeacoffee.com/ShacharTs"><img src="https://img.buymeacoffee.com/button-api/?text=Support me&emoji=❤️&slug=ShacharTs&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>

<br/><br/>

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor%20on%20GitHub-EA4AAA?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sponsors)

⭐ **Star this repository** to show your support!

</div>

---

## License & Acknowledgements

- **License**: Released under the **[MIT License](LICENSE)**.
- **Open-Source Credits**:
  - [anime.js](https://animejs.com) by Julian Garnier for fluid visual transitions and keyframe animations.
  - [KaTeX](https://katex.org) for fast LaTeX mathematical typography.
  - [React](https://react.dev) & [Vite](https://vitejs.dev) for frontend UI rendering and bundling.
  - [Prisma](https://www.prisma.io) for local SQLite schema and database management.
  - [Lucide](https://lucide.dev) for interface iconography.
  - [Model Context Protocol](https://modelcontextprotocol.io) by Anthropic for open agentic tool integration.
  - [Mermaid](https://mermaid.js.org) for declarative diagrams.
