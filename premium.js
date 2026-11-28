/* TradeLink Premium: free 30-day trial, then Weekly / Monthly / Yearly plans.
   Needs: premium.sql already run in Supabase, and this file loaded AFTER the main page script.
   HOW PAYMENT WORKS: the tradesperson picks a plan and gets a payment reference. They pay you
   outside the app (bank transfer or mobile money). You tap Confirm on the Admin page, and
   their listing stays in Search for the time they paid for. No card data ever touches this site. */

/* >>> YOU MUST FILL THIS IN <<<  Say exactly how people can pay you. Add one line per method:
   let PAY_METHODS = [
     {name: "Bank transfer", info: "Bank: ...\nAccount name: ...\nAccount number: ..."},
     {name: "Mobile money",  info: "Number: ...\nName: ..."}
   ];
   While this list is empty, the app tells people that payments are not open yet. */
let PAY_METHODS = [];
let PAY_INFO = "";      // the old single box still works if you prefer it
const payList = () => PAY_METHODS.length ? PAY_METHODS : (PAY_INFO.trim() ? [{name: "Pay TradeLink", info: PAY_INFO}] : []);
let PICK = 0;

const PLANS = [
  {id: "weekly",  name: "Weekly Plan",  desc: "Perfect for short-term access and flexibility.", price: "1.10",  per: "week",  icon: "cal"},
  {id: "monthly", name: "Monthly Plan", desc: "The most popular choice for steady growth.",     price: "4.40",  per: "month", icon: "crown", badge: "POPULAR"},
  {id: "yearly",  name: "Yearly Plan",  desc: "Best value. Save more in the long run.",         price: "44.00", per: "year",  icon: "gem",   badge: "\u2605 BEST VALUE"}
];
/* Prices in each currency. Change them here AND in currency.sql so the two always match.
   The server decides the real amount, and the payment screen always shows the server's amount. */
const PRICES = {USD: {weekly: "1.10", monthly: "4.40", yearly: "44.00"}, AUD: {weekly: "1.70", monthly: "6.60", yearly: "66.00"}};
let PAY_CUR = "USD";
const sym = c => c == "AUD" ? "A$" : "US$";
const money = (v, c) => sym(c) + Number(v).toFixed(2);
const priceOf = p => PRICES[PAY_CUR][p.id];
window.setPayCur = c => { PAY_CUR = c; pn("pm"); };
const curToggle = fn => `<div style="display:flex;gap:8px;justify-content:center;margin:0 0 14px">${["USD", "AUD"].map(c => `<button class="btn ${PAY_CUR == c ? "" : "o"}" style="padding:6px 16px" onclick="${fn(c)}">${c == "USD" ? "US dollars (US$)" : "Australian dollars (A$)"}</button>`).join("")}</div>`;
const PICON = {
  cal: '<svg class="i" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>',
  crown: '<svg class="i" viewBox="0 0 24 24"><path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/></svg>',
  gem: '<svg class="i" viewBox="0 0 24 24"><path d="M6 4h12l4 6-10 11L2 10z"/><path d="M2 10h20M9 4l3 17M15 4l-3 17"/></svg>'
};
(function () {
  const st = document.createElement("style");
  st.textContent = `.pmh{text-align:center;padding:10px 0 18px}.pmh h2{font-size:26px}.pmh p{color:var(--mut);margin-top:6px}
.pmc{display:flex;align-items:center;gap:16px;padding:16px;margin-bottom:14px;border-radius:16px;border:1px solid #5b4bd6;background:linear-gradient(120deg,#16164a,#241a63);color:#fff;cursor:pointer}
.pmc.pop{border-color:#2f8cff;background:linear-gradient(120deg,#0e2a6b,#123b8f)}.pmc.best{border-color:#8a5cff;background:linear-gradient(120deg,#2a1670,#3a1d86)}
.pmc .ic{width:56px;height:56px;border-radius:50%;background:#ffffff1c;display:grid;place-items:center;flex:none}.pmc .ic svg{width:26px;height:26px}
.pmc .tx{flex:1;min-width:0}.pmc .tx b{font-size:17px;display:block}.pmc .tx small{opacity:.8}
.pmc .pr{background:#ffffff1c;border-radius:14px;padding:10px 16px;text-align:left;position:relative;min-width:130px}.pmc .pr b{font-size:24px;display:block;line-height:1.1}.pmc .pr small{opacity:.85}
.pmc .bd2{position:absolute;top:-10px;right:-6px;background:#1e88ff;border-radius:99px;font-size:10px;padding:3px 10px;font-weight:700}.pmc.best .bd2{background:#7c4dff}
.pmf{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:18px 0}.pmf div{display:flex;gap:10px;align-items:center;font-size:12px;color:var(--mut)}.pmf svg{width:26px;height:26px;color:var(--blue)}
@media(max-width:760px){.pmc{flex-wrap:wrap}.pmc .pr{width:100%}}`;
  document.head.appendChild(st);
})();

let SUB = null, PAYS = [];
const dleft = e => Math.max(0, Math.ceil((new Date(e) - Date.now()) / 864e5));
const fdate = e => new Date(e).toLocaleDateString([], {day: "numeric", month: "short", year: "numeric"});
function subState() {
  const now = Date.now(), paid = SUB && SUB.current_period_end && new Date(SUB.current_period_end) > now, trial = SUB && SUB.trial_ends_at && new Date(SUB.trial_ends_at) > now;
  if (paid) return {k: "active", end: SUB.current_period_end};
  if (trial) return {k: "trial", end: SUB.trial_ends_at};
  return {k: SUB ? "expired" : "none"};
}
async function loadSub() {
  if (!ME_ID || role != "t") { SUB = null; PAYS = []; return; }
  try {
    SUB = await ck(SB.from("subscriptions").select("*").eq("owner_id", ME_ID).maybeSingle());
    PAYS = (await ck(SB.from("payment_requests").select("*").eq("owner_id", ME_ID).order("created_at", {ascending: false}))) || [];
  } catch (e) { console.warn("Premium not set up yet (run premium.sql):", e.message || e); SUB = null; PAYS = []; }
}
const _loadAll = window.loadAll;
window.loadAll = async function () { await _loadAll(); await loadSub(); };

/* ---- the Premium page ---- */
function statusCard() {
  const s = subState();
  const msg = {
    active: ["Premium is active", `Your listing stays in Search until <b>${s.end ? fdate(s.end) : ""}</b> (${s.end ? dleft(s.end) : 0} days left).`, "var(--grn)"],
    trial: ["Free trial", `You have <b>${s.end ? dleft(s.end) : 0} days</b> left of your free trial (until ${s.end ? fdate(s.end) : ""}). Pick a plan any time to keep your listing live after that.`, "var(--blue)"],
    expired: ["Your listing is hidden", "Your free trial or plan has ended, so customers can't find you in Search. Choose a plan below to go live again.", "#e5384f"],
    none: ["Free trial not started", "Your free 30-day trial starts the day TradeLink approves your listing.", "var(--gold)"]
  }[s.k];
  return `<div class="card pad" style="border-left:4px solid ${msg[2]};margin-bottom:16px"><b>${msg[0]}</b><div class="m" style="margin-top:4px">${msg[1]}</div></div>`;
}
window.pmp = function () {
  if (role != "t") return '<div class="card pad">Premium is for tradespeople.</div>';
  const PST = {awaiting: "Payment not submitted", pending: "Waiting for confirmation", confirmed: "Confirmed", rejected: "Not accepted"};
  const pays = PAYS.filter(p => p.status != "cancelled").length ? `<div class="card pad" style="margin-top:6px"><b>My payments</b>${PAYS.filter(p => p.status != "cancelled").map(p => `<div class="bk" style="flex-wrap:wrap"><span><b>${esc(p.reference)}</b> \u2022 ${esc(p.plan)} \u2022 ${money(p.amount, p.currency)}<div class="m">${fdate(p.created_at)}${p.note ? " \u2022 " + esc(p.note) : ""}</div></span><i class="cf" style="font-style:normal">${PST[p.status] || cap(p.status)}</i>${p.status == "awaiting" ? `<a class="vf" onclick="payResume('${p.id}')">Continue</a> <a class="vf" onclick="payCancel('${p.id}')">Cancel</a>` : ""}</div>`).join("")}</div>` : "";
  return `<div class="pmh"><h2>TradeLink Premium</h2><p>More visibility. More opportunities. More value.</p></div>${statusCard()}${curToggle(c => "setPayCur('" + c + "')")}
${PLANS.map(p => `<div class="pmc ${p.id == "monthly" ? "pop" : p.id == "yearly" ? "best" : ""}" onclick="payOpen('${p.id}')"><div class="ic">${PICON[p.icon]}</div><div class="tx"><b>${p.name}</b><small>${p.desc}</small></div><div class="pr">${p.badge ? `<span class="bd2">${p.badge}</span>` : ""}<b>${sym(PAY_CUR)}${priceOf(p)}</b><small>/ ${p.per}</small></div><span>\u203a</span></div>`).join("")}
<div class="pmf"><div>${I("shield")}<span>Stay listed in Search</span></div><div>${I("user")}<span>More connections</span></div><div>${I("filter")}<span>Greater opportunities</span></div><div>${I("star")}<span>Support local business</span></div></div>${pays}`;
};
PANES.pm = window.pmp;

/* ---- checkout ---- */
const usd = v => money(v, PAY_CUR);
function checkoutHTML(id) {
  const p = PLANS.find(x => x.id == id), s = subState(), list = payList(), first = s.k == "none" || s.k == "trial";
  const note = s.k == "trial" ? `Your plan starts when your free trial ends (${dleft(s.end)} days left).` : s.k == "none" ? "Your free 30-day trial starts when TradeLink approves your listing." : "";
  const rows = first ? [["30-day free trial", money(0, PAY_CUR) + " today"], ["After trial", usd(priceOf(p)) + "/" + p.per]] : [["Today", usd(priceOf(p))], ["Covers", "1 " + p.per]];
  return `<div class="aw" style="grid-template-columns:1fr"><div class="ac" style="max-width:440px">
<button class="x" aria-label="Close" onclick="$('au').hidden=true">${I("x")}</button><h2>TradeLink Checkout</h2>${curToggle(c => "PAY_CUR='" + c + "';payOpen('" + id + "')")}
<div class="card pad" style="margin:14px 0;background:var(--chip)"><div style="display:flex;justify-content:space-between;align-items:center"><b>Premium ${p.id == "weekly" ? "Weekly" : p.id == "monthly" ? "Monthly" : "Yearly"}</b>${p.badge ? `<span class="tag" style="margin:0;color:var(--grn)">${p.badge.replace("\u2605 ", "")}</span>` : ""}</div><div style="font-size:28px;font-weight:700;margin:6px 0">${usd(priceOf(p))}</div><div class="m">One payment covers 1 ${p.per}. It does not renew by itself, so pay again when it ends.</div></div>
<b>Payment method</b>
<div style="display:grid;gap:8px;margin:8px 0 14px">${list.map((m, i) => `<div class="card pad" style="cursor:pointer;padding:12px;${i == PICK ? "border-color:var(--blue);box-shadow:0 0 0 2px #1262ff33" : ""}" onclick="PICK=${i};payOpen('${id}')"><b>${esc(m.name)}</b><div class="m">You will see the payment details on the next screen.</div></div>`).join("")}</div>
<div class="m" style="margin-bottom:12px;display:flex;gap:8px;align-items:center;color:var(--grn)">${I("shield")}<span>We never ask for card numbers on this site. Payments are confirmed by TradeLink.</span></div>
<div style="border-top:1px solid var(--line);padding-top:12px"><b>Your order</b>${rows.map(r => `<div style="display:flex;justify-content:space-between;margin-top:8px"><span class="m">${r[0]}</span><b>${r[1]}</b></div>`).join("")}${note ? `<div class="m" style="margin-top:10px">${note}</div>` : ""}</div>
<div class="er" id="px"></div><button class="btn" onclick="payRequest('${id}')">Continue to payment</button>
<p class="m" style="text-align:center;margin-top:10px">By continuing, you agree to the <a class="vf" onclick="$('au').hidden=true;go('terms')">Terms of Service</a>.</p></div></div>`;
}
window.payOpen = function (id) {
  if (!payList().length) { alert("Payments are not open yet. Please contact us and we will help you."); return; }
  if (PICK >= payList().length) PICK = 0;
  $("au").hidden = false; $("au").innerHTML = checkoutHTML(id);
};
window.payRequest = async function (id) {
  try {
    const r = await ck(SB.from("payment_requests").insert({plan: id, currency: PAY_CUR}).select().single()), m = payList()[PICK] || payList()[0];
    await loadSub();
    $("au").innerHTML = `<div class="aw" style="grid-template-columns:1fr"><div class="ac"><h2>Pay ${money(r.amount, r.currency)}</h2><div class="m">Your payment reference</div><div style="font-size:26px;font-weight:700;letter-spacing:2px;margin:8px 0 14px">${esc(r.reference)}</div><p class="m"><b>Include this reference when you pay by ${esc(m.name)}.</b></p><div class="card pad" style="margin:12px 0;white-space:pre-line">${esc(m.info)}</div><p class="m">We confirm payments by hand, so it can take a little while. You will see the status under My payments.</p><button class="btn" style="margin-top:14px" onclick="$('au').hidden=true;openDash('pm')">Done</button></div></div>`;
  } catch (e) { const x = $("px"); if (x) x.textContent = e.message || String(e); else alert(e.message || e); }
};

/* ---- a reminder on the tradesperson dashboard ---- */
const _dbd = window.dbd;
window.dbd = function () {
  let b = "";
  if (role == "t") {
    const s = subState();
    if (s.k == "trial") b = `<div class="card pad" style="margin-bottom:14px;border-left:4px solid var(--blue)">Free trial: <b>${dleft(s.end)} days left</b>. <a class="vf" onclick="pn('pm')">See Premium plans</a></div>`;
    else if (s.k == "expired") b = `<div class="card pad" style="margin-bottom:14px;border-left:4px solid #e5384f">Your listing is hidden from Search. <a class="vf" onclick="pn('pm')">Choose a plan to go live again</a></div>`;
    else if (s.k == "none") b = `<div class="card pad" style="margin-bottom:14px;border-left:4px solid var(--gold)">Your free 30-day trial starts when TradeLink approves your listing. <a class="vf" onclick="pn('pm')">See Premium plans</a></div>`;
    else if (s.k == "active") b = `<div class="card pad" style="margin-bottom:14px;border-left:4px solid var(--grn)">Premium active until <b>${fdate(s.end)}</b>. <a class="vf" onclick="pn('pm')">Manage</a></div>`;
  }
  return b + _dbd();
};

/* ---- admin: confirm or reject payments ---- */
const _loadAdmin = window.loadAdmin;
window.loadAdmin = async function () {
  await _loadAdmin();
  let pay = [];
  try { pay = (await ck(SB.from("payment_requests").select("*").eq("status", "pending").order("created_at"))) || []; } catch (e) {}
  const ids = [...new Set(pay.map(p => p.owner_id).filter(id => !ADM.ps.some(x => x.id == id)))];
  if (ids.length) { try { ADM.ps = ADM.ps.concat((await ck(SB.from("profiles").select("id,full_name").in("id", ids))) || []); } catch (e) {} }
  ADM.pay = pay;
};
const _adp = window.adp;
window.adp = function () {
  const base = _adp();
  if (!ME_ADMIN || !ADM || !ADM.pay) return base;
  const nm = id => { const p = ADM.ps.find(x => x.id == id); return p ? p.full_name : "Unknown"; };
  return `<h2>Admin</h2><div class="card pad" style="margin-top:14px"><b>Payments waiting (${ADM.pay.length})</b>${ADM.pay.map(p => `<div class="bk" style="flex-wrap:wrap"><span><b>${esc(p.reference)}</b> \u2022 ${esc(nm(p.owner_id))}<div class="m">${esc(p.plan)} \u2022 ${money(p.amount, p.currency)} \u2022 ${fdate(p.created_at)}</div>${p.payer_name ? `<div class="m">Paid by <b>${esc(p.payer_name)}</b>${p.method ? " via " + esc(p.method) : ""} \u2022 Receipt no. <b>${esc(p.txn_ref || "none")}</b>${p.paid_on ? " \u2022 " + esc(p.paid_on) : ""}</div>` : ""}${p.receipt_path ? `<a class="vf" onclick="receiptOpen('${p.id}')">Open receipt photo</a>` : ""}</span><span style="display:flex;gap:12px"><a class="vf" onclick="payConfirm('${p.id}')">Confirm payment received</a><a class="vf" onclick="payReject('${p.id}')">Reject</a></span></div>`).join("") || '<p class="m">No payments waiting.</p>'}</div>` + base.replace("<h2>Admin</h2>", "");
};
PANES.ad = window.adp;
window.payConfirm = async function (id) {
  if (!confirm("Only confirm after the money has really arrived with this reference. Continue?")) return;
  try { const r = await SB.rpc("confirm_payment", {pid: id}); if (r.error) throw r.error; ADM = null; await loadListings(); draw(); top_(); pn("ad"); } catch (e) { alert("Could not confirm: " + (e.message || e)); }
};
window.payReject = async function (id) {
  const why = prompt("Reason (the tradesperson will see this):"); if (why == null) return;
  try { const r = await SB.rpc("reject_payment", {pid: id, why: why.trim() || "Not received"}); if (r.error) throw r.error; ADM = null; pn("ad"); } catch (e) { alert("Could not reject: " + (e.message || e)); }
};
if (ME_ID) loadSub();   // already signed in when this file loads
