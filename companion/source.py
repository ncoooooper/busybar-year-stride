"""Compare all deduplicated Garmin runs in the current calendar year to a target."""
from datetime import datetime,date
from zoneinfo import ZoneInfo
from serve import page
from fit_runs import runs
INTERVAL=30
def snapshot(o,m):
    history,bad=runs(o,m);tz=ZoneInfo(o.get("zone","UTC"));today=datetime.now(tz).date()
    year=today.year;goal=float(o.get("target_km",1000))
    if goal<=0:raise ValueError("Enter a positive yearly target")
    months=[0.0]*12;count=0
    for start,meters,*rest in history:
        local=start.astimezone(tz).date()
        if local.year==year and local<=today:months[local.month-1]+=meters/1000;count+=1
    total=sum(months);days=(date(year+1,1,1)-date(year,1,1)).days
    left=(date(year+1,1,1)-today).days
    scheduled=goal*(days-left+1)/days;weekly=max(0,goal-total)*7/left
    pages=[page("YEAR DISTANCE",f"{total:.1f}km",f"{count} runs / {year}",f"Target {goal:g} km",fraction=total/goal),
           page("PLAN GAP",f"{total-scheduled:+.1f}km","Relative to today",f"Need {weekly:.1f} km/week")]
    for i,km in enumerate(months,1):
        pages.append(page("MONTH "+str(i),f"{km:.1f}km",f"{year}-{i:02}",f"Of {total:.1f} km this year",fraction=km/max(1,max(months))))
    return dict(state=f"Local FIT / {bad} unreadable",key=f"{count}/{total:.3f}",pages=pages)
