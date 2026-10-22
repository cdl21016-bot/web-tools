/* 汉语拼音学习小程序 — 主逻辑
 * 发音方案：全部使用预生成音频文件（audio/{嗓音}/{key}.mp3），
 * 不依赖学生设备的系统语音包——学习者的电脑/手机可能没有任何中文 TTS。
 * 仅当音频文件加载失败、且系统恰好有中文嗓音时，才用 TTS 兜底。
 * key 命名：ini_声母 / fin_韵母 / wh_整体认读 / syl_音节_声调(1~4)
 */
(function () {
  'use strict';
  var PY = window.PY, PYAnim = window.PYAnim;

  /* ---------- 嗓音（预生成音频目录） ---------- */
  var VOICE_LIST = [
    { id: 'xiaoxiao', name: '女声 · 晓晓', btn: 'btnFemale' },
    { id: 'yunxi', name: '男声 · 云希', btn: 'btnMale' }
  ];
  var currentVoice = 'xiaoxiao';
  var rate = 1.0, vol = 1.0;
  var curAudio = null;

  function audioUrl(key) { return 'audio/' + currentVoice + '/' + key + '.mp3'; }

  function updateVoiceLabel() {
    var v = VOICE_LIST.filter(function (x) { return x.id === currentVoice; })[0];
    document.getElementById('voiceLabel').textContent =
      '当前发音：' + (v ? v.name : currentVoice) + '（内置音频，无需安装中文语音包）';
  }

  function selectVoice(id) {
    if (currentVoice === id) return;
    currentVoice = id;
    VOICE_LIST.forEach(function (v) {
      var b = document.getElementById(v.btn);
      if (b) b.classList.toggle('active', v.id === id);
    });
    updateVoiceLabel();
    preloadAll();
  }

  /* ---------- TTS 兜底（仅在音频缺失且系统有中文嗓音时生效） ---------- */
  var _ttsVoice = 'unchecked';
  function ttsVoice() {
    if (_ttsVoice !== 'unchecked') return _ttsVoice;
    _ttsVoice = null;
    if ('speechSynthesis' in window) {
      var all = window.speechSynthesis.getVoices() || [];
      _ttsVoice = all.filter(function (v) { return /zh|cmn/i.test(v.lang); })[0] || null;
    }
    return _ttsVoice;
  }
  function ttsSpeak(text) {
    var v = ttsVoice();
    if (!v || !text) return false;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN'; u.voice = v; u.rate = rate; u.volume = vol;
      u.onend = function () { PYAnim.Mouth.reset(); };
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  /* ---------- 提示条 ---------- */
  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  /* ---------- 播放一个音 ---------- */
  function seqOf(item) {
    if (item.seq) return item.seq;
    if (item.v) return [item.v];
    return ['a'];
  }

  /* 口型动画按音频时长均分各关键帧，尽量声形同步 */
  function startMouth(seq, durSec) {
    var per = 300;
    if (durSec && isFinite(durSec) && durSec > 0.2) {
      per = Math.max(160, Math.min(430, (durSec * 1000 - 140) / Math.max(1, seq.length)));
    }
    PYAnim.Mouth.sequence(seq, per);
    return Math.max(900, seq.length * (per + 30) + 200);
  }

  function stopCurrent() {
    if (curAudio) {
      try { curAudio.pause(); } catch (e) {}
      curAudio.onended = null; curAudio.onerror = null; curAudio.oncanplay = null;
      curAudio = null;
    }
    if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (e) {} }
    PYAnim.Mouth.reset();
    PYAnim.Tone.reset();
  }

  /* 播放音频键；item 提供 TTS 兜底文本；onDone 用于多段连读（如试听「你好」） */
  function playKey(key, item, seq, toneTip, onDone) {
    stopCurrent();
    var a = new Audio();
    a.preload = 'auto';
    a.src = audioUrl(key);
    a.playbackRate = rate;
    a.volume = vol;
    var animStarted = false, fellBack = false;
    function begin(dur) {
      if (animStarted) return;
      animStarted = true;
      var ms = startMouth(seq, dur);
      PYAnim.Tone.play(toneTip || 0, ms);
    }
    function fallback(why) {
      if (fellBack) return;
      fellBack = true;
      if (!ttsSpeak(item ? (item.read || item.h || '') : '')) {
        PYAnim.Mouth.reset();
        toast('音频加载失败（' + key + '），请刷新重试');
      }
    }
    a.onloadedmetadata = function () { begin(a.duration); };
    setTimeout(function () { begin(0.45 * seq.length); }, 400); // 元数据迟迟不来的保险
    a.onended = function () {
      if (curAudio === a) { curAudio = null; PYAnim.Mouth.reset(); }
      if (onDone) onDone();
    };
    a.onerror = function () { if (curAudio === a) curAudio = null; fallback(); };
    curAudio = a;
    var p = a.play();
    if (p && p.catch) p.catch(function () { fallback(); });
  }

  function playItem(item, toneTip, onDone) {
    document.getElementById('nowPy').textContent = item.disp || PY.displayPy(item.py);
    document.getElementById('nowHanzi').textContent = item.h || '';
    document.getElementById('nowTip').textContent = item.tip || '';
    playKey(item.audioKey, item, seqOf(item), toneTip, onDone);
  }

  /* ---------- 渲染卡片 ---------- */
  function makeCard(item, tone, key) {
    var card = document.createElement('button');
    card.className = 'card';
    var disp = item.disp || PY.displayPy(item.py);
    card.innerHTML = '<span class="py">' + disp + '</span>' +
      '<span class="hz">' + (item.h || '') + '</span>' +
      '<span class="tip">' + (item.tip || '') + '</span>';
    item.audioKey = key;
    card.addEventListener('click', function () { playItem(item, tone); });
    return card;
  }

  function renderGrid(containerId, items, tone, prefix) {
    var box = document.getElementById(containerId);
    box.innerHTML = '';
    items.forEach(function (it) {
      box.appendChild(makeCard(it, tone, prefix + it.py));
    });
  }

  /* 预热当前嗓音的网格音频（每个仅几 KB，避免首次点击延迟） */
  var preloadedVoice = null;
  function preloadAll() {
    if (preloadedVoice === currentVoice) return;
    preloadedVoice = currentVoice;
    var keys = [];
    PY.INITIALS.forEach(function (it) { keys.push('ini_' + it.py); });
    PY.FINALS.forEach(function (it) { keys.push('fin_' + it.py); });
    PY.WHOLE.forEach(function (it) { keys.push('wh_' + it.py); });
    keys.forEach(function (k) {
      var p = new Audio();
      p.preload = 'auto';
      p.src = audioUrl(k);
    });
  }

  /* ---------- 拼读组合 ---------- */
  function buildComposer() {
    var iniSel = document.getElementById('iniSel');
    var finSel = document.getElementById('finSel');
    var toneRadios = document.getElementsByName('tone');

    iniSel.innerHTML = '<option value="">（无声母）</option>';
    PY.INITIALS.forEach(function (it, i) {
      var o = document.createElement('option'); o.value = i; o.textContent = PY.displayPy(it.py); iniSel.appendChild(o);
    });
    finSel.innerHTML = '';
    PY.FINALS.forEach(function (it, i) {
      var o = document.createElement('option'); o.value = i; o.textContent = PY.displayPy(it.py); finSel.appendChild(o);
    });

    function getTone() {
      for (var i = 0; i < toneRadios.length; i++) if (toneRadios[i].checked) return Number(toneRadios[i].value);
      return 1;
    }
    /* 轻声(5)无对应音频，借用一声的文件（轻声本无声调） */
    function toneOf(t) { return t === 5 ? 1 : t; }

    function refresh() {
      var ini = iniSel.value === '' ? null : PY.INITIALS[Number(iniSel.value)];
      var fin = PY.FINALS[Number(finSel.value)];
      var tone = getTone();
      var compPy = document.getElementById('compPy');
      var compMsg = document.getElementById('compMsg');
      var btn = document.getElementById('btnCompose');
      var iniDisp = ini ? PY.displayPy(ini.py) : '';
      var finDisp = PY.displayPy(fin.py);
      var base, look, disp, item;

      /* 纠错：普通话不存在的音节，显示错误并禁止朗读 */
      if (!PY.canSpell(ini ? ini.py : '', fin.py)) {
        var why = '';
        if (!ini) {
          compPy.textContent = '✕ 不能单独发音';
          compMsg.textContent = '普通话中没有单独读 "' + finDisp + '" 的音节：' + finDisp + ' 必须和声母相拼（试试 d+' + finDisp + '）';
        } else {
          compPy.textContent = '✕ 不能组合';
          compMsg.textContent = '普通话中没有 "' + iniDisp + finDisp + '" 这个音节：' + iniDisp + ' 不能和 ' + finDisp + ' 相拼，请换一个声母或韵母';
          // 特例引导：j/q/x/y+u 实际要选 ü；w+ei 实际要选 ui（uei）
          if ('jqxy'.indexOf(ini.py) >= 0 && fin.py === 'u') why = '（"ju/qu/xu/yu" 的韵母是 ü，请把韵母换成 ü 再试）';
          else if (ini.py === 'w' && fin.py === 'ei') why = '（"wei 为" 的韵母是 ui，请把韵母换成 ui 再试）';
          if (why) compMsg.textContent += why;
        }
        compPy.classList.add('err');
        btn.disabled = true;
        return null;
      }
      compPy.classList.remove('err');
      btn.disabled = false;

      if (!ini) {
        base = fin.py;
        var syl0 = PY.normSyll('', fin.py);   // 零声母改写：i→yi、ui→wei、iu→you…
        look = syl0;                           // normSyll 已处理全部 ü 改写，无需再替换
        disp = PY.markTone(syl0, tone);
        compPy.textContent = PY.displayPy(disp);
        var hz0 = PY.toneChar(look, tone) || PY.anyToneChar(look) || fin.h;
        compMsg.textContent = hz0 ? ('示范字：' + hz0) : '';
        item = {
          py: syl0, disp: PY.displayPy(disp), h: hz0, tip: fin.tip,
          seq: fin.seq || [fin.v],
          audioKey: 'syl_' + look + '_' + toneOf(tone),
          read: hz0
        };
      } else {
        var syl = PY.normSyll(ini.py, fin.py);        // 规范拼写：j+v→ju、y+iu→you、w+ui→wei…
        look = syl;                                    // normSyll 已处理 ü 改写：j/q/x/y→u，n/l 保留 v
        disp = PY.markTone(syl, tone);
        compPy.textContent = PY.displayPy(disp);
        // 按所选声调取对应示范汉字（汉字自带声调，音频才有入声变化）；
        // 该声调无单字时借用同音节其他声调的字，保证永远是汉字读音
        var hzExact = PY.toneChar(look, tone);
        var hz = hzExact || PY.anyToneChar(look) || PY.SYLL[syl] || '';
        compMsg.textContent = hz
          ? ('示范字：' + hz + (hzExact ? '' : '（该声调无常用单字，借同音节字示范）'))
          : '该组合较少用，未收录范字';
        item = {
          py: syl, disp: PY.displayPy(disp), h: hz,
          tip: '声母 ' + PY.displayPy(ini.py) + ' + 韵母 ' + PY.displayPy(fin.py),
          seq: [ini.v].concat(fin.seq || [fin.v]),
          audioKey: 'syl_' + look + '_' + toneOf(tone),
          read: hz
        };
      }
      return item;
    }

    [iniSel, finSel].forEach(function (s) { s.addEventListener('change', refresh); });
    toneRadios.forEach(function (r) { r.addEventListener('change', refresh); });
    refresh();

    document.getElementById('btnCompose').addEventListener('click', function () {
      var item = refresh();
      if (item) playItem(item, getTone());
    });
  }

  /* ---------- 标签页 ---------- */
  function initTabs() {
    var tabs = document.querySelectorAll('.tab');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.remove('active'); });
        document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
        t.classList.add('active');
        document.getElementById('panel-' + t.dataset.tab).classList.add('active');
      });
    });
  }

  /* ---------- 初始化 ---------- */
  function init() {
    PYAnim.Mouth.init();
    PYAnim.Tone.init();
    renderGrid('gridInitial', PY.INITIALS, 0, 'ini_');
    renderGrid('gridFinal', PY.FINALS, 0, 'fin_');
    renderGrid('gridWhole', PY.WHOLE, 0, 'wh_');
    buildComposer();
    initTabs();
    preloadAll();

    document.getElementById('btnMale').addEventListener('click', function () { selectVoice('yunxi'); });
    document.getElementById('btnFemale').addEventListener('click', function () { selectVoice('xiaoxiao'); });
    document.getElementById('rate').addEventListener('input', function () {
      rate = Number(this.value); document.getElementById('rateVal').textContent = rate.toFixed(2) + 'x';
    });
    document.getElementById('vol').addEventListener('input', function () {
      vol = Number(this.value); document.getElementById('volVal').textContent = Math.round(vol * 100) + '%';
    });
    document.getElementById('btnTest').addEventListener('click', function () {
      // 连读「你好」示范
      var chain = [
        { key: 'syl_ni_3', seq: ['n', 'i'], tone: 3, item: { read: '你' } },
        { key: 'syl_hao_3', seq: ['h', 'a', 'o'], tone: 3, item: { read: '好' } }
      ];
      (function next() {
        var job = chain.shift();
        if (!job) return;
        playKey(job.key, job.item, job.seq, job.tone, next);
      })();
    });

    VOICE_LIST.forEach(function (v) {
      var b = document.getElementById(v.btn);
      if (b) b.classList.toggle('active', v.id === currentVoice);
    });
    updateVoiceLabel();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
