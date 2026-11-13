/* Ruletix · herramientas de azar. Todo se ejecuta en el navegador: no hay servidor ni datos enviados. */
(function () {
  "use strict";
  var T = window.T || {}, LANG = window.LANG || "es";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- utilidades ----------
  function randInt(min, max) { // entero en [min, max] con el generador criptográfico del navegador
    var range = max - min + 1;
    if (range <= 0) return min;
    var buf = new Uint32Array(1), limit = Math.floor(0x100000000 / range) * range, x;
    do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return min + (x % range);
  }
  function rand01() { return randInt(0, 1000000) / 1000000; }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = randInt(0, i); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function lines(text) { return String(text || "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function fmt(s, o) { return String(s).replace(/\{(\w)\}/g, function (m, k) { return o[k] != null ? o[k] : m; }); }
  var store = {
    get: function (k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  var toastEl;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.classList.remove("show"); }, 2000);
  }
  function copy(text, msg) {
    var done = function () { toast(msg || T.copied || "Copiado"); };
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) {} ta.remove();
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  function getHash() { return new URLSearchParams(location.hash.slice(1)); }
  function setHash(params) {
    var s = params.toString();
    try { history.replaceState(null, "", s ? "#" + s : location.pathname + location.search); } catch (e) {}
  }
  var audioCtx;
  function beep(freq, dur, vol) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime;
      o.type = "triangle"; o.frequency.value = freq || 900;
      g.gain.setValueAtTime(vol || .08, t); g.gain.exponentialRampToValueAtTime(.0001, t + (dur || .05));
      o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(t + (dur || .05));
    } catch (e) {}
  }
  function fanfare() { beep(660, .12, .1); setTimeout(function () { beep(880, .12, .1); }, 110); setTimeout(function () { beep(1320, .25, .1); }, 220); }
  function soundOn(root) { var s = $("#sound", root); return !s || s.checked; }
  function fullscreen(root) {
    $$("[data-fullscreen]", root).forEach(function (b) {
      if (!document.documentElement.requestFullscreen) { b.hidden = true; return; }
      b.addEventListener("click", function () { if (document.fullscreenElement) document.exitFullscreen(); else root.requestFullscreen().catch(function () {}); });
    });
  }
  function typing() { var a = document.activeElement; return a && /INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY|A/.test(a.tagName); }
  function onSpace(fn) {
    document.addEventListener("keydown", function (e) {
      if (e.code !== "Space" || typing() || document.querySelector(".modal.open")) return;
      e.preventDefault(); fn();
    });
  }
  function segVal(name, root) { var b = $('.seg[data-name="' + name + '"] [aria-checked=true]', root); return b ? b.getAttribute("data-v") : null; }
  function bindCommon(root) {
    $$(".stepper", root).forEach(function (s) {
      var inp = $("input", s);
      $$("button", s).forEach(function (b) {
        b.addEventListener("click", function () {
          var v = (parseFloat(inp.value) || 0) + parseFloat(b.getAttribute("data-step"));
          var mn = inp.min !== "" ? +inp.min : -Infinity, mx = inp.max !== "" ? +inp.max : Infinity;
          inp.value = Math.max(mn, Math.min(mx, v)); inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true }));
        });
      });
    });
    $$(".seg", root).forEach(function (sg) {
      $$("button", sg).forEach(function (b) {
        b.addEventListener("click", function () {
          $$("button", sg).forEach(function (x) { x.setAttribute("aria-checked", x === b ? "true" : "false"); });
          sg.dispatchEvent(new CustomEvent("segchange", { bubbles: true, detail: b.getAttribute("data-v") }));
        });
      });
    });
    $$("textarea", root).forEach(function (ta) {
      var c = ta.parentNode.querySelector(".count"); if (!c) return;
      function upd() { var n = lines(ta.value).length; c.textContent = n === 1 ? T.count1 : fmt(T.count, { n: n }); }
      ta.addEventListener("input", upd); ta._count = upd; upd();
    });
  }

  // ---------- confeti ----------
  var CONF = ["#7b61ff", "#ff5a5f", "#ffc93c", "#17c3b2", "#3ab0ff", "#ff6fb5"];
  function confetti(n) {
    if (REDUCED) return;
    var cv = document.createElement("canvas"); cv.id = "confetti"; document.body.appendChild(cv);
    var dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight, ctx = cv.getContext("2d");
    cv.width = W * dpr; cv.height = H * dpr; ctx.scale(dpr, dpr);
    var ps = [];
    for (var i = 0; i < (n || 140); i++) {
      var left = i % 2 === 0;
      ps.push({ x: left ? -10 : W + 10, y: H * (.35 + Math.random() * .3), vx: (left ? 1 : -1) * (4 + Math.random() * 7), vy: -(7 + Math.random() * 9),
        w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - .5) * .35, c: CONF[i % CONF.length] });
    }
    var t0 = performance.now();
    (function frame(now) {
      ctx.clearRect(0, 0, W, H);
      ps.forEach(function (p) {
        p.vy += .28; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2))); ctx.restore();
      });
      if (now - t0 < 2600) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  }

  // ---------- motor de ruleta ----------
  var PAL = ["#7b61ff", "#ff5a5f", "#ffc93c", "#17c3b2", "#3ab0ff", "#ff6fb5"];
  var INK = { "#ffc93c": "#3a2a00", "#17c3b2": "#05302c", "#3ab0ff": "#06263d" };
  var LABEL_COL = { "sí": "#17c3b2", "si": "#17c3b2", "yes": "#17c3b2", "no": "#ff5a5f", "quizás": "#ffc93c", "quizas": "#ffc93c", "maybe": "#ffc93c" };
  function Wheel(box, opts) {
    var canvas = $("canvas", box), ctx = canvas.getContext("2d"), pointer = $(".wheel-pointer", box);
    var self = { angle: 0, items: [], spinning: false };
    function color(i, n, label) {
      if (opts.byLabel && LABEL_COL[String(label).toLowerCase()]) return LABEL_COL[String(label).toLowerCase()];
      var c = PAL[i % PAL.length];
      if (n > 1 && i === n - 1 && n % PAL.length === 1) c = PAL[2];
      return c;
    }
    self.draw = function () {
      var dpr = Math.min(2, window.devicePixelRatio || 1), size = Math.round((canvas.clientWidth || 400) * dpr);
      if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
      var items = self.items, r = size / 2, n = Math.max(items.length, 1), seg = 2 * Math.PI / n;
      ctx.clearRect(0, 0, size, size);
      for (var i = 0; i < n; i++) {
        var a0 = self.angle + i * seg - Math.PI / 2, col = items.length ? color(i, n, items[i]) : "#3a3360";
        ctx.beginPath(); ctx.moveTo(r, r); ctx.arc(r, r, r, a0, a0 + seg); ctx.closePath();
        ctx.fillStyle = col; ctx.fill();
        if (n > 1) { ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.5 * dpr; ctx.stroke(); }
        var label = items[i] || T.empty || "";
        ctx.save(); ctx.translate(r, r); ctx.rotate(a0 + seg / 2);
        ctx.fillStyle = INK[col] || "#fff"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
        var fs = Math.max(10, Math.min(opts.mini ? 22 : 26, (opts.mini ? 260 : 360) / Math.max(n, 6))) * (size / 500) * 1.15;
        ctx.font = "700 " + fs + "px Inter, system-ui, sans-serif";
        var maxW = r * .66, t = label;
        while (ctx.measureText(t).width > maxW && t.length > 1) t = t.slice(0, -1);
        if (t !== label) t = t.slice(0, -1) + "…";
        ctx.fillText(t, r - 16 * dpr, 0); ctx.restore();
      }
      var g = ctx.createRadialGradient(r, r, r * .2, r, r, r); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(0,0,0,.12)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(r, r, r, 0, 2 * Math.PI); ctx.fill();
    };
    self.current = function () {
      var n = self.items.length, seg = 2 * Math.PI / n, a = ((-self.angle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      return Math.floor(a / seg) % n;
    };
    self.spin = function (done) {
      if (self.spinning || self.items.length < 2) return false;
      self.spinning = true; box.classList.add("spinning");
      var n = self.items.length, seg = 2 * Math.PI / n, w = randInt(0, n - 1); // el ganador lo decide el azar criptográfico
      var t = (w + .15 + .7 * rand01()) * seg, start = self.angle;
      var base = ((-t - start) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      var delta = base + 2 * Math.PI * (REDUCED ? 1 : 5 + randInt(0, 2)), dur = REDUCED ? 900 : 4600 + randInt(0, 800), t0 = performance.now(), last = self.current();
      function frame(now) {
        var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        self.angle = start + delta * e; self.draw();
        var c = self.current();
        if (c !== last) { last = c; if (opts.onTick) opts.onTick(); if (pointer && !REDUCED) { pointer.classList.remove("tick"); void pointer.offsetWidth; pointer.classList.add("tick"); } }
        if (p < 1) requestAnimationFrame(frame);
        else { self.spinning = false; box.classList.remove("spinning"); done(self.items[w], w); }
      }
      requestAnimationFrame(frame);
      return true;
    };
    window.addEventListener("resize", function () { self.draw(); });
    return self;
  }

  // ---------- RULETA (nombres, comida, sí o no) ----------
  function initWheel(root) {
    var variant = root.getAttribute("data-variant"), ta = $("#entries", root), spinBtn = $("#spin", root), box = $(".wheel-box", root);
    var modal = $("#winner-modal"), wname = $("#winner-name"), rmChk = $("#remove-winner", root), maybe = $("#maybe", root), q = $("#question", root);
    var hist = [], histEl = $("#hist", root), lastPill = $("#last-pill", root), defaultQ = $("#winner-q").textContent;
    var wheel = Wheel(box, { byLabel: variant === "yesno", onTick: function () { if (soundOn(root)) beep(650 + randInt(0, 250), .04, .06); } });
    var h = getHash(); if (h.get("l")) ta.value = h.get("l");
    function read() { wheel.items = lines(ta.value).slice(0, 200); if (ta._count) ta._count(); }
    var saveT;
    function save() {
      read(); wheel.draw();
      clearTimeout(saveT); saveT = setTimeout(function () { var p = getHash(); p.set("l", lines(ta.value).join("\n")); setHash(p); }, 400);
    }
    function spin() {
      read();
      if (wheel.items.length < 2) { toast(T.needTwo); return; }
      spinBtn.disabled = true;
      wheel.spin(function (w) {
        spinBtn.disabled = false;
        wname.textContent = w; modal._winner = w;
        $("#winner-q").textContent = q && q.value.trim() ? q.value.trim() : defaultQ;
        $("#remove-btn").hidden = rmChk.checked || wheel.items.length < 3;
        modal.classList.add("open"); document.body.classList.add("noscroll");
        setTimeout(function () { $("#close-modal").focus(); }, 50);
        if (soundOn(root)) fanfare();
        confetti();
        hist.unshift(w); hist = hist.slice(0, 10);
        histEl.innerHTML = hist.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join(""); $("#hist-box", root).hidden = false;
        lastPill.textContent = (LANG === "es" ? "Último: " : "Last: ") + w; lastPill.hidden = false;
      });
    }
    function removeWinner() {
      var arr = lines(ta.value), i = arr.indexOf(modal._winner);
      if (i > -1) { arr.splice(i, 1); ta.value = arr.join("\n"); save(); }
    }
    function close(remove) {
      modal.classList.remove("open"); document.body.classList.remove("noscroll");
      if ((rmChk.checked || remove) && modal._winner) removeWinner();
      modal._winner = null; spinBtn.focus({ preventScroll: true });
    }
    $("#close-modal").addEventListener("click", function () { close(false); });
    $("#remove-btn").addEventListener("click", function () { close(true); });
    modal.addEventListener("click", function (e) { if (e.target === modal) close(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal.classList.contains("open")) close(false); });
    ta.addEventListener("input", save);
    if (maybe) maybe.addEventListener("change", function () {
      var y = T.yes, n = T.no, m = T.maybe;
      ta.value = (maybe.checked ? [y, n, m, y, n, m] : [y, n, y, n]).join("\n"); save();
    });
    spinBtn.addEventListener("click", spin); $(".wheel-center", box).addEventListener("click", spin);
    $("#shuffle", root).addEventListener("click", function () { ta.value = shuffle(lines(ta.value)).join("\n"); save(); });
    $("#sort", root).addEventListener("click", function () { ta.value = lines(ta.value).sort(function (a, b) { return a.localeCompare(b); }).join("\n"); save(); });
    $("#share", root).addEventListener("click", function () {
      var p = getHash(); p.set("l", lines(ta.value).join("\n")); setHash(p); copy(location.href, T.linkCopied);
    });
    onSpace(spin);
    fullscreen(root); read(); wheel.draw();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { wheel.draw(); });
  }

  // ---------- RULETA DE LA PORTADA ----------
  function initMini() {
    var play = $(".hero-play"); if (!play) return;
    var box = $(".wheel-box", play), res = $("#mini-result");
    var wheel = Wheel(box, { mini: true, onTick: function () {} });
    try { wheel.items = JSON.parse(play.getAttribute("data-mini")); } catch (e) { wheel.items = ["A", "B", "C"]; }
    wheel.angle = -0.35; wheel.draw();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { wheel.draw(); });
    function spin() {
      res.classList.remove("win"); res.textContent = "…";
      wheel.spin(function (w) { res.textContent = "→ " + w; void res.offsetWidth; res.classList.add("win"); confetti(80); });
    }
    $(".wheel-center", box).addEventListener("click", spin);
    $("canvas", box).addEventListener("click", spin);
  }

  // ---------- SORTEO DE NOMBRES ----------
  function initPicker(root) {
    var ta = $("#names", root), slot = $("#slot", root), sn = $(".slot-name", slot), out = $("#pick-out", root), drawBtn = $("#draw", root);
    function draw() {
      var all = lines(ta.value), names = all;
      if ($("#dedupe", root).checked) {
        var seen = {}; names = all.filter(function (n) { var k = n.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; });
        if (names.length < all.length) { ta.value = names.join("\n"); if (ta._count) ta._count(); toast(fmt(T.deduped, { n: all.length - names.length })); }
      }
      var W = Math.max(1, parseInt($("#winners", root).value, 10) || 1), A = Math.max(0, parseInt($("#alts", root).value, 10) || 0);
      if (names.length < 2) { out.innerHTML = '<p class="error">' + esc(T.needTwo) + "</p>"; return; }
      if (names.length < W) { out.innerHTML = '<p class="error">' + esc(T.needMore) + "</p>"; return; }
      var order = shuffle(names.slice()), win = order.slice(0, W), alts = order.slice(W, W + A);
      drawBtn.disabled = true; out.innerHTML = ""; $("#pick-actions", root).hidden = true;
      slot.classList.remove("done"); slot.classList.add("rolling");
      var steps = REDUCED ? 0 : 22, i = 0;
      (function roll() {
        if (i < steps) {
          sn.textContent = names[randInt(0, names.length - 1)];
          if (soundOn(root)) beep(500 + i * 18, .03, .05);
          i++; setTimeout(roll, 40 + i * i * .35); return;
        }
        slot.classList.remove("rolling"); slot.classList.add("done");
        sn.textContent = win.length === 1 ? win[0] : win.join(" · ");
        var d = new Date().toLocaleString(LANG === "es" ? "es-ES" : "en-US", { dateStyle: "long", timeStyle: "medium" });
        var html = "<h3>" + esc(win.length === 1 ? T.winner1 : T.winners) + '</h3><ol class="plist">' + win.map(function (n, k) {
          return '<li style="animation-delay:' + k * 60 + 'ms"><span class="medal">' + (k + 1) + "</span>" + esc(n) + "</li>"; }).join("") + "</ol>";
        if (alts.length) html += "<h3>" + esc(T.alts) + '</h3><ol class="plist alts">' + alts.map(function (n, k) {
          return '<li style="animation-delay:' + (win.length + k) * 60 + 'ms"><span class="medal">' + (k + 1) + "</span>" + esc(n) + "</li>"; }).join("") + "</ol>";
        html += '<p class="stamp">' + esc(fmt(T.drawnAt, { d: d })) + " · " + esc(fmt(T.entrants, { n: names.length })) + "</p>";
        out.innerHTML = html; $("#pick-actions", root).hidden = false; drawBtn.disabled = false;
        out._text = T.winners + ":\n" + win.map(function (n, k) { return (k + 1) + ". " + n; }).join("\n") +
          (alts.length ? "\n\n" + T.alts + ":\n" + alts.map(function (n, k) { return (k + 1) + ". " + n; }).join("\n") : "") +
          "\n\n" + fmt(T.drawnAt, { d: d }) + " · " + fmt(T.entrants, { n: names.length });
        if (soundOn(root)) fanfare();
        confetti();
      })();
    }
    drawBtn.addEventListener("click", draw);
    $("#copy", root).addEventListener("click", function () { if (out._text) copy(out._text); });
    fullscreen(root);
  }

  // ---------- TORNEO ----------
  var BYE = "\u0000bye";
  function initBracket(root) {
    var ta = $("#players", root), el = $("#bracket", root), champ = $("#champ", root), KEY = "ruletix-bracket-" + LANG;
    var st = store.get(KEY), celebrated = null;
    function roundName(r, R) {
      var left = R - r;
      return left === 1 ? T.final : left === 2 ? T.semi : left === 3 ? T.quarter : left === 4 ? T.r16 : fmt(T.round, { n: r + 1 });
    }
    function compute() {
      var R = Math.log2(st.slots.length), rounds = [], prev = null;
      for (var r = 0; r < R; r++) {
        var ms = [], count = st.slots.length / Math.pow(2, r + 1);
        for (var m = 0; m < count; m++) {
          var a = r === 0 ? st.slots[2 * m] : prev[2 * m].w, b = r === 0 ? st.slots[2 * m + 1] : prev[2 * m + 1].w, w = null;
          if (a != null && b != null) {
            if (a === BYE && b !== BYE) w = b; else if (b === BYE && a !== BYE) w = a;
            else { var p = (st.picks[r] || {})[m]; if (p === a || p === b) w = p; }
          }
          ms.push({ a: a, b: b, w: w });
        }
        rounds.push(ms); prev = ms;
      }
      return rounds;
    }
    function render() {
      if (!st) { el.innerHTML = ""; champ.hidden = true; return; }
      var rounds = compute(), R = rounds.length;
      el.innerHTML = rounds.map(function (ms, r) {
        return '<div class="round"><h4>' + esc(roundName(r, R)) + '</h4><div class="ms">' + ms.map(function (m, i) {
          return '<div class="match">' + [m.a, m.b].map(function (s) {
            var cls = s == null ? "tbd" : s === BYE ? "bye" : m.w == null ? "" : m.w === s ? "win" : "lose";
            var label = s == null ? T.tbd : s === BYE ? T.bye : s;
            var dis = s == null || s === BYE || m.a == null || m.b == null || m.a === BYE || m.b === BYE;
            return '<button type="button" class="slotbtn ' + cls + '" data-r="' + r + '" data-m="' + i + '"' + (dis ? " disabled" : "") + (s != null && s !== BYE ? ' data-n="' + esc(s) + '"' : "") +
              '><span>' + esc(label) + "</span></button>";
          }).join("") + "</div>";
        }).join("") + "</div></div>";
      }).join("");
      var w = rounds[R - 1][0].w;
      if (w) {
        champ.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/></svg><div><small>' + esc(T.champion) + "</small>" + esc(w) + "</div>";
        champ.hidden = false;
        if (celebrated !== w) { celebrated = w; if (st._live) { confetti(); fanfare(); } }
      } else { champ.hidden = true; celebrated = null; }
    }
    function make() {
      var ps = lines(ta.value).slice(0, 64);
      if (ps.length < 2) { toast(T.needTwo); return; }
      if ($("#shuffle", root).checked) shuffle(ps);
      var size = 2; while (size < ps.length) size *= 2;
      var matches = size / 2, byes = size - ps.length, byeAt = {};
      for (var k = 0; k < byes; k++) byeAt[Math.floor(k * matches / byes)] = 1;
      var slots = [], p = 0;
      for (var m = 0; m < matches; m++) {
        if (byeAt[m]) { if (randInt(0, 1)) slots.push(ps[p++], BYE); else slots.push(BYE, ps[p++]); }
        else slots.push(ps[p++], ps[p++]);
      }
      st = { slots: slots, picks: [], list: ta.value, _live: true }; celebrated = null;
      store.set(KEY, { slots: slots, picks: [], list: ta.value }); render();
    }
    el.addEventListener("click", function (e) {
      var b = e.target.closest(".slotbtn"); if (!b || b.disabled || !st) return;
      var r = +b.getAttribute("data-r"), m = +b.getAttribute("data-m"), n = b.getAttribute("data-n");
      st.picks[r] = st.picks[r] || {};
      st.picks[r][m] = st.picks[r][m] === n ? null : n;
      for (var rr = r + 1, mm = m >> 1; rr < 7; rr++, mm >>= 1) if (st.picks[rr]) delete st.picks[rr][mm]; // borra lo que dependía de este partido
      st._live = true; store.set(KEY, { slots: st.slots, picks: st.picks, list: st.list }); render();
    });
    $("#make", root).addEventListener("click", make);
    $("#reset", root).addEventListener("click", function () { st = null; store.del(KEY); render(); });
    if (st && st.slots) { if (st.list) { ta.value = st.list; if (ta._count) ta._count(); } render(); st._live = true; } // restaurado: sin confeti
    else make();
    fullscreen(root);
  }

  // ---------- VERDAD O RETO ----------
  function initTruth(root) {
    var TD = window.TD || { truth: [], dare: [] }, KEY = "ruletix-td-" + LANG, card = $("#td-card", root);
    var pl = $("#players", root), ot = $("#own-truths", root), od = $("#own-dares", root), only = $("#only-own", root), pill = $("#turn", root);
    var saved = store.get(KEY) || {};
    if (saved.p) pl.value = saved.p; if (saved.t) ot.value = saved.t; if (saved.d) od.value = saved.d; if (saved.o) only.checked = true;
    var decks = { truth: [], dare: [] }, turn = 0;
    function persist() { store.set(KEY, { p: pl.value, t: ot.value, d: od.value, o: only.checked }); decks = { truth: [], dare: [] }; showTurn(); }
    [pl, ot, od].forEach(function (x) { x.addEventListener("input", persist); }); only.addEventListener("change", persist);
    function pool(kind) {
      var own = lines(kind === "truth" ? ot.value : od.value);
      return only.checked && own.length ? own : TD[kind].concat(own);
    }
    function showTurn() {
      var ps = lines(pl.value);
      if (!ps.length) { pill.hidden = true; return; }
      pill.textContent = fmt(T.turnOf, { n: ps[turn % ps.length] }); pill.hidden = false;
    }
    function pick(kind) {
      if (kind === "random") kind = randInt(0, 1) ? "truth" : "dare";
      if (!decks[kind].length) decks[kind] = shuffle(pool(kind).slice());
      var text = decks[kind].pop() || "";
      var ps = lines(pl.value);
      if (ps.length) { pill.textContent = fmt(T.turnOf, { n: ps[turn % ps.length] }); pill.hidden = false; turn++; }
      card.setAttribute("data-kind", kind);
      $("#td-kind", root).textContent = kind === "truth" ? T.truth : T.dare;
      $("#td-text", root).textContent = text;
      card.classList.remove("flip"); void card.offsetWidth; card.classList.add("flip");
      beep(kind === "truth" ? 740 : 520, .08, .06);
    }
    $$("[data-pick]", root).forEach(function (b) { b.addEventListener("click", function () { pick(b.getAttribute("data-pick")); }); });
    onSpace(function () { pick("random"); });
    showTurn(); fullscreen(root);
  }

  // ---------- LETRA ALEATORIA ----------
  function initLetter(root) {
    var tile = $("#letter", root), used = {}, chips = $$(".lchip", root), usedPill = $("#used-pill", root);
    var ring = $("#ring", root), tv = $("#t-val", root), timerEl = $("#timer", root), startBtn = $("#t-start", root), CIRC = 326.7;
    var startLabel = startBtn.textContent, stopLabel = LANG === "es" ? "Parar" : "Stop", tId = null, left = 60, total = 60, busy = false;
    function active() { return chips.filter(function (c) { return c.getAttribute("aria-pressed") === "true"; }).map(function (c) { return c.getAttribute("data-l"); }); }
    function mark() {
      chips.forEach(function (c) { c.classList.toggle("used", !!used[c.getAttribute("data-l")]); });
      var n = Object.keys(used).length;
      usedPill.textContent = (LANG === "es" ? "Usadas: " : "Used: ") + n + "/" + active().length; usedPill.hidden = !n;
    }
    chips.forEach(function (c) { c.addEventListener("click", function () { c.setAttribute("aria-pressed", c.getAttribute("aria-pressed") === "true" ? "false" : "true"); mark(); }); });
    function draw() {
      if (busy) return;
      var act = active();
      if (!act.length) { toast(T.noLetters); return; }
      var left2 = act.filter(function (l) { return !used[l]; });
      if (!left2.length) { used = {}; left2 = act; toast(T.allUsed); }
      var L = left2[randInt(0, left2.length - 1)], i = 0, n = REDUCED ? 0 : 12; busy = true;
      (function roll() {
        if (i < n) { tile.textContent = act[randInt(0, act.length - 1)]; tile.classList.remove("roll"); void tile.offsetWidth; tile.classList.add("roll"); i++; setTimeout(roll, 45 + i * 6); return; }
        tile.textContent = L; tile.classList.remove("roll", "land"); void tile.offsetWidth; tile.classList.add("land");
        used[L] = 1; mark(); busy = false;
        if (soundOn(root)) beep(880, .15, .08);
      })();
    }
    function fmtT(s) { return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
    function paint() { tv.textContent = fmtT(left); ring.style.strokeDashoffset = String(CIRC * (1 - left / total)); timerEl.classList.toggle("ending", left <= 10 && tId !== null); }
    function stop() { clearInterval(tId); tId = null; startBtn.lastChild.textContent = startLabel; timerEl.classList.remove("ending"); }
    function reset() { stop(); total = left = parseInt(segVal("secs", root), 10) || 60; timerEl.classList.remove("done"); paint(); }
    startBtn.addEventListener("click", function () {
      if (tId !== null) { stop(); return; }
      if (left <= 0) reset();
      timerEl.classList.remove("done"); startBtn.lastChild.textContent = stopLabel;
      tId = setInterval(function () {
        left--; paint();
        if (left <= 5 && left > 0 && soundOn(root)) beep(700, .06, .06);
        if (left <= 0) { stop(); timerEl.classList.add("done"); toast(T.timeUp); if (soundOn(root)) { beep(440, .4, .12); setTimeout(function () { beep(330, .5, .12); }, 300); } }
      }, 1000);
    });
    root.addEventListener("segchange", reset);
    $("#draw", root).addEventListener("click", draw);
    onSpace(draw);
    reset(); fullscreen(root);
  }

  // ---------- EQUIPOS ----------
  var TEAM_COL = ["#3ab0ff", "#ff5a5f", "#17c3b2", "#ffc93c", "#7b61ff", "#ff6fb5", "#22c55e", "#f97316"];
  function initTeams(root) {
    var ta = $("#names", root), num = $("#count-n", root), bal = $("#balance", root), out = $("#teams-out", root), lbl = $('label[for="count-n"]', root);
    var h = getHash(); if (h.get("l")) { ta.value = h.get("l"); if (ta._count) ta._count(); }
    root.addEventListener("segchange", function () { lbl.textContent = segVal("mode", root) === "teams" ? T.howManyTeams : T.perTeam; });
    function parse() {
      return lines(ta.value).map(function (l) {
        var m = l.match(/^(.*?)[\s,;:\-]+([1-5])$/);
        return m ? { name: m[1].trim(), lvl: +m[2] } : { name: l, lvl: 0 };
      });
    }
    function make() {
      var people = parse(), n = parseInt(num.value, 10) || 2, balance = bal.checked;
      if (people.length < 2) { out.innerHTML = '<p class="error">' + esc(T.needTwo) + "</p>"; return; }
      var k = segVal("mode", root) === "teams" ? n : Math.ceil(people.length / Math.max(1, n));
      k = Math.max(2, Math.min(k, people.length));
      var teams = []; for (var i = 0; i < k; i++) teams.push({ m: [], s: 0 });
      shuffle(people);
      if (balance) {
        people.sort(function (a, b) { return b.lvl - a.lvl; });
        people.forEach(function (p) { // al equipo con menos nivel y, en empate, con menos gente
          var best = teams.slice().sort(function (a, b) { return a.s - b.s || a.m.length - b.m.length; });
          var cands = best.filter(function (t) { return t.s === best[0].s && t.m.length === best[0].m.length; });
          var t = cands[randInt(0, cands.length - 1)]; t.m.push(p); t.s += p.lvl;
        });
      } else people.forEach(function (p, i) { teams[i % k].m.push(p); });
      out.innerHTML = teams.map(function (t, i) {
        return '<div class="team" style="--tc:' + TEAM_COL[i % TEAM_COL.length] + ";animation-delay:" + i * 60 + 'ms"><h3>' + esc(T.team) + " " + (i + 1) +
          (balance ? "<small>" + esc(T.level) + " " + t.s + "</small>" : "") + "</h3><ol>" +
          t.m.map(function (p) { return "<li>" + esc(p.name) + "</li>"; }).join("") + "</ol></div>";
      }).join("");
      out._text = teams.map(function (t, i) { return T.team + " " + (i + 1) + ": " + t.m.map(function (p) { return p.name; }).join(", "); }).join("\n");
      $("#out-actions", root).hidden = false;
      var p = getHash(); p.set("l", lines(ta.value).join("\n")); setHash(p);
      if (soundOn(root)) beep(760, .08, .06);
    }
    $("#make", root).addEventListener("click", make); $("#again", root).addEventListener("click", make);
    $("#copy", root).addEventListener("click", function () { if (out._text) copy(out._text); });
    fullscreen(root);
  }

  // ---------- AMIGO INVISIBLE ----------
  var KEY = "azar-2026"; // misma clave que la versión anterior: los enlaces ya enviados siguen funcionando
  function encode(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj)), k = new TextEncoder().encode(KEY), s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] ^ k[i % k.length]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decode(str) {
    try {
      var b = atob(str.replace(/-/g, "+").replace(/_/g, "/")), k = new TextEncoder().encode(KEY), arr = new Uint8Array(b.length);
      for (var i = 0; i < b.length; i++) arr[i] = b.charCodeAt(i) ^ k[i % k.length];
      return JSON.parse(new TextDecoder().decode(arr));
    } catch (e) { return null; }
  }
  function assign(names, excl) {
    for (var t = 0; t < 5000; t++) {
      var r = shuffle(names.slice()), ok = true;
      for (var i = 0; i < names.length; i++) if (names[i] === r[i] || excl[names[i] + "|" + r[i]]) { ok = false; break; }
      if (ok) return names.map(function (g, i) { return [g, r[i]]; });
    }
    return null;
  }
  function initSanta(root) {
    var s = getHash().get("s");
    window.addEventListener("hashchange", function () { if (getHash().get("s")) location.reload(); });
    if (s) {
      var d = decode(s), view = $("#santa-reveal", root);
      $("#santa-organizer", root).hidden = true; view.hidden = false;
      document.querySelectorAll(".steps,.uses,.faq").forEach(function (x) { var sec = x.closest("section"); if (sec) sec.hidden = true; });
      if (!d) { $("#reveal-hello", root).textContent = T.badLink; $("#reveal-btn", root).hidden = true; return; }
      $("#reveal-hello", root).textContent = fmt(T.hello, { n: d.g });
      $("#reveal-btn", root).addEventListener("click", function () {
        $("#reveal-btn", root).hidden = true;
        $("#reveal-result", root).innerHTML = "<p>" + esc(T.youGive) + '</p><div class="big">' + esc(d.r) + "</div>" +
          (d.e ? '<p class="muted">' + esc(d.e) + "</p>" : "") +
          (d.b ? "<p><b>" + esc(T.budget) + ":</b> " + esc(d.b) + "</p>" : "") +
          (d.d ? "<p><b>" + esc(T.date) + ":</b> " + esc(new Date(d.d + "T12:00:00").toLocaleDateString(LANG === "es" ? "es-ES" : "en-US", { dateStyle: "long" })) + "</p>" : "");
        confetti(); fanfare();
      });
      return;
    }
    var out = $("#santa-out", root);
    $("#draw", root).addEventListener("click", function () {
      var names = lines($("#names", root).value), seen = {}, dup = null;
      names.forEach(function (n) { var k = n.toLowerCase(); if (seen[k]) dup = n; seen[k] = 1; });
      if (names.length < 3) { out.innerHTML = '<p class="error">' + esc(T.needThree) + "</p>"; return; }
      if (dup) { out.innerHTML = '<p class="error">' + esc(fmt(T.duplicate, { n: dup })) + "</p>"; return; }
      var excl = {};
      lines($("#excl", root).value).forEach(function (l) {
        var p = l.split(/\s+[-–—]\s+|\s*[,;\/]\s*|\s+y\s+|\s+and\s+/i).map(function (x) { return x.trim(); }).filter(Boolean);
        if (p.length === 2) { excl[p[0] + "|" + p[1]] = 1; excl[p[1] + "|" + p[0]] = 1; }
      });
      var pairs = assign(names, excl);
      if (!pairs) { out.innerHTML = '<p class="error">' + esc(T.impossible) + "</p>"; return; }
      var ev = $("#event", root).value.trim(), bud = $("#budget", root).value.trim(), dt = $("#date", root).value;
      var base = location.href.split("#")[0];
      out.innerHTML = '<p class="warn">' + esc(T.dontOpen) + '</p><div class="links">' + pairs.map(function (p) {
        var url = base + "#s=" + encode({ g: p[0], r: p[1], e: ev, b: bud, d: dt });
        var msg = fmt(T.waMsg, { n: p[0], e: ev || T.santaName }) + " " + url;
        return '<div class="link-row"><span class="who">' + esc(p[0]) + '</span><input type="text" readonly value="' + esc(url) + '" aria-label="' + esc(p[0]) + '">' +
          '<span class="row-btns"><button type="button" class="btn sm ghost" data-copy="' + esc(url) + '">' + esc(T.copy) + "</button>" +
          '<a class="btn sm wa" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(msg) + '">WhatsApp</a></span></div>';
      }).join("") + "</div>";
      $$("[data-copy]", out).forEach(function (b) { b.addEventListener("click", function () { copy(b.getAttribute("data-copy")); }); });
      if (soundOn(root)) beep(760, .08, .06);
    });
  }

  // ---------- DADOS ----------
  var PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  function dieHTML(v, sides) {
    if (sides === 6) {
      var cells = ""; for (var i = 1; i <= 9; i++) cells += PIPS[v].indexOf(i) > -1 ? '<span class="pip"></span>' : "<span></span>";
      return '<div class="die pips rolling" role="img" aria-label="' + v + '">' + cells + "</div>";
    }
    return '<div class="die rolling">' + v + "</div>";
  }
  function initDice(root) {
    var out = $("#dice-out", root), sum = $("#dice-sum", root), hist = [];
    function roll() {
      var n = Math.min(10, Math.max(1, parseInt($("#qty", root).value, 10) || 1)), sides = parseInt(segVal("sides", root), 10) || 6;
      var vals = []; for (var i = 0; i < n; i++) vals.push(randInt(1, sides));
      out.innerHTML = vals.map(function (v) { return dieHTML(v, sides); }).join("");
      var total = vals.reduce(function (a, b) { return a + b; }, 0);
      sum.textContent = T.total + ": " + total; sum.hidden = n < 2;
      hist.unshift(vals.join(" + ") + (n > 1 ? " = " + total : "")); hist = hist.slice(0, 10);
      $("#hist", root).innerHTML = hist.map(function (h) { return "<li>" + esc(h) + "</li>"; }).join(""); $("#hist-box", root).hidden = hist.length < 2;
      if (soundOn(root)) { beep(300, .05, .08); setTimeout(function () { beep(420, .05, .08); }, 90); }
    }
    $("#roll", root).addEventListener("click", roll);
    onSpace(roll);
    fullscreen(root); roll(); hist = []; $("#hist-box", root).hidden = true;
  }

  // ---------- MONEDA ----------
  function initCoin(root) {
    var coin = $(".coin", root), res = $("#coin-result", root), rot = 0, c = { h: 0, t: 0 }, busy = false;
    function flip() {
      if (busy) return; busy = true;
      var heads = randInt(0, 1) === 0, target = rot + 360 * (REDUCED ? 1 : 5), mod = ((target % 360) + 360) % 360;
      target += heads ? (360 - mod) % 360 : (180 - mod + 360) % 360;
      rot = target; coin.style.transform = "rotateY(" + rot + "deg)"; res.innerHTML = "&nbsp;"; res.classList.remove("show");
      setTimeout(function () {
        busy = false; heads ? c.h++ : c.t++;
        res.textContent = heads ? T.heads : T.tails; void res.offsetWidth; res.classList.add("show");
        $("#c-h", root).textContent = c.h; $("#c-t", root).textContent = c.t; $("#c-n", root).textContent = c.h + c.t;
        beep(heads ? 880 : 660, .12, .07);
      }, REDUCED ? 320 : 1650);
    }
    $("#flip", root).addEventListener("click", flip); coin.addEventListener("click", flip);
    coin.addEventListener("keydown", function (e) { if (e.key === "Enter") flip(); });
    onSpace(flip); fullscreen(root);
  }

  // ---------- NÚMERO ALEATORIO ----------
  function initNumber(root) {
    var out = $("#num-out", root);
    function gen() {
      var a = parseInt($("#min", root).value, 10), b = parseInt($("#max", root).value, 10);
      var q = Math.min(1000, Math.max(1, parseInt($("#qty", root).value, 10) || 1)), uniq = $("#unique", root).checked;
      if (isNaN(a) || isNaN(b)) { out.innerHTML = '<p class="error">' + esc(T.badRange) + "</p>"; return; }
      if (a > b) { var t = a; a = b; b = t; }
      if (uniq && q > b - a + 1) { out.innerHTML = '<p class="error">' + esc(T.tooMany) + "</p>"; return; }
      var vals = [];
      if (uniq) {
        if (q > (b - a + 1) / 2) { var all = []; for (var x = a; x <= b; x++) all.push(x); vals = shuffle(all).slice(0, q); }
        else { var set = {}; while (vals.length < q) { var v = randInt(a, b); if (!set[v]) { set[v] = 1; vals.push(v); } } }
      } else for (var i = 0; i < q; i++) vals.push(randInt(a, b));
      if ($("#sorted", root).checked) vals.sort(function (x, y) { return x - y; });
      var loc = LANG === "es" ? "es-ES" : "en-US";
      out.innerHTML = q === 1 ? '<span class="n1">' + vals[0].toLocaleString(loc) + "</span>" :
        vals.map(function (v, k) { return '<span class="nn" style="animation-delay:' + Math.min(k, 30) * 15 + 'ms">' + v.toLocaleString(loc) + "</span>"; }).join("");
      out._text = vals.join(", ");
    }
    $("#gen", root).addEventListener("click", gen);
    $("#copy", root).addEventListener("click", function () { if (out._text) copy(out._text); });
    onSpace(gen); fullscreen(root); gen();
  }

  // ---------- ORDEN ALEATORIO ----------
  function initOrder(root) {
    var ta = $("#items", root), out = $("#order-out", root);
    out.setAttribute("data-empty", LANG === "es" ? "El nuevo orden aparecerá aquí." : "The new order will appear here.");
    var h = getHash(); if (h.get("l")) { ta.value = h.get("l"); if (ta._count) ta._count(); }
    $("#mix", root).addEventListener("click", function () {
      var arr = lines(ta.value);
      if (arr.length < 2) { toast(T.needTwo); return; }
      shuffle(arr);
      out.innerHTML = arr.map(function (x, k) { return '<li style="animation-delay:' + Math.min(k, 20) * 40 + 'ms">' + esc(x) + "</li>"; }).join("");
      out._text = arr.map(function (x, i) { return (i + 1) + ". " + x; }).join("\n");
      $("#out-actions", root).hidden = false;
      var p = getHash(); p.set("l", lines(ta.value).join("\n")); setHash(p);
    });
    $("#copy", root).addEventListener("click", function () { if (out._text) copy(out._text); });
    fullscreen(root);
  }

  var INIT = { wheel: initWheel, picker: initPicker, bracket: initBracket, truth: initTruth, letter: initLetter, teams: initTeams,
               santa: initSanta, dice: initDice, coin: initCoin, number: initNumber, order: initOrder };
  function boot() {
    var root = document.querySelector("[data-tool]");
    if (root) { bindCommon(root); var fn = INIT[root.getAttribute("data-tool")]; if (fn) fn(root); }
    initMini();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
