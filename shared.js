/* Capra Fitness demo: shared data layer
   Everything is stored in the visitor's browser (localStorage).
   In the real build this becomes PHP + MySQL:
     members(id, name, pin_hash), checkins(member_id, date) with UNIQUE(member_id, date),
     bonus_points(member_id, points, reason), rewards(member_id, claimed_at),
     join_requests(...), reservations(...), and a daily QR code generated on the server. */

(function () {
  "use strict";

  var GOAL = 20;          // CF Project "Project 20": 20 points = free T-shirt
  var OPEN_CAP = 12;      // pickleball open play slots
  var KEY = "capra-demo-v3";
  var TZ = "Asia/Manila";
  var SALT = "capra-demo-salt";
  var state = null;

  /* ---------- dates ---------- */
  function dateStr(d) { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); } // YYYY-MM-DD
  function timeStr(d) { return new Intl.DateTimeFormat("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(d); }
  function today() { return dateStr(new Date()); }
  function daysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return dateStr(d); }
  function daysAhead(n) { return daysAgo(-n); }
  function fmt12(h, m) { return (h % 12 || 12) + ":" + (m < 10 ? "0" : "") + m + (h < 12 ? " AM" : " PM"); }
  function pad(n) { return ("0000" + n).slice(-4); }
  function prettyDate(ds) { return new Date(ds + "T12:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" }); }
  function hourLabel(h) { return fmt12(h, 0); }

  /* Next pickleball open-play Monday (today counts until 10 PM). */
  function openPlayDate() {
    var now = new Date();
    var hour = parseInt(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now), 10);
    for (var i = 0; i < 14; i++) {
      var ds = dateStr(new Date(now.getTime() + i * 86400000));
      var isMonday = new Date(ds + "T12:00:00Z").getUTCDay() === 1;
      if (isMonday && !(i === 0 && hour >= 22)) return ds;
    }
    return today();
  }

  /* ---------- seed ---------- */
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
  var OPEN_SEED = [["Rico", "0917 555 0101"], ["Jessa", "0917 555 0102"], ["Mark", "0917 555 0103"], ["Tin", "0917 555 0104"], ["Gab", "0917 555 0105"], ["Nico", "0917 555 0106"]];

  function buildSeed() {
    var members = [], checkins = [], claimed = {};
    SEED.forEach(function (row, i) {
      var id = "CAP-" + pad(i + 1);
      members.push({ id: id, name: row[0], pin: "1234" });
      if (row[2]) claimed[id] = true;
      var added = 0, offset = 1;
      while (added < row[1]) {
        if (offset % 7 !== 0) { // skip every 7th day as a rest day
          checkins.push({ id: id, date: daysAgo(offset), time: fmt12(6 + ((i * 5 + offset * 3) % 15), (i * 13 + offset * 7) % 60) });
          added++;
        }
        offset++;
      }
    });
    var op = openPlayDate();
    var reservations = OPEN_SEED.map(function (r, i) {
      return { rid: "B" + (i + 1), name: r[0], phone: r[1], type: "open", date: op, time: "", hours: 0, status: "confirmed", at: daysAgo(i % 3) };
    });
    reservations.push({ rid: "B9", name: "Team Alpha", phone: "0918 555 0199", type: "court", date: daysAhead(2), time: hourLabel(19), hours: 2, status: "pending", at: today() });
    return { members: members, checkins: checkins, claimed: claimed, bonus: {}, requests: [], reservations: reservations };
  }

  /* ---------- storage ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && Array.isArray(s.members) && Array.isArray(s.checkins)) {
          s.claimed = s.claimed || {};
          s.bonus = s.bonus || {};
          s.requests = s.requests || [];
          s.reservations = s.reservations || [];
          state = s;
          return state;
        }
      }
    } catch (e) { /* storage blocked or corrupt: use fresh seed */ }
    state = buildSeed();
    return state;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }
  function reset() { state = buildSeed(); save(); return state; }

  /* ---------- queries ---------- */
  function norm(s) { return String(s).toLowerCase().replace(/\s+/g, " ").trim(); }
  function memberById(id) {
    for (var i = 0; i < state.members.length; i++) if (state.members[i].id === id) return state.members[i];
    return null;
  }
  function uniqueDays(id) {
    var seen = {};
    state.checkins.forEach(function (c) { if (c.id === id) seen[c.date] = true; });
    return Object.keys(seen).length;
  }
  /* Project 20 points = one per gym session (day) + bonus points staff award (e.g. for winning games). */
  function points(id) { return uniqueDays(id) + (state.bonus[id] || 0); }
  function checkinOn(id, date) {
    for (var i = 0; i < state.checkins.length; i++) {
      var c = state.checkins[i];
      if (c.id === id && c.date === date) return c;
    }
    return null;
  }
  function checkinToday(id) { return checkinOn(id, today()); }
  function statusFor(id) {
    if (points(id) >= GOAL) return state.claimed[id] ? "claimed" : "eligible";
    return "progress";
  }

  /* ---------- actions ---------- */
  function checkIn(id) {
    var m = memberById(id);
    if (!m) return { ok: false, error: "Member not found." };
    var ex = checkinToday(id);
    if (ex) return { ok: true, already: true, time: ex.time, n: points(id) };
    var before = points(id), now = new Date(), t = timeStr(now);
    state.checkins.push({ id: id, date: today(), time: t });
    save();
    var n = points(id);
    return { ok: true, already: false, time: t, n: n, justEarned: before < GOAL && n >= GOAL };
  }

  function addBonus(id, delta) {
    if (!memberById(id)) return null;
    state.bonus[id] = Math.max(0, (state.bonus[id] || 0) + delta);
    if (!state.bonus[id]) delete state.bonus[id];
    save();
    return state.bonus[id] || 0;
  }

  function newPin() { return String(Math.floor(1000 + Math.random() * 9000)); }

  function addMember(name) {
    name = String(name).replace(/\s+/g, " ").trim();
    if (!name) return { ok: false, error: "Enter a name." };
    var dupe = state.members.some(function (m) { return norm(m.name) === norm(name); });
    if (dupe) return { ok: false, error: name + " is already a member." };
    var next = state.members.reduce(function (mx, m) { return Math.max(mx, parseInt(m.id.slice(4), 10)); }, 0) + 1;
    var m = { id: "CAP-" + pad(next), name: name, pin: newPin() };
    state.members.push(m);
    save();
    return { ok: true, member: m };
  }

  function resetPin(id) {
    var m = memberById(id);
    if (!m) return null;
    m.pin = newPin();
    save();
    return m.pin;
  }

  function addRequest(name, phone, note) {
    state.requests.push({ rid: "R" + Date.now(), name: name, phone: phone, note: note || "", at: dateStr(new Date()) });
    save();
  }

  /* ---------- pickleball ---------- */
  function openTaken(date) {
    return state.reservations.filter(function (r) { return r.type === "open" && r.date === date && r.status !== "declined"; }).length;
  }
  function addReservation(o) {
    var name = String(o.name).replace(/\s+/g, " ").trim(), phone = String(o.phone).replace(/[^\d+]/g, "");
    if (o.type === "open") {
      if (openTaken(o.date) >= OPEN_CAP) return { ok: false, error: "Open play is fully booked for that session." };
      var dupe = state.reservations.some(function (r) { return r.type === "open" && r.date === o.date && r.phone === phone && r.status !== "declined"; });
      if (dupe) return { ok: false, error: "That number already has a slot for this session." };
    }
    var r = {
      rid: "B" + Date.now() + Math.floor(Math.random() * 1000), name: name, phone: phone, type: o.type, date: o.date,
      time: o.time || "", hours: o.hours || 0, status: o.type === "open" ? "confirmed" : "pending", at: today()
    };
    state.reservations.push(r);
    save();
    return { ok: true, reservation: r, slot: o.type === "open" ? openTaken(o.date) : 0 };
  }
  function setReservationStatus(rid, status) {
    state.reservations.forEach(function (r) { if (r.rid === rid) r.status = status; });
    save();
  }
  function removeReservation(rid) {
    state.reservations = state.reservations.filter(function (r) { return r.rid !== rid; });
    save();
  }

  /* ---------- auth helpers ---------- */
  function normalizeId(input) {
    var s = String(input).toUpperCase().replace(/\s+/g, "");
    if (/^\d+$/.test(s)) s = "CAP-" + pad(parseInt(s, 10));
    else if (/^CAP\d+$/.test(s)) s = "CAP-" + s.slice(3);
    return s;
  }
  function authenticate(idInput, pin) {
    var m = memberById(normalizeId(idInput));
    return m && m.pin === String(pin).trim() ? m : null;
  }

  /* Daily QR code: derived from the date so the demo needs no server.
     In the real build the server generates and rotates it, so it cannot be worked out from the page. */
  var ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function dayCode(date) {
    var seed = hash(SALT + date), out = "";
    for (var i = 0; i < 6; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      out += ALPHA.charAt((seed >>> 16) % ALPHA.length);
    }
    return out;
  }
  function memberUrl(code) {
    var base = /^https?:$/.test(location.protocol)
      ? location.origin + "/member"
      : new URL("member.html", location.href).href; // when opened straight from a folder
    return base + (code ? "?code=" + encodeURIComponent(code) : "");
  }

  /* ---------- DOM helpers ---------- */
  function $(id) { return document.getElementById(id); }
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
  function meter(count) {
    var m = el("div", { class: "meter", "aria-hidden": "true" });
    for (var i = 0; i < GOAL; i++) m.appendChild(el("i", { class: i < count ? "on" : "" }));
    return m;
  }
  /* Digital version of the paper "Project 20" card: 20 boxes in rows of 7, 7 and 6. */
  function p20Card(pts) {
    var shown = Math.min(pts, GOAL);
    var card = el("div", { class: "p20", role: "img", "aria-label": "Project 20 card: " + shown + " of " + GOAL + " points" });
    card.appendChild(el("div", { class: "p20-head" }, [
      el("img", { src: "assets/logo-cream.png", alt: "", width: "46", height: "43" }),
      el("div", null, [
        el("b", { text: "Project 20" }),
        el("span", { text: "20 points = a free T-shirt from CF Gear" }),
        el("span", { text: "1 gym session = 1 point" })
      ])
    ]));
    var grid = el("div", { class: "p20-grid", "aria-hidden": "true" });
    for (var i = 0; i < GOAL; i++) grid.appendChild(el("i", { class: i < shown ? "on" : "" }));
    card.appendChild(grid);
    return card;
  }

  window.Capra = {
    GOAL: GOAL, OPEN_CAP: OPEN_CAP, load: load, save: save, reset: reset,
    get state() { return state; },
    today: today, daysAgo: daysAgo, daysAhead: daysAhead, dateStr: dateStr, timeStr: timeStr, norm: norm,
    prettyDate: prettyDate, hourLabel: hourLabel, openPlayDate: openPlayDate,
    memberById: memberById, uniqueDays: uniqueDays, points: points, checkinOn: checkinOn, checkinToday: checkinToday, statusFor: statusFor,
    checkIn: checkIn, addBonus: addBonus, addMember: addMember, resetPin: resetPin, addRequest: addRequest,
    openTaken: openTaken, addReservation: addReservation, setReservationStatus: setReservationStatus, removeReservation: removeReservation,
    authenticate: authenticate, normalizeId: normalizeId, dayCode: dayCode, memberUrl: memberUrl,
    $: $, el: el, meter: meter, p20Card: p20Card
  };
})();
