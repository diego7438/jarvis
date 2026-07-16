# JARVIS — Just A Rather Very Intelligent System

> A fully private, local AI coding assistant for VS Code. No cloud. No API calls. No passive monitoring. Everything runs on-device.

## The Problem

Cloud-based AI coding assistants (GitHub Copilot, Gemini Code Assist, etc.) require sending your code to someone else's servers — every keystroke, every file, potentially used to train models you'll never see. As a student about to spend the next four years writing code I actually care about, I didn't want that tradeoff. On top of privacy, cloud AI subscriptions add up fast on a student budget, and I wanted to actually understand how these tools work under the hood instead of treating them as a black box.

JARVIS is my answer: an AI coding assistant that runs **entirely on my MacBook's own hardware** — no internet connection required, no data ever leaves the machine, and nothing runs unless I explicitly ask it to.

## 3 Major Quality-of-Life Improvements

1. **Fully local inference with GPU acceleration** — Runs Meta's Llama 3.1 8B model directly on Apple Silicon via `llama.cpp` compiled with Metal GPU support, hitting ~33 tokens/second on an M2 chip. No internet connection needed, no latency waiting on a remote server, no usage limits or subscription fees.

2. **Explicit-activation only — zero passive monitoring** — Unlike tools that watch your file changes in the background, JARVIS only ever activates when *you* right-click and ask it something. Nothing is read, sent, or processed unless you take a deliberate action. This was a deliberate architecture choice, not an afterthought: privacy by design means the tool has no ability to snoop, because it's never running unless summoned.

3. **A coding assistant that feels like an assistant** — JARVIS is built around a persona (yes, like the Iron Man AI it's named after), making the interaction feel less like querying a black-box tool and more like working alongside something purpose-built to help. Small detail, real impact on how usable and enjoyable the tool feels day to day.

## How It Works Today

1. Highlight code in the VS Code editor
2. Right-click → **"Ask JARVIS"**
3. The selected code is sent to a local `llama-server` instance running on `localhost:8080`
4. Llama 3.1 8B processes it entirely on-device via Metal GPU acceleration
5. The response appears back in the editor/panel — no data ever left your machine

## Architecture

```
~/Developer/jarvis/
├── llama.cpp/          ← inference engine, compiled from source with Metal GPU support (not included in repo — see Setup)
├── models/              ← Llama 3.1 8B Q4_K_M (not included in repo — see Setup)
└── vscode-extension/    ← the actual JARVIS extension (this repo's real content)
    ├── src/
    │   ├── extension.ts     ← command registration, editor integration
    │   └── jarvisPanel.ts   ← chat UI + persona
    └── package.json         ← context menu + command config
```

**Tech stack:** llama.cpp (Metal GPU backend), TypeScript, Node.js, esbuild, VS Code Extension API

## Setup

### 1. Compile llama.cpp with Metal GPU support

```bash
git clone https://github.com/ggml-org/llama.cpp.git
cd llama.cpp
cmake -B build -DGGML_METAL=ON
cmake --build build --config Release -j$(sysctl -n hw.logicalcpu)
```

The `-j$(sysctl -n hw.logicalcpu)` flag parallelizes the build across all your Mac's CPU cores — cuts compile time down to a few minutes on an M-series chip.

### 2. Download the model

Download `Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf` (~4.7GB) from Hugging Face and place it in a `models/` folder. (Not included in this repo — see `.gitignore` — due to file size and Meta's model license.)

### 3. Start the local inference server

```bash
./llama.cpp/build/bin/llama-server -m models/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf --port 8080
```

### 4. Run the VS Code extension

```bash
cd vscode-extension
npm install
npm run compile
```

Then press `F5` in VS Code to launch the Extension Development Host.

## Roadmap

- [x] **Phase 1** — Local inference engine (llama.cpp + Metal GPU)
- [x] **Phase 2** — VS Code extension with right-click "Ask JARVIS" command
- [ ] **Phase 3** — Agent capabilities with human-approval workflows (edit files, run commands, always with explicit user sign-off)
- [ ] **Phase 4** — Python-based orchestration layer + local Whisper voice input, expanding JARVIS into a broader Mac assistant

## Why This Matters (Stardance / Frictionless)

Every developer using cloud AI tools faces an implicit tradeoff they rarely get to opt out of: convenience in exchange for their code leaving their machine. JARVIS removes that tradeoff entirely — full AI coding assistance with zero compromise on privacy, zero recurring cost, and zero reliance on an internet connection. It's a smoother, more trustworthy version of a tool millions of developers already use daily.

## Author

Built by Diego Anderson, incoming freshman, as an independent systems project — see [`/devlog`](./devlog) for the full build process and time log.