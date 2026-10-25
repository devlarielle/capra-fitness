/* Capra Fitness demo
   Everything is stored in the visitor's browser (localStorage).
   In the real build this becomes PHP + MySQL; the logic below maps 1:1:
   members table, checkins table (unique member_id + date), rewards flag. */

(function () {
  "use strict";

  var GOAL = 20;
  var KEY = "capra-demo-v1";
  var TZ = "Asia/Manila";

  /* ---------- date helpers ---------- */
  function dateStr(d) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // YYYY-MM-DD
  }
  function timeStr(d) {
    return new Intl.DateTimeFormat("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(d);
  }
  function today() { return dateStr(new Date()); }
  function daysAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return dateStr(d);
  }

  /* ---------- seed data ---------- */
  var SEED = [
    ["Larielle", 20, false],
    ["Andrew", 19, false],
    ["Paolo", 20, true],
    ["Dani", 18, false],
    ["Bea", 15, false],
    ["Mika", 12, false],
    ["Joshua", 7, false],
    ["Carlo", 3, false]
  ];

  function pad(n) { return ("0000" + n).slice(-4); }

  function buildSeed() {
    var members = [], checkins = [], claimed = {};
    SEED.forEach(function (row, i) {
      var id = "CAP-" + pad(i + 1);
      members.push({ id: id, name: row[0] });
      if (row[2]) claimed[id] = true;
      // spread the check-ins over past days, skipping every 7th day (rest day)
      var added = 0, offset = 1;
      while (added < row[1]) {
        if (offset % 7 !== 0) {
          var hour = 6 + ((i * 5 + offset * 3) % 15);
          var min = (i * 13 + offset * 7) % 60;
          checkins.push({ id: id, date: daysAgo(offset), time: hour + ":" + (min < 10 ? "0" : "") + min });
          added++;
        }
        offset++;
      }
    });
    return { members: members, checkins: checkins, claimed: claimed };
  }

  /* ---------- storage ---------- */
  var state;
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { state = JSON.parse(raw); return; }
    } catch (e) { /* storage blocked; fall through */ }
    state = buildSeed();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  /* ---------- queries ---------- */
  function uniqueDays(id) {
    var seen = {};
    state.checkins.forEach(function (c) { if (c.id === id) seen[c.date] = true; });
    return Object.keys(seen).length;
  }
  function checkinToday(id) {
    var t = today();
    for (var i = 0; i < state.checkins.length; i++) {
      var c = state.checkins[i];
      if (c.id === id && c.date === t) return c;
    }
    return null;
  }
  function memberById(id) {
    for (var i = 0; i < state.members.length; i++) if (state.members[i].id === id) return state.members[i];
    return null;
  }
  function norm(s) { return s.toLowerCase().replace(/\s+/g, " ").trim(); }

  /* ---------- tiny DOM helper ---------- */
  function el(tag, props, children) {
    var n = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      if (k === "class") n.className = props[k];
      else if (k === "text") n.textContent = props[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), props[k]);
      else n.setAttribute(k, props[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function $(id) { return document.getElementById(id); }

  function meter(count) {
    var m = el("div", { class: "meter", "aria-hidden": "true" });
    for (var i = 0; i < GOAL; i++) m.appendChild(el("i", { class: i < count ? "on" : "" }));
    return m;
  }

  /* ---------- check-in UI ---------- */
  var input = $("nameInput"), list = $("suggestions"), btn = $("checkinBtn"), result = $("result");
  var selectedId = null, activeIndex = -1, matches = [];

  function closeList() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    activeIndex = -1;
  }

  function choose(m) {
    selectedId = m.id;
    input.value = m.name;
    btn.disabled = false;
    closeList();
  }

  function showSuggestions() {
    var q = norm(input.value);
    selectedId = null;
    btn.disabled = true;
    if (!q) { closeList(); return; }
    matches = state.members.filter(function (m) { return norm(m.name).indexOf(q) !== -1; }).slice(0, 6);
    list.innerHTML = "";
    if (!matches.length) {
      list.appendChild(el("li", { class: "empty", text: "No member found. Ask the front desk to add you." }));
    } else {
      matches.forEach(function (m, i) {
        var li = el("li", { role: "option", id: "opt" + i, "aria-selected": "false" }, [
          el("span", { text: m.name }),
          el("small", { text: m.id })
        ]);
        li.addEventListener("mousedown", function (e) { e.preventDefault(); choose(m); });
        list.appendChild(li);
      });
      // exact single match: select it right away
      if (matches.length === 1 && norm(matches[0].name) === q) { choose(matches[0]); return; }
    }
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    activeIndex = -1;
  }

  function moveActive(delta) {
    if (!matches.length || list.hidden) return;
    activeIndex = (activeIndex + delta + matches.length) % matches.length;
    Array.prototype.forEach.call(list.querySelectorAll("li"), function (li, i) {
      li.setAttribute("aria-selected", i === activeIndex ? "true" : "false");
    });
  }

  input.addEventListener("input", function () { result.innerHTML = ""; showSuggestions(); });
  input.addEventListener("focus", function () { if (input.value) showSuggestions(); });
  input.addEventListener("blur", function () { setTimeout(closeList, 120); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (!list.hidden && activeIndex >= 0 && matches[activeIndex]) choose(matches[activeIndex]);
      else if (!list.hidden && matches.length === 1) choose(matches[0]);
      else if (selectedId) doCheckIn();
    } else if (e.key === "Escape") closeList();
  });
  btn.addEventListener("click", doCheckIn);

  function doCheckIn() {
    if (!selectedId) return;
    var m = memberById(selectedId);
    if (!m) return;
    var existing = checkinToday(m.id);
    var box;

    if (existing) {
      var n = uniqueDays(m.id);
      box = el("div", { class: "result-box warn" }, [
        el("p", { class: "result-title", text: "Already checked in" }),
        el("p", { class: "result-sub", text: m.name + ", you checked in today at " + existing.time + ". Come back tomorrow for the next day." }),
        meter(Math.min(n, GOAL)),
        el("div", { class: "meter-caption" }, [el("span", { text: Math.min(n, GOAL) + " of " + GOAL + " days" })])
      ]);
    } else {
      var before = uniqueDays(m.id);
      state.checkins.push({ id: m.id, date: today(), time: timeStr(new Date()) });
      save();
      var n2 = uniqueDays(m.id);
      var justEarned = before < GOAL && n2 >= GOAL;
      var eligible = n2 >= GOAL && !state.claimed[m.id];
      var title = justEarned ? "Free shirt unlocked!" : "You're in, " + m.name;
      var sub = justEarned
        ? m.name + ", that's day " + n2 + ". Show this screen at the front desk to get your shirt."
        : eligible
          ? "Day " + n2 + ". Your free shirt is still waiting at the front desk."
          : "Day " + n2 + " counted. " + (n2 >= GOAL ? "Shirt already claimed. Keep going!" : (GOAL - n2) + " more to the free shirt.");
      box = el("div", { class: "result-box success" }, [
        el("p", { class: "result-title", text: title }),
        el("p", { class: "result-sub", text: sub }),
        meter(Math.min(n2, GOAL)),
        el("div", { class: "meter-caption" }, [
          el("span", { text: Math.min(n2, GOAL) + " of " + GOAL + " days" }),
          el("span", { text: "Checked in " + timeStr(new Date()) })
        ])
      ]);
      renderAll();
    }
    result.innerHTML = "";
    result.appendChild(box);
    input.value = "";
    selectedId = null;
    btn.disabled = true;
  }

  /* ---------- progress board ---------- */
  function statusFor(id) {
    var n = uniqueDays(id);
    if (n >= GOAL) return state.claimed[id] ? "claimed" : "eligible";
    return "progress";
  }

  function renderBoard() {
    var rows = state.members.map(function (m) { return { m: m, n: uniqueDays(m.id), s: statusFor(m.id) }; });
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

    var todayCount = state.checkins.filter(function (c) { return c.date === today(); }).length;
    var ready = rows.filter(function (r) { return r.s === "eligible"; }).length;
    var stats = $("stats");
    stats.innerHTML = "";
    [[state.members.length, "members"], [todayCount, "checked in today"], [ready, "shirts ready"]].forEach(function (s) {
      stats.appendChild(el("div", { class: "stat" }, [el("b", { text: String(s[0]) }), el("span", { text: s[1] })]));
    });
  }

  /* ---------- staff view ---------- */
  function renderStaff() {
    var t = today();

    var todays = state.checkins.filter(function (c) { return c.date === t; });
    var tl = $("todayList");
    tl.innerHTML = "";
    if (!todays.length) {
      tl.appendChild(el("li", { class: "none", text: "No check-ins yet today." }));
    } else {
      todays.slice().reverse().forEach(function (c) {
        var m = memberById(c.id);
        tl.appendChild(el("li", null, [el("span", { text: m ? m.name : c.id }), el("small", { text: c.time })]));
      });
    }

    var bars = $("weekBars");
    bars.innerHTML = "";
    var counts = [], max = 1;
    for (var i = 6; i >= 0; i--) {
      var d = daysAgo(i);
      var n = state.checkins.filter(function (c) { return c.date === d; }).length;
      counts.push({ d: d, n: n, isToday: i === 0, label: new Date(d + "T12:00:00").toLocaleDateString("en-PH", { weekday: "short" }) });
      if (n > max) max = n;
    }
    counts.forEach(function (c) {
      var bar = el("div");
      bar.style.height = Math.round(c.n / max * 78) + "%";
      bars.appendChild(el("div", { class: "bar" + (c.isToday ? " today" : "") }, [
        el("span", { text: String(c.n) }), bar, el("span", { text: c.label })
      ]));
    });

    var tbody = $("memberRows");
    tbody.innerHTML = "";
    state.members.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (m) {
      var n = uniqueDays(m.id);
      var s = statusFor(m.id);
      var shirt = s === "claimed" ? "Claimed" : s === "eligible" ? "Ready to give" : "Not yet";

      var claimBtn = el("button", { class: "row-btn" + (s === "eligible" ? " primary" : ""), type: "button" });
      if (s === "claimed") {
        claimBtn.textContent = "Undo claim";
        claimBtn.addEventListener("click", function () { delete state.claimed[m.id]; save(); renderAll(); });
      } else {
        claimBtn.textContent = "Mark claimed";
        claimBtn.disabled = s !== "eligible";
        claimBtn.addEventListener("click", function () { state.claimed[m.id] = true; save(); renderAll(); });
      }

      var undoBtn = el("button", { class: "row-btn", type: "button", text: "Undo today" });
      undoBtn.disabled = !checkinToday(m.id);
      undoBtn.addEventListener("click", function () {
        var tt = today();
        state.checkins = state.checkins.filter(function (c) { return !(c.id === m.id && c.date === tt); });
        save(); renderAll();
      });

      tbody.appendChild(el("tr", null, [
        el("td", { text: m.name }),
        el("td", { text: m.id }),
        el("td", { text: Math.min(n, GOAL) + " / " + GOAL }),
        el("td", { text: shirt }),
        el("td", null, [claimBtn, undoBtn])
      ]));
    });
  }

  /* add member */
  $("addForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var field = $("newName"), msg = $("addMsg");
    var name = field.value.replace(/\s+/g, " ").trim();
    if (!name) return;
    var dupe = state.members.some(function (m) { return norm(m.name) === norm(name); });
    if (dupe) { msg.textContent = name + " is already a member."; return; }
    var next = state.members.reduce(function (mx, m) { return Math.max(mx, parseInt(m.id.slice(4), 10)); }, 0) + 1;
    var id = "CAP-" + pad(next);
    state.members.push({ id: id, name: name });
    save();
    field.value = "";
    msg.textContent = name + " added as " + id + ".";
    renderAll();
  });

  $("resetBtn").addEventListener("click", function () {
    state = buildSeed();
    save();
    result.innerHTML = "";
    $("addMsg").textContent = "Demo data reset.";
    renderAll();
  });

  /* ---------- boot ---------- */
  function renderAll() { renderBoard(); renderStaff(); }

  load();
  $("todayLabel").textContent = new Date().toLocaleDateString("en-PH", { timeZone: TZ, weekday: "long", month: "long", day: "numeric", year: "numeric" });
  renderAll();
})();
