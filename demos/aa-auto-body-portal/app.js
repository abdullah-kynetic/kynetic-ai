(function () {
  var D = window.DEMO;
  var $ = function (s) { return document.querySelector(s); };
  var money = function (n) { return "$" + n.toLocaleString("en-US"); };
  var I = {
    today: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    leads: '<path d="M4 5h16v11H8l-4 4z"/>',
    quotes: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7"/>',
    jobs: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    customers: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-4 3-6 6.500-6s6.500 2 6.500 6"/><path d="M16 5a3.500 3.500 0 0 1 0 6M18 14c2.500.7 3.500 2.700 3.500 6"/>',
    reviews: '<path d="M12 3l2.700 5.500 6 .9-4.400 4.200 1 6-5.300-2.800-5.300 2.800 1-6L3.300 9.400l6-.9z"/>',
    report: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
    found: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>',
    more: '<circle cx="5" cy="12" r="1.600"/><circle cx="12" cy="12" r="1.600"/><circle cx="19" cy="12" r="1.600"/>'
  };
  var icon = function (n) { return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + I[n] + '</svg>'; };
  var NAV = [
    ["today", "Today"], ["leads", "Leads"], ["quotes", "Quotes"], ["jobs", "Jobs board"], ["calendar", "Calendar"],
    ["customers", "Customers"], ["reviews", "Reviews"], ["report", "Weekly report"], ["found", "Get found"]
  ];
  var TABS = ["today", "leads", "jobs", "calendar"];
  var state = { leadId: 1, sheet: false };
  var jobs = D.jobs.map(function (j) { return Object.assign({}, j); });
  var reviews = D.reviews.map(function (r) { return Object.assign({}, r); });
  var toastT;

  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("show"); }, 3600);
  }
  function photo(label) {
    return '<div class="ph"><svg viewBox="0 0 120 90" preserveAspectRatio="xMidYMid slice"><rect width="120" height="90" fill="#e3e0da"/><path d="M14 62l8-18c2-4 5-6 9-6h38c4 0 7 2 9 5l10 12c5 1 8 4 8 9v4H14z" fill="#cfcac2"/><circle cx="34" cy="68" r="8" fill="#b9b3a9"/><circle cx="88" cy="68" r="8" fill="#b9b3a9"/></svg><span style="position:relative;background:#fffc;padding:2px 8px;border-radius:999px;margin-top:62px">' + label + '</span></div>';
  }
  function srcPill(s) { return '<span class="pill ' + (s === "ai" ? "or" : s === "photo" ? "bl" : "") + '">' + D.sources[s] + '</span>'; }
  function statusPill(s) { return '<span class="pill ' + (s === "New" ? "or" : s === "Booked" ? "ok" : s === "Quote sent" ? "bl" : "") + '">' + s + '</span>'; }
  function typePill(t) { return '<span class="pill ' + (t === "Insurance" ? "bl" : "") + '">' + t + '</span>'; }

  var inShop = function () { return jobs.filter(function (j) { return j.col !== "picked"; }).length; };
  var waitingQuotes = function () { return D.quotes.filter(function (q) { return q.state === "Waiting"; }).length; };

  function today() {
    return '<div class="grid g3">' +
      kpi("Cars in shop", inShop(), "Across 7 stages", "jobs") +
      kpi("Drop-offs today", 1, "Next: 9:00 AM, Jake", "calendar") +
      kpi("New leads", 2, "5 more in progress", "leads") +
      kpi("Quotes waiting", waitingQuotes(), "Follow-ups going out on their own", "quotes") +
      kpi("Money in this week", "$24,300", "Synced with QuickBooks (demo)", "report") +
      kpi("Missed calls answered", 7, "By the AI receptionist and auto text this week", "leads") +
      '</div><div class="grid g2" style="margin-top:16px"><div class="card"><h2>Needs you</h2>' +
      D.needsYou.map(function (n) { return '<div class="need"><span class="pill or">' + n.tag + '</span><span class="t">' + n.t + '</span><button class="btn sm" data-go="' + n.go + '">Open</button></div>'; }).join("") +
      '</div><div class="card"><h2>Running without you today</h2>' +
      ["Maya (AI) answered 2 calls after hours last night", "9 customers asked where their car is. Answered by text", "3 reminder texts went out for tomorrow's drop-offs", "Follow-ups sent on 4 open quotes", "2 review requests queued for today's pickups"].map(function (t) { return '<div class="need"><span style="color:var(--ok);font-weight:800">✓</span><span class="t" style="font-weight:500">' + t + '</span></div>'; }).join("") +
      '</div></div>';
  }
  function kpi(l, n, s, go) { return '<div class="card kpi tap" data-go="' + go + '" role="button" tabindex="0"><div class="n">' + n + '</div><div class="l">' + l + '</div><div class="s">' + s + '</div></div>'; }

  function leads() {
    var cur = D.leads.filter(function (l) { return l.id === state.leadId; })[0];
    var list = D.leads.map(function (l) {
      return '<button class="row ' + (l.id === state.leadId ? "on" : "") + '" data-lead="' + l.id + '"><div class="a"><b>' + l.name + '</b>' + statusPill(l.status) + '</div><div class="b">' + l.car + ' · ' + l.when + '</div><div style="margin-top:8px">' + srcPill(l.src) + '</div></button>';
    }).join("");
    var ph = ""; for (var i = 1; i <= cur.photos; i++) ph += photo("photo " + i);
    var est = "";
    if (cur.est) {
      var tot = cur.est.reduce(function (a, r) { return a + r[1]; }, 0);
      est = '<h2 style="margin-top:20px">Draft estimate from the photos</h2><p class="hint">Written by the AI for Robert or Edwin to review. Nothing goes out until you approve.</p><table>' +
        cur.est.map(function (r) { return '<tr><td>' + r[0] + '</td><td style="text-align:right">' + money(r[1]) + '</td></tr>'; }).join("") +
        '<tr><td><b>Total (' + cur.estType + ')</b></td><td style="text-align:right"><b>' + money(tot) + '</b></td></tr></table>' +
        '<div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn" data-toast="Estimate and deposit link sent to ' + cur.name + ' (demo)">Approve and send with deposit link</button><button class="btn ghost" data-toast="Opened for editing (demo)">Edit</button></div>';
    }
    var chat = cur.lines.map(function (l) { var us = l[0] !== "Customer" && l[0] !== "Caller"; return '<div class="bub ' + (us ? "us" : "them") + '"><small>' + l[0] + '</small>' + l[1] + '</div>'; }).join("");
    return '<p class="hint">Every call, text, photo and walk-in lands here, with a summary, so nothing gets lost in your text messages.</p><div class="split"><div>' + list + '</div><div class="card"><div class="a" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><h2 style="margin:0">' + cur.name + '</h2><div class="hint" style="margin:4px 0 0">' + cur.car + ' · ' + cur.when + '</div></div><div>' + srcPill(cur.src) + ' ' + statusPill(cur.status) + '</div></div>' +
      '<h2 style="margin-top:18px">Summary</h2><p style="margin:0">' + cur.summary + '</p>' +
      '<h2 style="margin-top:18px">Conversation</h2>' + chat +
      '<h2 style="margin-top:18px">Damage photos</h2><div class="photos">' + ph + '</div>' + est +
      '<div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn ghost" data-toast="Text sent to ' + cur.name + ' (demo)">Text customer</button><button class="btn ghost" data-toast="Drop-off booked on the calendar (demo)">Book drop-off</button></div></div></div>';
  }

  function quotes() {
    var won = D.quotes.filter(function (q) { return q.state === "Accepted"; }).length;
    var cards = D.quotes.map(function (q) {
      var tl = D.steps.map(function (s, i) {
        var done = i < q.sent, next = i === q.sent && q.state === "Waiting";
        return '<div class="st ' + (done ? "done " : "") + (next ? "next" : "") + '"><div class="dot"></div><b>' + s[0] + '</b>' + (done ? "Sent" : next ? "Next up" : q.state === "Accepted" ? "Stopped" : "Scheduled") + '</div>';
      }).join("");
      return '<div class="card" style="margin-bottom:12px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:200px"><b style="font-size:17px">' + q.car + '</b><div class="hint" style="margin:2px 0 0">' + q.name + ' · sent ' + q.age + ' ago</div></div><div style="font-size:26px;font-weight:800">' + money(q.amt) + '</div><div>' + typePill(q.type) + ' <span class="pill ' + (q.state === "Accepted" ? "ok" : "warn") + '">' + q.state + '</span></div></div><div class="tl">' + tl + '</div>' +
        (q.reply ? '<div class="reply"><b>' + q.name + ' replied:</b> ' + q.reply[1] + '</div>' : '') + '</div>';
    }).join("");
    return '<div class="grid g3" style="margin-bottom:16px">' + kpi("Close rate (last 30 days)", "50%", "7 of 14 quotes accepted (demo)", "quotes") + kpi("Quotes waiting", waitingQuotes(), "Each one is being followed up", "quotes") + kpi("Quotes won", won, "Follow-ups stop on their own", "quotes") + '</div>' +
      '<p class="hint">Every quote gets a follow-up at 1 hour, day 1, 3, 7 and 14, with a deposit link. You told us about 2 in 5 quotes become jobs today. This is where the follow-up changes that. All numbers here are demo data.</p>' + cards;
  }

  function jobsPage() {
    var cols = D.columns.map(function (c, ci) {
      var list = jobs.filter(function (j) { return j.col === c.id; });
      return '<div class="colm" data-col="' + c.id + '"><h3><span>' + c.name + '</span><span>' + list.length + '</span></h3>' + list.map(function (j) {
        return '<div class="job" draggable="true" data-job="' + j.id + '"><b>' + j.car + '</b><div class="m">' + j.name + ' · Tech: ' + j.tech + '</div><div class="m">' + money(j.amount) + ' · ' + j.type + '</div>' + (j.flag ? '<div style="margin-top:6px"><span class="pill warn">' + j.flag + '</span></div>' : '') +
          '<div class="mv"><button data-mv="-1" data-id="' + j.id + '" aria-label="Move back"' + (ci === 0 ? " disabled" : "") + '>‹</button><button data-mv="1" data-id="' + j.id + '" aria-label="Move forward"' + (ci === D.columns.length - 1 ? " disabled" : "") + '>›</button><span class="d">' + j.days + (j.days === 1 ? " day" : " days") + ' in shop</span></div></div>';
      }).join("") + '</div>';
    }).join("");
    return '<p class="hint">Drag a car to the next stage, or tap ‹ ›. Each move sends the customer a status text, so they stop calling to ask where their car is.</p><div class="board">' + cols + '</div>';
  }
  function moveJob(id, col) {
    var j = jobs.filter(function (x) { return x.id === id; })[0]; if (!j || j.col === col) return;
    j.col = col; if (col === "picked") j.days = j.days;
    var c = D.columns.filter(function (x) { return x.id === col; })[0];
    toast("Status text sent to " + j.name + " (demo): \"Hi " + j.name + ", " + c.text.replace("{car}", j.car.replace(/^\d{4} /, "")) + ".\"");
    render();
  }

  function calendar() {
    return '<p class="hint">Every booking lands here, and the customer and your team get a reminder, so no more forgetting a drop-off. This week, Mon to Fri (shop hours 8 AM to 6 PM).</p><div class="legend"><span><i style="background:var(--orange)"></i>Drop-off</span><span><i style="background:var(--blue)"></i>Estimate</span><span><i style="background:var(--ok)"></i>Pickup</span></div><div class="cal">' +
      D.week.map(function (d) {
        return '<div class="day ' + (d.today ? "today" : "") + '"><h3>' + d.d + (d.today ? ' · Today' : '') + '</h3>' + d.ev.map(function (e) {
          return '<div class="ev ' + e.k + '"><b>' + e.t + ' · ' + ({ drop: "Drop-off", est: "Estimate", pick: "Pickup" })[e.k] + '</b>' + e.w + (e.r ? '<br><span class="rm">✓ ' + e.r + '</span>' : '') + '</div>';
        }).join("") + '</div>';
      }).join("") + '</div><p class="note">Syncs to Google Calendar in the real version. Demo data.</p>';
  }

  function customers(filter) {
    filter = (filter || "").toLowerCase();
    var rows = D.customers.filter(function (c) { return (c[0] + c[1]).toLowerCase().indexOf(filter) > -1; }).map(function (c) {
      return '<tr><td><b>' + c[0] + '</b></td><td class="hide-m">' + c[1] + '</td><td class="hide-m">' + c[2] + '</td><td>' + money(c[3]) + '</td><td>' + (c[4] ? '<span class="pill ok">Reviewed</span>' : '<span class="pill warn">Not yet</span>') + '</td></tr>';
    }).join("");
    return '<div class="bar-tools"><input class="search" id="q" placeholder="Search customers" value="' + filter + '"><span class="sp"></span><button class="btn" data-modal="1">Bring back old customers</button></div><div class="card" style="padding:8px 14px"><table><tr><th>Customer</th><th class="hide-m">Last job</th><th class="hide-m">When</th><th>Total spent</th><th>Review</th></tr>' + rows + '</table></div><p class="note">Demo data. 12 of your past customers shown.</p>';
  }

  function reviewsPage() {
    var rv = reviews.map(function (r, i) {
      return '<div class="card" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between"><b>' + r.n + '</b><span class="stars" style="font-size:16px">★★★★★</span></div><div class="hint" style="margin:2px 0 8px">' + r.d + ' · Google</div><p style="margin:0 0 12px">' + r.t + '</p><div class="mail" style="margin:0"><div class="h">Drafted reply in Edwin\'s voice</div>' + r.draft + '</div>' +
        (r.st === "pending" ? '<div style="margin-top:12px;display:flex;gap:10px"><button class="btn" data-approve="' + i + '">Approve and post</button><button class="btn ghost" data-toast="Opened for editing (demo)">Edit</button></div>' : '<div style="margin-top:12px"><span class="pill ok">✓ Reply posted</span></div>') + '</div>';
    }).join("");
    var rq = D.requests.map(function (r) { return '<div class="need"><span class="pill ' + (r[2] === "Sent" ? "ok" : "")+ '">' + r[2] + '</span><span class="t" style="font-weight:500"><b>' + r[0] + '</b><br><span style="color:var(--muted);font-size:14px">' + r[1] + '</span></span></div>'; }).join("");
    return '<div class="grid g2" style="margin-bottom:16px"><div class="card"><div class="big">5.0</div><div class="stars">★★★★★</div><div class="l" style="color:var(--muted);font-weight:600;margin-top:6px">240+ Google reviews (demo figure)</div></div><div class="card"><h2>How review requests work</h2><p style="margin:0">Every customer gets the Google review link by text after pickup. No filtering by stars and no discounts for reviews, so every review is real. Anyone who doesn\'t reply gets one gentle reminder.</p></div></div>' +
      '<div class="grid g2" style="align-items:start"><div><h2 style="font-size:17px">Recent Google reviews</h2>' + rv + '</div><div class="card"><h2>Review requests</h2>' + rq + '</div></div>';
  }

  function report() {
    var max = 26, bars = D.weeks.map(function (w, i) {
      return '<div class="bar ' + (i === D.weeks.length - 1 ? "cur" : "") + '"><b>$' + w[1] + 'k</b><div style="height:' + (w[1] / max * 100) + '%"></div><span>' + w[0] + '</span></div>';
    }).join("");
    return '<p class="hint">This week so far, Mon Nov 23 to today. Every figure is demo data.</p><div class="grid g4">' +
      kpi("Cars done", 6, "Picked up or ready", "jobs") + kpi("Money in", "$24,300", "Synced with QuickBooks (demo)", "report") + kpi("Average ticket", "$4,050", "Across 6 jobs", "report") + kpi("Parts and outside work", "$8,900", "Money out this week", "report") +
      kpi("Calls answered", 31, "7 after hours, by the AI", "leads") + kpi("Quotes sent", 14, "All followed up", "quotes") + kpi("Close rate", "50%", "7 of 14 accepted", "quotes") + kpi("Cars in shop now", inShop(), jobs.filter(function (j) { return j.col !== "picked" && j.type === "Insurance"; }).length + " insurance, " + jobs.filter(function (j) { return j.col !== "picked" && j.type !== "Insurance"; }).length + " out-of-pocket", "jobs") +
      '</div><div class="grid g2" style="margin-top:16px"><div class="card"><h2>Money in, last 8 weeks</h2><div class="bars">' + bars + '</div></div><div class="card"><h2>Out-of-pocket vs insurance</h2><div class="split-bar"><div style="width:71%;background:var(--orange)"></div><div style="width:29%;background:#f1c6ad"></div></div><div style="display:flex;justify-content:space-between;font-weight:700"><span>Insurance 71%</span><span>Out-of-pocket 29%</span></div><p class="note">Demo split. This report goes to Edwin\'s email every Monday morning.</p><button class="btn" data-toast="Weekly report emailed (demo only, nothing was sent)">Email me this report</button></div></div>';
  }

  function found() {
    var rows = D.found.map(function (f) { return '<div class="need"><span class="pill ' + (f[2] === "ok" ? "ok" : f[2] === "warn" ? "warn" : "or") + '">' + f[1] + '</span><span class="t"><b>' + f[0] + '</b><br><span style="font-weight:500;color:var(--muted);font-size:14px">' + f[3] + '</span></span></div>'; }).join("");
    var posts = D.posts.map(function (p) { return '<div class="mail" style="margin:0 0 12px"><div class="h">' + p[0] + ' · ' + p[2] + '</div>' + p[1] + '<div style="margin-top:10px"><button class="btn sm" data-toast="Post scheduled (demo)">Approve</button></div></div>'; }).join("");
    return '<p class="hint">One consistent shop listing everywhere people look: Google, Apple, Yelp and AI assistants. Demo statuses.</p><div class="grid g2" style="align-items:start"><div class="card"><h2>Where the shop shows up</h2>' + rows + '</div><div class="card"><h2>Posts, written from your work</h2>' + posts + '<p class="note">Seasonal posts (like hail season) and before/after photos from finished jobs, ready for your OK.</p></div></div>';
  }

  var PAGES = { today: today, leads: leads, quotes: quotes, jobs: jobsPage, calendar: calendar, customers: customers, reviews: reviewsPage, report: report, found: found };
  var TITLES = { today: "Today", leads: "Leads", quotes: "Quotes", jobs: "Jobs board", calendar: "Calendar", customers: "Customers", reviews: "Reviews", report: "Weekly report", found: "Get found" };
  function cur() { var h = location.hash.slice(1); return PAGES[h] ? h : "today"; }

  function render() {
    var p = cur();
    $("#title").textContent = TITLES[p];
    $("#view").innerHTML = PAGES[p]();
    document.querySelectorAll(".nav button").forEach(function (b) { b.classList.toggle("on", b.dataset.p === p); });
    document.querySelectorAll(".tabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.p === p || (b.dataset.p === "more" && TABS.indexOf(p) < 0)); });
    $("#sheet").classList.toggle("show", state.sheet);
  }
  function go(p) { state.sheet = false; if (location.hash.slice(1) === p) render(); else location.hash = p; window.scrollTo(0, 0); }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-p],[data-go],[data-lead],[data-toast],[data-mv],[data-modal],[data-approve],[data-close]");
    if (!t) { if (state.sheet) { state.sheet = false; render(); } return; }
    var d = t.dataset;
    if (d.p) { if (d.p === "more") { state.sheet = !state.sheet; render(); } else go(d.p); }
    else if (d.go) go(d.go);
    else if (d.lead) { state.leadId = +d.lead; render(); }
    else if (d.toast) { toast(d.toast); if (d.close != null) $("#modal").classList.remove("show"); }
    else if (d.mv) { var j = jobs.filter(function (x) { return x.id === +d.id; })[0]; var i = D.columns.map(function (c) { return c.id; }).indexOf(j.col); var n = D.columns[i + +d.mv]; if (n) moveJob(j.id, n.id); }
    else if (d.modal) $("#modal").classList.add("show");
    else if (d.close != null) $("#modal").classList.remove("show");
    else if (d.approve) { reviews[+d.approve].st = "approved"; toast("Reply posted to Google (demo, nothing was posted)"); render(); }
  });
  document.addEventListener("input", function (e) { if (e.target.id !== "q") return; var v = e.target.value; $("#view").innerHTML = customers(v); var n = $("#q"); n.focus(); n.setSelectionRange(v.length, v.length); });
  // drag and drop
  var dragId = null;
  document.addEventListener("dragstart", function (e) { var j = e.target.closest && e.target.closest("[data-job]"); if (!j) return; dragId = +j.dataset.job; j.classList.add("drag"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", String(dragId)); } catch (x) {} });
  document.addEventListener("dragend", function () { dragId = null; document.querySelectorAll(".drag,.over").forEach(function (n) { n.classList.remove("drag", "over"); }); });
  document.addEventListener("dragover", function (e) { var c = e.target.closest && e.target.closest(".colm"); if (c && dragId) { e.preventDefault(); document.querySelectorAll(".over").forEach(function (n) { n.classList.remove("over"); }); c.classList.add("over"); } });
  document.addEventListener("drop", function (e) { var c = e.target.closest && e.target.closest(".colm"); if (c && dragId) { e.preventDefault(); moveJob(dragId, c.dataset.col); } });
  document.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(".kpi[data-go]")) { e.preventDefault(); go(e.target.dataset.go); } if (e.key === "Escape") $("#modal").classList.remove("show"); });

  // chrome
  $("#nav").innerHTML = NAV.map(function (n) { return '<button data-p="' + n[0] + '">' + icon(n[0]) + n[1] + '</button>'; }).join("");
  $("#tabs").innerHTML = TABS.map(function (k) { return '<button data-p="' + k + '">' + icon(k) + TITLES[k] + '</button>'; }).join("") + '<button data-p="more">' + icon("more") + 'More</button>';
  $("#sheet").innerHTML = NAV.filter(function (n) { return TABS.indexOf(n[0]) < 0; }).map(function (n) { return '<button data-p="' + n[0] + '">' + icon(n[0]) + n[1] + '</button>'; }).join("");
  window.addEventListener("hashchange", render);
  render();
})();
