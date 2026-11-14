/* TradeLink supporting documents. Run documents.sql once, and deploy the scan-document function.
   Load after security.js. In the tradesperson wizard (step 2) a "Supporting documents" box appears:
   Add file > Take a photo / Choose a photo / Choose a file. Each file is uploaded privately and
   checked automatically. The tradesperson can continue once one file is accepted,
   or by ticking "I do not have a certificate" (then TradeLink reviews their work instead).
   The check is a first filter only: an admin still decides who gets the Verified badge. */
const DOC_MAX_MB = 8;
/* Set to true ONLY after you have deployed the scan-document function and added ANTHROPIC_API_KEY.
   While false, every file waits for a TradeLink admin to Accept or Reject it on the Admin page. */
const DOC_AI = false;
let DOCS = [];

async function loadDocs() {
  if (!ME_ID) { DOCS = []; return; }
  try { DOCS = (await ck(SB.from("documents").select("*").eq("owner_id", ME_ID).order("created_at", {ascending: false}))) || []; }
  catch (e) { DOCS = []; }
}
const DSTATE = {pending: [DOC_AI ? "Checking\u2026" : "Waiting for review", "var(--mut)"], approved: ["Accepted", "var(--grn)"], rejected: ["Not accepted", "#e5384f"], needs_review: ["Sent for review", "#b7791f"]};
const DKIND = {certificate: "Certificate", licence: "Licence", id: "Photo ID", other: "Document"};

function drawDocs() {
  const b = document.getElementById("docbox"); if (!b || typeof PF === "undefined" || !PF.t) return;
  b.innerHTML = `<b>Supporting documents *</b><p class="m" style="margin:4px 0 10px">Add a trade certificate, licence or photo ID. ${DOC_AI ? "Each file is checked automatically before you can continue." : "TradeLink reviews each file before you can continue. If you do not have a certificate, tick the box below to carry on."} Files are private: only you and TradeLink staff can see them.</p>
${DOCS.map(d => { const s = DSTATE[d.status] || DSTATE.pending; return `<div class="bk"><span><b>${esc(DKIND[d.kind] || "Document")}</b><div class="m">${esc(d.ai_note || "")}</div></span><i class="cf" style="font-style:normal;color:${s[1]}">${s[0]}</i><a class="vf" onclick="docDel('${d.id}')">Remove</a></div>`; }).join("")}
<button class="btn o" style="margin-top:10px" onclick="docSheet()">Add file</button>
<label style="display:flex;gap:8px;margin-top:12px;font-size:12px"><input type="checkbox" ${PF.t.nocert ? "checked" : ""} onchange="PF.t.nocert=this.checked;sv_()"> I do not have a certificate. TradeLink will review my work instead.</label><div class="er" id="dx"></div>`;
}
onDom(() => {
  if (typeof PF === "undefined" || !PF.t || typeof role === "undefined" || role !== "t") return;
  const inp = document.querySelector('input[oninput*="\'lic\'"]'); if (!inp) return;
  const lab = inp.closest("label"); if (!lab || lab.dataset.doc) return; lab.dataset.doc = "1";
  const box = document.createElement("div"); box.id = "docbox"; box.className = "card pad"; box.style.marginTop = "14px";
  lab.insertAdjacentElement("afterend", box); drawDocs(); loadDocs().then(drawDocs);
});

/* ---- the "Add file" menu: camera, photos, phone files ---- */
window.docSheet = function () {
  $("au").hidden = false;
  $("au").innerHTML = `<div class="aw" style="grid-template-columns:1fr"><div class="ac"><button class="x" aria-label="Close" onclick="$('au').hidden=true">${I("x")}</button><h2>Add file</h2><p class="m" style="margin:6px 0 14px">Choose how to add your document.</p>
<button class="btn" style="margin-top:8px" onclick="docPick('image/*',true)">Take a photo</button>
<button class="btn o" style="margin-top:8px" onclick="docPick('image/*',false)">Choose from photos</button>
<button class="btn o" style="margin-top:8px" onclick="docPick('application/pdf,image/*',false)">Choose from files</button></div></div>`;
};
window.docPick = function (accept, camera) {
  const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.style.display = "none";
  if (camera) i.setAttribute("capture", "environment");
  i.onchange = () => { if (i.files[0]) addDoc(i.files[0]); i.remove(); };
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
window.addDoc = async function (file) {
  $("au").hidden = true;
  const isPdf = file.type === "application/pdf";
  if (!isPdf && !file.type.startsWith("image/")) { dmsg("Please choose a photo or a PDF."); return; }
  if (file.size > DOC_MAX_MB * 1048576 && isPdf) { dmsg("That PDF is too large. The limit is " + DOC_MAX_MB + " MB."); return; }
  try {
    dmsg("Uploading\u2026", true);
    const blob = isPdf ? file : await shrinkDoc(file), mime = isPdf ? "application/pdf" : "image/jpeg";
    const path = ME_ID + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + (isPdf ? ".pdf" : ".jpg");
    await ck(SB.storage.from("documents").upload(path, blob, {contentType: mime}));
    const row = await ck(SB.from("documents").insert({path, mime}).select().single());
    await loadDocs(); drawDocs();
    if (!DOC_AI) { dmsg("Uploaded. TradeLink will review your document.", true); return; }
    dmsg("Checking your document\u2026", true);
    const r = await SB.functions.invoke("scan-document", {body: {documentId: row.id}});
    await loadDocs(); drawDocs();
    if (r.error) { dmsg("The automatic check is not available right now. Please try again later, or tick the box below."); return; }
    const d = DOCS.find(x => x.id === row.id);
    if (d && d.status === "approved") dmsg("Document accepted. You can continue.", true);
    else if (d && d.status === "rejected") dmsg("This file was not accepted: " + (d.ai_note || "please upload a clearer photo of a certificate, licence or ID."));
    else dmsg("Your document was sent for review by TradeLink.", true);
  } catch (e) { dmsg("Could not upload: " + (e.message || e)); }
};
window.docDel = async function (id) {
  const d = DOCS.find(x => x.id === id); if (!d || !confirm("Remove this file?")) return;
  try { await ck(SB.from("documents").delete().eq("id", id)); await SB.storage.from("documents").remove([d.path]); await loadDocs(); drawDocs(); }
  catch (e) { dmsg("Could not remove: " + (e.message || e)); }
};

/* ---- the continue rule, saving the tick, and loading it back ---- */
const _vals4 = window.vals;
window.vals = function (s) {
  const m = _vals4(s); if (m) return m;
  if (s == 1 && !(DOCS.some(d => d.status === "approved") || PF.t.nocert)) return "Add a supporting document and wait until it is accepted, or tick that you have no certificate.";
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
