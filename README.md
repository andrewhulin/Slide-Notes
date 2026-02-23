# Ash Notes

A Figma plugin that converts raw UX interview notes into a formatted slide deck in Figma Slides. Paste your notes, fill in a title and metadata, and the plugin generates a cover slide with topic pills, title, and author line, followed by content slides where your text flows automatically across as many slides as needed.

In other Figma editors (Design, FigJam, Buzz) it provides a simple shape creator utility.

## Install locally

1. Clone or download this repo.
2. Install dependencies and build:
   ```sh
   cd Ash-Notes
   npm install
   npm run build
   ```
3. In Figma, open a Slides file, then go to **Plugins → Development → Import plugin from manifest…** and select `Ash-Notes/manifest.json`.
4. Run the plugin from **Plugins → Development → Ash-Notes**.

During development, use `npm run watch` in the `Ash-Notes/` directory to recompile on every save.

## Usage

1. Open a Figma Slides file and run the plugin.
2. Fill in the cover slide fields — title, author, date, and topic tags.
3. Paste your interview notes into the text area (or drag in a `.md` / `.txt` file).
4. Click **Generate Slides**. The plugin creates a formatted cover slide and distributes your notes across content slides automatically.

## Project structure

```
Slide-Notes/
├── README.md
├── CLAUDE.md              # AI assistant project guide
└── Ash-Notes/             # Plugin source
    ├── manifest.json       # Figma plugin manifest
    ├── package.json        # Scripts and dev dependencies
    ├── tsconfig.json       # TypeScript config
    ├── code.ts             # Plugin logic (compiles to code.js)
    └── ui.html             # Plugin UI
```
