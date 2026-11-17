import { device } from "./device";
import manifest from "../src/appmeta/manifest.json";
import type { DisplayDrawParams } from "@busy-app/busy-lib";

export type Frame = DisplayDrawParams["elements"];
export type Key = "up" | "down" | "ok" | "start" | "hold-ok" | "hold-start";
export const white = "#FFFFFFFF";
export const mint = "#62EAC2FF";
export const amber = "#FFB459FF";
type Display = "front" | "back";
export function label(id: string, text: string, x: number, y: number, color = white, display: Display = "front", font: "tiny" | "small" | "bold" = "small"): Frame[number] {
  return {id, type:"text", text, x, y, color, display, font, align:"top_left", z_index:1};
}
export function rect(id:string,x:number,y:number,width:number,height:number,color:string,display:Display="front"):Frame[number] {
  return {id,type:"rectangle",x,y,width,height,display,align:"top_left",fill:"solid",fill_colors:[color],border_width:0};
}
export function panel(title:string, lines:string[]):Frame {
  return [label("rear-title",title,2,0,white,"back","bold"),rect("rule",2,13,139,1,"#888888FF","back"),
    ...lines.slice(0,6).map((line,i)=>label("rear-"+i,line,2,16+i*10,white,"back"))];
}
export function wrap(n:number,count:number) {return (n%count+count)%count;}
export function read<T>(key:string,fallback:T):T {
  try {const raw=localStorage.getItem(key); return raw?JSON.parse(raw) as T:fallback;} catch {return fallback;}
}
export function persist(key:string,value:unknown) {localStorage.setItem(key,JSON.stringify(value));}
export function report(error:unknown) {console.error(manifest.id+": "+String(error));}
export function surface(draw:()=>Frame, input:(key:Key)=>void, cleanup?:()=>void) {
  let closed=false, painting=false, dirty=false;
  const previous:Record<string,string>={};
  async function paint() {
    if(painting||closed)return;
    painting=true;
    try {
      while(dirty&&!closed){
        dirty=false;
        const frame=draw();
        const next:Record<string,string>={};
        for(const e of frame)next[e.id]=JSON.stringify(e);
        const removed=Object.keys(previous).filter(id=>!(id in next));
        if(removed.length){
          await device.DisplayClear({application_name:manifest.id,element_ids:removed});
          for(const id of removed)delete previous[id];
        }
        const changed=frame.filter(e=>next[e.id]!==previous[e.id]);
        if(changed.length&&!closed){
          await device.DisplayDraw({application_name:manifest.id,priority:50,elements:changed});
          for(const e of changed)previous[e.id]=next[e.id];
        }
      }
    } catch(error){report(error);} finally{painting=false;}
  }
  function refresh(){dirty=true;void paint();}
  const detach=listen("input",event=>{
    if(closed)return;
    if(event.key==="back"&&event.action==="short"){
      closed=true;cleanup?.();setTimeout(detach,0);return;
    }
    let key:Key;
    if(event.key==="encoder")key=event.delta>0?"up":"down";
    else if(event.key==="ok"||event.key==="start"){
      if(event.action==="short")key=event.key;
      else if(event.action==="long")key=event.key==="ok"?"hold-ok":"hold-start";
      else return;
    }else return;
    try{input(key);refresh();}catch(error){report(error);}
  });
  refresh();
  return refresh;
}
