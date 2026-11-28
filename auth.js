/* TradeLink sign up and login. Load AFTER security.js (it replaces the earlier sign-up/login code).
   What this fixes and adds:
   - Sign up really creates the account, and tells the person clearly what happens next:
       * signed in straight away, OR
       * "check your email to confirm" (with a Resend button and a spam-folder hint)
   - An email that is already registered is detected, so nobody thinks a second sign-up worked.
   - Log out then log in again works, with clear messages when something is wrong
     (wrong password, email not confirmed, too many tries).
   - See your password: a proper eye button on every password box.
   - Strong passwords: a live checklist while typing. At least 10 characters, upper AND lower case, a number,
     and not a common password. (Also set the same rules in Supabase: Authentication > Policies.)
   - New people land on their Profile page to finish the required details. */
const PW_LEN = 10;
function pwChecks(pw, email) {
  pw = String(pw || ""); const local = String(email || "").split("@")[0].toLowerCase();
  return [
    [pw.length >= PW_LEN, "At least " + PW_LEN + " characters"],
    [/[a-z]/.test(pw) && /[A-Z]/.test(pw), "Upper and lower case letters"],
    [/\d/.test(pw), "At least one number"],
    [!COMMON_PW.includes(pw.toLowerCase()) && !(local.length >= 4 && pw.toLowerCase().includes(local)), "Not a common password or part of your email"]
  ];
}
window.pwProblem = function (pw, email) { const bad = pwChecks(pw, email).find(c => !c[0]); return bad ? "Password rule: " + bad[1].toLowerCase() + "." : ""; };

/* ---------- friendly messages ---------- */
function authMsg(x) {
  const m = String((x && x.message) || x || "").toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials")) return {t: "The email or password is not correct. If you just signed up, confirm your email first."};
  if (m.includes("not confirmed")) return {t: "Please confirm your email address first. Check your inbox and your spam folder.", resend: true};
  if (m.includes("already registered") || m.includes("already been registered")) return {t: "An account with this email already exists. Please log in instead."};
  if (m.includes("rate limit") || m.includes("too many")) return {t: "Too many attempts. Please wait a few minutes and try again."};
  if (m.includes("not authorized") || m.includes("sending") && m.includes("email")) return {t: "We could not send the confirmation email just now. Please try again later or contact TradeLink."};
  if (m.includes("failed to fetch") || m.includes("network")) return {t: "Cannot connect. Check your internet connection and try again."};
  return {t: (x && x.message) || String(x)};
}
function toast(t) {
  let b = document.getElementById("authtoast");
  if (!b) { b = document.createElement("div"); b.id = "authtoast"; b.style.cssText = "position:fixed;left:12px;right:12px;bottom:72px;z-index:99;background:#1fa971;color:#fff;border-radius:10px;padding:12px 14px;font-size:14px;cursor:pointer;text-align:center"; b.onclick = () => b.remove(); document.body.appendChild(b); }
  b.textContent = t; setTimeout(() => b.remove(), 7000);
}

/* ---------- the "check your email" screen ---------- */
function showCheckEmail(email) {
  $("au").innerHTML = `<div class="aw" style="grid-template-columns:1fr"><div class="ac"><h2>Check your email</h2><p class="m" style="margin:8px 0 12px">Your account has been created. We sent a confirmation link to <b>${esc(email)}</b>. Open it to finish, then log in.</p><p class="m">Cannot find it? Look in your spam or junk folder.</p><div class="er" id="rs"></div><button class="btn" onclick="openAuth('login')">Go to log in</button><button class="btn o" style="margin-top:10px" onclick="resendConfirm('${esc(email)}')">Resend the email</button></div></div>`;
}
window.resendConfirm = async function (email) {
  const r = $("rs") || $("er");
  try { const x = await SB.auth.resend({type: "signup", email}); if (x.error) throw x.error; if (r) { r.style.color = "var(--grn)"; r.textContent = "Sent again. Please check your inbox."; } }
  catch (e) { if (r) { r.style.color = ""; r.textContent = authMsg(e).t; } }
};

/* ---------- the form: eye buttons, strength checklist, Enter key ---------- */
const EYE = '<svg class="i" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg class="i" viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 6.2A9.9 9.9 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 6.7A16 16 0 0 0 2 12s4 7 10 7a9.8 9.8 0 0 0 4.4-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
function eyeFor(inp) {
  let b = inp.parentNode.querySelector("button");
  if (!b) { b = document.createElement("button"); inp.parentNode.appendChild(b); }
  b.type = "button"; b.setAttribute("aria-label", "Show or hide password"); b.title = "Show or hide password"; b.innerHTML = EYE_OFF;                                   // hidden (default): eye with a line across it
  b.onclick = () => { const show = inp.type === "password"; inp.type = show ? "text" : "password"; b.innerHTML = show ? EYE : EYE_OFF; };
}
function enhanceAuth(signup) {
  const pw = $("pw"), pc = $("pc"), em = $("em"); if (!pw) return;
  em.setAttribute("autocomplete", "email"); pw.setAttribute("autocomplete", signup ? "new-password" : "current-password");
  eyeFor(pw); if (pc) { pc.setAttribute("autocomplete", "new-password"); eyeFor(pc); }
  [em, pw, pc].forEach(i => { if (i) i.onkeydown = e => { if (e.key === "Enter") doAuth(signup); }; });
  if (signup) {
    const box = document.createElement("div"); box.id = "pwm"; box.style.cssText = "margin-top:8px;font-size:12px";
    pw.closest("label").insertAdjacentElement("afterend", box);
    const upd = () => {
      const c = pwChecks(pw.value, em.value), n = c.filter(x => x[0]).length, col = n == 4 ? "var(--grn)" : n >= 2 ? "var(--gold)" : "#e5384f";
      box.innerHTML = `<div style="height:6px;background:var(--chip);border-radius:9px;overflow:hidden"><div style="height:100%;width:${n * 25}%;background:${col}"></div></div><div style="margin-top:4px;color:${col}">${["Too weak", "Weak", "Fair", "Good", "Strong"][n]}</div>${c.map(x => `<div style="color:${x[0] ? "var(--grn)" : "var(--mut)"}">${x[0] ? "\u2713" : "\u2022"} ${x[1]}</div>`).join("")}`;
    };
    pw.addEventListener("input", upd); em.addEventListener("input", upd); upd();
  }
}
const _oa2 = window.openAuth;
window.openAuth = function (m, next) { _oa2(m, next); try { enhanceAuth(m == "signup"); } catch (e) { console.warn(e); } };

/* ---------- sign up and log in ---------- */
window.doAuth = async function (s) {
  const er = $("er"), say = (t, good) => { er.style.color = good ? "var(--grn)" : ""; er.innerHTML = t; };
  const e = $("em").value.trim().toLowerCase(), p = $("pw").value, n = s ? $("fn").value.trim() : "";
  const bad = !/^\S+@\S+\.\S+$/.test(e) ? "Enter a valid email address." : !p ? "Enter your password." :
    s && !n ? "Enter your full name." : s && pwProblem(p, e) ? pwProblem(p, e) : s && $("pc").value !== p ? "The two passwords do not match." :
    s && !$("tc").checked ? "Agree to the Terms of Service and Privacy Policy to continue." : "";
  if (bad) { say(esc(bad)); return; }
  say("Please wait\u2026", true);
  const go = document.querySelector('#au button[onclick^="doAuth"]'); if (go) go.disabled = true;
  try {
    if (s) {
      const {data, error} = await SB.auth.signUp({email: e, password: p, options: {data: {full_name: n, role: role == "t" ? "tradesperson" : "customer"}, emailRedirectTo: location.origin + location.pathname}});
      if (error) throw error;
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) { say('An account with this email already exists. <a class="vf" onclick="openAuth(\'login\')">Log in instead</a>'); return; }
      if (!data.session) { showCheckEmail(e); return; }
      AN = "pf";                                           // new people finish their profile first
    } else {
      const {error} = await SB.auth.signInWithPassword({email: e, password: p});
      if (error) throw error;
    }
    if (!(await loadMe())) throw new Error("We could not load your account. Please try again.");
    await loadAll(); await loadListings(); await loadFavs(); draw(); top_();
    $("auth").innerHTML = authBtn(); openDash(AN); $("au").hidden = true;
    if (s) toast("Welcome to TradeLink, " + n.split(" ")[0] + ". Your account is ready.");
  } catch (x) {
    const m = authMsg(x);
    say(esc(m.t) + (m.resend ? ' <a class="vf" onclick="resendConfirm(\'' + esc(e) + '\')">Resend the email</a>' : ""));
  } finally { if (go) go.disabled = false; }
};

/* ---------- if a login exists but its profile row is missing, repair it automatically ---------- */
const _lm6 = window.loadMe;
window.loadMe = async function () {
  try { return await _lm6(); }
  catch (e) {
    const m = String((e && e.message) || e).toLowerCase();
    if (!(m.includes("no rows") || m.includes("multiple (or no)") || (e && e.code === "PGRST116"))) throw e;
    const r = await SB.rpc("ensure_profile");           // creates the missing profile (run auth-fix.sql once)
    if (r.error) throw new Error("Your account exists but your profile could not be prepared. Please contact TradeLink.");
    return await _lm6();
  }
};

/* ---------- keep the screen in step with the login ---------- */
let loggingOut = false;
const _out4 = window.out;
window.out = async function () { loggingOut = true; try { await _out4(); } finally { loggingOut = false; } };
SB.auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT" && U && !loggingOut) setTimeout(() => { if (U) window.out(); }, 0); });

/* ---------- choose a new password (also used after "Forgot password") ---------- */
window.chgPw = function () {
  $("au").hidden = false;
  $("au").innerHTML = `<div class="aw" style="grid-template-columns:1fr"><div class="ac"><button class="x" aria-label="Close" onclick="$('au').hidden=true">${I("x")}</button><h2>Choose a new password</h2>
<label class="fl">New password<div class="fi">${I("shield")}<input id="np" type="password" autocomplete="new-password"></div></label>
<label class="fl">Confirm new password<div class="fi">${I("shield")}<input id="np2" type="password" autocomplete="new-password"></div></label><div id="npm"></div>
<div class="er" id="npx"></div><button class="btn" onclick="savePw()">Save password</button></div></div>`;
  const a = $("np"), b = $("np2"); eyeFor(a); eyeFor(b);
  const box = $("npm"); box.style.cssText = "margin-top:8px;font-size:12px";
  const upd = () => { const c = pwChecks(a.value, ""); box.innerHTML = c.map(x => `<div style="color:${x[0] ? "var(--grn)" : "var(--mut)"}">${x[0] ? "\u2713" : "\u2022"} ${x[1]}</div>`).join(""); };
  a.addEventListener("input", upd); upd();
};
window.savePw = async function () {
  const a = $("np").value, b = $("np2").value, x = $("npx"); x.style.color = "";
  let email = ""; try { email = (await SB.auth.getUser()).data.user.email || ""; } catch (e) {}
  const bad = pwProblem(a, email) || (a !== b ? "The two passwords do not match." : "");
  if (bad) { x.textContent = bad; return; }
  const r = await SB.auth.updateUser({password: a});
  if (r.error) { x.textContent = authMsg(r.error).t; return; }
  $("au").hidden = true; toast("Your password has been changed.");
};
