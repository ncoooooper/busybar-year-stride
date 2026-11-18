import { makeMotion, type MotionOptions, type MotionCue, type MotionEvent, type ActionKey } from "./motion";
import { device } from "./device";
import { layoutFront, rearLine, clearTextArea } from "./typography";
import manifest from "../src/appmeta/manifest.json";
import type { DisplayDrawParams } from "@busy-app/busy-lib";

export type Frame = DisplayDrawParams["elements"];
export type Key = ActionKey;
export type { MotionCue, MotionOptions, Motif } from "./motion";
export const white = "#FFFFFFFF";
export const mint = "#62EAC2FF";
export const amber = "#FFB459FF";
type Display = "front" | "back";
export function label(id: string, text: string, x: number, y: number, color = white, display: Display = "front", font: "tiny" | "small" | "bold" = "small"): Extract<Frame[number], {type: "text"}> {
  return {id, type:"text", text, x, y, color, display, font, align:"top_left", z_index:1};
}
export function rect(id:string,x:number,y:number,width:number,height:number,color:string,display:Display="front"):Frame[number] {
  return {id,type:"rectangle",x,y,width,height,display,align:"top_left",fill:"solid",fill_colors:[color],border_width:0};
}
export function panel(title:string, lines:string[]):Frame {
  const rows = lines.slice(0,6);
  const firstBottom = 80 - (rows.length-1)*10;
  return [rearLine(label("rear-title",title,2,0,white,"back"),143,firstBottom-15,11,true),
    rect("rule",2,firstBottom-12,143,1,"#888888FF","back"),
    ...rows.map((line,i)=>rearLine(label("rear-"+i,line,2,0,white,"back"),143,firstBottom+i*10,9))];
}
export function wrap(n:number,count:number) {return (n%count+count)%count;}
export function read<T>(key:string,fallback:T):T {
  try {const raw=localStorage.getItem(key); return raw?JSON.parse(raw) as T:fallback;} catch {return fallback;}
}
export function persist(key:string,value:unknown) {localStorage.setItem(key,JSON.stringify(value));}
export function report(error:unknown) {console.error(manifest.id+": "+String(error));}

export function surface(draw: () => Frame, input: (key: Key) => void, cleanup?: () => void, options: MotionOptions = {}) {
  const motion = makeMotion(manifest.id, options);
  const previous: Record<string, string> = {};
  let frontText: ReturnType<typeof layoutFront> = [];
  let encoded: Record<string, string> = {};
  let content: Frame = [], state: string | number | undefined;
  let closed = false, leaving = false, painting = false, dirty = false, contentDirty = true;
  let event: MotionEvent | undefined, phase = 0, timer: ReturnType<typeof setTimeout> | undefined;

  function stopTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  function requestPaint() {
    dirty = true;
    void paint();
  }

  function advance() {
    timer = undefined;
    if (!event || closed) return;
    if (event === "leave" || options.reduced?.() || phase === 4) {
      if (event === "leave" && phase === 0 && motion.enabled && !options.reduced?.()) {
        phase = 3;
        timer = setTimeout(advance, 70);
      } else {
        event = undefined;
        if (leaving) {
          closed = true;
          detach();
          return;
        }
      }
    } else {
      phase++;
      timer = setTimeout(advance, 65);
    }
    requestPaint();
  }

  function startMotion(next: MotionEvent) {
    if (!motion.enabled && next !== "leave") return;
    stopTimer();
    event = next;
    phase = options.reduced?.() ? 4 : 0;
    timer = setTimeout(advance, next === "leave" ? 65 : options.reduced?.() ? 140 : 65);
  }

  async function paint() {
    if (painting || closed) return;
    painting = true;
    try {
      while (dirty && !closed) {
        dirty = false;
        if (contentDirty) {
          contentDirty = false;
          content = draw();
          frontText = layoutFront(content);
          encoded = {};
          for (const element of content) encoded[element.id] = JSON.stringify(element);
          const next = motion.stateKey(content);
          if (state !== undefined && next !== state && !event && !leaving) startMotion("change");
          state = next;
        }
        const overlay = event && motion.enabled ? motion.elements(event, phase) : [];
        clearTextArea(overlay, frontText);
        const encodedOverlay: Record<string, string> = {};
        for (const element of overlay) encodedOverlay[element.id] = JSON.stringify(element);
        const removed = Object.keys(previous).filter(id => !(id in encoded) && !(id in encodedOverlay));
        if (removed.length) {
          await device.DisplayClear({ application_name:manifest.id, element_ids:removed });
          for (const id of removed) delete previous[id];
        }
        const changed = content.filter(element => encoded[element.id] !== previous[element.id]);
        for (const element of overlay) {
          if (encodedOverlay[element.id] !== previous[element.id]) changed.push(element);
        }
        if (changed.length && !closed) {
          await device.DisplayDraw({ application_name:manifest.id, priority:50, elements:changed });
          for (const element of changed) previous[element.id] = encodedOverlay[element.id] || encoded[element.id];
        }
      }
    } catch (error) { report(error); } finally { painting = false; }
  }

  function refresh(cue?: MotionCue) {
    if (closed || leaving) return;
    if (cue) startMotion(cue);
    contentDirty = true;
    requestPaint();
  }

  const detach = listen("input", action => {
    if (closed || leaving) return;
    if (action.key === "back" && action.action === "short") {
      leaving = true;
      try { cleanup?.(); } catch (error) { report(error); }
      startMotion("leave");
      requestPaint();
      return;
    }
    let key: Key;
    if (action.key === "encoder") key = action.delta > 0 ? "up" : "down";
    else if (action.key === "ok" || action.key === "start") {
      if (action.action === "short") key = action.key;
      else if (action.action === "long") key = action.key === "ok" ? "hold-ok" : "hold-start";
      else return;
    } else return;
    try {
      startMotion(key);
      input(key);
      refresh();
    } catch (error) { report(error); }
  });
  startMotion("open");
  refresh();
  return refresh;
}
