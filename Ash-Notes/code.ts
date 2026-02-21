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

type PluginMessage =
  | { type: 'init' }
  | { type: 'create-shapes'; count: number }
  | { type: 'create-notes-slides'; data: ParsedNotes }
  | { type: 'cancel' };

// ---- Helpers for slide creation ----

function addText(
  parent: SlideNode,
  content: string,
  opts: {
    x: number; y: number; w: number;
    size: number; style: string;
    r: number; g: number; b: number;
    autoResize?: 'HEIGHT' | 'WIDTH_AND_HEIGHT' | 'NONE';
  }
): TextNode {
  const t = figma.createText();
  t.fontName = { family: 'Inter', style: opts.style };
  t.characters = content;
  t.fontSize = opts.size;
  t.fills = [{ type: 'SOLID', color: { r: opts.r, g: opts.g, b: opts.b } }];
  t.x = opts.x;
  t.y = opts.y;
  t.resize(opts.w, t.height);
  t.textAutoResize = opts.autoResize ?? 'HEIGHT';
  parent.appendChild(t);
  return t;
}

function addRect(
  parent: SlideNode,
  x: number, y: number, w: number, h: number,
  r: number, g: number, b: number
): RectangleNode {
  const rect = figma.createRectangle();
  rect.x = x;
  rect.y = y;
  rect.resize(w, h);
  rect.fills = [{ type: 'SOLID', color: { r, g, b } }];
  parent.appendChild(rect);
  return rect;
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
  margin: number
): SlideNode[] {
  const results: SlideNode[] = [];
  const HEADER_H = 120;
  const BODY_START_Y = 160;
  const BODY_MAX_H = slideH - BODY_START_Y - 60;
  const CHARS_PER_LINE = 88;
  const LINE_H = 40; // fontSize=28 * 1.4 line height
  const LINES_MAX = Math.floor(BODY_MAX_H / LINE_H);

  const bodyText = section.body.join('\n').trim();
  const chunks = splitIntoChunks(bodyText, CHARS_PER_LINE, LINES_MAX);

  chunks.forEach((chunk, idx) => {
    const slide = figma.createSlide();
    results.push(slide);

    // Header bar
    addRect(slide, 0, 0, slideW, HEADER_H, 0.176, 0.176, 0.306); // #2D2D4E

    // Section title in header bar
    const titleLabel = idx === 0 ? section.title : `${section.title} (cont'd)`;
    const titleNode = figma.createText();
    titleNode.fontName = { family: 'Inter', style: 'Bold' };
    titleNode.characters = titleLabel;
    titleNode.fontSize = 44;
    titleNode.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    titleNode.x = margin;
    titleNode.y = Math.round(HEADER_H / 2) - 26;
    titleNode.resize(slideW - margin * 2, 60);
    titleNode.textAutoResize = 'HEIGHT';
    slide.appendChild(titleNode);

    // Body text
    if (chunk.trim().length > 0) {
      const bodyNode = figma.createText();
      bodyNode.fontName = { family: 'Inter', style: 'Regular' };
      bodyNode.characters = chunk;
      bodyNode.fontSize = 28;
      bodyNode.fills = [{ type: 'SOLID', color: { r: 0.102, g: 0.102, b: 0.102 } }];
      bodyNode.x = margin;
      bodyNode.y = BODY_START_Y;
      bodyNode.resize(slideW - margin * 2, 100);
      bodyNode.textAutoResize = 'HEIGHT';
      bodyNode.lineHeight = { value: 140, unit: 'PERCENT' };
      slide.appendChild(bodyNode);
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

      // Load all needed fonts up front
      await Promise.all([
        figma.loadFontAsync({ family: 'Inter', style: 'Bold' }),
        figma.loadFontAsync({ family: 'Inter', style: 'Regular' }),
        figma.loadFontAsync({ family: 'Inter', style: 'Medium' }),
      ]);

      const SLIDE_W = 1920;
      const SLIDE_H = 1080;
      const MARGIN = 80;

      const allSlides: SlideNode[] = [];

      // ---- Cover slide ----
      const coverSlide = figma.createSlide();
      allSlides.push(coverSlide);

      // Dark background
      addRect(coverSlide, 0, 0, SLIDE_W, SLIDE_H, 0.102, 0.102, 0.180); // #1A1A2E

      // Title — scale font size based on length
      let titleFontSize = 72;
      if (parsed.rawTitle.length > 60) titleFontSize = 56;
      if (parsed.rawTitle.length > 90) titleFontSize = 44;

      addText(coverSlide, parsed.rawTitle, {
        x: 160, y: 300, w: SLIDE_W - 320,
        size: titleFontSize, style: 'Bold',
        r: 1, g: 1, b: 1,
        autoResize: 'HEIGHT',
      });

      // Date/context line from header (second header line if present)
      if (parsed.headerLines.length > 1) {
        const subtitleText = parsed.headerLines.slice(1).join(' | ');
        addText(coverSlide, subtitleText, {
          x: 160, y: 430, w: SLIDE_W - 320,
          size: 32, style: 'Regular',
          r: 0.627, g: 0.627, b: 0.753, // #A0A0C0
          autoResize: 'HEIGHT',
        });
      }

      // Topic areas
      if (parsed.topicAreas.length > 0) {
        addText(coverSlide, 'Key topics:', {
          x: 160, y: 545, w: 400,
          size: 28, style: 'Medium',
          r: 0.627, g: 0.627, b: 0.753,
          autoResize: 'WIDTH_AND_HEIGHT',
        });

        const topicText = parsed.topicAreas
          .map((t, i) => `${i + 1}.  ${t.length > 90 ? t.slice(0, 87) + '...' : t}`)
          .join('\n');

        addText(coverSlide, topicText, {
          x: 160, y: 595, w: SLIDE_W - 320,
          size: 26, style: 'Regular',
          r: 1, g: 1, b: 1,
          autoResize: 'HEIGHT',
        });
      }

      // ---- Content slides (one per section, with overflow splitting) ----
      for (const section of parsed.sections) {
        const contentSlides = createContentSlides(section, SLIDE_W, SLIDE_H, MARGIN);
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
