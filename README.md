# Ash Notes

A Figma plugin that converts raw UX interview notes into a formatted slide deck in **Figma Slides**. Paste your notes, fill in a title and metadata, and the plugin generates a styled cover slide and content slides where your text flows automatically across as many pages as needed.

---

## Installation

### Prerequisites

You need **Node.js** installed on your computer. If you're not sure whether you have it, open Terminal (Mac) or Command Prompt (Windows) and type:

```
node -v
```

If you see a version number (like `v18.17.0`), you're good. If you see an error, download and install Node.js from [https://nodejs.org](https://nodejs.org) — choose the **LTS** version and follow the installer.

### Step 1 — Download the project

Go to the GitHub page for this project and click the green **Code** button, then click **Download ZIP**.

Unzip the downloaded file. You should now have a folder called `Slide-Notes` (or `Slide-Notes-main`) somewhere on your computer. Remember where it is — you'll need the path in the next step.

### Step 2 — Build the plugin

Open **Terminal** (Mac) or **Command Prompt** (Windows). You need to navigate into the `Ash-Notes` folder inside the project you just unzipped.

**On Mac**, type `cd` followed by a space, then drag the `Ash-Notes` folder from Finder directly into the Terminal window — it will paste the path for you. Press Enter.

**On Windows**, open the `Ash-Notes` folder in File Explorer, click the address bar at the top, copy the path, then type `cd` followed by a space, paste the path, and press Enter.

You should now be inside the `Ash-Notes` folder. Run these two commands one at a time (type each one, press Enter, and wait for it to finish before running the next):

```
npm install
```

This downloads the project's dependencies. It may take a minute and will print a lot of text — that's normal. Wait until you see a new blank prompt line.

```
npm run build
```

This compiles the plugin. If it finishes without printing any errors, you're ready for the next step.

### Step 3 — Add the plugin to Figma

1. Open [Figma](https://www.figma.com) in your browser (or the desktop app) and open any **Slides** file — or create a new one.
2. In the toolbar, go to **Plugins → Development → Import plugin from manifest…**
3. A file picker will open. Navigate to the `Ash-Notes` folder inside the project you downloaded, select the file called **`manifest.json`**, and click Open.

That's it — the plugin is now installed.

### Step 4 — Run the plugin

In any Figma Slides file, go to **Plugins → Development → Ash-Notes** to launch it.

---

## Usage

1. Open the plugin from **Plugins → Development → Ash-Notes** in a Figma Slides file.
2. Fill in the cover slide details — title, author, date, and topic tags.
3. Paste your interview notes into the text area, or drag in a `.md` / `.txt` file.
4. Click **Generate Slides**. The plugin creates a formatted cover slide and distributes your notes across content slides automatically.

**Tips:**
- The **Today** button auto-fills the current date (it's also pre-filled when you open the plugin).
- The **Auto** button next to the title field generates a title from the first meaningful line of your notes.
- Press **⌘ Enter** (Mac) or **Ctrl Enter** (Windows) as a shortcut to generate slides.
- The slide count estimate updates live as you type or paste notes.

---

## For developers

All commands run from the `Ash-Notes/` directory:

| Command | What it does |
|---|---|
| `npm run build` | Compile the plugin (run this after making changes) |
| `npm run watch` | Auto-recompile on every file save (useful during development) |
| `npm run lint` | Check code for style issues |
| `npm run lint:fix` | Auto-fix style issues |

### Project structure

```
Slide-Notes/
├── README.md
├── CLAUDE.md                # AI assistant project guide
└── Ash-Notes/               # Plugin source
    ├── manifest.json         # Figma plugin manifest
    ├── package.json          # Scripts and dev dependencies
    ├── tsconfig.json         # TypeScript config
    ├── code.ts               # Plugin logic (compiles to code.js)
    └── ui.html               # Plugin UI
```
