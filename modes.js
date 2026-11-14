/* TradeLink account modes: one login, two modes. Run modes.sql once first. Load after security.js.
   - A "Switch to Tradesperson / Customer" button sits in the top bar of the dashboard.
   - The Profile page has a card that explains the two modes.
   - Messages and bookings show only the ones that belong to the mode you are in.
   - Your tradesperson listing stays online while you are in Customer mode. */

/* only show the chats and bookings that belong to the current mode */
const _lt = window.loadThreads;
window.loadThreads = async function () {
  await _lt();
  CVS = CVS.filter(c => c.as === role);
  UNR = CVS.reduce((n, c) => n + c.unread, 0);
};
const _lb = window.loadBookings;
window.loadBookings = async function () {
  await _lb();
  BKS = BKS.filter(b => role == "c" ? b.customer_id == ME_ID : b.listing_id == MYLID);
};

window.switchMode = async function (to) {
  const toT = to === "t";
  if (toT && !confirm("Switch to Tradesperson mode? You will set up a tradesperson profile. Your customer profile stays, and you can switch back any time.")) return;
  try {
    const r = await SB.from("profiles").update({role: toT ? "tradesperson" : "customer"}).eq("id", ME_ID);
    if (r.error) throw r.error;
    await loadMe(); await loadAll(); await loadListings(); draw(); top_();
    $("auth").innerHTML = authBtn();
    openDash(toT && !PF.done ? "pf" : "dash");
  } catch (e) { alert("Could not switch: " + (e.message || e)); }
};

onDom(() => {
  if (!U || typeof ME_ID === "undefined" || !ME_ID) return;
  const dm = document.querySelector("#dash .dm"); if (!dm) return;
  const tb = dm.querySelector(".tb");
  if (tb && !tb.querySelector(".modebtn")) {
    const b = document.createElement("button");
    b.className = "btn o modebtn"; b.style.cssText = "padding:6px 12px;font-size:12px;white-space:nowrap";
    b.textContent = role == "c" ? "Switch to Tradesperson" : "Switch to Customer";
    b.onclick = () => switchMode(role == "c" ? "t" : "c");
    tb.appendChild(b);
  }
  if (tb && pane === "pf" && !dm.querySelector("#modecard")) {
    const c = document.createElement("div");
    c.id = "modecard"; c.className = "card pad"; c.style.cssText = "margin-bottom:14px;border-left:4px solid var(--blue)";
    c.innerHTML = role == "c"
      ? `<b>You are in Customer mode</b><p class="m" style="margin:4px 0 12px">Do you offer a trade? Use this same login to offer your services. Your customer profile stays, and you can switch back any time.</p><button class="btn" onclick="switchMode('t')">Switch to Tradesperson mode</button>`
      : `<b>You are in Tradesperson mode</b><p class="m" style="margin:4px 0 12px">Want to hire someone yourself? Switch to Customer mode. Your listing stays online while you are away.</p><button class="btn o" onclick="switchMode('c')">Switch to Customer mode</button>`;
    tb.insertAdjacentElement("afterend", c);
  }
});
