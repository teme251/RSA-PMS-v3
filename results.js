const API = window.BACKEND_URL;
const byId = (id)=>document.getElementById(id);
let RAW=[];
let weeklyChart, monthlyChart;

function chipClass(v){ v=Math.max(0,Math.min(10,Math.round(+v))); return "score-c"+v; }
function avg(a){ return a.length? a.reduce((x,y)=>x+y,0)/a.length : 0; }
function startOfDay(d=new Date()){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d, n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function daysAgo(n){ return startOfDay(addDays(new Date(), -n)); }

function setRangeToday(){
  const s = startOfDay();
  byId("start").value = s.toISOString().slice(0,10);
  byId("end").value = s.toISOString().slice(0,10);
}
function setRangeYesterday(){
  const y = startOfDay(addDays(new Date(), -1));
  byId("start").value = y.toISOString().slice(0,10);
  byId("end").value = y.toISOString().slice(0,10);
}
function setRangeLastN(n){
  const s = daysAgo(n-1);
  const e = startOfDay();
  byId("start").value = s.toISOString().slice(0,10);
  byId("end").value = e.toISOString().slice(0,10);
}

async function load(){
  try{
    const res = await fetch(API, {cache:"no-store"});
    const json = await res.json();
    RAW = Array.isArray(json.data)? json.data : [];
    byId("updated").textContent = "Last updated " + new Date().toLocaleString();
  }catch(e){ RAW=[]; }
  renderAll();
}
document.addEventListener("DOMContentLoaded", ()=>{
  setRangeToday();
  load();
});
setInterval(load, 5*60*1000);

// Quick range buttons
document.addEventListener("click",(e)=>{
  const btn = e.target.closest("button[data-range]"); if(!btn) return;
  const r = btn.dataset.range;
  if(r==="today") setRangeToday();
  else if(r==="yesterday") setRangeYesterday();
  else setRangeLastN(+r);
  renderAll();
});

byId("start").addEventListener("change", renderAll);
byId("end").addEventListener("change", renderAll);
byId("search").addEventListener("input", renderAll);

function inRange(ts, sDate, eDate){
  const t = new Date(ts);
  const s = startOfDay(new Date(sDate));
  const e = startOfDay(new Date(eDate));
  return t >= s && t <= addDays(e, 1); // inclusive end
}

function groupBy(arr, key){
  const m = new Map();
  arr.forEach(r=>{
    const k = r[key];
    if(!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  });
  return m;
}

function scoreOrZero(x){ const n = +x; return Number.isFinite(n)? n : 0; }

function renderAll(){
  const s = byId("start").value;
  const e = byId("end").value;
  const q = (byId("search").value||"").toLowerCase();

  const rows = RAW.filter(r=> r.name && inRange(r.timestamp, s, e));
  const g = groupBy(rows, "name");

  const tb = byId("tbody"); tb.innerHTML="";
  const list = [];

  g.forEach((listRows, name)=>{
    if(q && !name.toLowerCase().includes(q)) return;
    // latest timestamp
    listRows.sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp));
    const last = listRows[0];

    // overall average in range
    const overallAvg = avg(listRows.map(r=> scoreOrZero(r.overall)));

    // category averages (1–10 scaled back from overall*weights—you stored raw category 1–10 inside scores_json)
    // We have r.scores as object; compute per-key avg
    const keys = ["customerInteraction","upsellCompliance","productKnowledge","transparencyEthics","efficiency","teamCollab"];
    const catAvg = Object.fromEntries(keys.map(k=>{
      const vals = listRows.map(r=> (r.scores && r.scores[k]!=null) ? +r.scores[k] : null).filter(v=> Number.isFinite(v));
      return [k, vals.length? avg(vals) : 0];
    }));

    // checklist completion %
    const totalChecks = listRows.reduce((acc,r)=> acc + ((r.checklist||[]).length||0), 0);
    const checksOk   = listRows.reduce((acc,r)=> acc + ((r.checklist||[]).filter(Boolean).length||0), 0);
    const checklistPct = totalChecks? (100*checksOk/totalChecks) : 0;

    // customers
    const customers = listRows.reduce((s,r)=> s + (+r.customersServed||1), 0);

    list.push({
      name,
      overall: overallAvg,
      last: last.timestamp,
      catAvg,
      checklistPct,
      entries: listRows.length,
      customers
    });
  });

  // sort by overall desc
  list.sort((a,b)=> b.overall - a.overall);

  list.forEach(row=>{
    const tr = document.createElement("tr");
    const sc = (v)=> `<span class="score ${chipClass(v)}">${(v).toFixed(1)}</span>`;
    const cat = row.catAvg;
    tr.innerHTML = `
      <td><a href="detail.html?name=${encodeURIComponent(row.name)}" target="_blank">${row.name}</a></td>
      <td>${sc(row.overall/10)}<!-- overall normalized to 0–10 scale from 0–100? No, our overall is already 0–100. Show on 0–10 scale: --></td>
      <td>${sc(cat.customerInteraction)}</td>
      <td>${sc(cat.upsellCompliance)}</td>
      <td>${sc(cat.productKnowledge)}</td>
      <td>${sc(cat.transparencyEthics)}</td>
      <td>${sc(cat.efficiency)}</td>
      <td>${sc(cat.teamCollab)}</td>
      <td>${row.checklistPct.toFixed(0)}%</td>
      <td>${row.entries}</td>
      <td>${row.customers}</td>
      <td>${(row.last||"").slice(0,10)}</td>
    `;
    // Fix overall scale: convert 0–100 to chipClass 0–10
    const overallSpan = tr.children[1].querySelector(".score");
    const overall10 = Math.max(0, Math.min(10, Math.round(row.overall/10)));
    overallSpan.className = "score "+chipClass(overall10);
    overallSpan.textContent = (row.overall/10).toFixed(1);

    tb.appendChild(tr);
  });

  byId("empty").style.display = list.length? "none":"block";

  renderWeeklyMonthly();
}

function renderWeeklyMonthly(){
  // Build weekly
  const weekly = RAW.filter(r=> new Date(r.timestamp) >= daysAgo(7));
  const mW = groupBy(weekly, "name");
  const tuplesW = [];
  mW.forEach((rows, name)=>{
    tuplesW.push({ n: name, v: avg(rows.map(r=> +r.overall||0)) });
  });
  tuplesW.sort((a,b)=> b.v-a.v);
  const wTop = tuplesW.slice(0,10);
  if(weeklyChart) weeklyChart.destroy();
  weeklyChart = new Chart(document.getElementById("weeklyChart"), {
    type: "bar",
    data: { labels: wTop.map(t=>t.n), datasets: [{ label: "Weekly Avg Overall", data: wTop.map(t=> t.v) }] },
    options: { responsive:true, scales:{ y:{ beginAtZero:true, max:100 } } }
  });
  byId("weeklyNote").textContent = weekly.length
    ? `Entries: ${weekly.length} • Overall Avg: ${avg(weekly.map(r=> +r.overall||0)).toFixed(1)}`
    : "No data this week.";

  // Build monthly
  const monthly = RAW.filter(r=> new Date(r.timestamp) >= daysAgo(30));
  const mM = groupBy(monthly, "name");
  const tuplesM = [];
  mM.forEach((rows, name)=>{
    tuplesM.push({ n: name, v: avg(rows.map(r=> +r.overall||0)) });
  });
  tuplesM.sort((a,b)=> b.v-a.v);
  const mTop = tuplesM.slice(0,10);
  if(monthlyChart) monthlyChart.destroy();
  monthlyChart = new Chart(document.getElementById("monthlyChart"), {
    type: "bar",
    data: { labels: mTop.map(t=>t.n), datasets: [{ label: "Monthly Avg Overall", data: mTop.map(t=> t.v) }] },
    options: { responsive:true, scales:{ y:{ beginAtZero:true, max:100 } } }
  });
  byId("monthlyNote").textContent = monthly.length
    ? `Entries: ${monthly.length} • Overall Avg: ${avg(monthly.map(r=> +r.overall||0)).toFixed(1)}`
    : "No data this month.";
}
