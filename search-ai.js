/* TradeLink smart (AI) search. Run search-ai.sql once and deploy the listing-search function.
   - After a tradesperson saves their profile it is "registered" with the AI index so it can be found.
   - In Browse, typing 3+ letters also finds listings by MEANING (for example "leaking tap" finds
     plumbers), and Best Match puts the closest ones first.
   - Admin page: a "Re-index all listings" button to register listings that existed before this update.
   If the function is not deployed, normal search keeps working exactly as before. */
const AI_MIN_SCORE = 0.78;     // lower = more results, higher = stricter. Tune after real use.
window.AI_HIT = {};

async function aiIndex() { try { await SB.functions.invoke("listing-search", {body: {action: "index"}}); } catch (e) {} }
const _sl4 = window.saveListing;
window.saveListing = async function (s) { await _sl4(s); aiIndex(); };      // runs in the background

let aiTimer = null, aiLast = "";
async function aiSearch(q) {
  if (q.length < 3) { if (Object.keys(AI_HIT).length) { AI_HIT = {}; draw(); } aiLast = ""; return; }
  if (q === aiLast) return; aiLast = q;
  try {
    const r = await SB.functions.invoke("listing-search", {body: {action: "search", q}});
    const hits = (r.data && r.data.hits) || [];
    const top = hits.length ? Math.max(...hits.map(h => h.score)) : 0, cut = Math.max(AI_MIN_SCORE, top - 0.06);
    AI_HIT = {}; hits.forEach(h => { if (h.score >= cut) AI_HIT[h.id] = h.score; });
    draw();
  } catch (e) { /* normal search still works */ }
}
onDom(() => {
  const q = document.getElementById("q"); if (!q || q.dataset.ai) return; q.dataset.ai = "1";
  q.addEventListener("input", () => { clearTimeout(aiTimer); aiTimer = setTimeout(() => aiSearch(q.value.trim()), 450); });
});

const _adp3 = window.adp;
window.adp = function () {
  const base = _adp3();
  if (!ME_ADMIN || !ADM) return base;
  return base + `<div class="card pad" style="margin-top:14px"><b>Smart search</b><p class="m" style="margin:4px 0 10px">Run this once after setting up smart search, and again if search results look wrong.</p><button class="btn o" onclick="aiReindex()">Re-index all listings</button></div>`;
};
PANES.ad = window.adp;
window.aiReindex = async function () {
  try { const r = await SB.functions.invoke("listing-search", {body: {action: "reindex"}}); if (r.error) throw r.error; alert("Done. " + ((r.data && r.data.count) || 0) + " listings registered."); }
  catch (e) { alert("Could not re-index. Is the listing-search function deployed? " + (e.message || e)); }
};
