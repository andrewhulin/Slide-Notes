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

interface ThemeFonts {
  headingFont: FontName;
  bodyFont: FontName;
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

        // Collect all text nodes and sort largest → smallest
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

// Determine if a slide's background is dark based on its resolved fills
function isBackgroundDark(slide: SlideNode): boolean {
  const fills = slide.fills;
  if (fills === figma.mixed || fills.length === 0) return false;
  const first = fills[0];
  if (first.type !== 'SOLID') return false;
  const { r, g, b } = first.color;
  // Weighted luminance (ITU-R BT.601)
  return (0.299 * r + 0.587 * g + 0.114 * b) < 0.5;
}

function textColorsForSlide(slide: SlideNode): { heading: RGB; body: RGB } {
  if (isBackgroundDark(slide)) {
    return {
      heading: { r: 1, g: 1, b: 1 },
      body: { r: 0.95, g: 0.95, b: 0.95 },
    };
  }
  return {
    heading: { r: 0.1, g: 0.1, b: 0.1 },
    body: { r: 0.2, g: 0.2, b: 0.2 },
  };
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
  _slideH: number,
  margin: number,
  fonts: ThemeFonts
): SlideNode[] {
  const results: SlideNode[] = [];
  const TITLE_Y = 60;
  const BODY_START_Y = 180;
  // Body at 32px, 160% leading ≈ 51px/line; available height ≈ 820px
  const CHARS_PER_LINE = 78;
  const LINES_MAX = 15;

  const bodyText = section.body.join('\n').trim();
  const chunks = splitIntoChunks(bodyText, CHARS_PER_LINE, LINES_MAX);

  chunks.forEach((chunk, idx) => {
    const slide = figma.createSlide();
    results.push(slide);

    // Don't set slide.fills — let the template handle backgrounds

    // Pick text colors that contrast with this slide's template background
    const colors = textColorsForSlide(slide);

    // Section title
    const titleLabel = idx === 0 ? section.title : `${section.title} (cont'd)`;
    addText(slide, titleLabel, {
      x: margin, y: TITLE_Y, w: slideW - margin * 2,
      size: 52, font: fonts.headingFont, color: colors.heading,
      autoResize: 'HEIGHT',
    });

    // Body text
    if (chunk.trim().length > 0) {
      const bodyNode = addText(slide, chunk, {
        x: margin, y: BODY_START_Y, w: slideW - margin * 2,
        size: 32, font: fonts.bodyFont, color: colors.body,
        autoResize: 'HEIGHT',
      });
      bodyNode.lineHeight = { value: 160, unit: 'PERCENT' };
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

      // Extract fonts from existing slides in the deck
      const fonts = extractFontsFromDeck();

      // Load all needed fonts (deduplicate if heading == body)
      const fontsToLoad: FontName[] = [fonts.headingFont];
      if (
        fonts.bodyFont.family !== fonts.headingFont.family ||
        fonts.bodyFont.style !== fonts.headingFont.style
      ) {
        fontsToLoad.push(fonts.bodyFont);
      }
      await Promise.all(fontsToLoad.map(f => figma.loadFontAsync(f)));

      const SLIDE_W = 1920;
      const SLIDE_H = 1080;
      const MARGIN = 80;
      const allSlides: SlideNode[] = [];

      // ---- Cover slide ----
      const coverSlide = figma.createSlide();
      allSlides.push(coverSlide);

      // Don't set fills — let the template handle the background
      const coverColors = textColorsForSlide(coverSlide);

      // Title — scale font size based on length
      let titleFontSize = 72;
      if (parsed.rawTitle.length > 60) titleFontSize = 52;
      if (parsed.rawTitle.length > 90) titleFontSize = 44;

      addText(coverSlide, parsed.rawTitle, {
        x: 160, y: 280, w: SLIDE_W - 320,
        size: titleFontSize, font: fonts.headingFont, color: coverColors.heading,
        autoResize: 'HEIGHT',
      });

      // Subtitle — cap at 2 header lines
      if (parsed.headerLines.length > 1) {
        const subtitleText = parsed.headerLines.slice(1, 3).join(' | ');
        addText(coverSlide, subtitleText, {
          x: 160, y: 420, w: SLIDE_W - 320,
          size: 36, font: fonts.bodyFont, color: coverColors.body,
          autoResize: 'HEIGHT',
        });
      }

      // Topic list — cap at 8
      if (parsed.topicAreas.length > 0) {
        const visibleTopics = parsed.topicAreas.slice(0, 8);
        const hiddenCount = parsed.topicAreas.length - visibleTopics.length;
        let topicText = visibleTopics
          .map((t, i) => `${i + 1}.  ${t.length > 80 ? t.slice(0, 77) + '...' : t}`)
          .join('\n');
        if (hiddenCount > 0) topicText += `\n    … and ${hiddenCount} more`;

        addText(coverSlide, 'Key topics:', {
          x: 160, y: 530, w: 400,
          size: 30, font: fonts.bodyFont, color: coverColors.body,
          autoResize: 'WIDTH_AND_HEIGHT',
        });
        addText(coverSlide, topicText, {
          x: 160, y: 580, w: SLIDE_W - 320,
          size: 28, font: fonts.bodyFont, color: coverColors.body,
          autoResize: 'HEIGHT',
        });
      }

      // ---- Content slides (one per section, with overflow splitting) ----
      for (const section of parsed.sections) {
        const contentSlides = createContentSlides(section, SLIDE_W, SLIDE_H, MARGIN, fonts);
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
