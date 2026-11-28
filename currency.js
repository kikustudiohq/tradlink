/* TradeLink currency: tradespeople choose US dollars (US$) or Australian dollars (A$) for their prices.
   Run currency.sql once first. Load after professional.js.
   The choice appears at the top of the "Services and fees" step of the tradesperson wizard. */
const curSym = c => c == "AUD" ? "A$" : "US$";

onDom(() => {
  if (typeof PF === "undefined" || !PF.t || typeof role === "undefined" || role !== "t") return;
  const add = document.querySelector('button[onclick*="svc.push"]'); if (!add) return;
  const card = add.closest(".card"); if (!card || card.querySelector("#curbox")) return;
  const box = document.createElement("label"); box.id = "curbox"; box.className = "fl"; box.style.marginTop = "0";
  box.innerHTML = 'Currency for your prices<div class="fi"><select><option value="USD">US dollars (US$)</option><option value="AUD">Australian dollars (A$)</option></select></div><div class="m" style="margin-top:4px">Customers see your prices in this currency.</div>';
  const sel = box.querySelector("select"); sel.value = PF.t.cur || "USD";
  sel.onchange = () => { PF.t.cur = sel.value; sv_(); };
  card.insertBefore(box, card.firstChild);
});

const _sl5 = window.saveListing;
window.saveListing = async function (s) {
  await _sl5(s);
  try { await ck(SB.from("trade_listings").update({currency: PF.t.cur || "USD"}).eq("owner_id", ME_ID)); }
  catch (e) { console.warn("Currency not saved (run currency.sql?)", e.message || e); }
};
const _lm5 = window.loadMe;
window.loadMe = async function () {
  const r = await _lm5();
  if (r && ME_ID && role === "t") {
    try { const l = await ck(SB.from("trade_listings").select("currency").eq("owner_id", ME_ID).maybeSingle()); PF.t.cur = (l && l.currency) || "USD"; } catch (e) { PF.t.cur = "USD"; }
  }
  return r;
};
