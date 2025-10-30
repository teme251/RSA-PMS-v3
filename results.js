
const API = window.BACKEND_URL;
const byId = (id)=>document.getElementById(id);
const statusFrom = (s)=> s>=85? ["Excellent","ex"] : s>=70? ["On Track","tr"] : ["Needs Coaching","nc"];
let RAW=[], SCOPE="weekly"; // weekly or monthly
let chart;

document.addEventListener("click",(e)=>{
  const tab = e.target.closest(".tab"); if(tab){
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    tab.classList.add("active"); SCOPE = tab.dataset.scope; render();
  }
  const row = e.target.closest("tr[data-name]"); if(row){
    const name = row.getAttribute("data-name");
    const url = "detail.html?name="+encodeURIComponent(name);
    window.open(url, "_blank");
  }
});
byId("search").addEventListener("input", render);

function daysAgo(n){
  const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-n); return d;
}
function withinScope(ts){
  const t = new Date(ts);
  if(SCOPE==="weekly") return t >= daysAgo(7);
  return t >= daysAgo(30);
}

async function load(){
  try{
    const res = await fetch(API, {cache:"no-store"});
    const json = await res.json();
    RAW = Array.isArray(json.data)? json.data : [];
    byId("updated").textContent = "Last updated " + new Date().toLocaleString();
  }catch(e){
    console.error(e); RAW=[];
  }
  render();
}
setInterval(load, 5*60*1000); // auto refresh
document.addEventListener("DOMContentLoaded", load);

function groupByName(rows){ 
  const m = new Map();
  rows.forEach(r=>{
    const k = r.name;
    if(!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  });
  return m;
}

function latestPerAssociate(rows){
  const g = groupByName(rows);
  const out = [];
  g.forEach((list,name)=>{
    list.sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp));
    const r = list[0];
    out.push({name, shift:r.shift||"-", overall:+r.overall||0, last:r.timestamp});
  });
  return out;
}

function avg(arr){ return arr.length? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }

function render(){
  const rows = RAW.filter(r=>withinScope(r.timestamp));
  const latest = latestPerAssociate(rows);
  const q = (byId("search").value||"").toLowerCase();
  const filtered = latest.filter(r=> r.name.toLowerCase().includes(q)).sort((a,b)=> b.overall-a.overall);

  // KPIs
  const overallAvg = avg(filtered.map(r=>r.overall));
  const top = filtered[0];
  const nc = filtered.filter(r=> r.overall < 70).length;
  byId("kpiA").textContent = filtered.length;
  byId("kpiAvg").textContent = overallAvg? overallAvg.toFixed(1) : "—";
  byId("kpiTop").textContent = top? `${top.name} (${top.overall.toFixed(1)})` : "—";
  byId("kpiNC").textContent = nc;

  // Table
  const tb = byId("tbody"); tb.innerHTML="";
  filtered.forEach(r=>{
    const [st, cls] = statusFrom(r.overall);
    const tr = document.createElement("tr");
    tr.setAttribute("data-name", r.name);
    tr.innerHTML = `
      <td><a href="detail.html?name=${encodeURIComponent(r.name)}" target="_blank">${r.name}</a></td>
      <td><span class="badge">${r.shift}</span></td>
      <td>${r.overall.toFixed(1)}</td>
      <td><span class="status ${cls}">${st}</span></td>
      <td>${(r.last||"").slice(0,10)}</td>
    `;
    tb.appendChild(tr);
  });
  byId("empty").style.display = filtered.length? "none":"block";

  // Chart data: per associate average within scope (top 10)
  const g = groupByName(rows);
  const labels = [];
  const values = [];
  g.forEach((list,name)=>{
    labels.push(name);
    values.push(avg(list.map(r=> +r.overall || 0)));
  });
  // sort top 10
  const tuples = labels.map((n,i)=>({n, v: values[i]})).sort((a,b)=>b.v-a.v).slice(0,10);
  drawChart(tuples.map(t=>t.n), tuples.map(t=>+t.v.toFixed(1)));
}

function drawChart(labels, data){
  const ctx = document.getElementById("avgChart");
  if(chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: (SCOPE==="weekly"?"Weekly":"Monthly")+" Avg by RSA", data }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true, max: 100 } },
      plugins: { legend: { display: true } }
    }
  });
}
