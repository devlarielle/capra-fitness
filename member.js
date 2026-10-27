/* Member area: login, progress, QR check-in. */
(function () {
  "use strict";
  var C = window.Capra, $ = C.$, el = C.el;
  var SESSION = "capra-member-session";
  var PENDING = "capra-pending-code";
  var GOAL = C.GOAL;

  C.load();

  /* ---------- tiny storage wrappers (never throw) ---------- */
  var memSession = null, memPending = "";
  function getSession() { try { return localStorage.getItem(SESSION) || memSession; } catch (e) { return memSession; } }
  function setSession(v) { memSession = v; try { v ? localStorage.setItem(SESSION, v) : localStorage.removeItem(SESSION); } catch (e) { /* ignore */ } }
  function getPending() { try { return sessionStorage.getItem(PENDING) || memPending; } catch (e) { return memPending; } }
  function setPending(v) { memPending = v || ""; try { v ? sessionStorage.setItem(PENDING, v) : sessionStorage.removeItem(PENDING); } catch (e) { /* ignore */ } }

  /* A scanned QR opens /member?code=XXXXXX. Keep the code, then clean the address bar. */
  var urlCode = (new URLSearchParams(location.search).get("code") || "").toUpperCase().trim();
  if (urlCode) {
    setPending(urlCode);
    try { history.replaceState(null, "", location.pathname); } catch (e) { /* ignore */ }
  }

  var flash = null; // result box shown after a check-in

  /* ---------- views ---------- */
  function currentMember() {
    var id = getSession();
    return id ? C.memberById(id) : null;
  }

  function render() {
    var m = currentMember();
    if (!m && getSession()) setSession(null);
    $("loginView").hidden = !!m;
    $("dashView").hidden = !m;
    $("logoutBtn").hidden = !m;
    if (m) renderDash(m);
  }

  function renderDash(m) {
    var n = C.points(m.id), shown = Math.min(n, GOAL), status = C.statusFor(m.id), bonus = n - C.uniqueDays(m.id);
    $("memberTag").textContent = m.id;
    $("greeting").textContent = "Hi, " + m.name.split(" ")[0];
    $("countNum").textContent = String(shown);
    var holder = $("p20Holder");
    holder.innerHTML = "";
    holder.appendChild(C.p20Card(n));
    $("countNote").textContent = (n >= GOAL ? "Project 20 complete. Keep showing up!" : (GOAL - n) + " more point" + (GOAL - n === 1 ? "" : "s") + " to your free shirt.") +
      (bonus > 0 ? " Includes " + bonus + " bonus point" + (bonus === 1 ? "" : "s") + "." : "");

    var sh = $("shirtNote");
    sh.innerHTML = "";
    if (status === "eligible") {
      sh.appendChild(el("div", { class: "shirt-banner" }, [
        el("b", { text: "Your free shirt is ready" }),
        el("span", { text: "Show this screen at the front desk to claim your CF Gear shirt." })
      ]));
    } else if (status === "claimed") {
      sh.appendChild(el("div", { class: "shirt-banner done" }, [el("b", { text: "Shirt claimed" }), el("span", { text: "Enjoy it, and keep training." })]));
    }

    renderScanCard(m);
    renderCalendar(m);
  }

  function renderScanCard(m) {
    var card = $("scanCard");
    card.innerHTML = "";
    card.appendChild(el("p", { class: "label", text: "Check in" }));

    if (flash && flash.id === m.id) {
      card.appendChild(flash.box);
      return;
    }

    var done = C.checkinToday(m.id);
    var pending = getPending();
    var todayCode = C.dayCode(C.today());

    if (done) {
      card.appendChild(el("div", { class: "result-box success" }, [
        el("p", { class: "result-title", text: "Checked in today" }),
        el("p", { class: "result-sub", text: "Point logged at " + done.time + ". See you next session!" })
      ]));
      return;
    }

    if (pending && pending !== todayCode) {
      setPending("");
      card.appendChild(el("div", { class: "result-box warn" }, [
        el("p", { class: "result-title", text: "QR code not valid" }),
        el("p", { class: "result-sub", text: "That code is not for today. Scan the QR code at the gym entrance to check in." })
      ]));
      card.appendChild(scanHelp(m));
      return;
    }

    if (pending === todayCode) {
      card.appendChild(el("div", { class: "result-box ok-scan" }, [
        el("p", { class: "result-title", text: "Gym QR scanned" }),
        el("p", { class: "result-sub", text: "You're at Capra Fitness. Tap below to log today." })
      ]));
      card.appendChild(el("button", { class: "btn btn-full", type: "button", id: "confirmBtn", text: "Check in now", onclick: function () { confirmCheckIn(m); } }));
      return;
    }

    card.appendChild(el("p", { class: "scan-copy", text: "Scan the QR code at the gym entrance with your phone's camera. It opens this page and you tap once to check in." }));
    card.appendChild(scanHelp(m));
  }

  /* Demo-only shortcut so the pitch works on a laptop with no phone scan. */
  function scanHelp() {
    return el("div", { class: "demo-box" }, [
      el("strong", { text: "Demo only" }),
      el("br"),
      el("span", { text: "On a real phone you'd scan the gym's QR. To try it here: " }),
      el("button", { class: "link-btn", type: "button", id: "simBtn", text: "simulate scanning today's QR", onclick: function () { setPending(C.dayCode(C.today())); flash = null; render(); } })
    ]);
  }

  function confirmCheckIn(m) {
    setPending("");
    var r = C.checkIn(m.id);
    if (!r.ok) { return; }
    var n = Math.min(r.n, GOAL);
    var status = C.statusFor(m.id);
    var title, sub;
    if (r.already) { title = "Already checked in"; sub = "You checked in today at " + r.time + "."; }
    else if (r.justEarned) { title = "Free shirt unlocked!"; sub = "Point " + r.n + ": Project 20 complete. Show this screen at the front desk to get your shirt."; }
    else { title = "You're in, " + m.name.split(" ")[0]; sub = "Point " + r.n + " earned. " + (status === "progress" ? (GOAL - r.n) + " more to the free shirt." : "Keep going!"); }
    flash = {
      id: m.id,
      box: el("div", { class: "result-box success" }, [
        el("p", { class: "result-title", text: title }),
        el("p", { class: "result-sub", text: sub }),
        C.meter(n),
        el("div", { class: "meter-caption" }, [el("span", { text: n + " of " + GOAL + " points" }), el("span", { text: "Checked in " + r.time })])
      ])
    };
    render();
  }

  function renderCalendar(m) {
    var cal = $("cal");
    cal.innerHTML = "";
    var count = 0;
    for (var i = 27; i >= 0; i--) {
      var d = C.daysAgo(i);
      var on = !!C.checkinOn(m.id, d);
      if (on) count++;
      var cls = "cal-day" + (on ? " on" : "") + (i === 0 ? " now" : "");
      cal.appendChild(el("span", { class: cls, title: d + (on ? " (checked in)" : ""), "aria-label": d + (on ? " checked in" : " no check-in"), text: String(parseInt(d.slice(8), 10)) }));
    }
    $("calNote").textContent = count + " day" + (count === 1 ? "" : "s") + " trained in the last 4 weeks.";
  }

  /* ---------- login ---------- */
  var fails = 0, lockUntil = 0;
  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var msg = $("loginMsg");
    var now = Date.now();
    if (now < lockUntil) { msg.textContent = "Too many tries. Please wait " + Math.ceil((lockUntil - now) / 1000) + " seconds."; return; }
    var m = C.authenticate($("memberId").value, $("memberPin").value);
    if (!m) {
      fails++;
      if (fails >= 5) { lockUntil = now + 30000; fails = 0; msg.textContent = "Too many tries. Please wait 30 seconds."; }
      else msg.textContent = "Member ID or PIN is incorrect.";
      return;
    }
    fails = 0; msg.textContent = "";
    $("memberPin").value = "";
    flash = null;
    setSession(m.id);
    render();
  });

  $("logoutBtn").addEventListener("click", function () {
    setSession(null); flash = null; setPending("");
    render();
  });

  render();
})();
