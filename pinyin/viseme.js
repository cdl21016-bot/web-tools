/* 汉语拼音学习小程序 — 口型 / 声调动画引擎 */
(function (global) {
  'use strict';

  var DEFAULT = { open: 0.04, width: 1.0, round: 0.05 };

  /* ============ 口型动画 ============ */
  var Mouth = (function () {
    var lipOuter, lipInner, tongue, cur, raf = null, target = null, t0 = 0, dur = 280;
    var C = { cx: 100, cy: 138, rw: 30, rh: 8, openMax: 26 };

    function init() {
      lipOuter = document.getElementById('lipOuter');
      lipInner = document.getElementById('lipInner');
      tongue = document.getElementById('tongue');
      cur = Object.assign({}, DEFAULT);
      apply(cur);
    }

    function lerp(a, b, k) { return a + (b - a) * k; }

    function apply(v) {
      var roundPull = v.round * 0.55;
      var rx = C.rw * v.width * (1 - roundPull);
      var ry = C.rh + C.openMax * v.open;
      if (lipOuter) {
        lipOuter.setAttribute('rx', (rx + 5).toFixed(1));
        lipOuter.setAttribute('ry', (ry + 5).toFixed(1));
      }
      if (lipInner) {
        lipInner.setAttribute('rx', rx.toFixed(1));
        lipInner.setAttribute('ry', ry.toFixed(1));
      }
      if (tongue) {
        var show = v.open > 0.35 ? Math.min(1, (v.open - 0.35) / 0.4) : 0;
        tongue.style.opacity = show;
        tongue.setAttribute('rx', (rx * 0.7).toFixed(1));
        tongue.setAttribute('ry', (ry * 0.7).toFixed(1));
      }
    }

    function step(ts) {
      var k = Math.min(1, (ts - t0) / dur);
      var e = 0.5 - 0.5 * Math.cos(Math.PI * k);
      cur = {
        open: lerp(cur.open, target.open, e),
        width: lerp(cur.width, target.width, e),
        round: lerp(cur.round, target.round, e)
      };
      apply(cur);
      if (k < 1) raf = requestAnimationFrame(step);
      else raf = null;
    }

    function to(v, ms) {
      target = v; dur = ms || 280; t0 = performance.now();
      if (!raf) raf = requestAnimationFrame(step);
    }

    /* 顺序播放一组口型关键帧，每帧 per 毫秒 */
    var timers = [];
    function sequence(seq, per) {
      timers.forEach(clearTimeout); timers = [];
      per = per || 300;
      var i = 0;
      function next() {
        if (i >= seq.length) { to(DEFAULT, 240); return; }
        var key = seq[i];
        var v = global.PY.VISEMES[key] || DEFAULT;
        i++;
        to(v, per);
        timers.push(setTimeout(next, per + 30));
      }
      next();
    }

    function reset() { to(DEFAULT, 200); }

    return { init: init, to: to, sequence: sequence, reset: reset };
  })();

  /* ============ 声调曲线动画 ============ */
  var Tone = (function () {
    var dot, paths = {}, raf = null;
    function init() {
      dot = document.getElementById('toneDot');
      for (var i = 0; i <= 4; i++) {
        var p = document.getElementById('tone' + i);
        if (p) paths[i] = p;
      }
    }
    function play(tone, ms) {
      tone = tone || 0;
      var p = paths[tone] || paths[0];
      if (!p || !dot) return;
      // 高亮当前曲线
      for (var k in paths) { paths[k].classList.toggle('active', Number(k) === tone); }
      var len = p.getTotalLength();
      var t0 = performance.now();
      ms = ms || 1200;
      function step(ts) {
        var k = Math.min(1, (ts - t0) / ms);
        var pt = p.getPointAtLength(len * k);
        dot.setAttribute('cx', pt.x.toFixed(1));
        dot.setAttribute('cy', pt.y.toFixed(1));
        if (k < 1) raf = requestAnimationFrame(step);
        else raf = null;
      }
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(step);
    }
    function reset() { if (dot) { dot.setAttribute('cx', 12); dot.setAttribute('cy', 60); } }
    return { init: init, play: play, reset: reset };
  })();

  global.PYAnim = { Mouth: Mouth, Tone: Tone };
})(typeof window !== 'undefined' ? window : this);
