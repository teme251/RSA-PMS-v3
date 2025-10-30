const API = window.BACKEND_URL;
const byId = (id)=>document.getElementById(id);
let RAW=[];
let weeklyChart, monthlyChart;

document.getElementById("search").addEventListener("input", renderTable);

function startOfDay(d=new Date()){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function daysAgo(n){ const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-n); return d; }
function avg(arr){ return arr.length? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function statusFrom(s){ return s>=85? ["Excellent","badge"] : s>=70? ["On Track","badge"] : ["Needs Coaching","badge"]; }

async function load(){
  try{
    const res = await fetch(API, {cache:"no-store"});
    const json = await res.json();
    RAW = Array.isArray(json.data) ? json.data : [];
    byId("updated").textContent = "Last updated " + new Date().toLocaleString();
  }catch(e){ RAW=[]; }
  renderToday();
  renderTop3();
  renderTable();
  renderBottomCharts();
}
document.addEventListener("DOMContentLoaded", load);
setInterval(load, 5*60*1000);

function renderToday(){
  const today = RAW.filter(r=> new Date(r.timestamp) >= startOfDay());
  const todayAvg = avg(today.map(r=> +r.overall||0));
  const top = [...today].sort((a,b)=> (+b.overall||0)-(+a.overall||0))[0];
  const cust = today.reduce((s,r)=> s+(+r.customersServed||0),0);

  byId("kpiTodayCount").textContent = today.length || "0";
  byId("kpiTodayAvg").textContent = today.length ? todayAvg.toFixed(1) : "—";
  byId("kpiTodayTop").textContent = top ? `${top.name} (${(+top.overall).toFixed(1)})` : "—";
  byId("kpiTodayCust").textContent = cust || "0";
}

function renderTop3(){
  const today = RAW.filter(r=> new Date(r.timestamp) >= startOfDay());
  const best = [...today].sort((a,b)=> (+b.overall||0)-(+a.overall||0)).slice(0,3);
  const worst = [...today].sort((a,b)=> (+a.overall||0)-(+b.overall||0)).slice(0,3);
  fillList("best3", best);
  fillList("worst3", worst);
}
function fillList(id, arr){
  const el = byId(id); el.innerHTML="";
  arr.forEach(r=>{ const li=document.createElement("li"); li.textContent=`${r.name} — ${(+r.overall||0).toFixed(1)}`; el.appendChild(li); });
}

function latestPerAssociate(rows){
  const m = new Map();
  rows.forEach(r=>{
    const k = r.name;
    if(!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  });
  const out=[];
  m.forEach((list,name)=>{
    list.sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp));
    const r=list[0];
    out.push({name, shift:r.shift||"-", overall:+r.overall||0, last:r.timestamp});
  });
  return out;
}

function renderTable(){
  const today = RAW.filter(r=> new Date(r.timestamp) >= startOfDay());
  const latest = latestPerAssociate(today);
  const q = (byId("search").value||"").toLowerCase();
  const filtered = latest.filter(r=> r.name.toLowerCase().includes(q)).sort((a,b)=> b.overall-a.overall);

  const tb = byId("tbody"); tb.innerHTML="";
  filtered.forEach(r=>{
    const [st, cls] = statusFrom(r.overall);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><a href="detail.html?name=${encodeURIComponent(r.name)}" target="_blank">${r.name}</a></td>
      <td><span class="badge">${r.shift}</span></td>
      <td>${r.overall.toFixed(1)}</td>
      <td><span class="${cls}">${st}</span></td>
      <td>${(r.last||"").slice(0,10)}</td>
    `;
    tb.appendChild(tr);
  });
  byId("empty").style.display = filtered.length ? "none":"block";
}

function buildTop10Averages(rows){
  const m=new Map();
  rows.forEach(r=>{
    const arr = m.get(r.name)||[];
    arr.push(+r.overall||0);
    m.set(r.name, arr);
  });
  const tuples = Array.from(m.entries()).map(([n,a])=>({n, v: avg(a)})).sort((a,b)=> b.v-a.v).slice(0,10);
  return { labels: tuples.map(t=>t.n), values: tuples.map(t=> +t.v.toFixed(1)) };
}

function renderBottomCharts(){
  // weekly
  const weekly = RAW.filter(r=> new Date(r.timestamp) >= daysAgo(7));
  const w = buildTop10Averages(weekly);
  if(weeklyChart) weeklyChart.destroy();
  weeklyChart = new Chart(document.getElementById("weeklyChart"), {
    type: "bar",
    data: { labels: w.labels, datasets: [{ label: "Weekly Avg by RSA", data: w.values }] },
    options: { responsive:true, scales:{ y:{ beginAtZero:true, max:100 } } }
  });
  byId("weeklyNote").textContent = weekly.length ? `Entries: ${weekly.length} • Overall Avg: ${avg(weekly.map(r=>+r.overall||0)).toFixed(1)}` : "No data this week.";

  // monthly
  const monthly = RAW.filter(r=> new Date(r.timestamp) >= daysAgo(30));
  const m = buildTop10Averages(monthly);
  if(monthlyChart) monthlyChart.destroy();
  monthlyChart = new Chart(document.getElementById("monthlyChart"), {
    type: "bar",
    data: { labels: m.labels, datasets: [{ label: "Monthly Avg by RSA", data: m.values }] },
    options: { responsive:true, scales:{ y:{ beginAtZero:true, max:100 } } }
  });
  byId("monthlyNote").textContent = monthly.length ? `Entries: ${monthly.length} • Overall Avg: ${avg(monthly.map(r=>+r.overall||0)).toFixed(1)}` : "No data this month.";
}
