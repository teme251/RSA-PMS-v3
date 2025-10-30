const API = window.BACKEND_URL;
const byId = (id)=>document.getElementById(id);
let RAW=[], NAME="";
let chart;

function chipClass(v){ v=Math.max(0,Math.min(10,Math.round(+v))); return "score-c"+v; }
function avg(a){ return a.length? a.reduce((x,y)=>x+y,0)/a.length : 0; }
function startOfDay(d=new Date()){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function daysAgo(n){ return startOfDay(addDays(new Date(), -n)); }
function qs(key){ return new URL(location.href).searchParams.get(key); }

function setRangeToday(){
  const s=startOfDay(); byId("start").value=s.toISOString().slice(0,10); byId("end").value=s.toISOString().slice(0,10);
}
function setRangeYesterday(){
  const y=startOfDay(addDays(new Date(),-1)); byId("start").value=y.toISOString().slice(0,10); byId("end").value=y.toISOString().slice(0,10);
}
function setRangeLastN(n){
  const s=daysAgo(n-1), e=startOfDay();
  byId("start").value=s.toISOString().slice(0,10); byId("end").value=e.toISOString().slice(0,10);
}

function inRange(ts,sDate,eDate){
  const t=new Date(ts), s=startOfDay(new Date(sDate)), e=startOfDay(new Date(eDate));
  return t>=s && t<=addDays(e,1);
}

async function load(){
  NAME = (qs("name")||"").trim();
  if(!NAME){ byId("title").textContent="No associate selected"; return; }
  byId("title").textContent = NAME;

  const res = await fetch(API, {cache:"no-store"});
  const json = await res.json();
  RAW = (json.data||[]).filter(r=> (r.name||"").toLowerCase()===NAME.toLowerCase());

  setRangeLastN(7);
  render();
}

document.addEventListener("DOMContentLoaded", load);

document.addEventListener("click",(e)=>{
  const btn = e.target.closest("button[data-range]"); if(!btn) return;
  const r = btn.dataset.range;
  if(r==="today") setRangeToday();
  else if(r==="yesterday") setRangeYesterday();
  else setRangeLastN(+r);
  render();
});
byId("start").addEventListener("change", render);
byId("end").addEventListener("change", render);

function render(){
  const s=byId("start").value, e=byId("end").value;
  const rows = RAW.filter(r=> inRange(r.timestamp, s, e)).sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp));

  byId("meta").textContent = rows.length
    ? `Entries: ${rows.length} • Last rated ${(rows[0].timestamp||"").slice(0,10)}`
    : "No entries in this range.";

  // Category averages
  const keys = [
    ["customerInteraction","CI"],
    ["upsellCompliance","UC"],
    ["productKnowledge","PK"],
    ["transparencyEthics","TE"],
    ["efficiency","EF"],
    ["teamCollab","TC"]
  ];
  const catTb = byId("cats"); catTb.innerHTML="";
  const catAvg = Object.fromEntries(keys.map(([k])=>{
    const vals = rows.map(r=> (r.scores&&r.scores[k]!=null)? +r.scores[k] : null).filter(v=> Number.isFinite(v));
    return [k, vals.length? avg(vals) : 0];
  }));
  keys.forEach(([k,label])=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${label}</td><td><span class="score ${chipClass(catAvg[k])}">${catAvg[k].toFixed(1)}</span></td>`;
    catTb.appendChild(tr);
  });

  // Checklist completion %
  const items = [
    "Greeted customer within 10 seconds",
    "Verified ID & payment clearly",
    "Explained insurance options neutrally",
    "Explained fuel/EV policy accurately",
    "Offered upgrade only if beneficial",
    "Reviewed total cost before payment",
    "Closed courteously & asked for questions"
  ];
  const checksTb = byId("checks"); checksTb.innerHTML="";
  items.forEach((label,i)=>{
    const total = rows.reduce((a,r)=> a + ((r.checklist||[]).length>i ? 1 : 0), 0);
    const ok = rows.reduce((a,r)=> a + ((r.checklist||[])[i] ? 1 : 0), 0);
    const pct = total? (100*ok/total) : 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${label}</td><td>${pct.toFixed(0)}%</td>`;
    checksTb.appendChild(tr);
  });

  // Trend (overall)
  const labels = rows.slice(0,30).map(r=> (r.timestamp||"").slice(5,10)).reverse();
  const data = rows.slice(0,30).map(r=> +r.overall||0).reverse();
  drawTrend(labels, data);

  // Recent ratings full breakdown
  const tb = byId("list"); tb.innerHTML="";
  rows.slice(0,20).forEach(r=>{
    const s = r.scores||{};
    const tr = document.createElement("tr");
    const checklist = (r.checklist||[]).filter(Boolean).length + "/" + (r.checklist||[]).length;
    tr.innerHTML = `
      <td>${(r.timestamp||"").slice(0,10)}</td>
      <td><span class="score ${chipClass((+r.overall||0)/10)}">${(+r.overall||0/10).toFixed(1)}</span></td>
      <td><span class="score ${chipClass(+s.customerInteraction||0)}">${(+s.customerInteraction||0).toFixed(1)}</span></td>
      <td><span class="score ${chipClass(+s.upsellCompliance||0)}">${(+s.upsellCompliance||0).toFixed(1)}</span></td>
      <td><span class="score ${chipClass(+s.productKnowledge||0)}">${(+s.productKnowledge||0).toFixed(1)}</span></td>
      <td><span class="score ${chipClass(+s.transparencyEthics||0)}">${(+s.transparencyEthics||0).toFixed(1)}</span></td>
      <td><span class="score ${chipClass(+s.efficiency||0)}">${(+s.efficiency||0).toFixed(1)}</span></td>
      <td><span class="score ${chipClass(+s.teamCollab||0)}">${(+s.teamCollab||0).toFixed(1)}</span></td>
      <td>${checklist}</td>
      <td>${(+r.customersServed||1)}</td>
      <td>${(r.notes||"")}</td>
    `;
    // fix overall chip scale (0–100 into 0–10 class)
    const overallSpan = tr.children[1].querySelector(".score");
    const overall10 = Math.max(0, Math.min(10, Math.round((+r.overall||0)/10)));
    overallSpan.className = "score "+("score-c"+overall10);
    overallSpan.textContent = ((+r.overall||0)/10).toFixed(1);
    tb.appendChild(tr);
  });
  byId("empty").style.display = rows.length? "none":"block";
}

function drawTrend(labels, data){
  if(chart) chart.destroy();
  chart = new Chart(document.getElementById("trendChart"), {
    type: "line",
    data: { labels, datasets: [{ label:"Overall (0–100)", data, tension:.3 }] },
    options: { responsive:true, scales:{ y:{ beginAtZero:true, max:100 } } }
  });
}
