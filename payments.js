/* TradeLink payments, step 2: the "I have paid" form. Load AFTER premium.js and BEFORE fixes.js. Run 11-fixes.sql once first.

   HOW IT WORKS NOW
   1. The tradesperson picks a plan and a payment method (bank transfer, mobile money ...).
   2. A payment reference is made. NOTHING is recorded as a payment yet: it is only a draft ("Payment not submitted").
   3. They pay in their banking or mobile money app, using the reference.
   4. They come back and fill in: who paid, the receipt number, the date, and a photo of the receipt.
      Only then does it become "Waiting for confirmation" and appear on the Admin page.
   5. You check the receipt photo against your bank or mobile money history and tap Confirm.

   Card payments (Visa / Mastercard) need a payment company. We never take card numbers ourselves.
   See README.txt, section "Card payments". */
(function () {
  const today = () => new Date().toISOString().slice(0, 10);
  const say = (t, good) => { const x = document.getElementById("pyx"); if (x) { x.style.color = good ? "var(--grn)" : ""; x.textContent = t; } };
  const tip = (id, t) => `<button type="button" class="tlinfo" aria-expanded="false" aria-label="Explain this question" onclick="const b=document.getElementById('${id}');b.hidden=!b.hidden;this.setAttribute('aria-expanded',String(!b.hidden))">i</button><div class="tlhint" id="${id}" hidden>${t}</div>`;

  function details(r) {
    const m = (payList()[PICK] || payList()[0] || {name: "Bank transfer", info: ""});
    $("au").hidden = false;
    $("au").innerHTML = `<div class="aw" style="grid-template-columns:1fr"><div class="ac" style="max-width:460px;max-height:92vh;overflow:auto">
<button class="x" aria-label="Close" onclick="$('au').hidden=true">${I("x")}</button>
<h2>Pay ${money(r.amount, r.currency)}</h2>
<div class="card pad" style="margin:12px 0;background:var(--chip)"><b>Step 1. Send the money</b>
<div class="m" style="margin-top:8px">Your payment reference. Write it in the reason or description box when you pay.</div>
<div style="font-size:26px;font-weight:700;letter-spacing:2px;margin:6px 0 10px">${esc(r.reference)}</div>
<div class="m"><b>${esc(m.name)}</b></div><div style="white-space:pre-line;margin-top:4px">${esc(m.info)}</div></div>
<div class="card pad" style="margin:12px 0"><b>Step 2. Tell us about your payment</b>
<p class="m" style="margin:4px 0 8px">Fill this in after you have paid. We use it to find your payment quickly.</p>
<label class="fl">What name was on the account or phone you paid from?${tip("pyh1", "Write the name exactly as it shows on your bank or mobile money account, for example: Mary Kila.")}<div class="fi"><input id="pyn" autocomplete="name" maxlength="80"></div></label>
<label class="fl">What is the receipt or transaction number?${tip("pyh2", "After you pay, your bank or mobile money app shows a number or code. Type it here, for example: TXN48213377. If you cannot find one, add a photo of the receipt instead.")}<div class="fi"><input id="pyt" maxlength="60" autocapitalize="characters"></div></label>
<label class="fl">On which date did you pay?<div class="fi"><input id="pyd" type="date" value="${today()}" max="${today()}"></div></label>
<label class="fl">Can you add a photo of your receipt? (optional)${tip("pyh3", "Take a screenshot of the payment confirmation in your banking app, or a photo of the paper receipt. Make sure the amount, date and reference are easy to read. It makes confirmation much faster.")}<div class="fi"><input id="pyf" type="file" accept="image/*"></div></label>
<div class="er" id="pyx"></div>
<button class="btn" id="pyb" onclick="paySubmit('${r.id}')">I have paid. Submit details</button>
<button class="btn o" style="margin-top:10px" onclick="$('au').hidden=true;openDash('pm')">I will pay later</button></div>
<p class="m">If you do not submit these details, your payment is not counted. You can finish it later under My payments.</p></div></div>`;
  }

  window.payRequest = async function (id) {
    try {
      await loadSub();
      let r = PAYS.find(p => p.status === "awaiting" && p.plan === id && p.currency === PAY_CUR);
      if (!r) r = await ck(SB.from("payment_requests").insert({plan: id, currency: PAY_CUR}).select().single());
      await loadSub(); details(r);
    } catch (e) { const x = $("px"); if (x) x.textContent = e.message || String(e); else alert(e.message || e); }
  };
  window.payResume = function (id) {
    const r = PAYS.find(p => p.id === id); if (!r) return;
    PAY_CUR = r.currency || "USD"; if (!payList().length) { alert("Payments are not open yet."); return; }
    details(r);
  };
  window.payCancel = async function (id) {
    const ok = window.tlConfirm ? await tlConfirm({title: "Cancel this payment?", body: "Nothing has been charged. You can start again any time.", ok: "Cancel payment", cancel: "Keep it"}) : confirm("Cancel this payment?");
    if (!ok) return;
    try { const r = await SB.rpc("cancel_payment", {pid: id}); if (r.error) throw r.error; await loadSub(); pn("pm"); } catch (e) { alert("Could not cancel: " + (e.message || e)); }
  };
  window.paySubmit = async function (id) {
    const payer = $("pyn").value.trim(), txn = $("pyt").value.trim(), paid = $("pyd").value, file = $("pyf").files[0];
    if (payer.length < 2) { say("Type the name on the account you paid from."); return; }
    if (txn.length < 4 && !file) { say("Type the receipt number, or add a photo of your receipt."); return; }
    if (!paid || paid > today()) { say("Choose the date you paid. It cannot be in the future."); return; }
    const b = $("pyb"); b.disabled = true; say("Sending\u2026", true);
    try {
      let path = null;
      if (file) {
        if (!file.type.startsWith("image/")) throw new Error("Please add a photo or screenshot of your receipt.");
        const blob = await shrinkDoc(file);
        path = ME_ID + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".jpg";
        await ck(SB.storage.from("receipts").upload(path, blob, {contentType: "image/jpeg"}));
      }
      const m = (payList()[PICK] || payList()[0] || {}).name || null;
      const r = await SB.rpc("submit_payment", {pid: id, payer: payer, txn: txn || null, paid: paid, receipt: path, meth: m});
      if (r.error) throw r.error;
      await loadSub();
      $("au").innerHTML = `<div class="aw" style="grid-template-columns:1fr"><div class="ac"><h2>Thank you</h2><p class="m" style="margin:8px 0">We have your payment details. TradeLink will check them against the payment and confirm. This can take a little while.</p><p class="m">You can follow the status under <b>My payments</b>.</p><button class="btn" style="margin-top:14px" onclick="$('au').hidden=true;openDash('pm')">Done</button></div></div>`;
    } catch (e) { b.disabled = false; say(e.message || String(e)); }
  };


  /* =====================================================================
     CHECKOUT PAGE (laid out like a normal app checkout)
     1. plan and price   2. choose how to pay   3. summary   4. the button
     Card payments go through KINA BANK's Internet Payment Gateway (IPG). The card number, expiry and security
     code are typed on Kina Bank's own secure page, never on TradeLink. Until Kina Bank has approved your
     business and given you your IPG details, keep CARD_ENABLED = false: the card row then shows "Coming soon". */
  const CARD_ENABLED = false;
  let CH = {sel: null};
  const chips = '<span style="display:inline-flex;gap:6px;margin-top:6px"><span class="tag" style="margin:0">VISA</span><span class="tag" style="margin:0">Mastercard</span><span class="tag" style="margin:0">Kina Bank card</span></span>';
  function rowsFor(id) {
    const p = PLANS.find(x => x.id == id), s = subState(), first = s.k == "none" || s.k == "trial";
    return {p, first, now: first ? money(0, PAY_CUR) : usd(priceOf(p)),
      lines: first ? [["Now", "30-day free trial for " + money(0, PAY_CUR)], ["After the trial", usd(priceOf(p)) + " for 1 " + p.per]] : [["Now", "1 " + p.per + " for " + usd(priceOf(p))], ["It does not renew by itself", "Pay again when it ends"]]};
  }
  function panel(id) {
    const list = payList();
    if (CH.sel === "card")
      return `<p class="m" style="text-align:center">You will go to <b>Kina Bank's secure page</b> to enter your card. TradeLink never sees your card number.</p>${chips}<div class="er" id="px"></div><button class="btn" style="margin-top:12px" onclick="cardGo('${id}')">Complete purchase</button>`;
    const m = list[+CH.sel] || list[0]; if (!m) return "";
    return `<p class="m" style="text-align:center">Pay with <b>${esc(m.name)}</b>. On the next screen you get your payment reference and the account details. Then tell us once you have paid.</p><div class="er" id="px"></div><button class="btn" style="margin-top:12px" onclick="PICK=${+CH.sel};payRequest('${id}')">Continue</button>`;
  }
  window.payOpen = function (id) {
    const list = payList();
    if (!list.length && !CARD_ENABLED) { alert("Payments are not open yet. Please contact us and we will help you."); return; }
    if (CH.sel === null || (CH.sel === "card" && !CARD_ENABLED) || (CH.sel !== "card" && !list[+CH.sel])) CH.sel = CARD_ENABLED ? "card" : "0";
    const r = rowsFor(id), p = r.p;
    const radio = (key, title, sub, dis) => `<div class="card pad" data-k="${key}" style="cursor:${dis ? "default" : "pointer"};padding:14px;margin-bottom:8px;${dis ? "opacity:.6;" : ""}${CH.sel === key ? "border-color:var(--blue);box-shadow:0 0 0 2px #1262ff33" : ""}" ${dis ? "" : `onclick="chkPick('${key}','${id}')"`}><div style="display:flex;gap:12px;align-items:flex-start"><span style="width:18px;height:18px;border-radius:50%;border:2px solid ${CH.sel === key ? "var(--blue)" : "var(--mut)"};display:grid;place-items:center;margin-top:2px;flex:none">${CH.sel === key ? '<span style="width:8px;height:8px;border-radius:50%;background:var(--blue)"></span>' : ""}</span><span><b>${title}</b>${dis ? ' <span class="tag" style="margin:0 0 0 6px">Coming soon</span>' : ""}<div class="m">${sub}</div></span></div></div>`;
    $("au").hidden = false;
    $("au").innerHTML = `<div class="aw" style="grid-template-columns:1fr"><div class="ac" style="max-width:480px;max-height:94vh;overflow:auto">
<button class="x" aria-label="Close" onclick="$('au').hidden=true">${I("x")}</button>
<h2>Checkout</h2>
<div style="text-align:right"><a class="vf" onclick="$('au').hidden=true;openDash('pm')">Change plan</a></div>
${curToggle(c => "PAY_CUR='" + c + "';payOpen('" + id + "')")}
<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line);padding-top:14px"><span><b style="font-size:17px">TradeLink Premium ${p.id == "weekly" ? "Weekly" : p.id == "monthly" ? "Monthly" : "Yearly"}</b><div class="m">1 tradesperson account</div></span><span style="text-align:right"><b style="font-size:19px">${usd(priceOf(p))}</b><div class="m">for 1 ${p.per}</div></span></div>
<div style="margin:12px 0;font-size:13px">${r.lines.map((l, i) => `<div style="display:flex;gap:10px;margin-top:6px"><span style="color:var(--blue)">${i ? "\u25CB" : "\u25CF"}</span><span><b>${l[0]}:</b> ${l[1]}</span></div>`).join("")}</div>
<h3 style="margin:18px 0 4px;font-size:20px">Choose how to pay</h3><p class="m" style="margin-bottom:10px">Pick the way that is easiest for you.</p>
${radio("card", "Credit or debit card", "Pay by card through Kina Bank." + chips, !CARD_ENABLED)}
${list.map((m, i) => radio(String(i), esc(m.name), "You pay in your banking or mobile money app, then send us the details.")).join("")}
<h3 style="margin:18px 0 8px;font-size:20px">Summary</h3>
<div class="card pad" style="background:var(--chip)"><div class="m">Items</div><div style="display:flex;justify-content:space-between;margin-top:6px"><b>TradeLink Premium ${p.id == "weekly" ? "Weekly" : p.id == "monthly" ? "Monthly" : "Yearly"}</b><span>${r.now}</span></div>
<div style="border-top:1px solid var(--line);margin-top:12px;padding-top:10px;display:flex;justify-content:space-between"><b style="font-size:17px">Total now</b><b style="font-size:17px">${r.now}</b></div></div>
${r.first ? '<p class="m" style="margin:10px 0">Your plan starts when your free trial ends. It does not renew by itself.</p>' : ""}
<div class="card pad" id="chp" style="margin-top:12px;text-align:center">${panel(id)}</div>
<p class="m" style="text-align:center;margin-top:10px">By continuing, you agree to the <a class="vf" onclick="$('au').hidden=true;go('terms')">Terms of Service</a>.</p></div></div>`;
  };
  window.chkPick = function (key, id) { CH.sel = key; const y = document.querySelector("#au .ac").scrollTop; window.payOpen(id); document.querySelector("#au .ac").scrollTop = y; };
  window.cardGo = async function (id) {
    const x = $("px"); if (x) x.textContent = "";
    try {
      const r = await SB.functions.invoke("kina-checkout", {body: {plan: id, currency: PAY_CUR}});
      if (r.error || !r.data || !r.data.url) throw new Error("Card payment is not available right now. Please choose another way to pay.");
      location.href = r.data.url;     // Kina Bank's secure card page
    } catch (e) { if (x) x.textContent = e.message || String(e); }
  };

  /* admin: open the receipt photo */
  window.receiptOpen = async function (id) {
    const p = (window.ADM && ADM.pay || []).find(x => x.id === id); if (!p || !p.receipt_path) return;
    const r = await SB.storage.from("receipts").createSignedUrl(p.receipt_path, 300);
    if (r.error) { alert("Could not open: " + r.error.message); return; }
    window.open(r.data.signedUrl, "_blank");
  };
})();
