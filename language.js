/* TradeLink languages: (1) pick the website language, (2) translate posts written in other languages.
   Run profile-extras.sql once to remember each person's choice. Works with or without it.

   WEBSITE LANGUAGE
   - English and Tok Pisin use the built-in word lists below (DICTS). Tok Pisin should be checked by a
     native speaker before launch. To add a language (for example Hiri Motu), copy the Tok Pisin block,
     rename it, translate the right-hand side, and add it to LANGS.
   - Other languages are translated on the device by desktop Chrome's built-in translator when it is
     available. Only the fixed menu and button words are translated, never people's names or posts.

   TRANSLATE A POST
   - A "Translate" link appears under messages, a tradesperson's About text and service descriptions.
     It uses Chrome's built-in translator when available, otherwise the free MyMemory web service.
     The free service has a daily limit, so for a busy site we should move this to a paid translation
     service later. */
(function () {
  const LANGS = [["en", "English"], ["tpi", "Tok Pisin"], ["ho", "Hiri Motu"], ["fr", "Fran\u00e7ais"], ["es", "Espa\u00f1ol"], ["pt", "Portugu\u00eas"], ["de", "Deutsch"], ["id", "Bahasa Indonesia"], ["tl", "Filipino"], ["zh", "\u4e2d\u6587"], ["ja", "\u65e5\u672c\u8a9e"], ["ko", "\ud55c\uad6d\uc5b4"], ["hi", "\u0939\u093f\u0928\u094d\u0926\u0940"]];
  const DICTS = {
    tpi: {
      "Home": "Hom", "Browse": "Painim", "About": "Baut long mipela", "Contact": "Toktok wantaim mipela",
      "Log in": "Go insait", "Sign up": "Raitim nem", "My Dashboard": "Pes bilong mi", "Admin": "Admin",
      "Find trusted tradespeople near you": "Painim ol gutpela wokman klostu long yu",
      "Whether it's a quick repair or a big project, connect with skilled tradespeople in your area.": "Sapos em liklik stretim o bikpela wok, toktok wantaim ol gutpela wokman long ples bilong yu.",
      "Browse Tradespeople": "Lukim ol wokman", "How It Works": "Olsem wanem em i wok",
      "Top Rated Tradespeople": "Ol wokman i gat gutpela nem", "View all \u2192": "Lukim olgeta \u2192",
      "Reviewed Listings": "Ol lista mipela i lukim pastaim", "Every tradesperson listing is reviewed before it goes public.": "Mipela i lukim olgeta lista pastaim bipo em i go long ol manmeri.",
      "Real Reviews": "Ol tru tok bilong kastoma", "See what other customers have to say.": "Lukim wanem ol narapela kastoma i tok.",
      "Local & Reliable": "Long ples na yu ken bilip", "Find help in your area, when you need it.": "Painim halivim long ples bilong yu taim yu nidim.",
      "Find the right tradesperson": "Painim stretpela wokman", "Search": "Painim", "View Profile": "Lukim profail",
      "Message": "Tok", "Book Service": "Buk wok", "Request a Quote": "Askim prais",
      "Welcome back": "Welkam bek", "Create an account": "Mekim wanpela akaun", "Create Account": "Mekim akaun",
      "Customer": "Kastoma", "Tradesperson": "Wokman", "Full name": "Pulap nem", "Email address": "Email adres",
      "Password": "Pasward", "Confirm password": "Kamapim pasward gen", "Remember me": "Tingim mi",
      "Forgot password?": "Yu lusim tingting long pasward?",
      "Dashboard": "Pes bilong mi", "Messages": "Ol tok", "Profile": "Profail", "Log Out": "Go aut",
      "My Bookings": "Ol buk bilong mi", "Saved Tradespeople": "Ol wokman mi seivim", "My Reviews": "Ol tok bilong mi",
      "Help and Support": "Halivim", "Services and Pricing": "Ol wok na prais", "Availability": "Taim mi stap",
      "Work Gallery": "Piksa bilong wok", "Premium": "Premium",
      "Save Changes": "Seivim senis", "Cancel": "Lusim", "Continue": "Go het", "Previous": "Go bek",
      "Save Draft": "Seivim draft", "Submit Profile": "Salim profail", "Send Message": "Salim tok",
      "Send request": "Salim askim", "Leave a review": "Raitim tok", "Confirm": "Kamapim", "Decline": "Nogat",
      "Mark completed": "Makim pinis", "Terms": "Lo", "Privacy": "Haid", "Terms of Service": "Lo bilong wok",
      "Privacy Policy": "Lo bilong haitim save", "Contact us": "Toktok wantaim mipela", "About TradeLink": "Baut long TradeLink",
      "Report this listing": "Tokim mipela long dispela lista", "Type a message": "Raitim wanpela tok",
      "e.g. plumber, electrician, carpenter...": "olsem: plamba, elektrisen, kapenta...", "Your location": "Ples bilong yu"
    }
  };
  const UI_KEYS = Object.keys(DICTS.tpi);          // the fixed words we are allowed to translate
  const MAPS = {}, MT = {};
  let lang = localStorage.getItem("tl_lang") || "en";

  /* ---------- translators ---------- */
  async function getTranslator(src, tgt) {
    const k = src + ">" + tgt; if (MT[k] !== undefined) return MT[k];
    try {
      if (!("Translator" in self)) return (MT[k] = null);
      if ((await Translator.availability({sourceLanguage: src, targetLanguage: tgt})) === "unavailable") return (MT[k] = null);
      return (MT[k] = await Translator.create({sourceLanguage: src, targetLanguage: tgt}));
    } catch (e) { return (MT[k] = null); }
  }
  async function buildMT(code) {
    const tr = await getTranslator("en", code); if (!tr) return null;
    const map = {}; for (const k of UI_KEYS) { try { map[k] = await tr.translate(k); } catch (e) {} }
    return map;
  }
  const target = () => ({tpi: "en", zh: "zh-CN"}[lang] || lang);


  /* ---------- translation that works on every phone and browser ----------
     Order: (1) built-in word list, (2) this device's saved translations, (3) Chrome's translator if it has one,
     (4) the translate-ui function (AI translation, shared cache), (5) the free MyMemory service.
     Everything that is translated is saved on the device, so each sentence is only translated once. */
  const ENAME = {tpi: "Tok Pisin", ho: "Hiri Motu", fr: "French", es: "Spanish", pt: "Portuguese", de: "German", id: "Indonesian", tl: "Filipino", zh: "Simplified Chinese", ja: "Japanese", ko: "Korean", hi: "Hindi"};
  const TX = {};
  const txLoad = c => { if (!TX[c]) { try { TX[c] = JSON.parse(localStorage.getItem("tl_tx_" + c) || "{}"); } catch (e) { TX[c] = {}; } } return TX[c]; };
  const txSave = c => { try { localStorage.setItem("tl_tx_" + c, JSON.stringify(TX[c] || {})); } catch (e) {} };
  async function myMemory(strings, code) {
    const out = {}, tgt = ({zh: "zh-CN"})[code] || code; let i = 0;
    async function worker() {
      while (i < strings.length) {
        const k = strings[i++];
        try {
          const r = await fetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(k.slice(0, 450)) + "&langpair=en|" + tgt);
          const d = await r.json(), t = d && d.responseData && d.responseData.translatedText;
          if (t && !/MYMEMORY WARNING|INVALID|QUERY LENGTH/i.test(t)) out[k] = t;
        } catch (e) {}
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    return out;
  }
  async function translateBatch(strings, code) {
    const out = {};
    for (let i = 0; i < strings.length; i += 40) {
      const part = strings.slice(i, i + 40);
      try {
        const r = await SB.functions.invoke("translate-ui", {body: {lang: ENAME[code] || code, strings: part}});
        if (!r.error && r.data && r.data.map) { Object.assign(out, r.data.map); continue; }
      } catch (e) {}
      Object.assign(out, await myMemory(part, code));
    }
    return out;
  }
  async function buildServer(code) {
    const c = txLoad(code), need = UI_KEYS.filter(k => c[k] === undefined);
    if (need.length) { const got = await translateBatch(need, code); Object.assign(c, got); txSave(code); }
    const map = {}; UI_KEYS.forEach(k => { if (c[k]) map[k] = c[k]; });
    return Object.keys(map).length ? map : null;
  }
  // the form pages (questions and explanations) are translated as they appear
  let filling = false;
  async function fillMissing() {
    if (filling || lang === "en" || !MAPS[lang]) return;
    const sel = ".pro label.fl, .pro div.fl, .pro .tlhint, .pro h2, .pro h3, .pro .card > .m, .pro .cta button, #tlreq, .tlsheet-c h3, .tlsheet-c p, .tlsheet-c li, .tlsheet-c button";
    const c = txLoad(lang), have = Object.assign({}, MAPS[lang], c), need = new Set();
    nodes().forEach(n => { const k = n.nodeValue.trim(); if (n.__o === undefined && k.length > 2 && k.length < 260 && /[A-Za-z]/.test(k) && have[k] === undefined && n.parentNode.closest && n.parentNode.closest(sel)) need.add(k); });
    if (!need.size) return;
    filling = true;
    try { const got = await translateBatch([...need].slice(0, 80), lang); Object.keys(got).forEach(k => { c[k] = got[k]; }); txSave(lang); apply(); }
    finally { filling = false; }
  }

  /* ---------- the page text ---------- */
  function nodes() {
    const out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {acceptNode: n => {
      const p = n.parentNode; if (!p || /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName) || (p.closest && p.closest(".nt,.langsel"))) return NodeFilter.FILTER_REJECT;
      return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }});
    let n; while ((n = w.nextNode())) out.push(n); return out;
  }
  function restore() {
    nodes().forEach(n => { if (n.__o !== undefined) { n.nodeValue = n.__o; n.__o = undefined; } });
    document.querySelectorAll("[placeholder]").forEach(e => { if (e.__p !== undefined) { e.setAttribute("placeholder", e.__p); e.__p = undefined; } });
  }
  function apply() {
    const base = MAPS[lang]; if (lang === "en" || !base) return;
    const map = Object.assign({}, base, txLoad(lang)); Object.keys(map).forEach(k => { if (!map[k]) delete map[k]; });
    nodes().forEach(n => { const k = n.nodeValue.trim(); if (map[k] !== undefined) { if (n.__o === undefined) n.__o = n.nodeValue; n.nodeValue = n.nodeValue.replace(k, map[k]); } });
    document.querySelectorAll("[placeholder]").forEach(e => { const k = e.getAttribute("placeholder"); if (map[k] !== undefined) { if (e.__p === undefined) e.__p = k; e.setAttribute("placeholder", map[k]); } });
  }
  function note(m) {
    let b = document.getElementById("langnote");
    if (!b) { b = document.createElement("div"); b.id = "langnote"; b.style.cssText = "position:fixed;left:12px;right:12px;bottom:70px;z-index:99;background:#101d39;color:#fff;border-radius:10px;padding:10px 14px;font-size:13px;cursor:pointer"; b.onclick = () => b.remove(); document.body.appendChild(b); }
    b.textContent = m; setTimeout(() => b.remove(), 6000);
  }
  async function setLang(code, save = true) {
    restore(); lang = code; localStorage.setItem("tl_lang", code); document.documentElement.lang = code.split("-")[0];
    document.querySelectorAll(".langsel").forEach(s => s.value = code);
    if (code !== "en" && !MAPS[code]) {
      note("Translating the page\u2026");
      MAPS[code] = DICTS[code] || await buildMT(code) || await buildServer(code);
      if (!MAPS[code]) { note("We could not translate the page just now. Please check your internet and try again."); delete MAPS[code]; }
    }
    apply();
    if (save && typeof ME_ID !== "undefined" && ME_ID) { try { await ck(SB.from("profile_private").update({language: code}).eq("id", ME_ID)); } catch (e) {} }
  }
  window.setSiteLang = setLang;

  /* ---------- the language pickers ---------- */
  function mkSel(cls, dark) {
    const s = document.createElement("select"); s.className = "langsel " + cls; s.setAttribute("aria-label", "Language");
    s.style.cssText = "background:transparent;color:inherit;border:1px solid " + (dark ? "#ffffff44" : "var(--line)") + ";border-radius:7px;padding:5px 6px;font-size:12px;max-width:120px";
    s.innerHTML = LANGS.map(l => `<option value="${l[0]}" style="color:#000">${l[1]}</option>`).join(""); s.value = lang;
    s.onchange = () => setLang(s.value); return s;
  }

  /* ---------- translate a post ---------- */
  async function translateText(text) {
    const tgt = target();
    try {
      if ("LanguageDetector" in self && "Translator" in self) {
        const det = await LanguageDetector.create(), r = await det.detect(text), src = r && r[0] && r[0].detectedLanguage;
        if (src && src.split("-")[0] === tgt.split("-")[0]) return null;           // already in your language
        if (src) { const tr = await getTranslator(src, tgt); if (tr) return await tr.translate(text); }
      }
    } catch (e) {}
    const res = await fetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text.slice(0, 450)) + "&langpair=Autodetect|" + tgt);
    const d = await res.json(), out = d && d.responseData && d.responseData.translatedText;
    if (!out || /MYMEMORY WARNING|INVALID/i.test(out)) throw new Error("limit");
    return out;
  }
  function addButtons() {
    const items = [];
    document.querySelectorAll(".bb").forEach(el => items.push([el, () => el.firstChild && el.firstChild.nodeType == 3 ? el.firstChild.nodeValue : el.textContent]));
    const pg = document.querySelector("#pf .pg"), p = pg && pg.querySelector(".card > p.m"); if (p) items.push([p, () => p.textContent]);
    document.querySelectorAll("#pf .sv > span > small").forEach(el => items.push([el, () => el.textContent]));
    items.forEach(([el, get]) => {
      if (el.dataset.tl || (get() || "").trim().length < 4) return; el.dataset.tl = "1";
      const a = document.createElement("a"); a.className = "vf tlk"; a.style.cssText = "display:inline-block;margin:4px 0;font-size:11px;cursor:pointer"; a.textContent = "Translate";
      let box = null;
      a.onclick = async () => {
        if (box) { box.remove(); box = null; a.textContent = "Translate"; return; }
        a.textContent = "Translating\u2026"; box = document.createElement("div"); box.className = "nt m"; box.style.cssText = "font-style:italic;margin:2px 0 6px";
        a.insertAdjacentElement("afterend", box);
        try { const r = await translateText(get().trim()); box.textContent = r === null ? "This already looks like your language." : r; }
        catch (e) { box.innerHTML = 'Translation is not available right now. <a class="vf" target="_blank" rel="noopener" href="https://translate.google.com/?sl=auto&tl=' + encodeURIComponent(target()) + '&text=' + encodeURIComponent(get().trim().slice(0, 1500)) + '&op=translate">Open in Google Translate</a>'; }
        a.textContent = "Hide translation";
      };
      el.insertAdjacentElement("afterend", a);
    });
  }

  onDom(() => {
    const act = document.querySelector("header .act"); if (act && !act.querySelector(".langsel")) act.prepend(mkSel("l1", true));
    const tb = document.querySelector("#dash .tb"); if (tb && !tb.querySelector(".langsel")) tb.appendChild(mkSel("l2", false));
    if (window.__dbLang && !window.__langSynced) { window.__langSynced = 1; if (window.__dbLang !== lang) setLang(window.__dbLang, false); }
    apply(); addButtons(); fillMissing();
  });
  if (lang !== "en") setLang(lang, false);
})();
