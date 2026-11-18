import type {DisplayDrawParams} from "@busy-app/busy-lib";
import type {MotionEvent} from "./motion";
import {style} from "./page-style";

type Frame = DisplayDrawParams["elements"];
type Box = {x:number;y:number;right:number;bottom:number};
type Shape = "slide"|"fold"|"iris"|"art"|"swatch"|"flag"|"sample"|"reels"|"reaction";
export type PageStyle = {shape:Shape;ink:string;shade:string;edge:string};

function bar(id:string,x:number,y:number,w:number,h:number,color:string,z=4,back=false):Frame[number] {
  return {id:"turn-"+id,type:"rectangle",display:back?"back":"front",x,y,width:w,height:h,
    z_index:z,fill:"solid",fill_colors:[color],border_width:0,align:"top_left"};
}

// Identify a page independently of its changing clock, sensor value or animation frame.
export function pageKey(frame:Frame,boxes:Box[]):string {
  if(style.shape==="flag") {
    const flag=frame.find(e=>e.id==="flag");
    return flag?.type==="image" && "path" in flag ? flag.path : "";
  }
  if(boxes.length>=2){
    const cap=frame.find(e=>e.display!=="back"&&e.type==="text");
    if(cap?.type==="text")return cap.text.replace(/[0-9]+/g,"#");
  }
  return "";
}

// Reveal the destination inside its own bitmap. Matching palettes retain the outgoing artwork.
function reveal(data:string,prior:string|undefined,fraction:number,reverse:boolean):string {
  const next=data.split("\n");
  const [width,height,colors,cpp]=next[1].trim().split(/\s+/).map(Number);
  if(cpp!==1||width<1||height<1||width>72||height>16)return data;
  const start=2+colors;
  if(next.length<start+height)return data;
  const old=prior?.split("\n");
  const same=old&&old.slice(0,start).join("\n")===next.slice(0,start).join("\n");
  const paper=next[2][0];
  for(let y=0;y<height;y++){
    const amount=Math.max(0,Math.min(width,Math.round(width*fraction)+(y%4)-1));
    const from=same?old[start+y]:paper.repeat(width);
    next[start+y]=reverse?from.slice(0,width-amount)+next[start+y].slice(width-amount):
      next[start+y].slice(0,amount)+from.slice(amount);
  }
  return next.join("\n");
}

export function pageTurn(frame:Frame,boxes:Box[],event:MotionEvent,phase:number,departing:Frame):Frame {
  if(phase>=4 || event==="open" || event==="leave")return [];
  const reverse=event==="down";
  const p=[0.18,0.48,0.82,1][phase];
  const out:Frame=[];
  const rule=frame.find(e=>e.id==="rule"&&e.display==="back");
  // The physical rear panel is monochrome. The travelling notch sits on the existing divider.
  if(rule){
    const x=Math.round((reverse?1-p:p)*130);
    out.push(bar("rear-notch",2+x,rule.y||0,11,1,"#FFFFFFFF",4,true));
  }
  if(style.shape==="sample")return out; // Ink/paper are the measurement.
  if(style.shape==="reaction" && boxes.length!==2)return []; // Never delay the timed cue.
  if(style.shape==="flag"){
    const flag=frame.find(e=>e.id==="flag");
    if(flag?.type==="image")out.push({...flag,x:(flag.x||0)+(reverse?-1:1)*[8,4,1,0][phase]});
    return out;
  }
  if(style.shape==="swatch"){
    const active=frame.find(e=>e.type==="rectangle"&&e.id.startsWith("channel")&&e.fill_colors?.[0]!=="#394047FF");
    if(active?.type==="rectangle"){
      const w=[2,4,8,6][phase],x=active.x||0;
      out.push(bar("channel",Math.max(0,x+Math.floor((6-w)/2)),12,w,1,active.fill_colors?.[0]||style.ink));
    }
    return out;
  }
  if(style.shape==="reels"){
    // The three reel windows get their own cue. Keep the center payline unobstructed.
    for(let i=0;i<3;i++){
      const w=Math.max(1,[3,9,14,5][Math.max(0,phase-i)]);
      out.push(bar("sill"+i,4+23*i,15,w,1,style.ink));
    }
    return out;
  }
  if(boxes.length<2 || style.shape==="art"){
    const bitmap=frame.find(e=>e.display!=="back" && e.type==="xpmbitmap");
    if(bitmap?.type==="xpmbitmap" && phase<3){
      const before=departing.find(e=>e.id===bitmap.id);
      out.push({...bitmap,data:reveal(bitmap.data,before?.type==="xpmbitmap"?before.data:undefined,p,reverse)});
    }else if(!bitmap){
      // A fold line, route cursor or note marker moves between its actual old and new coordinates.
      for(const target of frame){
        if(target.display==="back"||target.type!=="rectangle")continue;
        const before=departing.find(e=>e.id===target.id);
        if(before?.type!=="rectangle")continue;
        const x=Math.round((before.x||0)*(1-p)+(target.x||0)*p);
        const y=Math.round((before.y||0)*(1-p)+(target.y||0)*p);
        const width=Math.max(1,Math.round((before.width||1)*(1-p)+(target.width||1)*p));
        if(x!==target.x||y!==target.y||width!==target.width)out.push({...target,x,y,width});
        else if(target.fill_colors?.[0]!==before.fill_colors?.[0] && phase<2){
          const c=target.fill_colors?.[0];
          if(c && c!=="#000000FF")out.push({...target,fill_colors:[phase===0?style.ink:c]});
        }
      }
    }
    return out;
  }

  const box=boxes[0], cap=frame.find(e=>e.display!=="back"&&e.type==="text");
  if(cap?.type!=="text" || !cap.text || box.bottom<=box.y)return out;
  // The white caption remains complete throughout. The highlight moves beneath its glyphs.
  const left=Math.max(0,box.x-1), width=Math.min(72-left,box.right-left+1);
  const top=Math.max(0,box.y-1), height=box.bottom-top;
  if(width<2||height<1)return out;
  const w=Math.max(1,Math.round(width*p));
  const x=style.shape==="iris"?left+Math.floor((width-w)/2):reverse?left+width-w:left;
  const h=style.shape==="fold"?Math.max(1,Math.round(height*p)):height;
  out.push(bar("ribbon",x,top+height-h,w,h,style.shade,0));
  const lead=reverse?x:x+w-1;
  out.push(bar("seam",lead,top+height-h,1,h,style.edge,0));
  out.push({...cap,color:"#FFF9EAFF",z_index:3});
  return out;
}
