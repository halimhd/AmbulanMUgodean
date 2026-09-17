// AmbulanMu Godean - frontend V2
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxAwH-y4cNBuVYYRAiakT6MID4dWbutH1Wsc-kokSScF-7Siv5teQSDLU0z9KXh1jRn9w/exec";

(() => {
  "use strict";

  const defaultMaster = {
    crew: ["Rehan","Crew 2","Crew 3"],
    armada: ["R1","R2"],
    keperluan: [
      "Jemput HD",
      "Antar HD",
      "Rujukan",
      "Antar/Jemput Pasien",
      "Lainnya"
    ]
  };

  let reports = [];

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const esc = v =>
    String(v ?? "").replace(/[&<>"']/g, m => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#039;"
    }[m]));

  const rupiah = n =>
    new Intl.NumberFormat("id-ID", {
      style:"currency",
      currency:"IDR",
      maximumFractionDigits:0
    })
    .format(Number(n) || 0)
    .replace(/\s/g,"");

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };

  const formatDate = s => {
    if(!s) return "-";

    const [y,m,d] = String(s).slice(0,10).split("-");

    return d && m && y
      ? `${d}-${m}-${y}`
      : String(s);
  };

  const dayName = s =>
    new Date(`${String(s).slice(0,10)}T00:00:00`)
      .toLocaleDateString("id-ID",{weekday:"long"});

  const getMaster = () => {
    try {
      return {
        ...defaultMaster,
        ...JSON.parse(
          localStorage.getItem("amb_master") || "{}"
        )
      };
    } catch {
      return {...defaultMaster};
    }
  };

  function fillSelect(id, items) {
    const el = $(id);

    if(!el) return;

    el.innerHTML =
      '<option value="">Pilih...</option>' +
      items.map(x =>
        `<option value="${esc(x)}">${esc(x)}</option>`
      ).join("");
  }

  function loadMasterUI() {
    const m = getMaster();

    fillSelect("#crew", m.crew);
    fillSelect("#armada", m.armada);
    fillSelect("#keperluan", m.keperluan);

    $("#masterCrew").value = m.crew.join("\n");
    $("#masterArmada").value = m.armada.join("\n");
    $("#masterKeperluan").value = m.keperluan.join("\n");
  }

  function defaultForm() {
    $("#tanggal").value = today();

    const d = new Date();

    $("#waktu").value =
      `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }

  function setStatus(msg, ok=true) {
    $("#status").textContent = msg;
    $("#status").className =
      "status " + (msg ? (ok ? "ok" : "err") : "");
  }

  function mapsSearch(q) {
    if(q) {
      window.open(
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(q),
        "_blank",
        "noopener"
      );
    }
  }

  function routeUrl(a,b) {
    return "https://www.google.com/maps/dir/?api=1&origin=" +
      encodeURIComponent(a || "") +
      "&destination=" +
      encodeURIComponent(b || "");
  }

  async function compressPhoto(file) {
    if(!file) return null;

    const img = await new Promise((res,rej) => {
      const i = new Image();

      i.onload = () => {
        URL.revokeObjectURL(i.src);
        res(i);
      };

      i.onerror = rej;
      i.src = URL.createObjectURL(file);
    });

    const max = 1280;

    const scale =
      Math.min(
        1,
        max / Math.max(img.width,img.height)
      );

    const c = document.createElement("canvas");

    c.width =
      Math.max(1,Math.round(img.width * scale));

    c.height =
      Math.max(1,Math.round(img.height * scale));

    c.getContext("2d")
      .drawImage(img,0,0,c.width,c.height);

    return c.toDataURL("image/jpeg",.72);
  }

  async function postPayload(payload) {
    if(
      !WEB_APP_URL ||
      WEB_APP_URL.startsWith("GANTI_")
    ) {
      return {
        ok:false,
        error:"WEB_APP_URL belum diisi"
      };
    }

    const body = new URLSearchParams();

    body.set(
      "payload",
      JSON.stringify(payload)
    );

    const res = await fetch(
      WEB_APP_URL,
      {
        method:"POST",
        headers:{
          "Content-Type":
            "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body
      }
    );

    const text = await res.text();

    let out;

    try {
      out = JSON.parse(text);
    } catch {
      throw new Error(
        "Server mengembalikan respons yang tidak dikenali"
      );
    }

    return out;
  }

  async function fetchReports() {
    try {
      const res = await fetch(
        WEB_APP_URL +
        "?action=list&t=" +
        Date.now(),
        {
          cache:"no-store"
        }
      );

      if(!res.ok) {
        throw new Error(
          "HTTP " + res.status
        );
      }

      const data = await res.json();

      if(!Array.isArray(data)) {
        throw new Error(
          "Data rekap tidak valid"
        );
      }

      reports = data;

      renderTable();

    } catch(e) {

      reports =
        JSON.parse(
          localStorage.getItem(
            "amb_reports"
          ) || "[]"
        );

      renderTable();

      if($("#status")) {
        setStatus(
          "Gagal mengambil data online: " +
          e.message,
          false
        );
      }
    }
  }

  function filtered() {
    const a = $("#fromDate").value;
    const b = $("#toDate").value;
    const q =
      $("#search").value.trim().toLowerCase();

    return reports.filter(r =>
      (!a ||
        String(r.tanggal).slice(0,10) >= a) &&
      (!b ||
        String(r.tanggal).slice(0,10) <= b) &&
      (
        !q ||
        [
          r.nama,
          r.crew,
          r.tujuan,
          r.jemput,
          r.keperluan,
          r.armada,
          r.alamat
        ]
        .join(" ")
        .toLowerCase()
        .includes(q)
      )
    );
  }

  function updateDashboard(rows) {
    $("#statServices").textContent =
      rows.length;

    const masuk =
      rows.reduce(
        (s,r) =>
          s + Number(r.kasMasuk || 0),
        0
      );

    const keluar =
      rows.reduce(
        (s,r) =>
          s + Number(r.kasKeluar || 0),
        0
      );

    const km =
      rows.reduce(
        (s,r) =>
          s + Number(r.jarakKm || 0),
        0
      );

    $("#statIn").textContent =
      rupiah(masuk);

    $("#statOut").textContent =
      rupiah(keluar);

    $("#statBalance").textContent =
      rupiah(masuk - keluar);

    $("#statKm").textContent =
      (Number.isInteger(km)
        ? km
        : km.toFixed(1)) +
      " KM";
  }

  function renderTable() {
    const rows = filtered();

    updateDashboard(rows);

    const body = $("#tableBody");

    if(!rows.length) {
      body.innerHTML =
        '<tr><td colspan="12" class="empty">' +
        'Belum ada data sesuai filter.' +
        '</td></tr>';

      return;
    }

    body.innerHTML =
      rows.map((r,i) =>
        `<tr>
          <td>${formatDate(r.tanggal)}</td>
          <td>${esc(r.waktu || "")}</td>
          <td><b>${esc(r.nama)}</b></td>
          <td>${esc(r.keperluan)}</td>
          <td>${esc(r.jemput)} → ${esc(r.tujuan)}</td>
          <td>${esc(r.armada)}</td>
          <td>${esc(r.crew)}</td>
          <td>${rupiah(r.kasMasuk)}</td>
          <td>
            ${rupiah(r.kasKeluar)}
            ${
              r.ketKasKeluar
              ? `<br><small>${esc(r.ketKasKeluar)}</small>`
              : ""
            }
          </td>
          <td>${esc(r.jarakKm || "-")}</td>
          <td>
            ${
              r.fotoUrl
              ? `<button
                  type="button"
                  class="photo-link"
                  data-photo="${esc(r.fotoUrl)}"
                  data-caption="${esc(r.nama || "")}">
                  📷 Lihat
                </button>`
              : "-"
            }
          </td>
          <td>
            <button
              type="button"
              class="table-btn"
              data-detail="${i}">
              Detail
            </button>

            <button
              type="button"
              class="table-btn edit"
              data-edit="${i}">
              Edit
            </button>
          </td>
        </tr>`
      ).join("");

    $$("[data-detail]")
      .forEach(b =>
        b.onclick = () =>
          showDetail(
            rows[
              Number(b.dataset.detail)
            ]
          )
      );

    $$("[data-edit]")
      .forEach(b =>
        b.onclick = () =>
          editReport(
            rows[
              Number(b.dataset.edit)
            ]
          )
      );

    $$("[data-photo]")
      .forEach(b =>
        b.onclick = () =>
          openPhoto(
            b.dataset.photo,
            b.dataset.caption
          )
      );
  }

  function waText(r) {
    return [
      "*Laporan Layanan AmbulanMu Godean*",
      "",
      `*Hari*          : ${dayName(r.tanggal)}`,
      `*Tanggal*       : ${formatDate(r.tanggal)}`,
      `*Waktu*         : ${r.waktu || "-"} WIB`,
      `*Keperluan*     : ${r.keperluan || "-"}`,
      `*Nama*          : ${r.nama || "-"}`,
      `*Alamat*        : ${r.alamat || "-"}`,
      `*Titik jemput*  : ${r.jemput || "-"}`,
      `*Titik Tujuan*  : ${r.tujuan || "-"}`,
      `*Armada*        : ${r.armada || "-"}`,
      `*Crew*          : ${r.crew || "-"}`,
      `*Kas Masuk*     : ${rupiah(r.kasMasuk)}`,
      `*Kas Keluar*    : ${rupiah(r.kasKeluar)}`,
      `*Ket. Kas Keluar*: ${r.ketKasKeluar || "-"}`,
      `*Jarak Tempuh*  : ${r.jarakKm || "-"} KM`,
      `*Note*          : ${r.note || "-"}`,
      "",
      "*Tetap semangat melayani umat,*",
      "*Memberi untuk Negeri*"
    ].join("\n");
  }

  async function copyWA(r) {
    const text = waText(r);

    try {
      await navigator.clipboard.writeText(text);

      alert(
        "Format WhatsApp tersalin."
      );

    } catch {
      prompt(
        "Salin teks WhatsApp berikut:",
        text
      );
    }
  }

  function sendWA(r) {
    window.open(
      "https://wa.me/?text=" +
      encodeURIComponent(
        waText(r)
      ),
      "_blank",
      "noopener"
    );
  }

  function showDetail(r) {
    const p = $("#detailPanel");

    p.classList.remove("hidden");

    p.innerHTML =
      `<h3>Detail: ${esc(r.nama || "")}</h3>
      <div class="detail-grid">
      ${
        Object.entries({
          Tanggal:formatDate(r.tanggal),
          Waktu:(r.waktu || "-") + " WIB",
          Keperluan:r.keperluan || "-",
          Nama:r.nama || "-",
          Alamat:r.alamat || "-",
          "Titik Jemput":r.jemput || "-",
          "Titik Tujuan":r.tujuan || "-",
          Armada:r.armada || "-",
          Crew:r.crew || "-",
          "Kas Masuk":rupiah(r.kasMasuk),
          "Kas Keluar":rupiah(r.kasKeluar),
          "Keterangan Kas Keluar":
            r.ketKasKeluar || "-",
          "Jarak Tempuh":
            (r.jarakKm || "-") + " KM",
          Note:r.note || "-"
        })
        .map(([k,v]) =>
          `<div class="detail-item">
            <b>${esc(k)}</b><br>
            ${esc(v)}
          </div>`
        )
        .join("")
      }
      </div>

      <div class="detail-actions">

        <button
          type="button"
          id="detailCopy"
          class="btn secondary">
          📋 Copy WhatsApp
        </button>

        <button
          type="button"
          id="detailWA"
          class="btn primary">
          📤 Kirim laporan ke WA
        </button>

        <button
          type="button"
          id="detailRoute"
          class="btn secondary">
          🗺️ Rute
        </button>

        <button
          type="button"
          id="detailEdit"
          class="btn secondary">
          ✏️ Edit
        </button>

      </div>

      ${
        r.fotoUrl
        ? `<p><b>Dokumentasi</b></p>
           <img
             class="detail-photo"
             id="detailPhoto"
             src="${esc(r.fotoUrl)}"
             alt="Dokumentasi layanan">`
        : ""
      }`;

    $("#detailCopy").onclick =
      () => copyWA(r);

    $("#detailWA").onclick =
      () => sendWA(r);

    $("#detailRoute").onclick =
      () =>
        window.open(
          routeUrl(
            r.jemput,
            r.tujuan
          ),
          "_blank",
          "noopener"
        );

    $("#detailEdit").onclick =
      () => editReport(r);

    if($("#detailPhoto")) {
      $("#detailPhoto").onclick =
        () =>
          openPhoto(
            r.fotoUrl,
            r.nama || ""
          );
    }

    p.scrollIntoView({
      behavior:"smooth",
      block:"nearest"
    });
  }

  function editReport(r) {
    $("#editId").value =
      r.id || "";

    $("#existingFotoUrl").value =
      r.fotoUrl || "";

    [
      "tanggal",
      "waktu",
      "keperluan",
      "nama",
      "alamat",
      "crew",
      "armada",
      "jemput",
      "tujuan",
      "kasMasuk",
      "kasKeluar",
      "ketKasKeluar",
      "jarakKm",
      "note"
    ].forEach(k => {
      if($("#"+k)) {
        $("#"+k).value =
          r[k] ?? "";
      }
    });

    $("#submitBtn").textContent =
      "💾 Simpan Perubahan";

    $("#editBanner")
      .classList
      .remove("hidden");

    $("#formView")
      .classList
      .add("active");

    $("#dataView")
      .classList
      .remove("active");

    $$(".nav-btn")
      .forEach(b =>
        b.classList.toggle(
          "active",
          b.dataset.view === "formView"
        )
      );

    window.scrollTo({
      top:0,
      behavior:"smooth"
    });
  }

  function clearEdit() {
    $("#editId").value = "";
    $("#existingFotoUrl").value = "";

    $("#editBanner")
      .classList
      .add("hidden");

    $("#submitBtn").textContent =
      "🚑 Simpan Laporan";
  }

  function resetForm() {
    $("#reportForm").reset();

    clearEdit();

    defaultForm();

    $("#kasMasuk").value = 0;
    $("#kasKeluar").value = 0;

    $("#photoPreview").innerHTML = "";

    $("#routeText").textContent =
      "Titik jemput → titik tujuan";

    setStatus("");
  }

  function openPhoto(url,caption) {
    if(!url) return;

    $("#modalPhoto").src = url;

    $("#photoCaption").textContent =
      caption
      ? "Dokumentasi: " + caption
      : "";

    $("#photoModal")
      .classList
      .remove("hidden");

    document.body.style.overflow =
      "hidden";
  }

  function closePhoto() {
    $("#modalPhoto").src = "";

    $("#photoModal")
      .classList
      .add("hidden");

    document.body.style.overflow =
      "";
  }

  async function saveReport(e) {
    e.preventDefault();

    const form = e.target;

    if(!form.reportValidity())
      return;

    setStatus(
      "Menyimpan laporan...",
      true
    );

    try {
      const fd = new FormData(form);

      const r =
        Object.fromEntries(
          fd.entries()
        );

      r.kasMasuk =
        Number(r.kasMasuk || 0);

      r.kasKeluar =
        Number(r.kasKeluar || 0);

      r.jarakKm =
        Number(r.jarakKm || 0);

      r.createdAt =
        new Date().toISOString();

      const file =
        $("#foto").files[0];

      if(file) {
        r.fotoData =
          await compressPhoto(file);

        $("#photoPreview").innerHTML =
          `<img
            src="${r.fotoData}"
            alt="Pratinjau foto">`;
      }

      const isEdit =
        !!r.editId;

      r.action =
        isEdit
        ? "update"
        : "create";

      const out =
        await postPayload(r);

      if(!out.ok) {
        throw new Error(
          out.error ||
          "Gagal menyimpan"
        );
      }

      setStatus(
        isEdit
        ? "✓ Perubahan laporan berhasil disimpan."
        : "✓ Laporan berhasil disimpan.",
        true
      );

      resetForm();

      await fetchReports();

    } catch(err) {

      console.error(err);

      setStatus(
        "Gagal menyimpan: " +
        err.message,
        false
      );
    }
  }

  function init() {

    // Navigation
    $$(".nav-btn")
      .forEach(btn =>
        btn.addEventListener(
          "click",
          () => {

            $$(".nav-btn")
              .forEach(x =>
                x.classList.remove(
                  "active"
                )
              );

            btn.classList.add(
              "active"
            );

            $$(".view")
              .forEach(v =>
                v.classList.remove(
                  "active"
                )
              );

            $("#" + btn.dataset.view)
              .classList
              .add("active");

            if(
              btn.dataset.view ===
              "dataView"
            ) {
              fetchReports();
            }

            window.scrollTo({
              top:0,
              behavior:"smooth"
            });
          }
        )
      );

    // Form controls
    $("#reportForm")
      .addEventListener(
        "submit",
        saveReport
      );

    $("#resetBtn")
      .addEventListener(
        "click",
        () => {
          if(
            confirm(
              "Bersihkan isian?"
            )
          ) {
            resetForm();
          }
        }
      );

    $("#duplicateBtn")
      .addEventListener(
        "click",
        () => {

          const last =
            reports.find(
              r =>
                r.keperluan ===
                  "Jemput HD" ||
                r.keperluan ===
                  "Antar HD"
            );

          if(!last) {
            alert(
              "Belum ada laporan HD untuk diduplikat."
            );

            return;
          }

          [
            "nama",
            "alamat",
            "jemput",
            "tujuan",
            "armada",
            "crew",
            "ketKasKeluar",
            "note"
          ].forEach(k =>
            $("#"+k).value =
              last[k] || ""
          );

          $("#keperluan").value =
            last.keperluan || "";

          $("#kasMasuk").value =
            last.kasMasuk || 0;

          $("#kasKeluar").value =
            last.kasKeluar || 0;

          $("#jarakKm").value =
            "";

          clearEdit();

          setStatus(
            "Data HD terakhir sudah disalin. Silakan periksa sebelum simpan.",
            true
          );
        }
      );

    $$(".map-btn")
      .forEach(b =>
        b.addEventListener(
          "click",
          () =>
            mapsSearch(
              $("#" + b.dataset.map).value
            )
        )
      );

    $("#routeBtn")
      .addEventListener(
        "click",
        () => {

          const a =
            $("#jemput").value;

          const b =
            $("#tujuan").value;

          if(a && b) {

            window.open(
              routeUrl(a,b),
              "_blank",
              "noopener"
            );

          } else {

            alert(
              "Isi titik jemput dan tujuan terlebih dahulu."
            );
          }
        }
      );

    ["jemput","tujuan"]
      .forEach(id =>
        $("#" + id)
          .addEventListener(
            "input",
            () =>
              $("#routeText")
                .textContent =
                  (
                    $("#jemput").value ||
                    "Titik jemput"
                  ) +
                  " → " +
                  (
                    $("#tujuan").value ||
                    "titik tujuan"
                  )
          )
      );

    $("#foto")
      .addEventListener(
        "change",
        async () => {

          const f =
            $("#foto").files[0];

          if(!f) {
            $("#photoPreview")
              .innerHTML = "";

            return;
          }

          try {

            $("#photoPreview")
              .innerHTML =
                `<img
                  alt="Pratinjau foto"
                  src="${
                    await compressPhoto(f)
                  }">`;

          } catch {

            alert(
              "Foto tidak dapat dibaca."
            );
          }
        }
      );

    // Rekap
    ["fromDate","toDate","search"]
      .forEach(id =>
        $("#" + id)
          .addEventListener(
            "input",
            renderTable
          )
      );

    $("#refreshBtn")
      .addEventListener(
        "click",
        fetchReports
      );

    $("#exportBtn")
      .addEventListener(
        "click",
        () => {

          const rows =
            filtered();

          const headers = [
            "Tanggal",
            "Waktu",
            "Hari",
            "Keperluan",
            "Nama",
            "Alamat",
            "Titik Jemput",
            "Titik Tujuan",
            "Armada",
            "Crew",
            "Kas Masuk",
            "Kas Keluar",
            "Ket. Kas Keluar",
            "Jarak KM",
            "Note",
            "Foto URL"
          ];

          const data = [
            headers,
            ...rows.map(r => [
              r.tanggal,
              r.waktu,
              dayName(r.tanggal),
              r.keperluan,
              r.nama,
              r.alamat,
              r.jemput,
              r.tujuan,
              r.armada,
              r.crew,
              r.kasMasuk,
              r.kasKeluar,
              r.ketKasKeluar,
              r.jarakKm,
              r.note,
              r.fotoUrl
            ])
          ];

          const csv =
            data.map(row =>
              row.map(x =>
                `"${String(x ?? "")
                  .replaceAll('"','""')}"`
              ).join(";")
            ).join("\n");

          const a =
            document.createElement("a");

          a.href =
            URL.createObjectURL(
              new Blob(
                ["\ufeff" + csv],
                {
                  type:
                    "text/csv;charset=utf-8"
                }
              )
            );

          a.download =
            `rekap-ambulance-${today()}.csv`;

          a.click();
        }
      );

    // Master
    $("#saveMasterBtn")
      .addEventListener(
        "click",
        () => {

          const m = {

            crew:
              $("#masterCrew")
                .value
                .split("\n")
                .map(x => x.trim())
                .filter(Boolean),

            armada:
              $("#masterArmada")
                .value
                .split("\n")
                .map(x => x.trim())
                .filter(Boolean),

            keperluan:
              $("#masterKeperluan")
                .value
                .split("\n")
                .map(x => x.trim())
                .filter(Boolean)
          };

          localStorage.setItem(
            "amb_master",
            JSON.stringify(m)
          );

          loadMasterUI();

          alert(
            "Master tersimpan di perangkat ini."
          );
        }
      );

    // Modal
    $("#closePhotoModal")
      .addEventListener(
        "click",
        closePhoto
      );

    $("#photoModal")
      .addEventListener(
        "click",
        e => {
          if(
            e.target.matches(
              "[data-close-modal]"
            )
          ) {
            closePhoto();
          }
        }
      );

    document.addEventListener(
      "keydown",
      e => {
        if(e.key === "Escape") {
          closePhoto();
        }
      }
    );

    defaultForm();

    loadMasterUI();

    fetchReports();
  }

  if(
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }

})();
