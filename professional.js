/* TradeLink professional wording and classic font for the profile questions.
   Changes only what people SEE: the label text and the font. Nothing in the database changes. */
(function () {
  const st = document.createElement("style");
  st.textContent = `.pro h2,.pro h3,.pro .fl,.pro .m,.pro .tag{font-family:Georgia,"Times New Roman",Times,serif}
.pro h2{font-weight:600;letter-spacing:.2px}.pro .fl{font-size:13px;letter-spacing:.1px}`;
  document.head.appendChild(st);

  const LABELS = {
    "Full name": "Full legal name",
    "Business or trading name (optional)": "Registered business or trading name (if applicable)",
    "Professional profile picture": "Professional portrait photograph",
    "Main trade category": "Primary trade or profession",
    "Your trade": "Please state your trade or profession",
    "Additional trades": "Additional trades or specialisations",
    "Professional headline": "Professional summary (one line)",
    "Professional biography / business description": "Professional background and services offered",
    "Years of experience": "Years of professional experience",
    "Skills and specialisations": "Key skills and areas of specialisation",
    "Qualifications or certificates": "Qualifications, certificates and accreditations",
    "Licences (where required)": "Trade licences and registrations (where required)",
    "City or suburb": "City or suburb of operation",
    "Main service location": "Principal service location",
    "Other suburbs or areas you serve": "Additional areas served",
    "Travel distance (km, optional)": "Maximum travel distance in kilometres (optional)",
    "Work gallery photos": "Portfolio of completed work",
    "Preferred contact method": "Preferred method of contact",
    "Public business phone (optional)": "Business telephone (displayed on your listing)",
    "Business phone (shown on your listing)": "Business telephone (displayed on your listing)",
    "Appointment preferences (optional)": "Appointment arrangements (optional)",
    "Availability status": "Current availability",
    "Opening time": "Daily opening time", "Closing time": "Daily closing time",
    "Display name (optional)": "Preferred name (optional)",
    "General location (city or suburb)": "City or suburb of residence",
    "Short biography (optional)": "About you (optional)",
    "Phone number (optional)": "Telephone number", "Phone number": "Telephone number",
    "Email address": "Email address", "Nationality": "Nationality"
  };
  const STEPS = {"Identity": "Professional identity", "Description": "Background and experience", "Services": "Services and fees", "Hours": "Hours of operation", "Location": "Service area", "Images": "Portfolio", "Contact": "Contact details", "Preview": "Review and submit"};
  window.proLabel = function (t) {
    const star = /\s\*$/.test(t), core = t.replace(/\s\*$/, "").trim();
    return LABELS[core] ? LABELS[core] + (star ? " *" : "") : t;
  };
  onDom(() => {
    const dm = document.querySelector("#dash .dm"); if (!dm) return;
    const forms = !!dm.querySelector(".fl"); if (dm.classList) dm.classList.toggle("pro", forms);
    dm.querySelectorAll("label.fl, div.fl").forEach(l => {
      const n = l.firstChild; if (!n || n.nodeType != 3) return;
      const t = proLabel(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t;
    });
    dm.querySelectorAll("b").forEach(b => { if (STEPS[b.textContent] && b.parentNode && /Step \d of 8/.test(b.parentNode.textContent)) b.textContent = STEPS[b.textContent]; });
  });
})();

/* ---------- limits, counters and guidance for the profile questions ---------- */
(function () {
  const st = document.createElement("style");
  st.textContent = `.pro .card.pad{border-radius:14px}.pro .fl .fi{transition:border-color .15s,box-shadow .15s}
.pro .fl .fi:focus-within{border-color:var(--blue);box-shadow:0 0 0 3px #1262ff22}
.cnt{text-align:right;font-size:11px;color:var(--mut);margin-top:3px}.cnt.full{color:#e5384f}
.hint{font-size:12px;color:var(--mut);margin:4px 0 0;line-height:1.4;font-family:Georgia,"Times New Roman",serif}`;
  document.head.appendChild(st);

  // field key -> [maximum characters, guidance shown under the question]
  const LIM = {
    "c.name": [100], "c.disp": [60], "c.loc": [100], "c.bio": [400, "A short note about yourself. Up to 400 characters."],
    "t.name": [100], "t.biz": [100], "t.other": [60],
    "t.head": [120, "One clear line, for example: Licensed plumber with 10 years of experience."],
    "t.bio": [1000, "Describe your experience, the work you do and what customers can expect. Up to 1,000 characters."],
    "t.skills": [250, "Separate skills with commas, for example: pipe fitting, leak detection, drainage."],
    "t.qual": [300, "List your certificates, training and accreditations."],
    "t.lic": [250, "Licence or registration numbers are optional. Do not include ID numbers."],
    "t.city": [60], "t.area": [80], "t.areas": [200, "Separate areas with commas."], "t.appt": [200],
    "svc.n": [80], "svc.d": [300, "A short description customers can understand."]
  };
  function keyOf(el) {
    const a = el.getAttribute("oninput") || "";
    let m = a.match(/setF\('([ct])','(\w+)'/); if (m) return m[1] + "." + m[2];
    m = a.match(/svc\[\d+\]\.(\w)=/); if (m) return "svc." + m[1];
    return null;
  }
  onDom(() => {
    document.querySelectorAll("#dash input[oninput], #dash textarea[oninput]").forEach(el => {
      if (el.dataset.lim) return; const k = keyOf(el), L = k && LIM[k]; if (!L) return; el.dataset.lim = "1";
      el.maxLength = L[0];
      const fi = el.closest(".fi") || el.parentNode, c = document.createElement("div"); c.className = "cnt";
      const upd = () => { c.textContent = el.value.length + " / " + L[0]; c.classList.toggle("full", el.value.length >= L[0]); };
      el.addEventListener("input", upd); upd(); fi.insertAdjacentElement("afterend", c);
      if (L[1]) { const h = document.createElement("div"); h.className = "hint"; h.textContent = L[1]; fi.insertAdjacentElement("afterend", h); }
    });
  });
})();
