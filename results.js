const API = window.BACKEND_URL;
const byId = (id)=>document.getElementById(id);
let RAW=[];

// ----- helpers -----
const pad=(n)=>String(n).padStart(2,"0");
function ymdLocal(d){
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
function setRangeToday(){ const t=ymdLocal(new Date()); byId("start").value=t; byId("end").value=t; }
function setRangeYesterday(){ const y=ymdLocal(addDays(new Date(),-1)); byId("start").value=y; byId("end").value=y; }
function setRangeLastN(n){ const s=ymdLocal(daysAgo(n-1)); const e=ymdLocal(new Date()); byId("start").value=s; byId("end").value=e; }
function chipClass(v){ v=Math.max(0,Math.min(10,Math.round(+v))); return "score-c"+v; }
function avg(a){ return a.length? a.reduce((x,y)=>x+y,0)/a.length : 0; }
function groupBy(arr, key){
  const m=new Map();
  arr.forEach(r=>{ const k=r[key]; if(!m.has(k)) m.set(k,[]); m.get(k).push(r); });
  return m;
}
function scoreOrZero(x){ const n=+x; return Number.isFinite(n)? n : 0; }

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

// ----- core renderers -----
function aggregateByRSA(rows){
  const g = groupBy(rows, "name");
  const result = [];

  g.forEach((listRows, name)=>{
    if(!name) return;

    // latest timestamp
    listRows.sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp));
    const last = listRows[0];

    // averages
    const overallAvg = avg(listRows.map(r=> scoreOrZero(r.overall)));
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

    // customers
    const customers = listRows.reduce((s,r)=> s + (+r.customersServed||1), 0);

    result.push({name, overall:overallAvg, catAvg, checklistPct, customers, last:last.timestamp});
  });

  // sort by overall desc
  result.sort((a,b)=> b.overall - a.overall);
  return result;
}

function renderTable(rows, tbodyId){
  const tb = byId(tbodyId); tb.innerHTML="";
  rows.forEach(row=>{
    const cat = row.catAvg;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><a href="detail.html?name=${encodeURIComponent(row.name)}" target="_blank">${row.name}</a></td>
      <td><span class="score ${chipClass(row.overall/10)}">${(row.overall/10).toFixed(1)}</span></td>
      <td><span class="score ${chipClass(cat.customerInteraction)}">${(cat.customerInteraction).toFixed(1)}</span></td>
      <td><span class="score ${chipClass(cat.upsellCompliance)}">${(cat.upsellCompliance).toFixed(1)}</span></td>
      <td><span class="score ${chipClass(cat.productKnowledge)}">${(cat.productKnowledge).toFixed(1)}</span></td>
      <td><span class="score ${chipClass(cat.transparencyEthics)}">${(cat.transparencyEthics).toFixed(1)}</span></td>
      <td><span class="score ${chipClass(cat.efficiency)}">${(cat.efficiency).toFixed(1)}</span></td>
      <td><span class="score ${chipClass(cat.teamCollab)}">${(cat.teamCollab).toFixed(1)}</span></td>
      <td>${row.checklistPct.toFixed(0)}%</td>
      <td>${row.customers}</td>
      <td>${(row.last||"").slice(0,10)}</td>
    `;
    tb.appendChild(tr);
  });
}

function renderAll(){
  const s = byId("start").value || ymdLocal(new Date());
  const e = byId("end").value   || ymdLocal(new Date());
  const q = (byId("search").value||"").toLowerCase();

  // Selected range (local date filter)
  const rangeRows = RAW.filter(r => r.name && inRangeLocalDate(r.timestamp, s, e));
  const rangeAgg  = aggregateByRSA(rangeRows).filter(r=> r.name.toLowerCase().includes(q));
  renderTable(rangeAgg, "tbody");
  byId("empty").style.display = rangeAgg.length ? "none":"block";

  // Weekly — ALL RSAs
  const weeklyRows = RAW.filter(r=> new Date(r.timestamp) >= daysAgo(7));
  const weeklyAgg  = aggregateByRSA(weeklyRows);
  renderTable(weeklyAgg, "weeklyBody");
  byId("weeklyNote").textContent = weeklyRows.length
    ? `Overall Avg (all RSAs): ${avg(weeklyRows.map(r=> +r.overall||0)).toFixed(1)}`
    : "No data this week.";

  // Monthly — ALL RSAs
  const monthlyRows = RAW.filter(r=> new Date(r.timestamp) >= daysAgo(30));
  const monthlyAgg  = aggregateByRSA(monthlyRows);
  renderTable(monthlyAgg, "monthlyBody");
  byId("monthlyNote").textContent = monthlyRows.length
    ? `Overall Avg (all RSAs): ${avg(monthlyRows.map(r=> +r.overall||0)).toFixed(1)}`
    : "No data this month.";
}
