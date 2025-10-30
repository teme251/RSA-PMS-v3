
const API = window.BACKEND_URL;
const byId = (id)=>document.getElementById(id);
let chart;

function qs(key){
  const u = new URL(location.href);
  return u.searchParams.get(key);
}

async function load(){
  const name = qs("name");
  if(!name){ byId("title").textContent="No associate selected"; return; }
  byId("title").textContent = name;

  const res = await fetch(API, {cache:"no-store"});
  const json = await res.json();
  const rows = (json.data||[]).filter(r=> (r.name||"").toLowerCase() === name.toLowerCase());

  rows.sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp));
  const last = rows[0];
  byId("meta").textContent = rows.length? `Last rated ${(last.timestamp||"").slice(0,10)} • Latest score ${(+last.overall||0).toFixed(1)} • Shift ${last.shift||"-"}` : "—";

  // table (last 5)
  const tb = byId("list"); tb.innerHTML="";
  rows.slice(0,5).forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${(r.timestamp||"").slice(0,10)}</td>
                    <td>${(+r.overall||0).toFixed(1)}</td>
                    <td><span class="badge">${r.shift||"-"}</span></td>
                    <td>${(r.notes||"")}</td>`;
    tb.appendChild(tr);
  });
  byId("empty").style.display = rows.length? "none":"block";

  // chart trend (up to 20 latest)
  const labels = rows.slice(0,20).map(r=> (r.timestamp||"").slice(5,10)).reverse();
  const data = rows.slice(0,20).map(r=> +r.overall||0).reverse();
  draw(labels, data);
}

function draw(labels, data){
  const ctx = document.getElementById("trendChart");
  if(chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ label:"Overall Score", data, tension:.3 }] },
    options: { responsive:true, scales:{ y:{ beginAtZero:true, max:100 } } }
  });
}

document.addEventListener("DOMContentLoaded", load);
