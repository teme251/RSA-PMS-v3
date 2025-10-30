const API = window.BACKEND_URL;
const byId = (id)=>document.getElementById(id);
let RAW=[];
let weeklyChart, monthlyChart;

// ----- helpers -----
const pad=(n)=>String(n).padStart(2,"0");
function ymdLocal(d){
  // Return local YYYY-MM-DD for any Date or timestamp string
  d = (d instanceof Date)? d : new Date(d);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function inRangeLocalDate(ts, sYmd, eYmd){
  const ymd = ymdLocal(ts);
  return (!sYmd || ymd >= sYmd) && (!eYmd || ymd <= eYmd);
}
function startOfDay(d=new Date()){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d, n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function daysAgo(n){ return startOfDay(addDays(new Date(), -n)); }
function setRangeToday(){
  const t = ymdLocal(new Date());
  byId("start").value = t; byId("end").value = t;
}
function setRangeYesterday(){
  const y = ymdLocal(addDays(new Date(), -1));
  byId("start").value = y; byId("end").value = y;
}
function setRangeLastN(n){
  const s = ymdLocal(daysAgo(n-1));
  const e = ymdLocal(new Date());
  byId("start").value = s; byId("end").value = e;
}
function chipClass(v){ v=Math.max(0,Math.min(10,Math.round(+v))); return "score-c"+v; }
function avg(a){ return a.length? a.reduce((x,y)=>x+y,0)/a.length : 0; }

// ----- load & events -----
async function load(){
  try{
    const res = await fetch(API, {cache:"no-store"});
    const json = await res.json();
    RAW = Array.isArray(json.data) ? json.data : [];
    byId("updated").textContent = "Last updated " + new Date().toLocaleString();
  }catch(e){ RAW=[]; }
  renderAll();
}
document.addEventListener("DOMContentLoaded", ()=>{
  if(!byId("start").value || !byId("end").value) setRangeToday();
  load();
});
setInterval(load, 5*60*1000);

document.addEventListener("click",(e)=>{
  const btn = e.target.closest("button[data-range]"); if(!btn) return;
  const r = btn.dataset.range;
  if(r==="today") setRangeToday();
  else if(r==="yesterday") setRangeYesterday();
  else setRangeLastN(+r);
  renderAll();
});
["start","end","search"].forEach(id=> byId(id).addEventListener("input", renderAll));

// ----- table rendering -----
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
  const s = byId("start").value || ymdLocal(new Date());
  const e = byId("end").value   || ymdLocal(new Date());
  const q = (byId("search").value||"").toLowerCase();

  // Use local-date range filtering (fixes UTC vs local mismatch)
  const rows = RAW.filter(r => r.name && inRangeLocalDate(r.timestamp, s, e));
  const g = groupBy(rows, "name");

  const tb = byId("tbody"); tb.innerHTML="";
  const list = [];

  g.forEach((listRows, name)=>{
    if(q && !name.toLowerCase().includes(q)) return;

    listRows.sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp));
    const last = listRows[0];

    // overall average (0–100)
    const overallAvg = avg(listRows.map(r=> scoreOrZero(r.overall)));

    // category averages (1–10)
    const keys = ["customerInteraction","upsellCompliance","productKnowledge","transparencyEthics","efficiency","teamCollab"];
    const catAvg = Object.fromEntries(keys.map(k=>{
      const vals = listRows
        .map(r=> (r.scores && r.scores[k]!=null) ? +r.scores[k] : null)
        .filter(v=> Number.isFinite(v));
      return [k, vals.length? avg(vals) : 0];
    }));

    // checklist %
    const totalChecks = listRows.reduce((acc,r)=> acc + ((r.checklist||[]).length||0), 0);
    const checksOk   = listRows.reduce((acc,r)=> acc + ((r.checklist||[]).filter(Boolean).length||0), 0);
    const checklistPct = totalChecks? (100*checksOk/totalChecks) : 0;

    const customers = listRows.reduce((s,r)=> s + (+r.customersServed||1), 0);

    list.push({ name, overall: overallAvg, last: last.timestamp, catAvg, checklistPct, entries: listRows.length, customers });
  });

  list.sort((a,b)=> b.overall - a.overall);

  list.forEach(row=>{
    const tr = document.createElement("tr");
    const sc = (v)=> `<span class="score ${chipClass(v)}">${(v).toFixed(1)}</span>`;
    const cat = row.catAvg;
    tr.innerHTML = `
      <td><a href="detail.html?name=${encodeURIComponent(row.name)}" target="_blank">${row.name}</a></td>
      <td>${sc(row.overall/10)}</td>
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
    tb.appendChild(tr);
  });

  byId("empty").style.display = list.length? "none":"block";

  renderWeeklyMonthly();
}

// ----- weekly/monthly charts (unchanged logic) -----
function renderWeeklyMonthly(){
  // Weekly
  const weekly = RAW.filter(r=> new Date(r.timestamp) >= daysAgo(7));
  const mW = groupBy(weekly, "name");
  const tuplesW = [];
  mW.forEach((rows, name)=> tuplesW.push({ n: name, v: avg(rows.map(r=> +r.overall||0)) }));
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

  // Monthly
  const monthly = RAW.filter(r=> new Date(r.timestamp) >= daysAgo(30));
  const mM = groupBy(monthly, "name");
  const tuplesM = [];
  mM.forEach((rows, name)=> tuplesM.push({ n: name, v: avg(rows.map(r=> +r.overall||0)) }));
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
