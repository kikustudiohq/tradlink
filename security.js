/* TradeLink security (front end). Run security.sql once first. Load this file LAST (after language.js).
   What it adds:
   1. Stronger passwords when signing up
   2. Slows down guessing: 5 wrong logins in 10 minutes locks the login box for 10 minutes
   3. Two-step verification (6-digit code from an authenticator app) with a Security page
   4. "Sign out on all devices" and automatic sign-out after being inactive
   5. A profile cannot be created until the required questions are answered
      (phone with country code and nationality for everyone, plus all the wizard questions)
   6. Optional bot check (Cloudflare Turnstile) once you add a site key below
   The same rules are enforced again by the database (security.sql), so they cannot be skipped
   by editing the page. */
const IDLE_MINUTES = 60;                 // sign out after this many minutes of no activity
const TURNSTILE_KEY = "";                // optional: paste your Cloudflare Turnstile SITE key to turn on the bot check
const COMMON_PW = ["password", "password1", "12345678", "123456789", "1234567890", "qwerty123", "iloveyou", "11111111", "abc12345", "letmein1", "welcome1", "admin123", "tradelink", "tradelink1", "papuanewguinea"];

/* ---------- 1. passwords ---------- */
function pwProblem(pw, email) {
  pw = String(pw || "");
  if (pw.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Use letters and numbers in your password.";
  if (COMMON_PW.includes(pw.toLowerCase())) return "That password is too common. Choose something harder to guess.";
  const local = String(email || "").split("@")[0].toLowerCase();
  if (local.length >= 4 && pw.toLowerCase().includes(local)) return "Do not use your email name inside your password.";
  return "";
}
const _da = window.doAuth;
window.doAuth = async function (s) {
  if (s) { const m = pwProblem($("pw").value, $("em").value); if (m) { const er = $("er"); er.style.color = ""; er.textContent = m; return; } }
  return _da(s);
};

/* ---------- 2. login guard + optional bot check ---------- */
const FKEY = "tl_fails";
const fails = () => { try { return JSON.parse(localStorage.getItem(FKEY) || "[]").filter(t => Date.now() - t < 10 * 60000); } catch (e) { return []; } };
const addFail = () => { const f = fails(); f.push(Date.now()); try { localStorage.setItem(FKEY, JSON.stringify(f)); } catch (e) {} };
const locked = () => fails().length >= 5;
let CAPTCHA = "";
function captchaOpt(o) { return TURNSTILE_KEY ? Object.assign({}, o, {captchaToken: CAPTCHA}) : o; }
function needCaptcha() { return TURNSTILE_KEY && !CAPTCHA ? {data: null, error: {message: "Please complete the \"I am human\" check first."}} : null; }

async function askCode() {
  return new Promise(res => {
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;inset:0;z-index:100;background:#000b;display:grid;place-items:center;padding:20px";
    d.innerHTML = '<div class="card pad" style="max-width:340px;width:100%"><h3>Two-step verification</h3><p class="m" style="margin:6px 0 12px">Enter the 6-digit code from your authenticator app.</p><div class="fi"><input id="mfacode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456"></div><div style="display:flex;gap:10px;margin-top:14px"><button class="btn o" id="mfx" style="flex:1">Cancel</button><button class="btn" id="mfo" style="flex:1">Verify</button></div></div>';
    document.body.appendChild(d);
    const i = d.querySelector("#mfacode"); i.focus();
    const done = v => { d.remove(); res(v); };
    d.querySelector("#mfx").onclick = () => done(null); d.querySelector("#mfo").onclick = () => done(i.value.trim());
    i.onkeydown = e => { if (e.key === "Enter") done(i.value.trim()); };
  });
}
const _signIn = SB.auth.signInWithPassword.bind(SB.auth);
SB.auth.signInWithPassword = async function (cred) {
  if (locked()) return {data: null, error: {message: "Too many wrong attempts. Please wait 10 minutes, or use Forgot password."}};
  const c = needCaptcha(); if (c) return c;
  const r = await _signIn({email: cred.email, password: cred.password, options: captchaOpt({}).captchaToken ? captchaOpt({}) : undefined});
  if (window.turnstile && TURNSTILE_KEY) { try { turnstile.reset(); } catch (e) {} CAPTCHA = ""; }
  if (r.error) { addFail(); return r; }
  try {
    const a = await SB.auth.mfa.getAuthenticatorAssuranceLevel();
    if (a.data && a.data.nextLevel === "aal2" && a.data.currentLevel !== "aal2") {
      const f = await SB.auth.mfa.listFactors(), fac = ((f.data && f.data.totp) || [])[0];
      const code = await askCode();
      if (!code) { await SB.auth.signOut(); return {data: null, error: {message: "Verification was cancelled."}}; }
      const v = await SB.auth.mfa.challengeAndVerify({factorId: fac.id, code});
      if (v.error) { await SB.auth.signOut(); addFail(); return {data: null, error: {message: "That code is not correct."}}; }
    }
  } catch (e) { await SB.auth.signOut(); return {data: null, error: {message: "Could not check your verification code. Please try again."}}; }
  try { localStorage.removeItem(FKEY); } catch (e) {}
  return r;
};
const _signUp = SB.auth.signUp.bind(SB.auth);
SB.auth.signUp = async function (a) {
  const c = needCaptcha(); if (c) return c;
  const r = await _signUp(TURNSTILE_KEY ? Object.assign({}, a, {options: Object.assign({}, a.options, {captchaToken: CAPTCHA})}) : a);
  if (window.turnstile && TURNSTILE_KEY) { try { turnstile.reset(); } catch (e) {} CAPTCHA = ""; }
  return r;
};
if (TURNSTILE_KEY) {
  const s = document.createElement("script"); s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true; document.head.appendChild(s);
  onDom(() => {
    const er = document.getElementById("er");
    if (er && !document.getElementById("cfbox") && window.turnstile) {
      const b = document.createElement("div"); b.id = "cfbox"; b.style.marginTop = "12px"; er.insertAdjacentElement("beforebegin", b);
      turnstile.render(b, {sitekey: TURNSTILE_KEY, callback: t => { CAPTCHA = t; }, "expired-callback": () => { CAPTCHA = ""; }});
    }
  });
}

/* ---------- 3. two-step verification + Security page ---------- */
let MFA = {on: false, fid: null};
async function loadMfa() {
  if (!ME_ID) { MFA = {on: false, fid: null}; return; }
  try { const f = await SB.auth.mfa.listFactors(), t = (f.data && f.data.totp) || []; MFA = {on: t.length > 0, fid: t[0] && t[0].id}; } catch (e) {}
}
const _la2 = window.loadAll;
window.loadAll = async function () { await _la2(); await loadMfa(); };
window.scp = function () {
  const warn = ME_ADMIN && !MFA.on ? '<div class="card pad" style="border-left:4px solid #e5384f;margin:14px 0"><b>Admin account: turn on two-step verification</b><div class="m">Admins can approve listings and confirm payments, so this account needs the strongest protection.</div></div>' : "";
  return `<h2>Security</h2>${warn}<div class="card pad" style="margin-top:14px"><b>Two-step verification ${MFA.on ? '<span class="tag" style="color:var(--grn)">On</span>' : '<span class="tag">Off</span>'}</b><p class="m" style="margin:6px 0 12px">Adds a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator or Authy) every time you log in. Even if someone learns your password, they cannot get in.</p>${MFA.on ? '<button class="btn o" onclick="mfaOff()">Turn off</button>' : '<button class="btn" onclick="mfaStart()">Turn on</button>'}</div>
<div class="card pad" style="margin-top:14px"><b>Password</b><p class="m" style="margin:6px 0 12px">Use a long password you do not use anywhere else.</p><button class="btn o" onclick="chgPw()">Change password</button></div>
<div class="card pad" style="margin-top:14px"><b>Sign out everywhere</b><p class="m" style="margin:6px 0 12px">Logs you out on every phone and computer. Use this if you lost a device or think someone else has your login.</p><button class="btn o" onclick="signOutAll()">Sign out on all devices</button></div>`;
};
PANES.sc = window.scp;
window.mfaStart = async function () {
  try {
    const f = await SB.auth.mfa.listFactors();
    for (const x of ((f.data && f.data.all) || []).filter(x => x.status === "unverified")) await SB.auth.mfa.unenroll({factorId: x.id});
    const r = await SB.auth.mfa.enroll({factorType: "totp", friendlyName: "TradeLink " + Date.now()}); if (r.error) throw r.error;
    const d = r.data; $("au").hidden = false;
    $("au").innerHTML = `<div class="aw" style="grid-template-columns:1fr"><div class="ac"><button class="x" aria-label="Close" onclick="$('au').hidden=true">${I("x")}</button><h2>Turn on two-step verification</h2><p class="m" style="margin-top:8px">1. Open your authenticator app and scan this picture.</p><img id="qrimg" alt="QR code" style="width:180px;height:180px;background:#fff;margin:10px 0;border-radius:8px"><p class="m">Cannot scan? Type this key into the app: <b>${esc(d.totp.secret)}</b></p><p class="m" style="margin-top:10px">2. Type the 6-digit code the app shows.</p><div class="fi"><input id="mc" inputmode="numeric" maxlength="6" placeholder="123456"></div><div class="er" id="mx"></div><button class="btn" onclick="mfaConfirm('${d.id}')">Turn on</button></div></div>`;
    $("qrimg").src = d.totp.qr_code;
  } catch (e) { alert("Could not start: " + (e.message || e)); }
};
window.mfaConfirm = async function (fid) {
  try { const r = await SB.auth.mfa.challengeAndVerify({factorId: fid, code: $("mc").value.trim()}); if (r.error) throw r.error; $("au").hidden = true; await loadMfa(); pn("sc"); alert("Two-step verification is now on."); }
  catch (e) { $("mx").textContent = "That code is not correct. Use the newest code from the app."; }
};
window.mfaOff = async function () {
  if (!confirm("Turn off two-step verification? Your account will be less safe.")) return;
  try { const r = await SB.auth.mfa.unenroll({factorId: MFA.fid}); if (r.error) throw r.error; await loadMfa(); pn("sc"); } catch (e) { alert("Could not turn it off: " + (e.message || e)); }
};
window.signOutAll = async function () { try { await SB.auth.signOut({scope: "global"}); } catch (e) {} window.out(); };

/* ---------- 4. sign out when inactive ---------- */
let lastActive = Date.now();
["click", "keydown", "touchstart", "mousemove"].forEach(ev => document.addEventListener(ev, () => { lastActive = Date.now(); }, {passive: true}));
setInterval(() => { if (U && ME_ID && Date.now() - lastActive > IDLE_MINUTES * 60000) { window.out(); alert("You were signed out because you were inactive."); } }, 60000);

/* ---------- 5. required questions before a profile can be created ---------- */
const phoneOk = v => { const d = String(v || "").replace(/\D/g, ""); return d.length >= 8 && d.length <= 15; };
const _vals = window.vals;
window.vals = function (s) {
  const m = _vals(s); if (m) return m;
  if (s == 0 && !PF.t.nat) return "Choose your nationality.";
  if (s == 6 && !phoneOk(PF.t.phone)) return "Enter a business phone number with its country code.";
  return "";
};
const _sub = window.sub;
window.sub = function () {
  for (let s = 0; s < 7; s++) { const m = vals(s); if (m) { PF.step = s; PF.flash = m; pn("pf"); return; } }
  _sub();
};
const _cs = window.cs;
window.cs = function () {
  const c = PF.c;
  const m = !c.name ? "Enter your full name." : !/^\S+@\S+$/.test(c.email || "") ? "Enter a valid email address." : !c.loc ? "Enter your general location." : !phoneOk(c.phone) ? "Enter your phone number with its country code." : !c.nat ? "Choose your nationality." : "";
  if (m) { $("verr").textContent = m; return; }
  _cs();
};
onDom(() => {   // mark the questions that are now required
  document.querySelectorAll("label.fl").forEach(l => {
    const t = l.firstChild; if (!t || t.nodeType != 3) return;
    if (t.nodeValue.includes("Phone number (optional)")) t.nodeValue = "Phone number *";
    else if (t.nodeValue.includes("Public business phone (optional)")) t.nodeValue = "Business phone (shown on your listing) *";
  });
});
