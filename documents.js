/* TradeLink supporting documents: photo ID, qualification certificate, trade licence.
   Run 07-documents.sql and 11-fixes.sql once, and deploy the scan-document function.
   Load after security.js. In the tradesperson wizard (step 2) a "Supporting documents" box appears with
   one slot for each document. For each slot the person taps Take a photo / Choose a photo / Choose a file.
   Each file is uploaded privately and checked by AI straight away:
     - accepted  : clear, readable, the right kind of document, not expired, name matches the profile
     - not accepted : unreadable, wrong kind of document, expired, or looks edited (the reason is shown)
     - sent for review : the AI is not sure (for example the name differs). A TradeLink admin decides.
   The AI check screens documents. It cannot prove one is genuine, so an admin still decides who gets the Verified badge. */
const DOC_MAX_MB = 8;
/* Needs the scan-document function deployed and an ANTHROPIC_API_KEY secret (see README).
   If the function is not deployed, files simply wait for a TradeLink admin on the Admin page. */
const DOC_AI = true;
let DOCS = [], DOC_KIND = "id", DOC_FALLBACK = false;

async function loadDocs() {
  if (!ME_ID) { DOCS = []; return; }
  try { DOCS = (await ck(SB.from("documents").select("*").eq("owner_id", ME_ID).order("created_at", {ascending: false}))) || []; }
  catch (e) { DOCS = []; }
}
const DSTATE = {
  pending: [() => (DOC_AI && !DOC_FALLBACK ? "Checking\u2026" : "Waiting for review"), "var(--mut)"],
  approved: [() => "Accepted", "var(--grn)"], rejected: [() => "Not accepted", "#e5384f"], needs_review: [() => "Sent for review", "#b7791f"]
};
const DKIND = {certificate: "Certificate", licence: "Licence", id: "Photo ID", other: "Document"};
const DSLOTS = [
  {kind: "id", title: "Photo ID", tip: "Upload a passport, driver's licence or national ID card. Take the photo in good light with all four corners of the card visible and the writing easy to read. It is private: only you and TradeLink staff can see it. The name on it should match the name on your profile."},
  {kind: "certificate", title: "Trade or qualification certificate", tip: "Upload a photo of your trade certificate, diploma or training record. If you have no certificate, tick the box at the bottom and TradeLink will review your work instead."},
  {kind: "licence", title: "Trade licence or registration (optional)", tip: "Only needed if your trade requires one, for example an electrician's licence. Skip this if it does not apply to you."}
];
const hasOk = kinds => DOCS.some(d => kinds.includes(d.kind) && d.status === "approved");

function drawDocs() {
  const b = document.getElementById("docbox"); if (!b || typeof PF === "undefined" || !PF.t) return;
  const slot = (sl, i) => {
    const mine = DOCS.filter(d => d.kind === sl.kind);
    return `<div style="padding:12px 0;${i ? "border-top:1px solid var(--line)" : ""}"><b>${sl.title}</b><button type="button" class="tlinfo" aria-expanded="false" aria-label="Explain this question" onclick="const h=document.getElementById('dh${i}');h.hidden=!h.hidden;this.setAttribute('aria-expanded',String(!h.hidden))">i</button><div class="tlhint" id="dh${i}" hidden>${sl.tip}</div>
${mine.map(d => { const s = DSTATE[d.status] || DSTATE.pending; return `<div class="bk" style="flex-wrap:wrap"><span><b style="color:${s[1]}">${s[0]()}</b><div class="m">${esc(d.ai_note || "")}</div></span>${d.status === "pending" && DOC_AI ? `<a class="vf" onclick="docRecheck('${d.id}')">Check again</a>` : ""}<a class="vf" onclick="docDel('${d.id}')">Remove</a></div>`; }).join("")}
<button type="button" class="btn o" style="margin-top:8px;padding:8px 14px" onclick="docSheet('${sl.kind}')">${mine.length ? "Add another file" : "Add photo or file"}</button></div>`;
  };
  b.innerHTML = `<b>Supporting documents</b><p class="m" style="margin:4px 0 6px">${DOC_AI ? "Each file is checked automatically when you add it." : "TradeLink reviews each file."} Files are private: only you and TradeLink staff can see them.</p>
${DSLOTS.map(slot).join("")}
<label style="display:flex;gap:8px;margin-top:8px;font-size:12px"><input type="checkbox" ${PF.t.nocert ? "checked" : ""} onchange="PF.t.nocert=this.checked;sv_()"> I do not have a certificate. TradeLink will review my work instead.</label><div class="er" id="dx"></div>`;
}
onDom(() => {
  if (typeof PF === "undefined" || !PF.t || typeof role === "undefined" || role !== "t") return;
  const inp = document.querySelector('input[oninput*="\'lic\'"]'); if (!inp) return;
  const lab = inp.closest("label"); if (!lab || lab.dataset.doc) return; lab.dataset.doc = "1";
  const box = document.createElement("div"); box.id = "docbox"; box.className = "card pad"; box.style.marginTop = "14px";
  lab.insertAdjacentElement("afterend", box); drawDocs(); loadDocs().then(drawDocs);
});

/* ---- the "Add file" menu: camera, photos, phone files ---- */
window.docSheet = function (kind) {
  DOC_KIND = kind || "other";
  const name = (DSLOTS.find(s => s.kind === DOC_KIND) || {title: "document"}).title.replace(" (optional)", "").toLowerCase();
  $("au").hidden = false;
  $("au").innerHTML = `<div class="aw" style="grid-template-columns:1fr"><div class="ac"><button class="x" aria-label="Close" onclick="$('au').hidden=true">${I("x")}</button><h2>Add your ${name}</h2><p class="m" style="margin:6px 0 14px">Make sure the whole document is in the photo and every word is easy to read.</p>
<button class="btn" style="margin-top:8px" onclick="docPick('image/*',true)">Take a photo</button>
<button class="btn o" style="margin-top:8px" onclick="docPick('image/*',false)">Choose from photos</button>
<button class="btn o" style="margin-top:8px" onclick="docPick('application/pdf,image/*',false)">Choose from files</button></div></div>`;
};
window.docPick = function (accept, camera) {
  const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.style.display = "none";
  if (camera) i.setAttribute("capture", "environment");
  i.onchange = () => { if (i.files[0]) addDoc(i.files[0], DOC_KIND); i.remove(); };
  document.body.appendChild(i); i.click();
};
function shrinkDoc(f) {
  return new Promise((ok, no) => {
    const r = new FileReader(); r.onerror = no;
    r.onload = () => { const im = new Image(); im.onerror = no; im.onload = () => {
      const k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement("canvas");
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      c.toBlob(b => b ? ok(b) : no(new Error("image")), "image/jpeg", 0.88); }; im.src = r.result; };
    r.readAsDataURL(f);
  });
}
const dmsg = (t, good) => { const x = document.getElementById("dx"); if (x) { x.style.color = good ? "var(--grn)" : ""; x.textContent = t; } };

async function scanDoc(id) {
  dmsg("Checking your document\u2026", true);
  const r = await SB.functions.invoke("scan-document", {body: {documentId: id}});
  await loadDocs(); drawDocs();
  if (r.error) { DOC_FALLBACK = true; drawDocs(); dmsg("The automatic check is not available right now. TradeLink will review your document instead.", true); return; }
  const d = DOCS.find(x => x.id === id);
  if (d && d.status === "approved") dmsg("Document accepted.", true);
  else if (d && d.status === "rejected") dmsg("This file was not accepted: " + (d.ai_note || "please upload a clearer photo.") + " You can remove it and add a new one.");
  else dmsg("Your document was sent to TradeLink for review.", true);
}
window.docRecheck = async function (id) { try { await scanDoc(id); } catch (e) { dmsg("Could not check: " + (e.message || e)); } };
window.addDoc = async function (file, kind) {
  $("au").hidden = true; kind = kind || DOC_KIND || "other";
  const isPdf = file.type === "application/pdf";
  if (!isPdf && !file.type.startsWith("image/")) { dmsg("Please choose a photo or a PDF."); return; }
  if (file.size > DOC_MAX_MB * 1048576 && isPdf) { dmsg("That PDF is too large. The limit is " + DOC_MAX_MB + " MB."); return; }
  try {
    dmsg("Uploading\u2026", true);
    const blob = isPdf ? file : await shrinkDoc(file), mime = isPdf ? "application/pdf" : "image/jpeg";
    const path = ME_ID + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + (isPdf ? ".pdf" : ".jpg");
    await ck(SB.storage.from("documents").upload(path, blob, {contentType: mime}));
    const row = await ck(SB.from("documents").insert({path, mime, kind}).select().single());
    await loadDocs(); drawDocs();
    if (!DOC_AI) { dmsg("Uploaded. TradeLink will review your document.", true); return; }
    await scanDoc(row.id);
  } catch (e) { dmsg("Could not upload: " + (e.message || e)); }
};
window.docDel = async function (id) {
  const d = DOCS.find(x => x.id === id); if (!d) return;
  const ok = window.tlConfirm ? await tlConfirm({title: "Remove this file?", body: "You can add a new one afterwards.", ok: "Remove", cancel: "Keep it"}) : confirm("Remove this file?");
  if (!ok) return;
  try { await ck(SB.from("documents").delete().eq("id", id)); await SB.storage.from("documents").remove([d.path]); await loadDocs(); drawDocs(); }
  catch (e) { dmsg("Could not remove: " + (e.message || e)); }
};

/* ---- the continue rule, saving the tick, and loading it back ---- */
const _vals4 = window.vals;
window.vals = function (s) {
  const m = _vals4(s); if (m) return m;
  if (s == 1) {
    if (PF.raw !== "approved" && !hasOk(["id"])) return "Add a clear photo of your ID and wait until it is accepted.";
    if (!(hasOk(["certificate", "licence"]) || PF.t.nocert)) return "Add your certificate and wait until it is accepted, or tick that you have no certificate.";
  }
  return "";
};
const _sl3 = window.saveListing;
window.saveListing = async function (s) {
  try { await ck(SB.from("profile_private").update({no_certificate: !!PF.t.nocert}).eq("id", ME_ID)); } catch (e) { console.warn("no_certificate not saved (run documents.sql?)", e.message || e); }
  await _sl3(s);
};
const _lm3 = window.loadMe;
window.loadMe = async function () {
  const r = await _lm3();
  if (r && ME_ID) {
    try { const p = await ck(SB.from("profile_private").select("no_certificate").eq("id", ME_ID).maybeSingle()); PF.t.nocert = !!(p && p.no_certificate); } catch (e) {}
    await loadDocs();
  }
  return r;
};

/* ---- admin: see the documents ---- */
const _loadAdmin2 = window.loadAdmin;
window.loadAdmin = async function () {
  await _loadAdmin2();
  try {
    ADM.docs = (await ck(SB.from("documents").select("*").order("created_at", {ascending: false}).limit(40))) || [];
    const ids = [...new Set(ADM.docs.map(d => d.owner_id).filter(id => !ADM.ps.some(x => x.id == id)))];
    if (ids.length) ADM.ps = ADM.ps.concat((await ck(SB.from("profiles").select("id,full_name").in("id", ids))) || []);
  } catch (e) { ADM.docs = []; }
};
const _adp2 = window.adp;
window.adp = function () {
  const base = _adp2();
  if (!ME_ADMIN || !ADM || !ADM.docs) return base;
  const nm = id => { const p = ADM.ps.find(x => x.id == id); return p ? p.full_name : "Unknown"; };
  const card = `<div class="card pad" style="margin-top:14px"><b>Documents (${ADM.docs.length})</b><p class="m" style="margin:4px 0">The AI check only screens for readable documents. You decide who gets Verified.</p>${ADM.docs.map(d => { const s = DSTATE[d.status] || DSTATE.pending; return `<div class="bk" style="flex-wrap:wrap"><span><b>${esc(nm(d.owner_id))}</b> \u2022 ${esc(DKIND[d.kind] || "Document")}<div class="m">${esc(d.ai_note || "")}</div></span><i class="cf" style="font-style:normal;color:${s[1]}">${s[0]}</i><a class="vf" onclick="docOpen('${d.id}')">Open</a><a class="vf" onclick="docSet('${d.id}','approved')">Accept</a><a class="vf" onclick="docSet('${d.id}','rejected')">Reject</a></div>`; }).join("") || '<p class="m">No documents yet.</p>'}</div>`;
  return base + card;
};
PANES.ad = window.adp;
window.docOpen = async function (id) {
  const d = ADM.docs.find(x => x.id === id); if (!d) return;
  const r = await SB.storage.from("documents").createSignedUrl(d.path, 300);
  if (r.error) { alert("Could not open: " + r.error.message); return; }
  window.open(r.data.signedUrl, "_blank");
};
window.docSet = async function (id, st) {
  try { await ck(SB.from("documents").update({status: st}).eq("id", id)); ADM = null; pn("ad"); } catch (e) { alert("Could not update: " + (e.message || e)); }
};
