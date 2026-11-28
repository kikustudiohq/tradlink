/* TradeLink phone numbers with a country picker (Papua New Guinea +675 is the default).
   Needs countries.js loaded first. Works on the customer profile form and on the
   tradesperson "public business phone" field. The number is saved as "+675 71234567"
   in the same phone fields as before, so nothing in the database changes. */
(function () {
  const list = [...COUNTRIES].sort((a, b) => a[1] == "PG" ? -1 : b[1] == "PG" ? 1 : a[0].localeCompare(b[0]));
  const dials = [...new Set(COUNTRIES.map(c => c[2]))].sort((a, b) => b.length - a.length);
  const dialOf = iso => (COUNTRIES.find(c => c[1] == iso) || [0, 0, "675"])[2];

  window.parsePhone = function (v) {
    v = String(v || "").trim();
    if (v[0] == "+") {
      const d = v.slice(1).replace(/\D/g, ""), m = dials.find(x => d.startsWith(x));
      if (m) return {dial: m, num: d.slice(m.length)};
    }
    return {dial: "675", num: v.replace(/\D/g, "")};
  };
  window.composePhone = function (dial, num) {
    const n = String(num || "").replace(/\D/g, "").replace(/^0+/, "");
    return n ? "+" + dial + " " + n : "";
  };

  onDom(() => {
    document.querySelectorAll('input[oninput*="\'phone\'"]').forEach(inp => {
      if (inp.dataset.cc) return;
      const g = ((inp.getAttribute("oninput") || "").match(/setF\('(c|t)','phone'/) || [])[1];
      if (!g) return;
      inp.dataset.cc = "1"; inp.style.display = "none";
      const p = parsePhone(inp.value), iso = (COUNTRIES.find(c => c[2] == p.dial) || [0, "PG"])[1];
      const box = document.createElement("div");
      box.style.cssText = "display:flex;gap:8px;width:100%;align-items:center";
      box.innerHTML = '<select aria-label="Country code" style="max-width:48%">' + list.map(c => `<option value="${c[1]}">${c[0]} (+${c[2]})</option>`).join("") + '</select><input type="tel" inputmode="numeric" placeholder="71234567" aria-label="Phone number">';
      const sel = box.querySelector("select"), num = box.querySelector("input");
      sel.value = iso; num.value = p.num;
      const upd = () => { const v = composePhone(dialOf(sel.value), num.value); inp.value = v; setF(g, "phone", v); };
      sel.onchange = upd; num.oninput = upd;
      inp.parentNode.appendChild(box);
    });
  });
})();
