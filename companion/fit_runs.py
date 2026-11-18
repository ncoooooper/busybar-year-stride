"""Decode only running session summaries, laps and distance traces from local FIT files."""
from pathlib import Path
from garmin_fit_sdk import Decoder,Stream

def runs(options,memory):
    folder=Path(options["folder"]).expanduser()
    if not folder.is_dir():raise ValueError("Select your FIT export directory")
    files=sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower()==".fit")
    cache=memory.setdefault("files",{})
    for path in set(cache)-set(files):del cache[path]
    invalid=0; sessions={}
    for path in files:
        stat=path.stat();key=(stat.st_mtime_ns,stat.st_size)
        if path not in cache or cache[path][0]!=key:
            try:doc,errors=Decoder(Stream.from_file(str(path))).read()
            except (ValueError,OSError,IndexError):doc,errors={},[True]
            records=[]
            if not errors:
                for s in doc.get("session_mesgs",[]):
                    if s.get("sport")!="running":continue
                    start=s.get("start_time");end=s.get("timestamp");dist=s.get("total_distance");sec=s.get("total_timer_time")
                    if start is None or end is None or dist is None or sec is None or dist<=0 or sec<=0:continue
                    laps=[(l["total_distance"],l["total_timer_time"]) for l in doc.get("lap_mesgs",[])
                          if l.get("start_time") and start<=l["start_time"]<end and l.get("total_distance",0)>0 and l.get("total_timer_time",0)>0]
                    splits=[];previous=(0,0);boundary=1000;last_cross=0
                    for point in doc.get("record_mesgs",[]):
                        t=point.get("timestamp");meters=point.get("distance")
                        if t is None or meters is None or not start<=t<=end:continue
                        elapsed=(t-start).total_seconds()
                        if meters<=previous[0] or elapsed<previous[1]:continue
                        while meters>=boundary and len(splits)<1000:
                            at=previous[1]+(elapsed-previous[1])*(boundary-previous[0])/(meters-previous[0])
                            splits.append(at-last_cross);last_cross=at;boundary+=1000
                        previous=(meters,elapsed)
                    records.append((start,dist,sec,laps,splits))
            cache[path]=(key,records,bool(errors))
        invalid+=int(cache[path][2])
        for row in cache[path][1]:
            identity=(row[0],round(row[1]))
            if identity not in sessions or len(row[4])>len(sessions[identity][4]):sessions[identity]=row
    return sorted(sessions.values(),key=lambda row:row[0]),invalid

def pace(seconds):
    minutes,sec=divmod(round(seconds),60)
    return f"{minutes}:{sec:02}"
