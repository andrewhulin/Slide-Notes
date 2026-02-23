# Ash Notes

A Figma plugin that turns raw UX interview notes into a formatted slide deck. Paste your notes, add a title and details, and the plugin builds a styled cover slide and content slides automatically.

---

## Installation (2 steps, no coding required)

### 1. Download

Click the green **Code** button at the top of this page, then click **Download ZIP**. Unzip it anywhere on your computer.

### 2. Add to Figma

1. Open [figma.com](https://www.figma.com) and open any **Slides** file (or create a new one).
2. In the menu bar, go to **Plugins → Development → Import plugin from manifest…**
3. In the file picker that appears, navigate into the folder you unzipped, then into the **Ash-Notes** folder, select **manifest.json**, and click **Open**.

Done. The plugin is installed.

To run it, go to **Plugins → Development → Ash-Notes** from any Figma Slides file.

---

## How to use

1. Run the plugin from **Plugins → Development → Ash-Notes**.
2. Fill in the cover details — title, author, date, and topic tags.
3. Paste your interview notes into the text area (or drag in a `.md` / `.txt` file).
4. Click **Generate Slides**.

**Shortcuts and tips:**
- **Auto** button next to the title field generates a title from the first line of your notes.
- **Today** button fills in the current date (also pre-filled on launch).
- **⌘ Enter** (Mac) or **Ctrl Enter** (Windows) to generate without clicking the button.
- A live slide count updates as you type.

---

## For developers

If you're making changes to the plugin source code, you'll need [Node.js](https://nodejs.org) installed.

From the `Ash-Notes/` folder, run:

```sh
npm install        # first time only — downloads dependencies
npm run watch      # auto-recompiles on every save
```

Other commands: `npm run build` (one-time compile), `npm run lint` (check code style), `npm run lint:fix` (auto-fix).

### Project structure

```
Slide-Notes/
├── README.md
├── CLAUDE.md                # AI assistant project guide
└── Ash-Notes/               # Plugin source
    ├── manifest.json         # Figma plugin manifest
    ├── package.json          # Scripts and dev dependencies
    ├── tsconfig.json         # TypeScript config
    ├── code.ts               # Plugin logic (source)
    ├── code.js               # Plugin logic (compiled — ready to use)
    └── ui.html               # Plugin UI
```
