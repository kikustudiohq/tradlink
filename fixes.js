/* TradeLink fixes. Load this file LAST (after payments.js). Run 11-fixes.sql once first.
   1. Progress is never lost: unsaved answers, the step you were on, the page you were on, and the
      sign-up / log-in form (never the password) survive a refresh.
   2. Every question is written as a question, has an (i) button that explains it, and no asterisks.
   3. Repeated questions are removed (name and email you already gave, travel distance, contact method,
      the second location question).
   4. A map to set your base and an optional live location.
   5. Tradesperson profiles are always public: the Public/Private switch is gone for them.
   6. A proper pop-up when switching between Customer and Tradesperson mode.
   7. Tap your profile photo to change it. */

/* >>> OPTIONAL: paste your Google Maps JavaScript API key between the quotes to use Google Maps.
       Leave it empty to use the free OpenStreetMap map instead (works the same way). */
const GMAPS_KEY = "";

(function () {
  "use strict";
  const q1 = (s, r) => (r || document).querySelector(s);
  const qa = (s, r) => [...(r || document).querySelectorAll(s)];
  const safe = fn => { try { return fn(); } catch (e) { console.warn("tl-fix:", e); } };
  const sget = k => { try { return JSON.parse(sessionStorage.getItem(k) || "null"); } catch (e) { return null; } };
  const sset = (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  /* ---------------------------------------------------------------- styles */
  const st = document.createElement("style");
  st.textContent = `
.tlinfo{width:20px;height:20px;border-radius:50%;border:1.5px solid var(--blue);color:var(--blue);background:transparent;font:italic 700 12px Georgia,serif;margin-left:8px;line-height:1;vertical-align:middle;cursor:pointer;padding:0;display:inline-grid;place-items:center}
.tlinfo[aria-expanded=true]{background:var(--blue);color:#fff}
.tlhint{margin:6px 0 8px;padding:9px 12px;border-left:3px solid var(--blue);background:var(--chip);border-radius:8px;font:400 12.5px/1.5 Georgia,"Times New Roman",serif;color:var(--ink);white-space:normal}
.pro .hint{display:none}
.tlmap{height:260px;border-radius:12px;overflow:hidden;border:1px solid var(--line);margin:8px 0;background:var(--chip)}
.tlmapbar{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0}.tlmapbar .btn{padding:8px 14px;font-size:13px}
.tlsheet{position:fixed;inset:0;z-index:120;background:#020814cc;display:grid;place-items:center;padding:18px}
.tlsheet-c{width:100%;max-width:400px;max-height:92vh;overflow:auto;padding:22px;border-radius:16px;background:var(--card,#0f1d36);border:1px solid var(--line);color:var(--ink);text-align:center}
.tlsheet-c h3{font-size:19px;margin:10px 0 6px}.tlsheet-c .cta{margin-top:16px;gap:10px}.tlsheet-c .cta .btn{flex:1}
.tlmi{width:54px;height:54px;border-radius:50%;background:#1262ff22;color:var(--blue);display:grid;place-items:center;margin:0 auto}.tlmi svg{width:26px;height:26px}
.tlul{list-style:none;padding:0;margin:12px 0 0;text-align:left;font-size:13px}.tlul li{display:flex;gap:8px;margin-top:6px;color:var(--mut)}.tlul li:before{content:"\\2713";color:var(--grn);font-weight:700}
.tlcam{position:absolute;left:0;right:0;bottom:0;background:#000b;color:#fff;font:600 10px system-ui;text-align:center;padding:3px 0}`;
  document.head.appendChild(st);

  /* ------------------------------------------------- generic confirm pop-up */
  function sheet(html, onReady) {
    const d = document.createElement("div"); d.className = "tlsheet";
    d.innerHTML = `<div class="tlsheet-c" role="dialog" aria-modal="true">${html}</div>`;
    const close = () => { d.remove(); document.removeEventListener("keydown", esc_); };
    const esc_ = e => { if (e.key === "Escape") close(); };
    d.addEventListener("click", e => { if (e.target === d) close(); });
    document.addEventListener("keydown", esc_); document.body.appendChild(d);
    onReady && onReady(d, close); return {el: d, close};
  }
  window.tlConfirm = function (o) {
    return new Promise(res => {
      let done = false; const fin = v => { if (!done) { done = true; res(v); } };
      const s = sheet(`<h3>${esc(o.title)}</h3><p class="m">${esc(o.body || "")}</p><div class="cta"><button class="btn o" data-x>${esc(o.cancel || "Cancel")}</button><button class="btn" data-ok>${esc(o.ok || "OK")}</button></div>`, (d, close) => {
        d.querySelector("[data-x]").onclick = () => { close(); fin(false); };
        d.querySelector("[data-ok]").onclick = () => { close(); fin(true); };
        d.querySelector("[data-ok]").focus();
      });
      const obs = new MutationObserver(() => { if (!document.body.contains(s.el)) { obs.disconnect(); fin(false); } });
      obs.observe(document.body, {childList: true});
    });
  };

  /* ------------------------------------------ 6. switching Customer / Tradesperson */
  window.switchMode = function (to) {
    const toT = to === "t";
    const pts = toT
      ? ["Your customer profile and messages are kept.", "You will set up your tradesperson profile if you have not yet.", "You can switch back at any time."]
      : ["Your tradesperson listing stays online.", "Your bookings and enquiries are kept.", "You can switch back at any time."];
    sheet(`<div class="tlmi">${I(toT ? "brief" : "user")}</div><h3>${toT ? "Switch to Tradesperson mode?" : "Switch to Customer mode?"}</h3>
<p class="m">${toT ? "Use TradeLink to offer your services to customers." : "Use TradeLink to find and hire tradespeople."}</p>
<ul class="tlul">${pts.map(p => `<li>${p}</li>`).join("")}</ul><div class="er" data-er></div>
<div class="cta"><button class="btn o" data-x>Cancel</button><button class="btn" data-ok>${toT ? "Switch to Tradesperson" : "Switch to Customer"}</button></div>`, (d, close) => {
      const ok = d.querySelector("[data-ok]"), er = d.querySelector("[data-er]");
      d.querySelector("[data-x]").onclick = close;
      ok.onclick = async () => {
        ok.disabled = true; ok.textContent = "Switching\u2026"; er.textContent = "";
        try {
          await ck(SB.from("profiles").update({role: toT ? "tradesperson" : "customer"}).eq("id", ME_ID));
          await loadMe(); await loadAll(); await loadListings(); draw(); top_();
          $("auth").innerHTML = authBtn(); close(); openDash(toT && !PF.done ? "pf" : "dash");
        } catch (e) { ok.disabled = false; ok.textContent = toT ? "Switch to Tradesperson" : "Switch to Customer"; er.textContent = "Could not switch: " + (e.message || e); }
      };
      ok.focus();
    });
  };

  /* ------------------------------------------------- 1. progress is never lost */
  const DRAFT = id => "tl_draft_" + id, IMGK = ["photo", "logo", "gal"];
  let ready = false, lastSig = "";
  const snap = () => (typeof PF !== "undefined" && PF && ME_ID && (PF.c || PF.t)) ? {v: 1, role: PF.role || null, step: PF.step || 0, done: !!PF.done, c: PF.c || null, t: PF.t || null} : null;
  function writeDraft() {
    if (!ready) return; const s = snap(); if (!s) return;
    if (s.done) { if (lastSig !== "done") { try { localStorage.removeItem(DRAFT(ME_ID)); } catch (e) {} lastSig = "done"; } return; }
    const json = JSON.stringify(s); if (json === lastSig) return;
    s.ts = Date.now();
    try { localStorage.setItem(DRAFT(ME_ID), JSON.stringify(s)); lastSig = json; }
    catch (e) {                                   // storage full: keep the text answers, drop the big photos
      const lite = JSON.parse(JSON.stringify(s));
      [lite.c, lite.t].forEach(o => { if (o) IMGK.forEach(k => { if (k in o) o[k] = Array.isArray(o[k]) ? [] : ""; }); });
      try { localStorage.setItem(DRAFT(ME_ID), JSON.stringify(lite)); lastSig = json; } catch (e2) {}
    }
  }
  setInterval(() => safe(writeDraft), 1000);
  function restoreDraft() {
    let d = null; try { d = JSON.parse(localStorage.getItem(DRAFT(ME_ID)) || "null"); } catch (e) {}
    if (!d || d.v !== 1 || d.done || d.role !== PF.role) return;
    const o = PF.role === "t" ? "t" : "c", src = d[o]; if (!src) return;
    Object.keys(src).forEach(k => {
      const empty = src[k] === undefined || (IMGK.includes(k) && (src[k] === "" || (Array.isArray(src[k]) && !src[k].length)));
      if (!empty) PF[o][k] = src[k];
    });
    PF.step = d.step || 0; PF.done = false; PF.flash = "We kept the answers you had not saved yet. Carry on where you stopped.";
  }
  const _lmF = window.loadMe;
  window.loadMe = async function () {
    ready = false;
    try {
      const r = await _lmF();
      if (r && ME_ID) {
        try { const l = await ck(SB.from("trade_listings").select("lat,lng,live_location").eq("owner_id", ME_ID).maybeSingle());
          if (l) { PF.t.lat = l.lat == null ? "" : l.lat; PF.t.lng = l.lng == null ? "" : l.lng; PF.t.live = !!l.live_location; } } catch (e) {}
        safe(restoreDraft);
      }
      return r;
    } finally { lastSig = ""; ready = true; }
  };
  const _rst = window.rst;
  window.rst = async function () { try { localStorage.removeItem(DRAFT(ME_ID)); } catch (e) {} return _rst(); };

  // also save to the account (as a draft) every time they move to another step of the wizard
  let saving = false;
  async function autosaveServer() {
    if (saving || !ME_ID || !PF.t || ["approved", "pending_review", "suspended"].includes(PF.raw)) return;
    saving = true;
    try { await window.saveListing("draft"); } catch (e) { console.warn("autosave:", e.message || e); } finally { saving = false; }
  }
  const _nx = window.nx;
  window.nx = function (d) { const before = PF.step || 0; _nx(d); if (role === "t" && (PF.step || 0) !== before) autosaveServer(); };

  /* ---- the sign-up / log-in form and the page you were on ---- */
  const AK = "tl_auth", NK = "tl_nav", NAV0 = sget(NK);
  let authTrack = false, navTrack = false, navDone = false;
  const _oa = window.openAuth;
  window.openAuth = function (m, next) {
    _oa(m, next); safe(() => {
      const s = sget(AK); sset(AK, Object.assign({}, s || {}, {mode: m, screen: null}));
      if (m === "signup" && s && s.role) { role = s.role; sr(); }
      const fill = (id, v) => { const el = $(id); if (el && v && !el.value) { el.value = v; el.dispatchEvent(new Event("input", {bubbles: true})); } };
      if (s) { fill("em", s.email); if (m === "signup") fill("fn", s.name); }
    });
  };
  const _sce = window.showCheckEmail;
  if (_sce) window.showCheckEmail = function (email) { sset(AK, {screen: "check", email}); _sce(email); };
  setInterval(() => safe(() => {
    if (authTrack) {
      const au = $("au");
      if (au && au.hidden) sset(AK, null);
      else if (au && $("em")) { const s = sget(AK) || {}; sset(AK, {mode: s.mode || "login", role, name: $("fn") ? $("fn").value : s.name || "", email: $("em").value}); }
    }
    if (navTrack) {
      const v = ["home", "browse", "profile", "dash", "about", "contact", "terms", "privacy"].find(x => $(x) && !$(x).hidden);
      if (v) sset(NK, {v, pane: typeof pane !== "undefined" ? pane : null});
    }
  }), 700);
  const PUBLIC_VIEWS = ["browse", "about", "contact", "terms", "privacy"];
  SB.auth.getSession().then(({data}) => {
    const s = sget(AK);
    if (!data.session) {
      navDone = true;
      if (NAV0 && PUBLIC_VIEWS.includes(NAV0.v)) go(NAV0.v);
      if (s && s.screen === "check" && s.email) { $("au").hidden = false; window.showCheckEmail(s.email); }
      else if (s && s.mode) openAuth(s.mode);
      navTrack = true;
    } else {
      if (NAV0 && PUBLIC_VIEWS.includes(NAV0.v)) go(NAV0.v);
      setTimeout(() => { navDone = true; navTrack = true; }, 10000);     // safety net
    }
    authTrack = true;
  }).catch(() => { authTrack = true; navTrack = true; navDone = true; });
  const _la = window.loadAll;
  window.loadAll = async function () {
    await _la();
    if (!navDone) {
      navDone = true;
      safe(() => { if (NAV0 && NAV0.v === "dash" && U) openDash(NAV0.pane || "dash"); });
      setTimeout(() => { navTrack = true; }, 1500);
    }
  };

  /* ------------------------------------------ 2. questions, (i) buttons, no asterisks */
  const CAT = {}, norm = s => String(s || "").replace(/\s*\*\s*$/, "").replace(/\s+/g, " ").trim();
  const add = (names, qn, tip) => names.forEach(n => { CAT[norm(n)] = {q: qn, tip}; });
  // tradesperson step 1 (identity)
  add(["Full name", "Full legal name"], "What is your full legal name?", "Write your name the way it appears on your ID, for example: Mary Kila. Customers see this name on your profile.");
  add(["Business or trading name (optional)", "Registered business or trading name (if applicable)"], "Do you have a business or trading name? (optional)", "Only fill this in if you work under a business name, for example: Kila Plumbing Services. If you do not, leave it empty and your own name is shown.");
  add(["Professional profile picture", "Professional portrait photograph"], "Can you add a clear photo of yourself?", "Use a front-facing photo taken in good light. Customers trust profiles that show a real face. Please do not use a logo here: you can add that later.");
  add(["Main trade category", "Primary trade or profession"], "What is your main trade?", "Choose the trade you do most often. If your trade is not in the list, choose Other and write it in the next question.");
  add(["Your trade", "Please state your trade or profession"], "What is your trade called?", "For example: Boat builder, Satellite dish installer, Pest controller.");
  add(["Additional trades", "Additional trades or specialisations"], "Do you do any other trades? (optional)", "Tick any other trades you can do. This helps customers find you in more searches.");
  add(["Nationality"], "What is your nationality?", "Choose the country on your passport or ID. This is private. It is never shown to customers.");
  add(["Professional headline", "Professional summary (one line)"], "How would you describe yourself in one line?", "One short sentence that shows under your name in search results. Example: Licensed plumber with 10 years of experience.");
  // step 2 (description)
  add(["Professional biography / business description", "Professional background and services offered"], "What work do you do, and what can customers expect from you?", "Describe your experience, the jobs you do best and how you work. Write at least 30 characters. Example: I have fixed pipes and installed bathrooms in Port Moresby for 10 years. I arrive on time and clean up after the job.");
  add(["Years of experience", "Years of professional experience"], "How many years have you worked in your trade?", "Type a whole number, for example 5. Type 0 if you are just starting.");
  add(["Skills and specialisations", "Key skills and areas of specialisation"], "What are your main skills?", "Separate each skill with a comma. Example: pipe fitting, leak repair, drainage.");
  add(["Qualifications or certificates", "Qualifications, certificates and accreditations"], "What qualifications or certificates do you have?", "Write them in words, for example: Certificate III in Plumbing, Don Bosco Technical School, 2018. You add a photo of the certificate in the Supporting documents box below.");
  add(["Licences (where required)", "Trade licences and registrations (where required)"], "Do you hold a trade licence or registration? (optional)", "Only if your trade needs one, such as an electrician's licence. Write the licence name and number. Do not write your ID number here.");
  // step 3 (services)
  add(["Service name"], "Which service do you offer?", "Name one service, for example: Fix a leaking tap. Use the Add Service button to add each service separately.");
  add(["Description"], "How would you describe this service? (optional)", "One or two short sentences about what is included, so customers know what they get.");
  add(["Pricing method"], "How do you charge for this service?", "Hourly rate: you charge for each hour. Fixed price: one price for the whole job. Starting price: the lowest price, and the final price depends on the job. Quote required: customers ask you for a price first.");
  add(["Price"], "What is your price?", "Type a number only, for example 80. It is in the currency you chose above.");
  add(["Currency for your prices"], "Which currency do you want to be paid in?", "Customers see your prices in this currency.");
  // step 4 (hours)
  add(["Working days"], "Which days do you work?", "Tick every day you normally take jobs.");
  add(["Opening time", "Daily opening time"], "What time do you start work?", "Your usual start time each working day, for example 08:00.");
  add(["Closing time", "Daily closing time"], "What time do you finish work?", "Your usual finish time each working day, for example 17:00.");
  add(["Availability status", "Current availability"], "Are you free to take new jobs right now?", "Available: taking new jobs. Busy: taking jobs, but slowly. Unavailable: not taking jobs at the moment. You can change this any time.");
  add(["Appointment preferences (optional)", "Appointment arrangements (optional)"], "Is there anything customers should know before they book you? (optional)", "For example: Please book two days ahead. I do not work on public holidays.");
  // step 5 (location)
  add(["Where are you based? (suburb, town or city)"], "Where are you based? (suburb, town or city)", "Type the suburb or town where you mainly work, for example: Gordons, Port Moresby. Do not type your home address.");
  add(["Do you also work in other areas? (optional)"], "Do you also work in other areas? (optional)", "Separate the areas with commas, for example: Boroko, Waigani, Hohola.");
  add(["Where exactly do you work from? (optional)"], "Where exactly do you work from? (optional)", "Tap the map to drop a pin on your workshop or the centre of the area you work in. Customers only see an approximate position. Do not pin your home.");
  add(["Show customers when I am active (live location)"], "Show customers when I am active (live location)", "While this is on and TradeLink is open on your phone, your pin follows you and customers see Active now. You can turn it off at any time. Do not turn it on if you are at home.");
  // step 6 (portfolio)
  add(["Business logo (optional)"], "Do you have a business logo? (optional)", "Add your logo if you have one. If you do not, skip this question.");
  add(["Work gallery photos", "Portfolio of completed work"], "Can you show photos of work you have done?", "Add clear photos of finished jobs. Before and after photos work well. Profiles with photos get more messages.");
  // step 7 (contact)
  add(["Public business phone (optional)", "Business phone (shown on your listing)", "Business telephone (displayed on your listing)"], "What phone number can customers call?", "Choose your country code, then type your number without the first 0, for example 71234567. Customers see this number on your listing.");
  add(["Accept messages"], "Do you want customers to message you on TradeLink?", "Tick this to let customers chat with you inside TradeLink. Untick it only if you want to be contacted by phone only.");
  add(["Accept booking requests"], "Do you want customers to send you booking requests?", "Tick this to let customers request a time with you. You can accept or decline each request.");
  // customer profile
  add(["Profile picture"], "Can you add a profile photo? (optional)", "A friendly photo helps tradespeople trust your messages. You can skip this.");
  add(["Display name (optional)", "Preferred name (optional)"], "What name should tradespeople see? (optional)", "Leave this empty to use your full name. You can use a first name only.");
  add(["Phone number (optional)", "Phone number", "Telephone number"], "What is your phone number?", "Choose your country code, then type your number without the first 0, for example 71234567. Only you and TradeLink can see it.");
  add(["General location (city or suburb)", "City or suburb of residence"], "Which suburb or town do you live in?", "Type only your suburb or town, never your street address.");
  add(["Short biography (optional)", "About you (optional)"], "Is there anything you would like tradespeople to know about you? (optional)", "A short note, for example: I rent a house in Gerehu and need a plumber on weekends.");
  add(["Notifications"], "Which notifications do you want?", "Tick the updates you want to receive. You can change this later.");

  function firstText(el) {
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.nodeValue.trim()) return n;
      if (n.nodeType === 1 && n.nodeName !== "INPUT" && n.nodeName !== "BUTTON") return null;
    }
    return null;
  }
  function addInfo(l, n, tip) {
    const b = document.createElement("button"); b.type = "button"; b.className = "tlinfo"; b.textContent = "i";
    b.setAttribute("aria-label", "Explain this question"); b.setAttribute("aria-expanded", "false");
    const box = document.createElement("div"); box.className = "tlhint"; box.hidden = true; box.textContent = tip;
    b.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); box.hidden = !box.hidden; b.setAttribute("aria-expanded", String(!box.hidden)); };
    n.parentNode.insertBefore(b, n.nextSibling); b.insertAdjacentElement("afterend", box);
  }
  function decorate() {
    qa("#dash .dm label.fl, #dash .dm div.fl").forEach(l => {
      if (l.dataset.tlq) return;
      const n = firstText(l); if (!n) return;
      const e = CAT[norm(n.nodeValue)];
      if (!e) { if (/\*\s*$/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/\s*\*\s*$/, ""); return; }
      l.dataset.tlq = "1"; n.nodeValue = (/^\s/.test(n.nodeValue) ? " " : "") + e.q; addInfo(l, n, e.tip);
    });
    const dm = q1("#dash .dm");
    if (dm && dm.classList.contains("pro") && !q1("#tlreq")) {
      const card = q1(".card.pad", dm);
      if (card && card.querySelector("label.fl")) card.insertAdjacentHTML("afterbegin", '<p id="tlreq" class="m" style="margin-bottom:10px">Please answer every question unless it says (optional). If you are not sure what a question means, tap the <b class="tlinfo" style="display:inline-grid;margin:0 2px">i</b> next to it.</p>');
    }
  }

  /* ---- 3. questions that were repeated or unnecessary ---- */
  function known(sel, val, label) {
    const inp = q1("#dash .dm " + sel); if (!inp) return;
    const lab = inp.closest("label"); if (!lab || lab.dataset.tlknown) return;
    const v = val(); if (!v) return;
    lab.dataset.tlknown = "1"; lab.style.display = "none";
    const line = document.createElement("div"); line.className = "m"; line.style.margin = "12px 0 4px";
    line.innerHTML = label + ": <b>" + esc(v) + "</b> <a class=\"vf\" role=\"button\" tabindex=\"0\">Change</a>";
    line.querySelector("a").onclick = () => { lab.style.display = ""; line.remove(); };
    lab.insertAdjacentElement("beforebegin", line);
  }
  function trim() {
    if (typeof PF === "undefined" || !PF.t) return;
    known(`input[oninput*="setF('t','name'"]`, () => PF.t.name, "Name you signed up with");
    known(`input[oninput*="setF('c','name'"]`, () => PF.c.name, "Name you signed up with");
    known(`input[oninput*="setF('c','email'"]`, () => PF.c.email, "Email you log in with");
    qa(`#dash .dm select[onchange*="'contact'"]`).forEach(s => { const l = s.closest("label"); if (l) l.style.display = "none"; });   // contact method: asked by the two tick boxes
    qa("#dash .dm h3").forEach(h => { if (h.textContent.trim() === "Profile visibility" && role === "t") { const c = h.closest(".card"); if (c) c.remove(); } });   // tradespeople are always public
  }

  /* ---- 4. location: one question, a map and optional live location ---- */
  const _tstep = window.tstep;
  window.tstep = function (s) {
    if (s !== 4) return _tstep(s);
    return fld("t", "Where are you based? (suburb, town or city)", "area", {r: 1}) + fld("t", "Do you also work in other areas? (optional)", "areas") +
      `<div class="fl" style="margin-top:16px">Where exactly do you work from? (optional)</div><div id="tlmap" class="tlmap" role="application" aria-label="Map"></div>
<div class="tlmapbar"><button type="button" class="btn o" onclick="tlUseHere()">Use my current location</button><button type="button" class="btn o" onclick="tlClearPin()">Remove pin</button></div>
<div class="m" id="tlpinmsg">${PF.t.lat ? "Your pin is set. Drag it to move it." : "Tap the map to place a pin, or use your current location."}</div>
<label class="fl" style="display:flex;gap:8px;align-items:flex-start;margin-top:14px"><input type="checkbox" ${PF.t.live ? "checked" : ""} onchange="tlLiveToggle(this.checked)"> Show customers when I am active (live location)</label>`;
  };
  const _vals = window.vals;
  window.vals = function (s) { if (s === 4 && PF.t && PF.t.area && !PF.t.city) PF.t.city = PF.t.area; return _vals(s); };
  const pmsg = t => { const m = $("tlpinmsg"); if (m) m.textContent = t; };
  let MAPI = null;
  const loadScript = (src, cb) => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; if (cb) window[cb] = ok; document.head.appendChild(s); });
  async function mapLib() {
    if (GMAPS_KEY) {
      if (window.google && google.maps) return "g";
      try { await new Promise((ok, no) => { window.__tlg = ok; const s = document.createElement("script"); s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(GMAPS_KEY) + "&callback=__tlg"; s.onerror = no; document.head.appendChild(s); }); return "g"; } catch (e) { /* fall back to OpenStreetMap */ }
    }
    if (!window.L) {
      const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(css);
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js");
    }
    return "l";
  }
  function buildMap(el, lib) {
    const t = PF.t, has = t.lat !== "" && t.lat != null && t.lng !== "" && t.lng != null, c = has ? [+t.lat, +t.lng] : [-9.4438, 147.1803];
    if (lib === "g") {
      const m = new google.maps.Map(el, {center: {lat: c[0], lng: c[1]}, zoom: has ? 15 : 12, streetViewControl: false, mapTypeControl: false});
      let mk = null;
      const place = (la, ln, zoom) => {
        if (!mk) { mk = new google.maps.Marker({map: m, draggable: true}); mk.addListener("dragend", () => { const p = mk.getPosition(); setPin(p.lat(), p.lng(), false); }); }
        mk.setPosition({lat: la, lng: ln}); if (zoom) { m.setCenter({lat: la, lng: ln}); m.setZoom(16); }
      };
      m.addListener("click", e => setPin(e.latLng.lat(), e.latLng.lng(), false));
      MAPI = {place, remove: () => { if (mk) { mk.setMap(null); mk = null; } }};
    } else {
      const m = L.map(el).setView(c, has ? 15 : 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 19, attribution: "&copy; OpenStreetMap contributors"}).addTo(m);
      let mk = null;
      const place = (la, ln, zoom) => {
        if (!mk) { mk = L.marker([la, ln], {draggable: true}).addTo(m); mk.on("dragend", () => { const p = mk.getLatLng(); setPin(p.lat, p.lng, false); }); }
        mk.setLatLng([la, ln]); if (zoom) m.setView([la, ln], 16);
      };
      m.on("click", e => setPin(e.latlng.lat, e.latlng.lng, false));
      MAPI = {place, remove: () => { if (mk) { m.removeLayer(mk); mk = null; } }};
      setTimeout(() => m.invalidateSize(), 200);
    }
    if (has) MAPI.place(c[0], c[1], false);
  }
  function initMap() {
    const el = $("tlmap"); if (!el || el.dataset.init) return; el.dataset.init = "1"; MAPI = null;
    mapLib().then(lib => buildMap(el, lib)).catch(() => { el.innerHTML = '<p class="m" style="padding:14px">The map could not load. You can still type your suburb above.</p>'; });
  }
  async function setPin(la, ln, recenter) {
    la = +(+la).toFixed(5); ln = +(+ln).toFixed(5); PF.t.lat = la; PF.t.lng = ln; sv_();
    if (MAPI) MAPI.place(la, ln, recenter); pmsg("Pin set. Finding the area name\u2026");
    try {
      const p = await placeName({latitude: la, longitude: ln}), nm = p.suburb || p.city;
      const inp = q1(`input[oninput*="setF('t','area'"]`);
      if (nm && inp && !inp.value.trim()) fillInput(inp, nm);
      if (p.city) { PF.t.city = p.city; sv_(); }
      pmsg("Pin set" + (nm ? " near " + nm : "") + ". Drag it to move it.");
    } catch (e) { pmsg("Pin set. Drag it to move it."); }
  }
  window.tlUseHere = () => { pmsg("Finding your location\u2026"); getPos().then(c => setPin(c.latitude, c.longitude, true)).catch(e => pmsg(e.message || String(e))); };
  window.tlClearPin = () => { PF.t.lat = ""; PF.t.lng = ""; PF.t.live = false; sv_(); if (MAPI) MAPI.remove(); pmsg("Pin removed."); const c = q1('#dash input[type=checkbox][onchange*="tlLiveToggle"]'); if (c) c.checked = false; };
  window.tlLiveToggle = async function (on) {
    if (!on) { PF.t.live = false; sv_(); return; }
    try { const c = await getPos(); PF.t.live = true; sv_(); if (PF.t.lat === "" || PF.t.lat == null) setPin(c.latitude, c.longitude, true); }
    catch (e) { PF.t.live = false; const c = q1('#dash input[type=checkbox][onchange*="tlLiveToggle"]'); if (c) c.checked = false; alert(e.message || e); }
  };
  // live location while TradeLink is open (only for tradespeople who turned it on)
  let watchId = null, lastPush = 0;
  function liveTick() {
    const want = !!(U && ME_ID && role === "t" && PF && PF.t && PF.t.live);
    if (!want && watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; SB.from("trade_listings").update({live_location: false}).eq("owner_id", ME_ID).then(() => {}, () => {}); return; }
    if (want && watchId == null && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(p => {
        const now = Date.now(); if (now - lastPush < 60000) return; lastPush = now;
        const la = +p.coords.latitude.toFixed(5), ln = +p.coords.longitude.toFixed(5); PF.t.lat = la; PF.t.lng = ln;
        SB.from("trade_listings").update({lat: la, lng: ln, live_location: true, live_updated_at: new Date().toISOString()}).eq("owner_id", ME_ID).then(() => {}, () => {});
      }, () => {}, {enableHighAccuracy: false, maximumAge: 30000, timeout: 20000});
    }
  }
  setInterval(() => safe(liveTick), 5000);

  const _sl = window.saveListing;
  window.saveListing = async function (s) {
    PF.t.contact = PF.t.phone ? "Either" : "Message"; PF.t.vis = "public"; PF.t.dist = "";
    if (!PF.t.city && PF.t.area) PF.t.city = PF.t.area;
    await _sl(s);
    try { await ck(SB.from("trade_listings").update({lat: PF.t.lat === "" || PF.t.lat == null ? null : +PF.t.lat, lng: PF.t.lng === "" || PF.t.lng == null ? null : +PF.t.lng, live_location: !!PF.t.live}).eq("owner_id", ME_ID)); }
    catch (e) { console.warn("Map location not saved (run 11-fixes.sql?)", e.message || e); }
  };
  const _ll = window.loadListings;
  window.loadListings = async function () {
    await _ll();
    try {
      const rows = await ck(SB.from("public_listings").select("id,lat,lng,active_now"));
      (rows || []).forEach(r => { const p = P.find(x => x.real && x.tt && x.tt.lid == r.id); if (p) { p.tt.lat = r.lat; p.tt.lng = r.lng; p.tt.activeNow = !!r.active_now; } });
    } catch (e) { /* 11-fixes.sql not run yet */ }
  };
  const _pub = window.pub;
  window.pub = function (t) {
    let h = _pub(t);
    const la = t && t.lat !== "" && t.lat != null ? +t.lat : NaN, ln = t && t.lng !== "" && t.lng != null ? +t.lng : NaN;
    if (isFinite(la) && isFinite(ln)) {
      const card = `<div class="card" style="margin-top:14px;padding:16px"><h3>Location</h3>${t.activeNow ? '<span class="tag" style="color:var(--grn);margin:0">Active now</span>' : ""}<iframe title="Map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" style="width:100%;height:220px;border:0;border-radius:10px;margin-top:8px" src="https://www.google.com/maps?q=${la},${ln}&z=15&output=embed"></iframe><p style="margin-top:8px"><a class="vf" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${la},${ln}">Open in Google Maps</a></p></div>`;
      const mark = '<p style="text-align:center;margin:18px 0">';
      h = h.includes(mark) ? h.replace(mark, card + mark) : h + card;
    }
    return h;
  };
  // quick controls on the tradesperson dashboard
  const _dbd = window.dbd;
  window.dbd = function () {
    let h = _dbd();
    if (role === "t" && PF.t) {
      h += `<div class="card pad" style="margin-top:14px"><b>Active location</b><div class="m" style="margin:4px 0 10px">${PF.t.lat !== "" && PF.t.lat != null ? "Your pin is set" + (PF.t.area ? " near " + esc(PF.t.area) : "") + "." : "You have not placed a pin yet."}${PF.t.live ? " Live location is on." : ""}</div>
<div class="cta"><button class="btn" onclick="tlSetNow()">Set to my current location</button><button class="btn o" onclick="editStep(4)">Open the map</button></div>
<label class="fl" style="display:flex;gap:8px;align-items:flex-start;margin-top:12px"><input type="checkbox" ${PF.t.live ? "checked" : ""} onchange="tlLiveDash(this.checked)"> Show customers when I am active (live location)</label></div>`;
    }
    return h;
  };
  window.tlSetNow = async function () {
    try {
      const c = await getPos(), la = +c.latitude.toFixed(5), ln = +c.longitude.toFixed(5); PF.t.lat = la; PF.t.lng = ln;
      await ck(SB.from("trade_listings").update({lat: la, lng: ln, live_updated_at: new Date().toISOString()}).eq("owner_id", ME_ID)); toast("Your active location was updated."); pn("dash");
    } catch (e) { alert(e.message || e); }
  };
  window.tlLiveDash = async function (on) {
    try {
      if (on) await getPos(); PF.t.live = on;
      await ck(SB.from("trade_listings").update({live_location: on}).eq("owner_id", ME_ID)); pn("dash");
    } catch (e) { PF.t.live = false; alert(e.message || e); pn("dash"); }
  };

  /* ---- 7. tap your photo to change it ---- */
  function enableAvatar(a) {
    if (a.dataset.chg) return; a.dataset.chg = "1"; a.style.position = "relative"; a.style.cursor = "pointer"; a.title = "Change photo";
    const b = document.createElement("span"); b.className = "tlcam"; b.textContent = "Change"; a.appendChild(b);
    a.onclick = () => {
      const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.style.display = "none";
      i.onchange = async () => {
        const f = i.files[0]; i.remove(); if (!f) return;
        try {
          toast("Uploading your photo\u2026");
          const url = await upload("avatars", await shrink(f), "avatar");
          await ck(SB.from("profiles").update({avatar_url: url}).eq("id", ME_ID));
          PF.c.photo = url; PF.t.photo = url; await loadListings(); draw(); top_(); pn("pf"); toast("Your photo was updated.");
        } catch (e) { alert("Could not change the photo: " + (e.message || e)); }
      };
      document.body.appendChild(i); i.click();
    };
  }

  onDom(() => { safe(decorate); safe(trim); safe(initMap); qa("#dash .dm .card.pad.pr .av.big").forEach(a => safe(() => enableAvatar(a))); });
})();
