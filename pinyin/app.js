/* 汉语拼音学习小程序 — 主逻辑 */
(function () {
  'use strict';
  var PY = window.PY, PYAnim = window.PYAnim;

  /* ---------- 嗓音 ---------- */
  var zhVoices = [], maleVoice = null, femaleVoice = null, currentVoice = null;
  var rate = 1.0, vol = 1.0;

  function classify(name) {
    name = (name || '').toLowerCase();
    if (/kang|male|男/.test(name)) return 'male';
    if (/hui|yaoyao|xiao|female|女|yahei|yun|ting/.test(name)) return 'female';
    return 'unknown';
  }

  function loadVoices() {
    _yueVoice = undefined; // 嗓音列表变化后重新探测粤语声
    var all = window.speechSynthesis.getVoices();
    zhVoices = all.filter(function (v) {
      return /zh|cmn|chinese/i.test(v.lang) || /chinese|mandarin/i.test(v.name);
    });
    if (!zhVoices.length) zhVoices = all.filter(function (v) { return /cn/i.test(v.lang); });
    maleVoice = zhVoices.filter(function (v) { return classify(v.name) === 'male'; })[0] || null;
    femaleVoice = zhVoices.filter(function (v) { return classify(v.name) === 'female'; })[0] || null;
    // 默认女声（多数系统自带），否则男声，否则第一个
    currentVoice = femaleVoice || maleVoice || zhVoices[0] || null;

    var sel = document.getElementById('voiceSel');
    sel.innerHTML = '';
    if (!zhVoices.length) {
      var opt = document.createElement('option');
      opt.textContent = '（系统未安装中文嗓音）';
      sel.appendChild(opt);
    } else {
      zhVoices.forEach(function (v, i) {
        var o = document.createElement('option');
        o.value = i; o.textContent = v.name + ' [' + (classify(v.name) === 'male' ? '男' : classify(v.name) === 'female' ? '女' : '?') + ']';
        sel.appendChild(o);
      });
      syncSelToCurrent();
    }
    var mv = document.getElementById('btnMale'), fv = document.getElementById('btnFemale');
    mv.disabled = !maleVoice; mv.title = maleVoice ? ('男声：' + maleVoice.name) : '系统无男声';
    fv.disabled = !femaleVoice; fv.title = femaleVoice ? ('女声：' + femaleVoice.name) : '系统无女声';
    updateVoiceLabel();
  }

  function syncSelToCurrent() {
    var sel = document.getElementById('voiceSel');
    if (!currentVoice) return;
    zhVoices.forEach(function (v, i) { if (v === currentVoice) sel.value = i; });
  }

  function updateVoiceLabel() {
    var el = document.getElementById('voiceLabel');
    el.textContent = currentVoice ? ('当前：' + currentVoice.name) : '无可用中文嗓音';
  }

  function selectMale() { if (maleVoice) { currentVoice = maleVoice; syncSelToCurrent(); updateVoiceLabel(); setVoiceActive('btnMale'); } }
  function selectFemale() { if (femaleVoice) { currentVoice = femaleVoice; syncSelToCurrent(); updateVoiceLabel(); setVoiceActive('btnFemale'); } }
  function setVoiceActive(id) {
    ['btnMale', 'btnFemale'].forEach(function (x) {
      document.getElementById(x).classList.toggle('active', x === id);
    });
  }

  /* ---------- 朗读 ---------- */
  var _yueVoice; // undefined=未查过, null=本机无粤语嗓音
  function cantoneseVoice() {
    if (_yueVoice !== undefined) return _yueVoice;
    var all = window.speechSynthesis.getVoices();
    _yueVoice = all.filter(function (v) {
      return /yue|zh-hk|cantonese/i.test(v.lang) || /cantonese|粤语|粵語|香港/i.test(v.name);
    })[0] || null;
    return _yueVoice;
  }

  function speak(text, opts) {
    if (!('speechSynthesis' in window)) {
      alert('当前浏览器不支持语音合成（SpeechSynthesis），请改用 Edge / Chrome。');
      return;
    }
    try { window.speechSynthesis.cancel(); } catch (e) {}
    var u = new SpeechSynthesisUtterance(text);
    var v = (opts && opts.voice) || currentVoice;
    u.lang = (opts && opts.lang) || 'zh-CN';
    if (v) u.voice = v;
    u.rate = rate; u.volume = vol;
    u.onend = function () { PYAnim.Mouth.reset(); };
    u.onerror = function () { PYAnim.Mouth.reset(); };
    window.speechSynthesis.speak(u);
  }

  /* ---------- 播放一个音 ---------- */
  function seqOf(item) {
    if (item.seq) return item.seq;
    if (item.v) return [item.v];
    return ['a'];
  }

  function playItem(item, toneTip) {
    var seq = seqOf(item);
    var per = 300;
    PYAnim.Mouth.sequence(seq, per);
    var ms = Math.max(1000, seq.length * (per + 30) + 200);
    PYAnim.Tone.play(toneTip || 0, ms);
    document.getElementById('nowPy').textContent = item.disp || PY.displayPy(item.py);
    document.getElementById('nowHanzi').textContent = item.h || '';
    document.getElementById('nowTip').textContent = item.tip || '';
    if (item.audio && item.audio.cantonese) {
      // 无独立汉字的鼻音韵母（如 ong）：优先用粤语嗓音读纯鼻音（安≈ON，无声母）；
      // 无粤语嗓音时退读韵母拼音本身（已实测普通话嗓音会发声，不会没声）。
      var yue = cantoneseVoice();
      if (yue) speak(item.audio.cantonese, { voice: yue, lang: 'zh-HK' });
      else speak(item.audio.pure, { voice: currentVoice, lang: 'zh-CN' });
    } else {
      // 发音优先用 item.read（拼读里是「声调专属汉字」）；卡片网格无 read，回退朗读范例汉字 h（中文 TTS 读汉字最稳）
      speak(item.read || item.h || PY.displayPy(item.py));
    }
  }

  /* ---------- 渲染卡片 ---------- */
  function makeCard(item, tone) {
    var card = document.createElement('button');
    card.className = 'card';
    var disp = item.disp || PY.displayPy(item.py);
    card.innerHTML = '<span class="py">' + disp + '</span>' +
      '<span class="hz">' + (item.h || '') + '</span>' +
      '<span class="tip">' + (item.tip || '') + '</span>';
    card.addEventListener('click', function () { playItem(item, tone); });
    return card;
  }

  function renderGrid(containerId, items, tone) {
    var box = document.getElementById(containerId);
    box.innerHTML = '';
    items.forEach(function (it) { box.appendChild(makeCard(it, tone)); });
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

    function refresh() {
      var ini = iniSel.value === '' ? null : PY.INITIALS[Number(iniSel.value)];
      var fin = PY.FINALS[Number(finSel.value)];
      var tone = getTone();
      var base, look, disp, item;
      if (!ini) {
        base = fin.py;
        disp = PY.markTone(base, tone);
        document.getElementById('compPy').textContent = PY.displayPy(disp);
        document.getElementById('compMsg').textContent = '单韵母示范：' + fin.h;
        item = { py: base, disp: PY.displayPy(disp), h: fin.h, tip: fin.tip, seq: fin.seq || [fin.v], read: fin.h };
      } else {
        base = ini.py + fin.py;
        look = base.replace(/v/g, 'u');   // ü->u，与 SYLL_TONE / SYLL 的查表键一致
        disp = PY.markTone(base, tone);
        document.getElementById('compPy').textContent = PY.displayPy(disp);
        // 关键：按所选声调取对应示范汉字（汉字自带声调，TTS 才会读出入声变化）
        var hz = PY.toneChar(look, tone) || PY.SYLL[look] || PY.SYLL[base] || '';
        document.getElementById('compMsg').textContent = hz ? ('示范字：' + hz) : '该组合较少用，未收录范字，听拼音发音';
        item = { py: base, disp: PY.displayPy(disp), h: hz, tip: '声母 ' + PY.displayPy(ini.py) + ' + 韵母 ' + PY.displayPy(fin.py), seq: [ini.v].concat(fin.seq || [fin.v]), read: hz || PY.displayPy(disp) };
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
    renderGrid('gridInitial', PY.INITIALS, 0);
    renderGrid('gridFinal', PY.FINALS, 0);
    renderGrid('gridWhole', PY.WHOLE, 0);
    buildComposer();
    initTabs();

    document.getElementById('btnMale').addEventListener('click', selectMale);
    document.getElementById('btnFemale').addEventListener('click', selectFemale);
    document.getElementById('voiceSel').addEventListener('change', function () {
      var i = Number(this.value);
      if (zhVoices[i]) { currentVoice = zhVoices[i]; updateVoiceLabel(); setVoiceActive(''); }
    });
    document.getElementById('rate').addEventListener('input', function () {
      rate = Number(this.value); document.getElementById('rateVal').textContent = rate.toFixed(2) + 'x';
    });
    document.getElementById('vol').addEventListener('input', function () {
      vol = Number(this.value); document.getElementById('volVal').textContent = Math.round(vol * 100) + '%';
    });
    document.getElementById('btnTest').addEventListener('click', function () {
      speak('你好，一起来学拼音吧');
    });

    if ('speechSynthesis' in window) {
      loadVoices();
      if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
      if (!zhVoices.length) {
        // 某些浏览器首次需触发一次
        var probe = new SpeechSynthesisUtterance('');
        window.speechSynthesis.speak(probe); window.speechSynthesis.cancel();
        setTimeout(loadVoices, 300);
      }
    } else {
      document.getElementById('voiceLabel').textContent = '浏览器不支持语音合成';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
