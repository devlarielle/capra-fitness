/* Front desk: staff gate, daily QR, check-ins, members, rewards. */
(function () {
  "use strict";
  var C = window.Capra, $ = C.$, el = C.el;
  var GOAL = C.GOAL;
  var PASSCODE = "capra2026"; // demo only. The real build uses staff accounts with hashed passwords.
  var AUTH = "capra-desk-auth";

  C.load();

  var memAuth = false;
  function isAuthed() { try { return sessionStorage.getItem(AUTH) === "1" || memAuth; } catch (e) { return memAuth; } }
  function setAuthed(v) { memAuth = v; try { v ? sessionStorage.setItem(AUTH, "1") : sessionStorage.removeItem(AUTH); } catch (e) { /* ignore */ } }

  /* ---------- gate ---------- */
  function showGate() {
    $("gate").hidden = false; $("desk").hidden = true; $("logoutBtn").hidden = true;
  }
  function showDesk() {
    $("gate").hidden = true; $("desk").hidden = false; $("logoutBtn").hidden = false;
    renderAll();
  }
  $("gateForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if ($("passcode").value === PASSCODE) { $("gateMsg").textContent = ""; $("passcode").value = ""; setAuthed(true); showDesk(); }
    else $("gateMsg").textContent = "Incorrect passcode.";
  });
  $("logoutBtn").addEventListener("click", function () { setAuthed(false); showGate(); });

  /* ---------- QR ---------- */
  function qrSvg(text) {
    var qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount(), quiet = 2, size = n + quiet * 2, d = "";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) d += "M" + (c + quiet) + " " + (r + quiet) + "h1v1h-1z";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + " " + size + '" shape-rendering="crispEdges" role="img" aria-label="Check-in QR code for today">' +
      '<rect width="100%" height="100%" fill="#ffffff"/><path d="' + d + '" fill="#0b0b0b"/></svg>';
  }

  function renderQr() {
    var t = C.today(), code = C.dayCode(t), url = C.memberUrl(code);
    var pretty = new Date(t + "T12:00:00").toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    var svg = qrSvg(url);
    $("qrBox").innerHTML = svg;
    $("qrBoxBig").innerHTML = svg;
    $("qrCode").textContent = code; $("qrCodeBig").textContent = code;
    $("qrDate").textContent = pretty; $("qrDateBig").textContent = pretty;
    $("qrBox").setAttribute("data-url", url);
  }

  $("qrFullBtn").addEventListener("click", function () { $("qrFull").hidden = false; $("qrFullClose").focus(); });
  $("qrFullClose").addEventListener("click", function () { $("qrFull").hidden = true; $("qrFullBtn").focus(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("qrFull").hidden) $("qrFullClose").click(); });
  function printQr() { $("qrFull").hidden = false; setTimeout(function () { window.print(); }, 50); }
  $("qrPrintBtn").addEventListener("click", printQr);
  $("qrFullPrint").addEventListener("click", function () { window.print(); });

  /* ---------- panels ---------- */
  function renderStats() {
    var S = C.state, t = C.today();
    var todayCount = S.checkins.filter(function (c) { return c.date === t; }).length;
    var ready = S.members.filter(function (m) { return C.statusFor(m.id) === "eligible"; }).length;
    var box = $("stats");
    box.innerHTML = "";
    [[S.members.length, "members"], [todayCount, "checked in today"], [ready, "shirts ready"]].forEach(function (s) {
      box.appendChild(el("div", { class: "stat" }, [el("b", { text: String(s[0]) }), el("span", { text: s[1] })]));
    });
  }

  function renderToday() {
    var S = C.state, t = C.today();
    var list = $("todayList");
    list.innerHTML = "";
    var todays = S.checkins.filter(function (c) { return c.date === t; });
    if (!todays.length) list.appendChild(el("li", { class: "none", text: "No check-ins yet today." }));
    else todays.slice().reverse().forEach(function (c) {
      var m = C.memberById(c.id);
      list.appendChild(el("li", null, [el("span", { text: m ? m.name : c.id }), el("small", { text: c.time })]));
    });

    var bars = $("weekBars");
    bars.innerHTML = "";
    var counts = [], max = 1;
    for (var i = 6; i >= 0; i--) {
      var d = C.daysAgo(i);
      var n = S.checkins.filter(function (c) { return c.date === d; }).length;
      counts.push({ n: n, isToday: i === 0, label: new Date(d + "T12:00:00").toLocaleDateString("en-PH", { weekday: "short" }) });
      if (n > max) max = n;
    }
    counts.forEach(function (c) {
      var bar = el("div");
      bar.style.height = Math.round(c.n / max * 78) + "%";
      bars.appendChild(el("div", { class: "bar" + (c.isToday ? " today" : "") }, [el("span", { text: String(c.n) }), bar, el("span", { text: c.label })]));
    });
  }

  function renderBoard() {
    var S = C.state;
    var rows = S.members.map(function (m) { return { m: m, n: C.points(m.id), s: C.statusFor(m.id) }; });
    rows.sort(function (a, b) { return b.n - a.n || a.m.name.localeCompare(b.m.name); });
    var board = $("board");
    board.innerHTML = "";
    rows.slice(0, 8).forEach(function (r, i) {
      var shown = Math.min(r.n, GOAL);
      var pill = r.s === "eligible" ? el("span", { class: "pill eligible", text: "Shirt ready" })
        : r.s === "claimed" ? el("span", { class: "pill claimed", text: "Claimed" })
        : el("span", { class: "pill", text: (GOAL - r.n) + " to go" });
      var fill = el("div", { class: "fill" });
      fill.style.width = (shown / GOAL * 100) + "%";
      board.appendChild(el("li", null, [
        el("span", { class: "rank", text: String(i + 1) }),
        el("div", { class: "who" }, [
          el("div", { class: "who-top" }, [el("span", { text: r.m.name }), el("span", { text: shown + "/" + GOAL })]),
          el("div", { class: "track" }, [fill])
        ]),
        pill
      ]));
    });
  }

  function renderRequests() {
    var S = C.state, list = $("reqList");
    list.innerHTML = "";
    $("reqCount").textContent = String(S.requests.length);
    if (!S.requests.length) { list.appendChild(el("li", { class: "none", text: "No pending requests." })); return; }
    S.requests.forEach(function (r) {
      var approve = el("button", { class: "row-btn primary", type: "button", text: "Approve", onclick: function () {
        var res = C.addMember(r.name);
        if (!res.ok) { $("addResult").innerHTML = ""; $("addResult").appendChild(el("p", { class: "form-msg error", text: res.error })); return; }
        S.requests = S.requests.filter(function (x) { return x.rid !== r.rid; });
        C.save();
        showCredentials(res.member);
        renderAll();
      } });
      var dismiss = el("button", { class: "row-btn", type: "button", text: "Dismiss", onclick: function () {
        S.requests = S.requests.filter(function (x) { return x.rid !== r.rid; });
        C.save(); renderAll();
      } });
      list.appendChild(el("li", null, [
        el("div", null, [el("strong", { text: r.name }), el("br"), el("small", { text: r.phone + " · " + r.at })]),
        el("div", { class: "req-actions" }, [approve, dismiss])
      ]));
    });
  }

  function showCredentials(m, note) {
    var box = $("addResult");
    box.innerHTML = "";
    box.appendChild(el("div", { class: "cred-box" }, [
      el("b", { text: note || (m.name + " is now a member") }),
      el("span", { text: "Member ID: " }), el("code", { text: m.id }),
      el("span", { text: "  PIN: " }), el("code", { text: m.pin }),
      el("small", { text: "Give these to the member. They can log in at the member page." })
    ]));
  }

  function renderMembers() {
    var S = C.state, tbody = $("memberRows");
    tbody.innerHTML = "";
    S.members.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (m) {
      var n = C.points(m.id), bonus = n - C.uniqueDays(m.id), s = C.statusFor(m.id);
      var shirt = s === "claimed" ? "Claimed" : s === "eligible" ? "Ready to give" : "Not yet";

      var claimBtn = el("button", { class: "row-btn" + (s === "eligible" ? " primary" : ""), type: "button" });
      if (s === "claimed") {
        claimBtn.textContent = "Undo claim";
        claimBtn.addEventListener("click", function () { delete S.claimed[m.id]; C.save(); renderAll(); });
      } else {
        claimBtn.textContent = "Mark claimed";
        claimBtn.disabled = s !== "eligible";
        claimBtn.addEventListener("click", function () { S.claimed[m.id] = true; C.save(); renderAll(); });
      }

      var inBtn = el("button", { class: "row-btn", type: "button", text: "Check in", title: "Check in for this member (e.g. phone died)" });
      inBtn.disabled = !!C.checkinToday(m.id);
      inBtn.addEventListener("click", function () {
        C.checkIn(m.id);
        $("tableMsg").textContent = m.name + " checked in by staff.";
        renderAll();
      });

      var bonusPlus = el("button", { class: "menu-btn", type: "button", text: "+1 bonus point (won a game)" });
      bonusPlus.addEventListener("click", function () {
        C.addBonus(m.id, 1);
        $("tableMsg").textContent = "Gave " + m.name + " a bonus point.";
        renderAll();
      });
      var bonusMinus = el("button", { class: "menu-btn", type: "button", text: "-1 bonus point" });
      bonusMinus.disabled = bonus <= 0;
      bonusMinus.addEventListener("click", function () {
        C.addBonus(m.id, -1);
        $("tableMsg").textContent = "Removed a bonus point from " + m.name + ".";
        renderAll();
      });
      var undoBtn = el("button", { class: "menu-btn", type: "button", text: "Undo today's check-in" });
      undoBtn.disabled = !C.checkinToday(m.id);
      undoBtn.addEventListener("click", function () {
        var t = C.today();
        S.checkins = S.checkins.filter(function (c) { return !(c.id === m.id && c.date === t); });
        C.save(); $("tableMsg").textContent = "Removed today's check-in for " + m.name + "."; renderAll();
      });
      var pinBtn = el("button", { class: "menu-btn", type: "button", text: "Reset PIN" });
      pinBtn.addEventListener("click", function () {
        var p = C.resetPin(m.id);
        $("tableMsg").textContent = m.name + "'s new PIN is " + p + ". Tell them in person.";
        renderAll();
      });
      var more = el("details", { class: "more" }, [
        el("summary", { text: "More" }),
        el("div", { class: "menu" }, [bonusPlus, bonusMinus, undoBtn, pinBtn])
      ]);

      tbody.appendChild(el("tr", null, [
        el("td", { text: m.name }), el("td", { text: m.id }),
        el("td", { text: Math.min(n, GOAL) + " / " + GOAL + (bonus > 0 ? "  (+" + bonus + " bonus)" : "") }),
        el("td", { text: shirt }),
        el("td", { class: "actions" }, [claimBtn, inBtn, more])
      ]));
    });
  }

  function renderPickleball() {
    var S = C.state, op = C.openPlayDate(), taken = C.openTaken(op);
    $("pbSummary").textContent = "Open play · " + C.prettyDate(op) + " · 6–10 PM · " + taken + " / " + C.OPEN_CAP + " slots taken";
    var list = $("pbList");
    list.innerHTML = "";
    var rows = S.reservations.filter(function (r) { return r.date >= C.today(); }).sort(function (a, b) {
      var pa = a.status === "pending" ? 0 : 1, pb = b.status === "pending" ? 0 : 1;
      return pa - pb || a.date.localeCompare(b.date) || a.name.localeCompare(b.name);
    });
    if (!rows.length) { list.appendChild(el("li", { class: "none", text: "No upcoming reservations." })); return; }
    rows.forEach(function (r) {
      var what = r.type === "open" ? "Open play" : "Court rental · " + r.time + " · " + r.hours + " hr" + (r.hours === 1 ? "" : "s");
      var chip = el("span", { class: "pill" + (r.status === "pending" ? " eligible" : r.status === "declined" ? "" : " claimed"), text: r.status });
      var actions = [];
      if (r.status === "pending") {
        actions.push(el("button", { class: "row-btn primary", type: "button", text: "Confirm", onclick: function () { C.setReservationStatus(r.rid, "confirmed"); renderAll(); } }));
        actions.push(el("button", { class: "row-btn", type: "button", text: "Decline", onclick: function () { C.setReservationStatus(r.rid, "declined"); renderAll(); } }));
      } else {
        actions.push(el("button", { class: "row-btn", type: "button", text: "Remove", onclick: function () { C.removeReservation(r.rid); renderAll(); } }));
      }
      list.appendChild(el("li", null, [
        el("div", null, [el("strong", { text: r.name }), el("br"), el("small", { text: r.phone + " · " + what + " · " + C.prettyDate(r.date) })]),
        el("div", { class: "req-actions" }, [chip].concat(actions))
      ]));
    });
  }

  function renderAll() { renderQr(); renderStats(); renderToday(); renderPickleball(); renderBoard(); renderRequests(); renderMembers(); }

  /* ---------- forms ---------- */
  $("addForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var res = C.addMember($("newName").value);
    var box = $("addResult");
    if (!res.ok) { box.innerHTML = ""; box.appendChild(el("p", { class: "form-msg error", text: res.error })); return; }
    $("newName").value = "";
    showCredentials(res.member, res.member.name + " added");
    renderAll();
  });

  $("resetBtn").addEventListener("click", function () {
    C.reset();
    $("addResult").innerHTML = ""; $("tableMsg").textContent = "Demo data reset.";
    renderAll();
  });

  if (isAuthed()) showDesk(); else showGate();
})();
