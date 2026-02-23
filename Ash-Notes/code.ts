// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// ---- Types for notes-to-slides feature ----

interface ParsedNotes {
  title: string;           // Cover slide main title
  author: string;          // Cover: "Interviewed by X"
  date: string;            // Cover: date string (e.g. "February 20, 2026")
  topicTags: string[];     // Cover: pill tags (e.g. ["Social","Personas"])
  contentTitle: string;    // Content slide heading (e.g. "9:45am, 2.20.26")
  contentSubtitle: string; // Content slide subtitle
  bodyLines: string[];     // Raw text lines for content slides
}

interface ThemeFonts {
  headingFont: FontName;
  bodyFont: FontName;
}

type PluginMessage =
  | { type: 'init'; editorType: string }
  | { type: 'create-shapes'; count: number }
  | { type: 'create-notes-slides'; data: ParsedNotes }
  | { type: 'cancel' };

// ---- Helpers for theme extraction ----

function findTextNodes(node: SceneNode): TextNode[] {
  if (node.type === 'TEXT') return [node];
  if ('children' in node) {
    const result: TextNode[] = [];
    for (const child of (node as FrameNode).children) {
      for (const t of findTextNodes(child as SceneNode)) {
        result.push(t);
      }
    }
    return result;
  }
  return [];
}

function extractFontsFromDeck(): ThemeFonts {
  const DEFAULT: ThemeFonts = {
    headingFont: { family: 'Inter', style: 'Bold' },
    bodyFont: { family: 'Inter', style: 'Regular' },
  };

  try {
    const grid = figma.getSlideGrid();
    for (const row of grid) {
      for (const slide of row) {
        if (slide.children.length === 0) continue;

        const textNodes: TextNode[] = [];
        for (const child of slide.children) {
          for (const t of findTextNodes(child as SceneNode)) {
            textNodes.push(t);
          }
        }
        if (textNodes.length === 0) continue;

        const sorted = [...textNodes].sort(
          (a, b) =>
            (typeof b.fontSize === 'number' ? b.fontSize : 0) -
            (typeof a.fontSize === 'number' ? a.fontSize : 0)
        );

        const headingNode = sorted[0];
        const bodyNode = sorted[sorted.length - 1];

        const headingFont: FontName =
          headingNode.fontName !== figma.mixed
            ? (headingNode.fontName as FontName)
            : DEFAULT.headingFont;

        const bodyFont: FontName =
          bodyNode.fontName !== figma.mixed
            ? (bodyNode.fontName as FontName)
            : DEFAULT.bodyFont;

        return { headingFont, bodyFont };
      }
    }
  } catch (_e) {
    // Fall through to defaults
  }

  return DEFAULT;
}


// ---- Helpers for slide creation ----

function addText(
  parent: SlideNode,
  content: string,
  opts: {
    x: number; y: number; w: number;
    size: number;
    font: FontName;
    color: RGB;
    autoResize?: 'HEIGHT' | 'WIDTH_AND_HEIGHT' | 'NONE';
    lineHeight?: { value: number; unit: 'PERCENT' | 'PIXELS' };
  }
): TextNode {
  const t = figma.createText();
  t.fontName = opts.font;
  t.characters = content;
  t.fontSize = opts.size;
  if (opts.lineHeight) t.lineHeight = opts.lineHeight;
  t.fills = [{ type: 'SOLID', color: opts.color }];
  t.x = opts.x;
  t.y = opts.y;
  t.resize(opts.w, t.height);
  t.textAutoResize = opts.autoResize ?? 'HEIGHT';
  parent.appendChild(t);
  return t;
}

/**
 * Split an array of body lines into page-sized chunks based on
 * character count (for line wrapping) and max lines per slide.
 */
function splitBodyIntoSlideChunks(
  lines: string[],
  charsPerLine: number,
  firstMaxLines: number,
  contMaxLines: number
): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let lineCount = 0;
  let isFirst = true;

  for (const line of lines) {
    const wrappedCount = Math.max(1, Math.ceil((line.length || 1) / charsPerLine));
    const maxLines = isFirst ? firstMaxLines : contMaxLines;

    if (lineCount + wrappedCount > maxLines && current.length > 0) {
      chunks.push(current);
      current = [];
      lineCount = 0;
      isFirst = false;
    }
    current.push(line);
    lineCount += wrappedCount;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks.length > 0 ? chunks : [[]];
}

/**
 * Try to load an italic variant of a font. Returns the italic FontName
 * on success, or falls back to the provided font if no italic exists.
 */
async function loadItalicVariant(baseFont: FontName): Promise<FontName> {
  const candidates = ['Italic', 'Regular Italic', 'Light Italic', 'Book Italic'];
  for (const style of candidates) {
    const f: FontName = { family: baseFont.family, style };
    try {
      await figma.loadFontAsync(f);
      return f;
    } catch (_e) {
      // try next
    }
  }
  return baseFont;
}

// ---- Editor branches ----

// Runs this code if the plugin is run in Figma
if (figma.editorType === 'figma') {
  figma.showUI(__html__);
  figma.ui.postMessage({ type: 'init', editorType: 'figma' });

  figma.ui.onmessage = (msg: PluginMessage) => {
    if (msg.type === 'create-shapes') {
      const numberOfRectangles = msg.count;
      const nodes: SceneNode[] = [];
      for (let i = 0; i < numberOfRectangles; i++) {
        const rect = figma.createRectangle();
        rect.x = i * 150;
        rect.fills = [{ type: 'SOLID', color: { r: 1, g: 0.5, b: 0 } }];
        figma.currentPage.appendChild(rect);
        nodes.push(rect);
      }
      figma.currentPage.selection = nodes;
      figma.viewport.scrollAndZoomIntoView(nodes);
    }
    figma.closePlugin();
  };
}

// Runs this code if the plugin is run in FigJam
if (figma.editorType === 'figjam') {
  figma.showUI(__html__);
  figma.ui.postMessage({ type: 'init', editorType: 'figjam' });

  figma.ui.onmessage = (msg: PluginMessage) => {
    if (msg.type === 'create-shapes') {
      const numberOfShapes = msg.count;
      const nodes: SceneNode[] = [];
      for (let i = 0; i < numberOfShapes; i++) {
        const shape = figma.createShapeWithText();
        shape.shapeType = 'ROUNDED_RECTANGLE';
        shape.x = i * (shape.width + 200);
        shape.fills = [{ type: 'SOLID', color: { r: 1, g: 0.5, b: 0 } }];
        figma.currentPage.appendChild(shape);
        nodes.push(shape);
      }

      for (let i = 0; i < numberOfShapes - 1; i++) {
        const connector = figma.createConnector();
        connector.strokeWeight = 8;
        connector.connectorStart = {
          endpointNodeId: nodes[i].id,
          magnet: 'AUTO',
        };
        connector.connectorEnd = {
          endpointNodeId: nodes[i + 1].id,
          magnet: 'AUTO',
        };
      }

      figma.currentPage.selection = nodes;
      figma.viewport.scrollAndZoomIntoView(nodes);
    }
    figma.closePlugin();
  };
}

// Runs this code if the plugin is run in Slides
if (figma.editorType === 'slides') {
  figma.showUI(__html__, { width: 520, height: 720, title: 'Notes to Slides' });
  figma.ui.postMessage({ type: 'init', editorType: 'slides' });

  figma.ui.onmessage = async (msg: PluginMessage) => {
    if (msg.type === 'cancel') {
      figma.closePlugin();
      return;
    }

    if (msg.type === 'create-notes-slides') {
      const parsed: ParsedNotes = msg.data;

      // ---- Hardcoded slide layout constants ----
      const SLIDE_W = 1920;
      const _SLIDE_H = 1080;
      const TEXT_X = 140;
      const TEXT_Y = 140;
      const TEXT_W = 1640;
      const TEXT_H = 800;
      const BG_COLOR: RGB = { r: 246 / 255, g: 240 / 255, b: 222 / 255 }; // #F6F0DE
      const HEADING_COLOR: RGB = { r: 0.1, g: 0.1, b: 0.1 };
      const BODY_COLOR: RGB = { r: 0.2, g: 0.2, b: 0.2 };

      // Content slide text flow constants
      const BODY_SIZE = 26;
      const BODY_LINE_H = 42;  // 26px × 160% ≈ 42px
      const CHARS_PER_LINE = 84;
      const MAX_LINES = Math.floor(TEXT_H / BODY_LINE_H); // 800 / 42 = 19

      // Pill styling (hardcoded for light background)
      const PILL_BG: RGB = { r: 0.15, g: 0.12, b: 0.08 };
      const PILL_BG_OPACITY = 0.55;
      const PILL_TEXT_COLOR: RGB = { r: 1, g: 0.97, b: 0.92 };

      // ---- Font loading ----
      const fonts = extractFontsFromDeck();
      const fontsToLoad: FontName[] = [fonts.headingFont];
      if (
        fonts.bodyFont.family !== fonts.headingFont.family ||
        fonts.bodyFont.style !== fonts.headingFont.style
      ) {
        fontsToLoad.push(fonts.bodyFont);
      }
      await Promise.all(fontsToLoad.map(f => figma.loadFontAsync(f)));

      const italicFont = await loadItalicVariant(fonts.bodyFont);

      const allSlides: SlideNode[] = [];

      // ==== COVER SLIDE ====
      const coverSlide = figma.createSlide();
      coverSlide.fills = [{ type: 'SOLID', color: BG_COLOR }];
      allSlides.push(coverSlide);

      // -- Cover: topic tag pills (right-aligned row near top) --
      if (parsed.topicTags.length > 0) {
        const PILL_FONT_SIZE = 18;
        const PILL_PAD_X = 24;
        const PILL_PAD_Y = 12;
        const PILL_RADIUS = 24;
        const PILL_GAP = 16;
        const PILL_Y = 100;

        const pillInfos: { frame: FrameNode; w: number }[] = [];
        for (const tag of parsed.topicTags) {
          const textNode = figma.createText();
          textNode.fontName = fonts.bodyFont;
          textNode.characters = tag.toUpperCase();
          textNode.fontSize = PILL_FONT_SIZE;
          textNode.fills = [{ type: 'SOLID', color: PILL_TEXT_COLOR }];
          textNode.textAutoResize = 'WIDTH_AND_HEIGHT';

          const pillW = textNode.width + PILL_PAD_X * 2;
          const pillH = textNode.height + PILL_PAD_Y * 2;

          const frame = figma.createFrame();
          frame.resize(pillW, pillH);
          frame.cornerRadius = PILL_RADIUS;
          frame.fills = [{ type: 'SOLID', color: PILL_BG, opacity: PILL_BG_OPACITY }];
          frame.clipsContent = false;

          textNode.x = PILL_PAD_X;
          textNode.y = PILL_PAD_Y;
          frame.appendChild(textNode);

          pillInfos.push({ frame, w: pillW });
        }

        // Position pills right-aligned
        const totalPillW = pillInfos.reduce((s, p) => s + p.w, 0)
          + (pillInfos.length - 1) * PILL_GAP;
        let pillX = SLIDE_W - 160 - totalPillW;

        for (const pill of pillInfos) {
          pill.frame.x = pillX;
          pill.frame.y = PILL_Y;
          coverSlide.appendChild(pill.frame);
          pillX += pill.w + PILL_GAP;
        }
      }

      // Cover layout: text positioned in the right portion of the slide
      const COVER_X = 540;
      const COVER_W = SLIDE_W - COVER_X - 160;

      // -- Cover: date --
      if (parsed.date) {
        addText(coverSlide, parsed.date.toUpperCase(), {
          x: COVER_X, y: 440, w: COVER_W,
          size: 20, font: fonts.bodyFont, color: BODY_COLOR,
          autoResize: 'HEIGHT',
        });
      }

      // -- Cover: title --
      let coverTitleSize = 56;
      if (parsed.title.length > 60) coverTitleSize = 48;
      if (parsed.title.length > 100) coverTitleSize = 40;

      addText(coverSlide, parsed.title, {
        x: COVER_X, y: 500, w: COVER_W,
        size: coverTitleSize, font: fonts.headingFont, color: HEADING_COLOR,
        autoResize: 'HEIGHT',
        lineHeight: { value: 130, unit: 'PERCENT' },
      });

      // -- Cover: "Interviewed by" author --
      if (parsed.author) {
        addText(coverSlide, 'Interviewed by ' + parsed.author, {
          x: COVER_X, y: 850, w: COVER_W,
          size: 24, font: italicFont, color: BODY_COLOR,
          autoResize: 'HEIGHT',
        });
      }

      // ==== CONTENT SLIDES ====
      // All content slides are identical: one text box at (140, 140) sized 1640×800
      const bodyChunks = splitBodyIntoSlideChunks(
        parsed.bodyLines, CHARS_PER_LINE, MAX_LINES, MAX_LINES
      );

      for (const chunk of bodyChunks) {
        const slide = figma.createSlide();
        slide.fills = [{ type: 'SOLID', color: BG_COLOR }];
        allSlides.push(slide);

        const chunkText = chunk.join('\n');
        if (chunkText.trim().length > 0) {
          addText(slide, chunkText, {
            x: TEXT_X, y: TEXT_Y, w: TEXT_W,
            size: BODY_SIZE, font: fonts.bodyFont, color: BODY_COLOR,
            autoResize: 'HEIGHT',
            lineHeight: { value: 160, unit: 'PERCENT' },
          });
        }
      }

      // Switch to grid view and select all new slides
      figma.viewport.slidesView = 'grid';
      figma.currentPage.selection = allSlides;
      figma.closePlugin();
    }
  };
}

// Runs this code if the plugin is run in Buzz
if (figma.editorType === 'buzz') {
  figma.showUI(__html__);
  figma.ui.postMessage({ type: 'init', editorType: 'buzz' });

  figma.ui.onmessage = (msg: PluginMessage) => {
    if (msg.type === 'create-shapes') {
      const numberOfFrames = msg.count;
      const nodes: FrameNode[] = [];
      for (let i = 0; i < numberOfFrames; i++) {
        const frame = figma.buzz.createFrame();
        nodes.push(frame);
      }
      figma.viewport.canvasView = 'grid';
      figma.currentPage.selection = nodes;
      figma.viewport.scrollAndZoomIntoView(nodes);
    }
    figma.closePlugin();
  };
}
