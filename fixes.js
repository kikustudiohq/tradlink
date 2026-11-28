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
  add(["General location (city or suburb)", "City or suburb of residence"], "Which suburb or town do you live in?