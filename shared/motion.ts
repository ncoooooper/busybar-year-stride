import type { DisplayDrawParams } from "@busy-app/busy-lib";

type Elements = DisplayDrawParams["elements"];
export type ActionKey = "up" | "down" | "ok" | "start" | "hold-ok" | "hold-start";
export type MotionEvent = ActionKey | "open" | "leave" | "change" | "success" | "warning";
export type MotionCue = "change" | "success" | "warning";
export type Ink = 1 | 2 | 3;
const WIDTH = 16;
const HEIGHT = 12;

/** A transparent 16-by-12 pixel sprite. Inks are shadow, enamel, and glint. */
export class Pixels {
  private data = new Uint8Array(WIDTH * HEIGHT);

  dot(x: number, y: number, ink: Ink = 3) {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) this.data[y * WIDTH + x] = ink;
  }

  line(x: number, y: number, endX: number, endY: number, ink: Ink = 2) {
    x = Math.round(x); y = Math.round(y); endX = Math.round(endX); endY = Math.round(endY);
    const dx = Math.abs(endX - x), dy = -Math.abs(endY - y);
    const sx = x < endX ? 1 : -1, sy = y < endY ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      this.dot(x, y, ink);
      if (x === endX && y === endY) break;
      const twice = error * 2;
      if (twice >= dy) { error += dy; x += sx; }
      if (twice <= dx) { error += dx; y += sy; }
    }
  }

  box(x: number, y: number, w: number, h: number, ink: Ink = 2) {
    if (w < 1 || h < 1) return;
    for (let row = y; row < y + h; row++) this.line(x, row, x + w - 1, row, ink);
  }

  xpm(color: string, shine: string, outline = false) {
    const rows = ["! XPM2", "16 12 5 1", ". c none", "# c #111522", "- c #384755", "+ c " + color, "* c " + shine];
    for (let y = 0; y < HEIGHT; y++) {
      let row = "";
      for (let x = 0; x < WIDTH; x++) {
        const i = y * WIDTH + x;
        const edge = outline && !this.data[i] && (
          (x > 0 && this.data[i-1]) || (x < WIDTH-1 && this.data[i+1]) ||
          (y > 0 && this.data[i-WIDTH]) || (y < HEIGHT-1 && this.data[i+WIDTH]));
        row += edge ? "#" : ".-+*"[this.data[i]];
      }
      rows.push(row);
    }
    return rows.join("\n");
  }
}

/** Draw one authored keyframe. Phase runs from 0 to 4. Coordinates are integer pixels. */
export type Motif = (art: Pixels, phase: number, event: MotionEvent) => void;

export const motifs = {
  shuttle(p, t) {
    for (let x = 2; x <= 12; x += 3) p.line(x, 1, x, 10, 1);
    for (let x = 1; x < 14; x++) p.dot(x, 5 + (Math.floor((x + t) / 3) % 2), 2);
    p.box(1 + t * 2, 4, 4, 2, 3);
  },
  pour(p, t) {
    p.line(2, 6, 3, 10); p.line(3, 10, 10, 10); p.line(10, 10, 11, 6);
    p.line(12, 6, 14, 6, 1); p.line(14, 6, 13, 8); p.dot(12, 8);
    p.line(4, 9 - Math.floor(t / 3), 9, 9 - Math.floor(t / 3), 2);
    if (t < 4) { p.dot(6, 1 + t); p.dot(6, 2 + t); } else { p.dot(4, 6); p.dot(8, 6); }
  },
  interval(p, t) {
    const h = [2, 4, 3, 2, 1][t];
    p.line(1, 6, 14, 6, 1);
    for (let i = 0; i < 2; i++) {
      const x = 2 + i * 7, a = i ? 5 - h : h;
      p.line(x, 6, x + 2, 6 - a, 2); p.line(x + 2, 6 - a, x + 4, 6 + a, 3);
      p.line(x + 4, 6 + a, x + 6, 6, 2);
    }
  },
  turnout(p, t) {
    p.line(1, 8, 14, 8, 1); p.line(7, 8, 12, 3, 2); p.line(12, 3, 14, 3);
    const x = 1 + 3 * t, y = 8 - Math.min(5, Math.max(0, x - 7));
    p.box(x, y - 1, 2, 2, 3);
  },
  stations(p, t) {
    p.line(1, 6, 14, 6, 1);
    for (let x = 2; x < 15; x += 4) p.box(x, 5, 2, 3, x <= 2 + t * 3 ? 2 : 1);
    p.box(1 + t * 3, 4, 2, 3, 3);
  },
  cells(p, t) {
    p.line(1, 2, 13, 2, 2); p.line(1, 9, 13, 9, 2);
    p.line(1, 2, 1, 9); p.line(13, 2, 13, 9); p.line(15, 4, 15, 7, 1);
    for (let j = 0; j <= Math.min(t, 3); j++) p.box(3 + j * 2, 4, 1, 4, j === t ? 3 : 2);
  },
  bookmark(p, t) {
    p.box(6, 1, 7, 6, 1);
    const x = 3 + Math.min(t, 2), bottom = 5 + t;
    p.box(x, 1, 6, bottom, 2);
    p.line(x, bottom + 1, x + 2, bottom - 1, 3); p.line(x + 2, bottom - 1, x + 5, bottom + 1, 3);
    p.line(x + 1, 2, x + 3, 2, 3);
  },
  folio(p, t) {
    const w = [6, 3, 0, 3, 6][t], left = 8 - w, right = 8 + w;
    p.line(left, 2, right, 2); p.line(left, 9, right, 9);
    p.line(left, 2, left, 9, 3); p.line(right, 2, right, 9, 2);
    if (w > 2) {
      p.line(left + 2, 4, right - 2, 4, 1);
      if (t > 2) p.dot(right - 2, 7); else p.dot(left + 2, 7);
    }
  },
  ticket(p, t) {
    p.line(1, 3, 9, 3, 1); p.line(2, 2, 10, 2, 1);
    const x = 2 + t, y = 5 - Math.floor(t / 2);
    p.box(x, y, 8, 5, 2); p.dot(x, y + 2, 1); p.dot(x + 7, y + 2, 1);
    p.line(x + 4, y + 1, x + 4, y + 3, 3);
  },
  trace(p, t) {
    p.line(0, 7, 4, 7, 1); p.line(4, 7, 7, 2); p.line(7, 2, 9, 9);
    p.line(9, 9, 11, 6); p.line(11, 6, 15, 6, 1);
    p.box([1, 5, 7, 9, 13][t], [6, 4, 1, 8, 5][t], 2, 2, 3);
  },
  flare(p, t) {
    if (t === 0) { p.line(7, 5, 7, 9, 3); return; }
    const r = t;
    for (const side of [-1, 1]) {
      p.dot(7 + side * (r + 1), 5); p.dot(7, 5 + side * r);
      p.dot(7 + side * r, 5 - r, 2); p.dot(7 + side * r, 5 + r, 2);
    }
    if (t < 3) p.dot(7, 5);
  }
} satisfies Record<string, Motif>;

export interface MotionOptions {
  motif?: keyof typeof motifs | Motif;
  /** Six-digit RGB colors for the front sprite. */
  color?: string;
  shine?: string;
  /** Report discrete semantic changes, such as a ticket opening or a recipe step ending. */
  stateKey?: () => string | number;
  reduced?: () => boolean;
  /** Optional full-display choreography. Use IDs reserved for the overlay. */
  overlay?: (event: MotionEvent, phase: number) => Elements;
}

type Profile = [keyof typeof motifs, string, string, string];
const profiles: Record<string, Profile> = {
  pixelloom: ["shuttle", "#DF8057", "#FFF0B5", ""],
  brewpilot: ["pour", "#D99453", "#F9E4AF", "title"],
  earbits: ["interval", "#9B9DF0", "#EEF2FF", "rear-1"],
  signalbox: ["turnout", "#EB8362", "#FFE387", "rear-4"],
  ritualrail: ["stations", "#4AC5AB", "#DBFAD6", "step"],
  powerwindow: ["cells", "#58D7A5", "#EDF7C4", "rear-0"],
  backtrack: ["bookmark", "#E6A85E", "#FFEBB1", "rear-0"],
  wordflip: ["folio", "#5BCDBE", "#ECFFF1", "word"],
  quietqueue: ["ticket", "#66BDAC", "#F5F0B1", "head"],
  canarywatch: ["trace", "#DFA652", "#FCE8A3", "rear-3"],
};
const fallback: Profile = ["trace", "#60CEB9", "#EBF8DB", ""];

export function makeMotion(id: string, options: MotionOptions) {
  const app = id.slice(id.lastIndexOf(".") + 1);
  const profile = profiles[app] || fallback;
  const motif = typeof options.motif === "function" ? options.motif : motifs[options.motif || profile[0]];
  function stateKey(frame: Elements) {
    if (options.stateKey) return options.stateKey();
    const item = profile[3] && frame.find(element => element.id === profile[3]);
    return item && item.type === "text" ? item.text : "";
  }
  function elements(event: MotionEvent, step: number): Elements {
    if (options.overlay) return options.overlay(event, step);
    const art = new Pixels();
    const reverse = event === "down" || event === "leave";
    const t = reverse ? 4 - step : step;
    motif(art, t, event);
    const held = event === "hold-start" || event === "hold-ok";
    const ink = event === "warning" ? "#F7AA76" : options.color || profile[1];
    const sprite = art.xpm(ink, options.shine || profile[2], app === "pixelloom");
    let x = 55, y = 2;
    switch (event) {
      case "up": x = 52 + step; break;
      case "down": x = 56 - step; break;
      case "ok": y = [2, 3, 3, 2, 2][step]; break;
      case "hold-ok": y = [0, 0, 1, 3, 3][step]; break;
      case "start": x = [51, 53, 55, 55, 55][step]; break;
      case "hold-start": x = [55, 53, 51, 53, 56][step]; break;
      case "leave": y = [4, 3, 2, 1, 0][t]; break;
      case "warning": x = [55, 53, 56, 54, 55][step]; break;
      case "success": y = [3, 1, 0, 1, 2][step]; break;
    }
    // The loom is full bleed. Its shuttle travels across the actual threads.
    if (app === "pixelloom") x = [2, 20, 37, 49, 56][t];
    // The switchyard occupies all three front lanes, including its destinations.
    if (app === "signalbox") {
      return [
        { id:"motion-glyph", type:"xpmbitmap", data:sprite, display:"back", x:122, y:0, z_index:8 },
        { id:"motion-guide", type:"rectangle", x:3 + t * 14, y:0, width:4, height:1,
          z_index:8, fill:"solid", fill_colors:["#FFE387FF"], border_width:0 },
      ];
    }
    const span = held ? 24 : event === "ok" || event === "success" ? 16 : 8;
    const offset = reverse ? 4 - step : step;
    return [
      { id:"motion-glyph", type:"xpmbitmap", data:sprite, x, y, z_index:8 },
      { id:"motion-guide", type:"rectangle", x:104 + offset * 3, y:13, width:span, height:1,
        display:"back", z_index:8, fill:"solid", fill_colors:["#FFFFFFFF"], border_width:0 },
    ];
  }
  return { elements, stateKey };
}
