import type {Page} from "@shared/instrument";
import {rect, type Frame} from "@shared/surface";

export function marks(_page: Page, pages: Page[], index: number): Frame {
  const months = pages.slice(2,14);
  if (months.length !== 12 || months.some((m,i)=>m.caption !== "MONTH "+(i+1) || m.fraction === undefined)) return [];
  return months.map((m,i)=>{
    const share = Math.max(0, Math.min(1,m.fraction!));
    const height = share ? Math.max(2,Math.round(share*10)) : 1;
    return rect("month"+i,48+i*2,15-height,1,height,i===index-2?"#FFF2D6FF":share?"#78D7BFFF":"#394449FF");
  });
}
