<p align="center">
  <img src="asset/studyts-logo.svg" alt="StudyTs logo" width="300" />
</p>

<h3 align="center">Local-first study platform for computer science: canvas lessons, step animations, and an MCP server for AI tools.</h3>

> **StudyTs is still in development.** It is not finished, and you may run into bugs. If you do, please
> [report them](https://github.com/ShacharTs/StudyTs/issues). It helps a lot.

<p align="center">
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-%3E%3D22.12-339933?logo=node.js&logoColor=white" alt="Node.js" /></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React" /></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-stdio-8A2BE2" alt="MCP" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
</p>

<p align="center">
  <img src="asset/screenshots/hd-lobby.png" alt="StudyTs course hub" width="100%" />
</p>

## What it is

StudyTs runs on your computer. A course is split into weeks and topics. Each topic is a canvas page you can read and edit. Some lectures are step animations. The app also runs an MCP server, so AI tools can create and edit courses directly. Your courses, notes, and database stay in local files.

## Easy PDF export

Open a course and click **Export course as PDF**. The app builds a print sheet: cover, week dividers, and one page per topic. Your browser's print dialog opens, and you choose **Save as PDF**.

<p align="center">
  <img src="asset/screenshots/pdf-export.gif" alt="PDF export: cover, week divider, topic pages" width="60%" />
</p>

## Step player

The step player animates objects over steps. The GIF below is built by hand in the UI:

1. **Insert** → **Box**.
2. Select the box → **Animate** → **Fill**.
3. **+** adds step 2. Drag the box to a new position.
4. Select the box → **Animate** → **Glow**.
5. **Play step**.

<p align="center">
  <img src="asset/screenshots/step-player-manual.gif" alt="Step player: manual build and playback" width="80%" />
</p>

## MCP vs manual

The same course can be built two ways. Left: a lecture generated through the MCP `save_animated_lecture` tool (Anime.js course, 9 animated steps, each with a title and a reason). Right: a topic built by hand in the canvas editor (C++ basics).

<p align="center">
  <img src="asset/screenshots/mcp-vs-manual.gif" alt="MCP-built Anime.js lecture next to a manual C++ canvas topic" width="100%" />
</p>

## Install

There are two ways to run StudyTs. Pick one.

| | Way 1: Installer | Way 2: Run from a folder |
| --- | --- | --- |
| Best for | Most people. Works like any other app. | Developers, or a quick try on a PC you do not want to install on. |
| Needs | Nothing. No Node.js, Git or terminal. | Node.js 22.12 or newer (`run.bat` installs it for you on Windows). |
| Start | Desktop shortcut or app menu | `run.bat`, `./studyts`, or `npm start` |
| Updates | Built in (see [Updates](#updates)) | Built in when started with `run.bat` or `npm start` |
| Remove | Uninstall like any app | Delete the folder |

### Way 1: Installer

Download the installer for your system from the [latest release](https://github.com/ShacharTs/StudyTs/releases/latest).

| System | File to download |
| --- | --- |
| Windows 10 or 11 | `StudyTs-Setup-<version>-x64.exe` (or `StudyTs-Portable-<version>-x64.exe`, no install) |
| macOS, Apple Silicon (M1 or newer) | `StudyTs-<version>-mac-arm64.dmg` |
| macOS, Intel | `StudyTs-<version>-mac-x64.dmg` |
| Linux | `StudyTs-<version>-linux-x86_64.AppImage`, or the `.deb` for Debian and Ubuntu |

The app is not code-signed yet (a signing certificate costs money), so each system asks you to confirm once. The steps below show how.

#### Windows

1. Download `StudyTs-Setup-<version>-x64.exe`.
2. Double-click it. If Windows shows a blue **Windows protected your PC** screen, click **More info**, then **Run anyway**.
3. The installer needs no administrator rights. It installs for your user only, adds a desktop shortcut and a Start menu entry, and starts StudyTs.
4. Open StudyTs from the shortcut at any time.

The **Portable** exe runs without installing. Put it anywhere, double-click it, and use the same **More info**, **Run anyway** step. It does not update itself. This is the easiest way to try StudyTs on a PC temporarily: delete the exe when you are done. Your courses stay in `%APPDATA%\StudyTs` until you delete that folder too.

To remove the installed app, open **Settings, Apps**, find StudyTs and click **Uninstall**. Your courses stay in `%APPDATA%\StudyTs`.

#### macOS

1. Check your chip: Apple menu, **About This Mac**. **Apple M1, M2, M3 or newer** needs the `arm64` file. **Intel** needs the `x64` file.
2. Open the `.dmg` and drag **StudyTs** into **Applications**.
3. The first time, do not double-click. Right-click (or Control-click) **StudyTs** in Applications, choose **Open**, then **Open** again.
4. If macOS says the app is **damaged** or cannot be opened, open Terminal and run this once, then try step 3 again:

   ```bash
   xattr -dr com.apple.quarantine /Applications/StudyTs.app
   ```

To remove the app, drag it from Applications to the Bin. Your courses stay in `~/Library/Application Support/StudyTs`.

#### Linux

**AppImage** (works on most distributions):

```bash
chmod +x StudyTs-*-linux-x86_64.AppImage
./StudyTs-*-linux-x86_64.AppImage
```

On Ubuntu 22.04 and newer the AppImage needs FUSE 2: `sudo apt install libfuse2`. You can also double-click the file after allowing it to run as a program in your file manager.

**Debian and Ubuntu package:**

```bash
sudo apt install ./StudyTs-*-linux.deb
```

Then start **StudyTs** from your application menu. To remove it: `sudo apt remove studyts`.

Your courses live in `~/.local/share/studyts` (or `$XDG_DATA_HOME/studyts`).

### Way 2: Run from a folder (run.bat or commands)

Download the code once: [Download ZIP](https://github.com/ShacharTs/StudyTs/archive/refs/heads/main.zip) and unzip it, or use Git:

```bash
git clone https://github.com/ShacharTs/StudyTs.git
cd StudyTs
```

Then start it:

| System | Command |
| --- | --- |
| Windows | Double-click **`run.bat`**. It installs Node.js 22 with winget if it is missing, installs the packages, sets up the database, builds the app, starts it and opens your browser. |
| macOS and Linux | `./studyts` in a terminal. Install [Node.js](https://nodejs.org) 22.12 or newer first. |
| Any system, step by step | `npm install`, then `npm run setup`, then `npm start` |

The app opens at `http://127.0.0.1:7301`. Stop it with `npm stop`, or close the terminal window.

The first start takes a few minutes while it installs and builds. Later starts are faster.

**Your data stays in the folder.** Courses are in `data/`, API keys in `.secrets/`, and the database in `prisma/studyts.db`. Nothing is installed on the PC except Node.js, so deleting the folder removes StudyTs. Set `STUDYTS_HOME` to keep the data somewhere else.

### First start

The window (or browser tab) opens after a few seconds while the app prepares its database. A fresh install has no courses: create one with **Edit, Add course**, or use **Import archive**.

### Updates

| How you run it | How it updates |
| --- | --- |
| Windows installer, Linux AppImage | The app checks for new versions, shows a banner, and **Update and restart** installs it. Your data is kept. |
| macOS, Windows portable, Linux `.deb` | The app shows a banner with **Download update**. Download the new file from the releases page and install it over the old one. Your data is kept. |
| Folder (`run.bat`, `./studyts`, `npm start`) | The banner's **Update and restart** downloads the new version into the folder and restarts. With a Git clone you can also run `git pull`. |

If a release was published without its update files, the installed app still shows the banner, with a link to download the new version by hand.

Updates never touch your data: the installer only replaces the program folder, and your courses live in the data folder below. Uninstalling also keeps the data folder.

Use **Settings, Updates, Check for updates** to check at any time. If a check fails, the reason is shown there. The installed app also writes it to `updater.log` in the logs folder.

### Where your data is

| How you run it | Folder |
| --- | --- |
| Installer on Windows | `%APPDATA%\StudyTs` |
| Installer on macOS | `~/Library/Application Support/StudyTs` |
| Installer on Linux | `~/.local/share/studyts` |
| Folder (`run.bat` and others) | The StudyTs folder itself |

It holds your courses (`data/`), the database, saved API keys (`.secrets/`) and logs (`.logs/`). Back up that folder to back up everything.

### Troubleshooting

- **The window does not open.** Look at `.logs` in the data folder above. The newest `run-*.log` file shows what failed.
- **A course disappears after you create it.** Update to 0.9.5 or newer. Older builds could drop a new course on the next automatic reload.
- **Port 7301 is busy.** Close the other StudyTs window. The installed app picks another free port by itself.
- **Update check failed.** Open **Settings, Updates**. It shows the reason, for example no internet or no installer files on the latest release.

## Connect an AI app (MCP)

StudyTs includes an MCP server named `studyts`. Any app that supports MCP servers can use it to create and edit your courses: Claude Desktop, Claude Code, Codex, Cursor, Windsurf, Gemini CLI, Cline and others. The server runs on your computer and starts when the AI app starts it. Nothing is sent to anyone else.

How you connect depends on how you run StudyTs. The easiest way works for both: open StudyTs, then **Settings, MCP**.

### The easy way (both ways of running)

1. In **Connect an AI app**, click **Add to** and the name of your AI app (Claude Desktop, Cursor, Windsurf or Gemini CLI).
2. Read the file it will change, then click **Confirm**. Your other settings in that file are kept, and a backup is saved next to it as `<file>.studyts.bak`.
3. Restart the AI app. Ask it to list your StudyTs courses to check the connection.

**Claude Code** has its own row. It shows **Connected globally**, **Not registered**, or **Claude Code not found**. **Connect to Claude Code** registers `studyts` for your user (`claude mcp add --scope user`), so it works in every folder; **Disconnect** removes it. Claude Code loads servers when a session starts, so open a new `claude` session afterwards and run `/mcp` (or `claude mcp list` in a terminal) to check.

The panel fills in the right paths for your computer. **Copy standard config** copies the JSON that most MCP apps accept. In the installed app, **Open MCP server folder** shows the server script those paths point at. If your app is not in the list, open **Another app, or set it up by hand** in the same panel. It shows copy-ready text: the standard MCP config (JSON), a Codex config (`~/.codex/config.toml`), and the `codex` and `claude` commands.

### If you run StudyTs with run.bat or commands

You have the source folder, so there are two more options.

**Claude Code, in the StudyTs folder.** The folder contains a `.mcp.json` file. Open a terminal in the StudyTs folder and start `claude`. It offers to enable the `studyts-mcp` server. Approve it, and run `/mcp` to check that it is connected. This needs no setup beyond `npm install` (which `run.bat` already did).

**Any other app, with a path.** Build once (`npm run build`, which `run.bat` does on every start), then point your app at the built server. Replace the folder with the real location of StudyTs:

```json
{
  "mcpServers": {
    "studyts": {
      "command": "node",
      "args": ["C:\\StudyTs\\dist-server\\mcp\\servers\\studyTsServer.mjs"],
      "env": {
        "STUDYTS_HOME": "C:\\StudyTs",
        "DATABASE_URL": "file:C:/StudyTs/prisma/studyts.db"
      }
    }
  }
}
```

On macOS and Linux use forward slashes, for example `/home/you/StudyTs/dist-server/mcp/servers/studyTsServer.mjs`.

### If you use the installer

The installed app has no separate Node.js, so it starts the server with its own program and one extra setting, `ELECTRON_RUN_AS_NODE`. The easy way above writes this for you. To write it by hand, you need two paths: the StudyTs program, and the server script inside it.

On Windows, with `<you>` replaced by your user name:

```json
{
  "mcpServers": {
    "studyts": {
      "command": "C:\\Users\\<you>\\AppData\\Local\\Programs\\studyts\\StudyTs.exe",
      "args": ["C:\\Users\\<you>\\AppData\\Local\\Programs\\studyts\\resources\\app\\dist-server\\mcp\\servers\\studyTsServer.mjs"],
      "env": {
        "ELECTRON_RUN_AS_NODE": "1",
        "STUDYTS_HOME": "C:\\Users\\<you>\\AppData\\Roaming\\StudyTs",
        "DATABASE_URL": "file:C:/Users/<you>/AppData/Roaming/StudyTs/studyts.db"
      }
    }
  }
}
```

On macOS and Linux the program and script are inside the app, and the data folder is the one in [Where your data is](#where-your-data-is). The paths differ by install type, so copy them from the **Connect an AI app** panel instead of typing them.

If you reinstall the app in a different place, or move it, open the panel again and re-copy the config, because the paths change. **Open MCP server folder** in the same panel shows where the script is now.

### Tools the AI gets

- `list_courses`, `list_lectures`, `create_course`
- `save_lecture_content`, `save_animated_lecture`, `add_lecture_to_course_list`, `add_network_diagram_to_lecture`
- `show_database_tables`, `read_course_database` (read-only `SELECT`)
- `save_note_to_notebook`, `search_notebook_notes`, `list_notebooks`

## How it works

StudyTs has two parts. The **website** you see in the browser, and a small **local server** on your computer that stores courses and talks to AI providers. Nothing leaves your machine except the AI requests you send.

| Part | What it does | Built with |
| --- | --- | --- |
| Website | Course hub, canvas editor, step player, PDF export | React 18, TypeScript, Vite |
| Local server | Saves courses, runs the MCP server, encrypts API keys | Express, Prisma, SQLite |
| Canvas and animation | Shapes, text, equations, step animations | Custom canvas, anime.js, Framer Motion, KaTeX |
| AI assistant | Chat and canvas edits with your own API key | Anthropic, OpenAI, Gemini, DeepSeek, xAI, Mistral, Groq, Cohere, Meta, Perplexity |
| Languages | English and Hebrew (Hebrew is right-to-left) | Locale files in `locales/` |

The npm package is built from the sources with esbuild, so you don't need TypeScript on your machine to run it.

### MCP server

StudyTs bundles one MCP server, `studyts`. See [Connect an AI app (MCP)](#connect-an-ai-app-mcp) above for setup and the list of tools.

### Development

```bash
npm run dev         # hot reload on :7300, API on :7301
npm run typecheck
npm run build
```

## Support

<p align="center">
  <a href="https://www.buymeacoffee.com/ShacharTs"><img src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=ShacharTs&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" alt="Buy me a coffee" /></a>
</p>

## Credits

StudyTs is built on open-source work:

- [anime.js](https://animejs.com) by Julian Garnier: transitions and keyframe animation.
- [KaTeX](https://katex.org): LaTeX math rendering.
- [React](https://react.dev) and [Vite](https://vitejs.dev): UI and bundling.
- [Prisma](https://www.prisma.io): SQLite schema and database access.
- [Lucide](https://lucide.dev): interface icons.
- [Model Context Protocol](https://modelcontextprotocol.io) by Anthropic: the open protocol behind the MCP server.

## License

MIT. See [LICENSE](LICENSE).
