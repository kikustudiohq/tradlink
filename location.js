/* TradeLink "use my location". Load after professional.js.
   - On profile forms: a "Use my current location" link fills in the suburb or city.
   - On search: a "Near me" button fills the location box and filters the results.
   The browser always asks permission first. Only the suburb and city NAMES are filled in:
   your exact position is never saved or sent to TradeLink. The place name is looked up with the
   free OpenStreetMap service (nominatim.openstreetmap.org). */
function getPos() {
  return new Promise((ok, no) => {
    if (!navigator.geolocation) return no(new Error("Location is not available on this device. Please type it in."));
    navigator.geolocation.getCurrentPosition(p => ok(p.coords),
      e => no(new Error(e.code === 1 ? "Location permission was not given. You can type your area instead." : "We could not find your location. Please type it in.")),
      {enableHighAccuracy: false, timeout: 12000, maximumAge: 300000});
  });
}
async function placeName(c) {
  const r = await fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=14&lat=" + c.latitude + "&lon=" + c.longitude, {headers: {"Accept-Language": "en"}});
  if (!r.ok) throw new Error("The place name service is busy. Please type it in.");
  const a = (await r.json()).address || {};
  return {
    suburb: a.suburb || a.neighbourhood || a.city_district || a.quarter || a.village || a.hamlet || "",
    city: a.city || a.town || a.municipality || a.county || a.state_district || a.state || ""
  };
}
function fillInput(inp, v) { if (!inp || !v) return; inp.value = v; inp.dispatchEvent(new Event("input", {bubbles: true})); }
const KINDS = {          // what each kind of box should receive
  both: p => [p.suburb, p.city].filter(Boolean).join(", "),
  city: p => p.city || p.suburb,
  area: p => p.suburb || p.city
};
window.useLocation = async function (inp, kind, msgEl) {
  const say = (t, ok) => { if (msgEl) { msgEl.style.color = ok ? "var(--grn)" : "#e5384f"; msgEl.textContent = t; } };
  try {
    say("Finding your location\u2026", true);
    const p = await placeName(await getPos()), v = KINDS[kind](p);
    if (!v) throw new Error("We could not work out your area. Please type it in.");
    fillInput(inp, v); say("Filled in: " + v, true);
  } catch (e) { say(e.message || String(e), false); }
};

function addLocBtn(inp, kind) {
  if (!inp || inp.dataset.loc) return; inp.dataset.loc = "1";
  const host = inp.closest("label") || inp.parentNode, wrap = document.createElement("div");
  wrap.style.cssText = "margin-top:6px;font-size:12px";
  wrap.innerHTML = '<a class="vf" role="button" tabindex="0">Use my current location</a> <span class="m"></span>';
  const link = wrap.querySelector("a"), msg = wrap.querySelector("span");
  link.onclick = () => useLocation(inp, kind, msg);
  host.appendChild(wrap);
}
onDom(() => {
  addLocBtn(document.querySelector('input[oninput*="setF(\'c\',\'loc\'"]'), "both");
  document.querySelectorAll('input[placeholder="Your location"], #loc').forEach(inp => {
    if (inp.dataset.near) return; inp.dataset.near = "1";
    const b = document.createElement("button"); b.type = "button"; b.className = "btn o"; b.textContent = "Near me";
    b.style.cssText = "padding:4px 10px;font-size:12px;white-space:nowrap;color:inherit;border-color:#ffffff55";
    b.onclick = async () => {
      b.textContent = "Finding\u2026";
      try { const v = KINDS.both(await placeName(await getPos())); if (v) { fillInput(inp, v); if (typeof draw === "function") draw(); } }
      catch (e) { alert(e.message || e); }
      b.textContent = "Near me";
    };
    inp.parentNode.appendChild(b);
  });
});
