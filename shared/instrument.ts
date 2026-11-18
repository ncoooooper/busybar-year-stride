import {surface,label,panel,rect,wrap,type Frame,type MotionOptions} from "./surface";
import {loadValues} from "./settings";

export type InstrumentOptions={title:string;primary:string;accent:string;cadence:number;motion:MotionOptions;setup:string};
type Page={caption:string;value:string;lines:string[];fraction?:number};
type Reading={pages:Page[];state:string;key:string;alert?:boolean;error?:string};

export function instrument(config:InstrumentOptions){
 let address="",page=0,last:Reading|null=null,error="",loading=false,closed=false,pinned=false;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const baseColor=config.accent+"FF";
 function draw():Frame{
  const p=last?.pages[page],fill=p?.fraction;
  const caption=p?.caption||config.primary;
  const value=p?.value||(address?error?"Offline":"Sync...":"Set URL");
  const right=typeof fill==="number"?Math.max(0,Math.min(14,Math.round(fill*14))):0;
  const marks:Frame=[];
  if(typeof fill==="number")for(let i=0;i<7;i++)marks.push(rect("dot"+i,50+i*3,10-Math.floor(i/2),2,4+Math.floor(i/2),i*2<right?baseColor:"#25343EFF"));
  return [label("cap",caption.slice(0,16),1,0,baseColor,"front","tiny"),
    label("num",value.slice(0,14),1,6,"#FAF3DCFF","front","small"),...marks,
    ...panel(config.title,[error?(last?"Offline / last reading":"Source unavailable"):last?.state||"Setup",
     ...(p?p.lines.slice(0,3):[config.setup,"Set bridge URL in settings"]),
     (page+1)+"/"+(last?.pages.length||1)+(pinned?"  Pinned":"  Wheel: browse"),"Click: sync / Start: pin"])];
 }
 async function pull(){
  if(closed||loading||!address)return;
  if(timer!==undefined)clearTimeout(timer);loading=true;
  try{
    const r=await fetch(address);if(!r.ok)throw Error("HTTP "+r.status);
    const data=await r.json() as Reading;
    if(data.error)throw Error(data.error);
    if(!Array.isArray(data.pages)||!data.pages.length||data.pages.length>40||!data.pages.every(p=>typeof p.value==="string"&&typeof p.caption==="string"&&Array.isArray(p.lines)&&p.lines.every(s=>typeof s==="string")))throw Error("Invalid reading");
    const changed=last!==null&&last.key!==data.key;last=data;error="";page=Math.min(page,data.pages.length-1);
    if(!closed)refresh(changed?(data.alert?"success":"change"):undefined);
  }catch(e){error=String(e);if(!closed)refresh();}
  finally{loading=false;if(!closed)timer=setTimeout(()=>void pull(),Math.max(1500,config.cadence)*(error?2:1));}
 }
 const refresh=surface(draw,k=>{
  if(k==="up"||k==="down"){if(last&&!pinned)page=wrap(page+(k==="up"?1:-1),last.pages.length);}
  else if(k==="ok")void pull();
  else if(k==="start")pinned=!pinned;
 },()=>{closed=true;if(timer!==undefined)clearTimeout(timer);},config.motion);
 void loadValues().then(v=>{if(closed)return;address=String(v?.bridge||"").trim();refresh();if(address)void pull();}).catch(e=>console.error("Settings",String(e)));
}
