"""Local HTTP companion for this BUSY Bar instrument. Python 3.10+."""
import argparse
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import source

def page(caption,value,*lines,fraction=None):
    obj=dict(caption=str(caption),value=str(value),lines=[str(s) for s in lines])
    if fraction is not None: obj["fraction"]=max(0,min(1,float(fraction)))
    return obj

def run():
    p=argparse.ArgumentParser(description=source.__doc__)
    p.add_argument("--config",type=Path,help="Path to your instrument JSON configuration")
    p.add_argument("--host",default="127.0.0.1");p.add_argument("--port",type=int,default=8770)
    p.add_argument("--once",action="store_true",help="Print one snapshot and exit")
    args=p.parse_args()
    options=json.loads(args.config.read_text(encoding="utf8")) if args.config else {}
    memory={};lock=threading.Lock();cached=None;last=0.0
    def snapshot():
        nonlocal last,cached
        now=time.monotonic()
        if cached is not None and now-last<getattr(source,"INTERVAL",5): return cached
        last=now
        try:
            result=source.snapshot(options,memory)
            if not result.get("pages"): raise ValueError("Empty result")
            cached=result
        except Exception as exc:
            # Local paths and remote responses can include personal information.
            # Only the error class crosses the network; the operator sees the reason.
            print("Source unavailable:",str(exc),flush=True)
            cached={"error":type(exc).__name__}
        return cached
    if args.once:
        result=snapshot();print(json.dumps(result,ensure_ascii=False));return int("error" in result)
    class Handler(BaseHTTPRequestHandler):
        def send_json(self,code,data):
            raw=json.dumps(data,ensure_ascii=True,allow_nan=False).encode()
            self.send_response(code);self.send_header("Content-Type","application/json")
            self.send_header("Cache-Control","no-store");self.send_header("Content-Length",str(len(raw)))
            self.end_headers();self.wfile.write(raw)
        def do_GET(self):
            if self.path!="/reading":return self.send_json(404,{"error":"No route"})
            with lock: result=snapshot()
            self.send_json(503 if "error" in result else 200,result)
        def do_POST(self):
            nonlocal cached
            if self.path!="/event" or not hasattr(source,"ingest"):return self.send_json(404,{"error":"No route"})
            try:
                size=int(self.headers.get("Content-Length",0))
                if not 0<size<=131072:return self.send_json(413,{"error":"Event size"})
                data=json.loads(self.rfile.read(size))
                with lock: source.ingest(options,memory,data);cached=None
            except PermissionError:return self.send_json(403,{"error":"Token rejected"})
            except (KeyError,TypeError,ValueError):return self.send_json(400,{"error":"Invalid event"})
            self.send_json(200,{"received":True})
        def log_message(self,*args):pass
    with ThreadingHTTPServer((args.host,args.port),Handler) as server:
        print("Serving /reading on",args.host,args.port,flush=True)
        try:server.serve_forever()
        except KeyboardInterrupt:pass
    return 0
if __name__=="__main__":raise SystemExit(run())
