// AmbulanMu Godean - frontend
// Setelah membuat Google Apps Script, isi URL WEB_APP_URL di bawah.
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxAwH-y4cNBuVYYRAiakT6MID4dWbutH1Wsc-kokSScF-7Siv5teQSDLU0z9KXh1jRn9w/exec";

const defaultMaster = {
  crew:["Rehan","Crew 2","Crew 3"],
  armada:["R1","R2"],
  keperluan:["Jemput HD","Antar HD","Rujukan","Antar/Jemput Pasien","Lainnya"]
};
let reports=[];

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function rupiah(n){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n||0))}
function today(){return new Date().toISOString().slice(0,10)}
function formatDate(s){if(!s)return "-";const [y,m,d]=s.slice(0,10).split("-");return `${d}-${m}-${y}`}
function getMaster(){
  try{return {...defaultMaster,...JSON.parse(localStorage.getItem("amb_master")||"{}")}}catch{return defaultMaster}
}
function fillSelect(id,items){
  const el=$(id); el.innerHTML='<option value="">Pilih...</option>'+items.map(x=>`<option>${esc(x)}</option>`).join("");
}
function loadMasterUI(){
  const m=getMaster(); fillSelect("#crew",m.crew); fillSelect("#armada",m.armada); fillSelect("#keperluan",m.keperluan);
  $("#masterCrew").value=m.crew.join("\n");$("#masterArmada").value=m.armada.join("\n");$("#masterKeperluan").value=m.keperluan.join("\n");
}
function defaultForm(){
  $("#tanggal").value=today(); $("#waktu").value=new Date().toTimeString().slice(0,5);
}
function mapsSearch(q){if(!q)return;window.open("https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(q),"_blank")}
function routeUrl(a,b){return "https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(a)+"&destination="+encodeURIComponent(b)}
function setStatus(msg,ok=true){$("#status").textContent=msg;$("#status").className="status "+(ok?"ok":"err")}
function localSave(r){const old=JSON.parse(localStorage.getItem("amb_reports")||"[]");old.unshift(r);localStorage.setItem("amb_reports",JSON.stringify(old));reports=old}
async function compressPhoto(file){
  if(!file)return null;
  const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=URL.createObjectURL(file)});
  const max=1280,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");
  c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext("2d").drawImage(img,0,0,c.width,c.height);
  return c.toDataURL("image/jpeg",.72);
}
async function postReport(r){
  if(WEB_APP_URL.startsWith("GANTI_")){localSave(r);return {local:true}}
  const body=new URLSearchParams(); body.set("payload",JSON.stringify(r));
  const resp=await fetch(WEB_APP_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body});
  return await resp.json();
}
async function fetchReports(){
  if(WEB_APP_URL.startsWith("GANTI_")){reports=JSON.parse(localStorage.getItem("amb_reports")||"[]");renderTable();return}
  try{
    const res=await fetch(WEB_APP_URL+"?action=list",{cache:"no-store"});
    reports=await res.json();renderTable();
  }catch(e){reports=JSON.parse(localStorage.getItem("amb_reports")||"[]");renderTable();setStatus("Gagal mengambil data online. Menampilkan data perangkat.",false)}
}
function filtered(){
  const a=$("#fromDate").value,b=$("#toDate").value,q=$("#search").value.toLowerCase();
  return reports.filter(r=>(!a||r.tanggal>=a)&&(!b||r.tanggal<=b)&&(!q||[r.nama,r.crew,r.tujuan,r.keperluan,r.armada].join(" ").toLowerCase().includes(q)));
}
function renderTable(){
  const rows=filtered();
  $("#tableBody").innerHTML=rows.length?rows.map((r,i)=>`<tr>
  <td>${formatDate(r.tanggal)}</td><td>${esc(r.waktu)}</td><td><b>${esc(r.nama)}</b></td><td>${esc(r.keperluan)}</td>
  <td>${esc(r.jemput)} → ${esc(r.tujuan)}</td><td>${esc(r.armada)}</td><td>${esc(r.crew)}</td>
  <td>${rupiah(r.kasMasuk)}</td><td>${rupiah(r.kasKeluar)}${r.ketKasKeluar?`<br><small>${esc(r.ketKasKeluar)}</small>`:""}</td>
  <td>${esc(r.jarakKm||"-")}</td><td>${r.fotoUrl?`<a href="${esc(r.fotoUrl)}" target="_blank">📷 Lihat</a>`:"-"}</td>
  <td><button class="table-btn" data-detail="${i}">Detail</button></td></tr>`).join(""):`<tr><td colspan="12" class="empty">Belum ada data sesuai filter.</td></tr>`;
  $$("#tableBody [data-detail]").forEach(btn=>btn.onclick=()=>showDetail(rows[Number(btn.dataset.detail)]));
}
function showDetail(r){
  const p=$("#detailPanel");p.classList.remove("hidden");
  p.innerHTML=`<h3>Detail: ${esc(r.nama)}</h3><div class="detail-grid">
  ${Object.entries({Tanggal:formatDate(r.tanggal),Waktu:r.waktu,Keperluan:r.keperluan,Alamat:r.alamat,"Titik Jemput":r.jemput,"Titik Tujuan":r.tujuan,Armada:r.armada,Crew:r.crew,"Kas Masuk":rupiah(r.kasMasuk),"Kas Keluar":rupiah(r.kasKeluar),"Keterangan Kas Keluar":r.ketKasKeluar||"-","Jarak":(r.jarakKm||"-")+" KM",Catatan:r.note||"-"}).map(([k,v])=>`<div class="detail-item"><b>${esc(k)}</b><br>${esc(v)}</div>`).join("")}</div>
  <div class="actions"><button class="btn secondary" onclick='navigator.clipboard.writeText(${JSON.stringify(waText(r))});alert("Format WhatsApp tersalin.")'>📋 Copy WhatsApp</button><button class="btn secondary" onclick='window.open(${JSON.stringify(routeUrl(r.jemput,r.tujuan))},"_blank")'>🗺️ Rute</button></div>
  ${r.fotoUrl?`<p><b>Dokumentasi</b></p><img src="${esc(r.fotoUrl)}" alt="Dokumentasi layanan">`:""}`;
  p.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function waText(r){
 return `*Laporan Layanan AmbulanMu Godean*\\n\\n*Hari* : ${new Date(r.tanggal+"T00:00:00").toLocaleDateString("id-ID",{weekday:"long"})}\\n*Tanggal* : ${formatDate(r.tanggal)}\\n*Waktu* : ${r.waktu} WIB\\n*Keperluan* : ${r.keperluan}\\n*Nama* : ${r.nama}\\n*Alamat* : ${r.alamat}\\n*Titik jemput* : ${r.jemput}\\n*Titik Tujuan* : ${r.tujuan}\\n*Armada* : ${r.armada}\\n*Crew* : ${r.crew}\\n*Kas Masuk* : ${rupiah(r.kasMasuk)}\\n*Kas keluar* : ${rupiah(r.kasKeluar)}${r.ketKasKeluar?` (${r.ketKasKeluar})`:""}\\n*Jarak tempuh* : ${r.jarakKm||"-"} KM\\n*Note* : ${r.note||"-"}\\n\\n*Tetap semangat melayani umat*,\\n*Memberi untuk Negeri*`;
}
function exportExcel(){
  const rows=filtered();const headers=["Tanggal","Waktu","Hari","Keperluan","Nama","Alamat","Titik Jemput","Titik Tujuan","Armada","Crew","Kas Masuk","Kas Keluar","Ket. Kas Keluar","Jarak KM","Catatan","Foto"];
  const data=rows.map(r=>[r.tanggal,r.waktu,new Date(r.tanggal+"T00:00:00").toLocaleDateString("id-ID",{weekday:"long"}),r.keperluan,r.nama,r.alamat,r.jemput,r.tujuan,r.armada,r.crew,r.kasMasuk,r.kasKeluar,r.ketKasKeluar,r.jarakKm,r.note,r.fotoUrl]);
  const csv=[headers,...data].map(row=>row.map(x=>`"${String(x??"").replaceAll('"','""')}"`).join(";")).join("\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`rekap-ambulance-${today()}.csv`;a.click();
}
$("#reportForm").onsubmit=async e=>{
 e.preventDefault();setStatus("Menyimpan laporan...",true);
 try{
  const fd=new FormData(e.target),r=Object.fromEntries(fd.entries());r.kasMasuk=Number(r.kasMasuk||0);r.kasKeluar=Number(r.kasKeluar||0);r.createdAt=new Date().toISOString();
  const file=$("#foto").files[0];if(file){r.fotoData=await compressPhoto(file);$("#photoPreview").innerHTML=`<img src="${r.fotoData}" alt="Pratinjau foto">`}
  const out=await postReport(r); if(!out.local&&!out.ok)throw Error(out.error||"Gagal menyimpan");
  setStatus("✓ Laporan berhasil disimpan.",true);$("#reportForm").reset();defaultForm();$("#photoPreview").innerHTML="";
 }catch(err){console.error(err);setStatus("Gagal menyimpan: "+err.message,false)}
};
$("#resetBtn").onclick=()=>{if(confirm("Bersihkan isian?")){$("#reportForm").reset();defaultForm();$("#photoPreview").innerHTML="";setStatus("")}}
$("#duplicateBtn").onclick=()=>{
 const last=reports.find(r=>r.keperluan==="Jemput HD"||r.keperluan==="Antar HD"); if(!last){alert("Belum ada laporan HD untuk diduplikat.");return}
 ["nama","alamat","jemput","tujuan","armada","crew","ketKasKeluar","note"].forEach(k=>{const el=$(`[name="${k}"]`);if(el)el.value=last[k]||""});$("#keperluan").value=last.keperluan;$("#kasMasuk").value=last.kasMasuk||0;$("#kasKeluar").value=last.kasKeluar||0;$("#jarakKm").value="";setStatus("Data HD terakhir sudah disalin. Silakan periksa sebelum simpan.",true)
};
$$(".map-btn").forEach(b=>b.onclick=()=>mapsSearch($("#"+b.dataset.map).value));
$("#routeBtn").onclick=()=>{const a=$("#jemput").value,b=$("#tujuan").value;if(a&&b)window.open(routeUrl(a,b),"_blank");else alert("Isi titik jemput dan tujuan terlebih dahulu.")};
["fromDate","toDate","search"].forEach(id=>$("#"+id).oninput=renderTable);$("#refreshBtn").onclick=fetchReports;$("#exportBtn").onclick=exportExcel;
$("#saveMasterBtn").onclick=()=>{const m={crew:$("#masterCrew").value.split("\n").map(x=>x.trim()).filter(Boolean),armada:$("#masterArmada").value.split("\n").map(x=>x.trim()).filter(Boolean),keperluan:$("#masterKeperluan").value.split("\n").map(x=>x.trim()).filter(Boolean)};localStorage.setItem("amb_master",JSON.stringify(m));loadMasterUI();alert("Master tersimpan di perangkat ini.")};
$$(".nav-btn").forEach(b=>b.onclick=()=>{$$(".nav-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active");$$(".view").forEach(x=>x.classList.remove("active"));$("#"+b.dataset.view).classList.add("active");if(b.dataset.view==="dataView")fetchReports()});
defaultForm();loadMasterUI();fetchReports();
