// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// ---- Types for notes-to-slides feature ----

interface NoteSection {
  title: string;   // text after "* " on a top-level bullet
  body: string[];  // all subsequent lines until the next top-level bullet
}

interface ParsedNotes {
  rawTitle: string;
  headerLines: string[];
  topicAreas: string[];  // first line of each section → used on cover slide
  sections: NoteSection[];
}

interface ThemeConfig {
  slideFills: ReadonlyArray<Paint>;
  headingFont: FontName;
  headingColor: RGB;
  bodyFont: FontName;
  bodyColor: RGB;
}

type PluginMessage =
  | { type: 'init' }
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

function extractThemeFromDeck(): ThemeConfig {
  const DEFAULT: ThemeConfig = {
    slideFills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
    headingFont: { family: 'Inter', style: 'Bold' },
    headingColor: { r: 0.102, g: 0.102, b: 0.102 },
    bodyFont: { family: 'Inter', style: 'Regular' },
    bodyColor: { r: 0.2, g: 0.2, b: 0.2 },
  };

  try {
    const grid = figma.getSlideGrid();
    for (const row of grid) {
      for (const slide of row) {
        if (slide.children.length === 0) continue;

        // Extract background fills from the slide
        const rawFills = slide.fills;
        const slideFills: ReadonlyArray<Paint> =
          rawFills !== figma.mixed && rawFills.length > 0
            ? rawFills
            : DEFAULT.slideFills;

        // Collect all text nodes and sort largest → smallest
        const textNodes: TextNode[] = [];
        for (const child of slide.children) {
          for (const t of findTextNodes(child as SceneNode)) {
            textNodes.push(t);
          }
        }
        if (textNodes.length === 0) {
          return { ...DEFAULT, slideFills };
        }

        const sorted = [...textNodes].sort(
          (a, b) =>
            (typeof b.fontSize === 'number' ? b.fontSize : 0) -
            (typeof a.fontSize === 'number' ? a.fontSize : 0)
        );

        const headingNode = sorted[0];
        const bodyNode = sorted[sorted.length - 1];

        // Heading font
        const headingFont: FontName =
          headingNode.fontName !== figma.mixed
            ? (headingNode.fontName as FontName)
            : DEFAULT.headingFont;

        // Heading color
        const hFills = headingNode.fills;
        const headingColor: RGB =
          hFills !== figma.mixed &&
          hFills.length > 0 &&
          hFills[0].type === 'SOLID'
            ? (hFills[0] as SolidPaint).color
            : DEFAULT.headingColor;

        // Body font
        const bodyFont: FontName =
          bodyNode.fontName !== figma.mixed
            ? (bodyNode.fontName as FontName)
            : DEFAULT.bodyFont;

        // Body color
        const bFills = bodyNode.fills;
        const bodyColor: RGB =
          bFills !== figma.mixed &&
          bFills.length > 0 &&
          bFills[0].type === 'SOLID'
            ? (bFills[0] as SolidPaint).color
            : DEFAULT.bodyColor;

        return { slideFills, headingFont, headingColor, bodyFont, bodyColor };
      }
    }
  } catch (_e) {
    // Fall through to defaults if anything fails
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
  }
): TextNode {
  const t = figma.createText();
  t.fontName = opts.font;
  t.characters = content;
  t.fontSize = opts.size;
  t.fills = [{ type: 'SOLID', color: opts.color }];
  t.x = opts.x;
  t.y = opts.y;
  t.resize(opts.w, t.height);
  t.textAutoResize = opts.autoResize ?? 'HEIGHT';
  parent.appendChild(t);
  return t;
}

function splitIntoChunks(text: string, charsPerLine: number, maxLines: number): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let current: string[] = [];
  let lineCount = 0;

  for (const line of lines) {
    const wrappedLines = Math.max(1, Math.ceil((line.length || 1) / charsPerLine));
    if (lineCount + wrappedLines > maxLines && current.length > 0) {
      chunks.push(current.join('\n'));
      current = [];
      lineCount = 0;
    }
    current.push(line);
    lineCount += wrappedLines;
  }

  if (current.length > 0) {
    chunks.push(current.join('\n'));
  }

  return chunks.length > 0 ? chunks : [''];
}

function createContentSlides(
  section: NoteSection,
  slideW: number,
  slideH: number,
  margin: number,
  theme: ThemeConfig
): SlideNode[] {
  const results: SlideNode[] = [];
  const TITLE_Y = 50;
  const BODY_START_Y = 160;
  // Conservative line budget — leaves ~80px bottom margin
  const BODY_MAX_H = slideH - BODY_START_Y - 80;
  const CHARS_PER_LINE = 88;
  const LINE_H = 40; // fontSize=28 * 1.4 line height
  const LINES_MAX = Math.floor(BODY_MAX_H / LINE_H) - 2; // -2 for safety margin

  const bodyText = section.body.join('\n').trim();
  const chunks = splitIntoChunks(bodyText, CHARS_PER_LINE, LINES_MAX);

  chunks.forEach((chunk, idx) => {
    const slide = figma.createSlide();
    results.push(slide);

    // Apply theme background
    slide.fills = theme.slideFills as Paint[];

    // Section title
    const titleLabel = idx === 0 ? section.title : `${section.title} (cont'd)`;
    addText(slide, titleLabel, {
      x: margin, y: TITLE_Y, w: slideW - margin * 2,
      size: 44, font: theme.headingFont, color: theme.headingColor,
      autoResize: 'HEIGHT',
    });

    // Body text
    if (chunk.trim().length > 0) {
      const bodyNode = addText(slide, chunk, {
        x: margin, y: BODY_START_Y, w: slideW - margin * 2,
        size: 28, font: theme.bodyFont, color: theme.bodyColor,
        autoResize: 'HEIGHT',
      });
      bodyNode.lineHeight = { value: 140, unit: 'PERCENT' };
    }
  });

  return results;
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
  figma.showUI(__html__, { width: 520, height: 600, title: 'Notes to Slides' });
  figma.ui.postMessage({ type: 'init', editorType: 'slides' });

  figma.ui.onmessage = async (msg: PluginMessage) => {
    if (msg.type === 'cancel') {
      figma.closePlugin();
      return;
    }

    if (msg.type === 'create-notes-slides') {
      const parsed: ParsedNotes = msg.data;

      // Extract colors, fonts, and background from existing slides
      const theme = extractThemeFromDeck();

      // Load all needed fonts (deduplicate if heading == body font)
      const fontsToLoad: FontName[] = [theme.headingFont];
      if (
        theme.bodyFont.family !== theme.headingFont.family ||
        theme.bodyFont.style !== theme.headingFont.style
      ) {
        fontsToLoad.push(theme.bodyFont);
      }
      await Promise.all(fontsToLoad.map(f => figma.loadFontAsync(f)));

      const SLIDE_W = 1920;
      const SLIDE_H = 1080;
      const MARGIN = 80;
      const allSlides: SlideNode[] = [];

      // ---- Cover slide ----
      const coverSlide = figma.createSlide();
      allSlides.push(coverSlide);

      // Apply theme background
      coverSlide.fills = theme.slideFills as Paint[];

      // Title — scale font size based on length
      let titleFontSize = 64;
      if (parsed.rawTitle.length > 60) titleFontSize = 52;
      if (parsed.rawTitle.length > 90) titleFontSize = 40;

      addText(coverSlide, parsed.rawTitle, {
        x: 160, y: 280, w: SLIDE_W - 320,
        size: titleFontSize, font: theme.headingFont, color: theme.headingColor,
        autoResize: 'HEIGHT',
      });

      // Subtitle — cap at 2 header lines to avoid overflow
      if (parsed.headerLines.length > 1) {
        const subtitleText = parsed.headerLines.slice(1, 3).join(' | ');
        addText(coverSlide, subtitleText, {
          x: 160, y: 400, w: SLIDE_W - 320,
          size: 30, font: theme.bodyFont, color: theme.bodyColor,
          autoResize: 'HEIGHT',
        });
      }

      // Topic list — cap at 8 to avoid overflow
      if (parsed.topicAreas.length > 0) {
        const visibleTopics = parsed.topicAreas.slice(0, 8);
        const hiddenCount = parsed.topicAreas.length - visibleTopics.length;
        let topicText = visibleTopics
          .map((t, i) => `${i + 1}.  ${t.length > 90 ? t.slice(0, 87) + '...' : t}`)
          .join('\n');
        if (hiddenCount > 0) topicText += `\n    … and ${hiddenCount} more`;

        addText(coverSlide, 'Key topics:', {
          x: 160, y: 510, w: 400,
          size: 26, font: theme.bodyFont, color: theme.bodyColor,
          autoResize: 'WIDTH_AND_HEIGHT',
        });
        addText(coverSlide, topicText, {
          x: 160, y: 555, w: SLIDE_W - 320,
          size: 24, font: theme.bodyFont, color: theme.bodyColor,
          autoResize: 'HEIGHT',
        });
      }

      // ---- Content slides (one per section, with overflow splitting) ----
      for (const section of parsed.sections) {
        const contentSlides = createContentSlides(section, SLIDE_W, SLIDE_H, MARGIN, theme);
        allSlides.push(...contentSlides);
      }

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
