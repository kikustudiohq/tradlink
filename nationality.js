/* TradeLink nationality picker. Needs countries.js loaded first, and profile-extras.sql run once.
   Adds a "Nationality" drop-down to the customer profile form and to the first step of the
   tradesperson wizard. It is saved PRIVATELY (only the owner can read it) in profile_private. */
(function () {
  const names = COUNTRIES.map(c => c[3]).sort((a, b) => a == "Papua New Guinean" ? -1 : b == "Papua New Guinean" ? 1 : a.localeCompare(b));

  onDom(() => {
    [["c", "phone"], ["t", "name"]].forEach(([g, k]) => {
      document.querySelectorAll(`input[oninput*="setF('${g}','${k}'"]`).forEach(inp => {
        const lab = inp.closest("label");
        if (!lab || lab.dataset.nat || typeof PF === "undefined" || !PF[g]) return;
        lab.dataset.nat = "1";
        const node = document.createElement("label");
        node.className = "fl";
        node.innerHTML = 'Nationality *<div class="fi"><select><option value="">Select\u2026</option>' + names.map(n => `<option>${n}</option>`).join("") + '<option>Other</option></select></div>';
        const sel = node.querySelector("select");
        sel.value = PF[g].nat || "";
        sel.onchange = () => { PF[g].nat = sel.value; sv_(); };
        lab.insertAdjacentElement("afterend", node);
      });
    });
  });

  async function persist(g) {
    try {
      if (!ME_ID || !PF[g]) return;
      await ck(SB.from("profile_private").update({nationality: PF[g].nat || null}).eq("id", ME_ID));
    } catch (e) { console.warn("Nationality not saved (run profile-extras.sql?):", e.message || e); }
  }
  const _lm = window.loadMe;
  window.loadMe = async function () {
    const r = await _lm();
    if (r && ME_ID) {
      try {
        const p = await ck(SB.from("profile_private").select("nationality,language").eq("id", ME_ID).maybeSingle());
        if (p) { PF.c.nat = p.nationality || ""; PF.t.nat = p.nationality || ""; window.__dbLang = p.language || ""; }
      } catch (e) {}
    }
    return r;
  };
  const _sc = window.saveCustomer;
  window.saveCustomer = async function () { await persist("c"); await _sc(); };   // saved first: the database checks it
  const _sl = window.saveListing;
  window.saveListing = async function (s) { await persist("t"); await _sl(s); };
})();
