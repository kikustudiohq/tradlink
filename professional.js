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
