import type { DisplayDrawParams } from "@busy-app/busy-lib";
import { pixelMetrics, type PixelFont } from "./pixel-metrics";

type Elements = DisplayDrawParams["elements"];
type Text = Extract<Elements[number], {type: "text"}>;
type Box = {x: number; y: number; right: number; bottom: number};
type Size = {font: PixelFont; width: number; top: number; bottom: number};
const sizes: PixelFont[] = ["large", "bold", "condensed", "small", "tiny"];
const captions: PixelFont[] = ["bold", "condensed", "small", "tiny"];

function measure(text: string, font: PixelFont): Size {
  const metrics = pixelMetrics[font];
  let width = 0, top = 16, bottom = 0;
  for (let i = 0; i < text.length; i++) {
    const ascii = text.charCodeAt(i);
    const index = ascii >= 32 && ascii <= 126 ? ascii-32 : 31;
    width += parseInt(metrics.advance[index], 16);
    const end = parseInt(metrics.bottom[index], 16);
    if (end) {
      top = Math.min(top, parseInt(metrics.top[index], 16));
      bottom = Math.max(bottom, end);
    }
  }
  return {font, width, top: bottom ? top : 0, bottom};
}

function fit(text: string, width: number, height: number, options: PixelFont[]): Size {
  let scroll: Size | undefined;
  for (const font of options) {
    const size = measure(text, font);
    if (size.bottom-size.top > height) continue;
    if (font === "tiny" && scroll && width >= 18) return scroll;
    if (size.width <= width) return size;
    if (!scroll || font === "small") scroll = size;
  }
  return scroll || measure(text, "tiny");
}

function position(line: Text, size: Size, width: number, bottom: number): Box {
  line.font = size.font;
  line.y = bottom-size.bottom;
  const x = line.x || 0;
  if (size.width > width) {
    line.width = width;
    line.scroll_rate = 320;
    line.scroll_start_delay = 900;
    line.scroll_repeat_delay = 900;
  } else {
    delete line.width;
    delete line.scroll_rate;
  }
  return {x, y: bottom-(size.bottom-size.top), right: x+Math.min(width,size.width), bottom};
}

// Use the space on the same row. A thumbnail, diagram or meter has its own pixels.
function available(frame: Elements, line: Text, y0: number, y1: number): number {
  const x = line.x || 0;
  let right = 72;
  for (const item of frame) {
    if (item.display === "back" || item.type !== "rectangle" || (item.x || 0) <= x) continue;
    const y = item.y || 0;
    if (y < y1 && y+(item.height || 0) > y0) right = Math.min(right, (item.x || 0)-1);
  }
  return Math.max(1, right-x);
}

// Small native glyphs need brighter strokes against the unlit matrix.
function legibleInk(color:string|undefined):string|undefined {
  if(!color || !/^#[0-9a-f]{6}(ff)?$/i.test(color))return color;
  const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
  const brightness=rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
  if(brightness>=170)return color;
  const amount=(170-brightness)/(255-brightness);
  return "#"+rgb.map(v=>Math.round(v+(255-v)*amount).toString(16).padStart(2,"0")).join("")+"FF";
}

export function layoutFront(frame: Elements): Box[] {
  const lines = frame.filter((e): e is Text => e.type === "text" && e.display !== "back");
  if (lines.length === 2) {
    const [caption, value] = lines;
    if(caption.color)caption.color=legibleInk(caption.color);
    if(value.color)value.color=legibleInk(value.color);
    const valueWidth = value.id === "total" ? 43 : available(frame, value, 8, 16);
    const number = fit(value.text, valueWidth, 10, sizes);
    const valueBox = position(value, number, valueWidth, 16);
    const captionBottom = valueBox.y-1;
    const captionWidth = available(frame, caption, 0, captionBottom);
    const heading = fit(caption.text, captionWidth, captionBottom, captions);
    return [position(caption, heading, captionWidth, captionBottom), valueBox];
  }
  return lines.map(line => {
    // A dice-pool count sits above eight dice that can occupy the entire width.
    const bottom = line.id === "n" && frame.some(e=>e.id === "die0") ? 4 : 16;
    const width = available(frame, line, bottom === 4 ? 0 : 5, bottom);
    const size = fit(line.text, width, bottom, sizes);
    return position(line, size, width, bottom);
  });
}

export function rearLine(line: Text, width: number, bottom: number, height: number, title = false): Text {
  position(line, fit(line.text, width, height, title ? sizes : captions), width, bottom);
  return line;
}

// Preserve the letter counters and the black gap around each line during a button animation.
export function clearTextArea(overlay: Elements, boxes: Box[]): void {
  const glyph = overlay.find(e=>e.id === "motion-glyph");
  if (!glyph || glyph.type !== "xpmbitmap" || glyph.display === "back") return;
  const x = glyph.x || 0, y = glyph.y || 0;
  const affected = boxes.filter(b=>b.x < x+16 && x < b.right && b.y < y+12 && y < b.bottom);
  if (!affected.length) return;
  const rows = glyph.data.split("\n");
  const header = rows.length-12;
  for (const b of affected) {
    const first = Math.max(0, b.x-x), end = Math.min(16, b.right-x);
    if (end <= first) continue;
    const clear = ".".repeat(end-first);
    for (let k=Math.max(0,b.y-y); k<Math.min(12,b.bottom-y); k++) {
      const row = rows[header+k];
      rows[header+k] = row.slice(0, first)+clear+row.slice(end);
    }
  }
  glyph.data = rows.join("\n");
}
