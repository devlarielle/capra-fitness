/* Public page: sample Project 20 card, pickleball reservations, join form. */
(function () {
  "use strict";
  var C = window.Capra, $ = C.$;
  C.load();

  /* ---------- sample Project 20 card ---------- */
  $("p20Preview").appendChild(C.p20Card(12));

  /* ---------- pickleball ---------- */
  var op = C.openPlayDate();
  var form = $("pbForm"), msg = $("pbMsg");

  function renderSlots() {
    var taken = C.openTaken(op), left = Math.max(0, C.OPEN_CAP - taken);
    $("pbSlotsText").textContent = "Next session: " + C.prettyDate(op) + " · " + (left ? left + " of " + C.OPEN_CAP + " slots left" : "fully booked");
    $("pbSlotsFill").style.width = Math.min(100, taken / C.OPEN_CAP * 100) + "%";
    $("pbOpenNote").textContent = "Open play on " + C.prettyDate(op) + ", 6:00 PM – 10:00 PM. ₱100 per head, paddle rental +₱30. " + (left ? left + " slot" + (left === 1 ? "" : "s") + " left." : "This session is full.");
  }

  (function buildTimes() {
    var sel = $("pbTime");
    for (var h = 6; h <= 21; h++) sel.appendChild(new Option(C.hourLabel(h), C.hourLabel(h), false, h === 19));
    var d = $("pbDate");
    d.min = C.today(); d.value = C.daysAhead(1);
  })();

  function type() { return form.querySelector("input[name=pbType]:checked").value; }
  function syncType() {
    var court = type() === "court";
    $("pbCourtFields").hidden = !court;
    $("pbOpenNote").hidden = court;
    $("pbSubmit").textContent = court ? "Request court" : "Reserve my slot";
  }
  Array.prototype.forEach.call(form.querySelectorAll("input[name=pbType]"), function (r) { r.addEventListener("change", syncType); });

  function fail(t) { msg.classList.add("error"); msg.textContent = t; }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    msg.classList.remove("error");
    var name = $("pbName").value.replace(/\s+/g, " ").trim();
    var phone = $("pbPhone").value;
    if (name.length < 2) return fail("Please enter your full name.");
    if (phone.replace(/\D/g, "").length < 10) return fail("Please enter a valid mobile number.");

    var t = type(), res;
    if (t === "open") {
      res = C.addReservation({ name: name, phone: phone, type: "open", date: op });
      if (!res.ok) return fail(res.error);
      msg.textContent = "You're in, " + name.split(" ")[0] + "! Slot " + res.slot + " of " + C.OPEN_CAP + " reserved for " + C.prettyDate(op) + ", 6–10 PM. ₱100 per head (paddle rental +₱30).";
    } else {
      var date = $("pbDate").value;
      if (!date || date < C.today()) return fail("Please pick a date from today onward.");
      var hrs = parseInt($("pbHours").value, 10), time = $("pbTime").value;
      res = C.addReservation({ name: name, phone: phone, type: "court", date: date, time: time, hours: hrs });
      if (!res.ok) return fail(res.error);
      msg.textContent = "Request sent, " + name.split(" ")[0] + ". The front desk will confirm " + C.prettyDate(date) + " at " + time + " (" + hrs + " hr" + (hrs === 1 ? "" : "s") + ").";
    }
    $("pbName").value = ""; $("pbPhone").value = "";
    renderSlots();
  });

  syncType();
  renderSlots();

  /* ---------- join form ---------- */
  var jForm = $("joinForm"), jMsg = $("joinMsg");
  jForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("jName").value.replace(/\s+/g, " ").trim();
    var phone = $("jPhone").value.replace(/[^\d+]/g, "");
    jMsg.classList.remove("error");
    if (name.length < 2) { jMsg.classList.add("error"); jMsg.textContent = "Please enter your full name."; return; }
    if (phone.replace(/\D/g, "").length < 10) { jMsg.classList.add("error"); jMsg.textContent = "Please enter a valid mobile number."; return; }
    C.addRequest(name, phone);
    jForm.reset();
    jMsg.textContent = "Thanks, " + name.split(" ")[0] + "! The front desk will contact you soon.";
  });
})();
