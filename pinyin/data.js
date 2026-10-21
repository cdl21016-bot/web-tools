/* 汉语拼音学习小程序 — 数据层
 * 说明：
 *  - 韵母里的 ü 内部用字母 v 表示（便于声调标注算法），展示时替换为 ü
 *  - v 字段是口型(viseme)关键帧；compound 韵母用 seq 数组串接多个关键帧
 *  - 拼读组合查 SYLL 表得到示范汉字，保证朗读音色正确（汉字自带声调）
 */
(function (global) {
  'use strict';

  /* 口型关键帧：open=张嘴程度(0~1) width=嘴角宽度 round=圆唇程度(0~1) */
  var VISEMES = {
    closed: { open: 0.04, width: 1.00, round: 0.05 },
    b: { open: 0.05, width: 1.00, round: 0.05 },
    p: { open: 0.05, width: 1.00, round: 0.05 },
    m: { open: 0.09, width: 1.00, round: 0.10 },
    f: { open: 0.13, width: 1.10, round: 0.00 },
    d: { open: 0.18, width: 1.00, round: 0.00 },
    t: { open: 0.18, width: 1.00, round: 0.00 },
    n: { open: 0.18, width: 1.00, round: 0.08 },
    l: { open: 0.22, width: 1.00, round: 0.00 },
    g: { open: 0.30, width: 0.92, round: 0.10 },
    k: { open: 0.30, width: 0.92, round: 0.10 },
    h: { open: 0.36, width: 0.95, round: 0.10 },
    j: { open: 0.12, width: 1.25, round: 0.00 },
    q: { open: 0.12, width: 1.25, round: 0.00 },
    x: { open: 0.12, width: 1.25, round: 0.00 },
    zh: { open: 0.18, width: 0.92, round: 0.20 },
    ch: { open: 0.18, width: 0.92, round: 0.20 },
    sh: { open: 0.20, width: 0.90, round: 0.25 },
    r: { open: 0.20, width: 0.90, round: 0.25 },
    z: { open: 0.12, width: 1.20, round: 0.00 },
    c: { open: 0.12, width: 1.20, round: 0.00 },
    s: { open: 0.12, width: 1.20, round: 0.00 },
    y: { open: 0.12, width: 1.25, round: 0.05 },
    w: { open: 0.33, width: 0.50, round: 0.90 },
    a: { open: 1.00, width: 1.00, round: 0.00 },
    o: { open: 0.55, width: 0.62, round: 0.90 },
    e: { open: 0.72, width: 0.90, round: 0.12 },
    i: { open: 0.12, width: 1.30, round: 0.00 },
    u: { open: 0.34, width: 0.46, round: 1.00 },
    v: { open: 0.30, width: 0.50, round: 0.95 },
    er: { open: 0.30, width: 0.85, round: 0.20 },
    n: { open: 0.15, width: 0.85, round: 0.15 },   /* 前鼻音 */
    ng: { open: 0.20, width: 0.80, round: 0.30 }   /* 后鼻音 */
  };

  /* 声母 */
  var INITIALS = [
    { py: 'b', h: '波', tip: '双唇紧闭，气流冲破阻碍（不送气）', v: 'b' },
    { py: 'p', h: '坡', tip: '同 b，但气流较强（送气）', v: 'p' },
    { py: 'm', h: '摸', tip: '双唇闭，气流从鼻腔送出', v: 'm' },
    { py: 'f', h: '佛', tip: '上齿轻触下唇，摩擦出声', v: 'f' },
    { py: 'd', h: '得', tip: '舌尖抵上齿龈，突然弹开（不送气）', v: 'd' },
    { py: 't', h: '特', tip: '同 d，气流较强（送气）', v: 't' },
    { py: 'n', h: '讷', tip: '舌尖抵上齿龈，气流从鼻腔出', v: 'n' },
    { py: 'l', h: '勒', tip: '舌尖抵上齿龈，气流从舌头两边出', v: 'l' },
    { py: 'g', h: '哥', tip: '舌根抬向软腭，突然放开（不送气）', v: 'g' },
    { py: 'k', h: '颗', tip: '同 g，气流较强（送气）', v: 'k' },
    { py: 'h', h: '喝', tip: '舌根靠近软腭，留出窄缝摩擦', v: 'h' },
    { py: 'j', h: '机', tip: '舌面前部抵硬腭，不送气', v: 'j' },
    { py: 'q', h: '欺', tip: '同 j，气流较强（送气）', v: 'q' },
    { py: 'x', h: '希', tip: '舌面前部靠近硬腭，摩擦出声', v: 'x' },
    { py: 'zh', h: '知', tip: '舌尖翘起抵硬腭，不送气', v: 'zh' },
    { py: 'ch', h: '吃', tip: '同 zh，气流较强（送气）', v: 'ch' },
    { py: 'sh', h: '诗', tip: '舌尖翘起，靠近硬腭摩擦', v: 'sh' },
    { py: 'r', h: '日', tip: '同 sh，声带振动', v: 'r' },
    { py: 'z', h: '资', tip: '舌尖抵上齿背，不送气', v: 'z' },
    { py: 'c', h: '雌', tip: '同 z，气流较强（送气）', v: 'c' },
    { py: 's', h: '思', tip: '舌尖靠近上齿背，摩擦出声', v: 's' },
    { py: 'y', h: '衣', tip: '半元音，口型同 i', v: 'y' },
    { py: 'w', h: '屋', tip: '半元音，口型同 u', v: 'w' }
  ];

  /* 韵母（单/复/鼻） */
  var FINALS = [
    { py: 'a', h: '啊', tip: '嘴巴张大，舌面自然放平', v: 'a' },
    { py: 'o', h: '喔', tip: '双唇圆拢，舌头稍后缩', v: 'o' },
    { py: 'e', h: '鹅', tip: '口半开，舌位靠后', v: 'e' },
    { py: 'i', h: '衣', tip: '口微开呈扁平，舌尖抵下齿', v: 'i' },
    { py: 'u', h: '乌', tip: '双唇收圆突出，舌后缩', v: 'u' },
    { py: 'v', h: '迂', tip: '双唇扁圆，舌尖抵下齿', v: 'v' },
    { py: 'ai', h: '爱', tip: 'a 滑向 i，口型由大到扁', seq: ['a', 'i'] },
    { py: 'ei', h: '诶', tip: 'e 滑向 i', seq: ['e', 'i'] },
    { py: 'ui', h: '威', tip: 'u 滑向 i（实际是 uei）', seq: ['u', 'i'] },
    { py: 'ao', h: '奥', tip: 'a 滑向 o，口型由大变圆', seq: ['a', 'o'] },
    { py: 'ou', h: '欧', tip: 'o 滑向 u', seq: ['o', 'u'] },
    { py: 'iu', h: '优', tip: 'i 滑向 u（实际是 iou）', seq: ['i', 'u'] },
    { py: 'ie', h: '耶', tip: 'i 滑向 ê', seq: ['i', 'e'] },
    { py: 've', h: '约', tip: 'ü 滑向 ê', seq: ['v', 'e'] },
    { py: 'er', h: '耳', tip: '卷舌元音，舌尖卷起', v: 'er' },
    { py: 'an', h: '安', tip: 'a 后舌尖抵上齿龈发 n', seq: ['a', 'n'] },
    { py: 'en', h: '恩', tip: 'e 后发前鼻音 n', seq: ['e', 'n'] },
    { py: 'in', h: '因', tip: 'i 后发前鼻音 n', seq: ['i', 'n'] },
    { py: 'un', h: '温', tip: 'u 后发前鼻音 n（实际是 uen）', seq: ['u', 'n'] },
    { py: 'vn', h: '晕', tip: 'ü 后发前鼻音 n', seq: ['v', 'n'] },
    { py: 'ang', h: '昂', tip: 'a 后抬舌根发后鼻音 ng', seq: ['a', 'ng'] },
    { py: 'eng', h: '鞥', tip: 'e 后发后鼻音 ng', seq: ['e', 'ng'] },
    { py: 'ing', h: '英', tip: 'i 后发后鼻音 ng', seq: ['i', 'ng'] },
    { py: 'ong', h: '东', tip: 'o 后发后鼻音 ng', seq: ['o', 'ng'] }
  ];

  /* 整体认读音节 */
  var WHOLE = [
    { py: 'zhi', h: '知', tip: '舌尖翘起，不送气', seq: ['zh', 'i'] },
    { py: 'chi', h: '吃', tip: '同 zhi，送气', seq: ['ch', 'i'] },
    { py: 'shi', h: '诗', tip: '舌尖翘起摩擦', seq: ['sh', 'i'] },
    { py: 'ri', h: '日', tip: '同 shi，声带振动', seq: ['r', 'i'] },
    { py: 'zi', h: '资', tip: '舌尖抵齿背，不送气', seq: ['z', 'i'] },
    { py: 'ci', h: '雌', tip: '同 zi，送气', seq: ['c', 'i'] },
    { py: 'si', h: '思', tip: '舌尖靠近齿背摩擦', seq: ['s', 'i'] },
    { py: 'yi', h: '衣', tip: 'i 的独立音节', seq: ['i'] },
    { py: 'wu', h: '乌', tip: 'u 的独立音节', seq: ['u'] },
    { py: 'yu', h: '鱼', tip: 'ü 的独立音节', seq: ['v'] },
    { py: 'ye', h: '叶', tip: 'i 与 ê 相拼', seq: ['i', 'e'] },
    { py: 'yue', h: '月', tip: 'ü 与 ê 相拼', seq: ['v', 'e'] },
    { py: 'yuan', h: '圆', tip: 'ü 与 an 相拼', seq: ['v', 'a', 'n'] },
    { py: 'yin', h: '因', tip: 'i 与前鼻音', seq: ['i', 'n'] },
    { py: 'ying', h: '影', tip: 'i 与后鼻音', seq: ['i', 'ng'] },
    { py: 'yun', h: '云', tip: 'ü 与前鼻音', seq: ['v', 'n'] }
  ];

  /* 拼读组合：pinyin(无声调) -> 示范汉字（用于保证朗读音色正确） */
  var SYLL = {
    ba: '爸', pa: '怕', ma: '妈', fa: '发', da: '大', ta: '他', na: '那', la: '拉',
    ga: '嘎', ka: '卡', ha: '哈',
    bai: '白', pai: '排', mai: '买', dai: '带', tai: '太', nai: '奶', lai: '来',
    bao: '包', pao: '跑', mao: '毛', dao: '到', tao: '桃', nao: '脑', lao: '老',
    ban: '班', pan: '盘', man: '满', dan: '但', tan: '谈', nan: '南', lan: '兰',
    bang: '帮', pang: '旁', mang: '忙', dang: '当', tang: '糖', lang: '浪',
    bian: '边', pian: '片', mian: '面', dian: '电', tian: '田', nian: '年', lian: '连',
    biao: '表', piao: '票', miao: '苗', diao: '掉', tiao: '跳', niao: '鸟', liao: '料',
    bie: '别', pie: '撇', mie: '灭',
    bin: '宾', pin: '品', min: '民',
    bing: '冰', ping: '平', ming: '明', ding: '丁', ting: '听', ning: '宁', ling: '铃',
    bo: '波', po: '破', mo: '摸', me: '么',
    bu: '不', pu: '普', mu: '木', fu: '父', du: '读', tu: '土', nu: '努', lu: '路',
    bai2: '百',
    cha: '茶', chai: '柴', chan: '产', chang: '长', chao: '超', che: '车', chen: '沉',
    cheng: '成', chi: '吃', chong: '虫', chou: '愁', chu: '出', chuan: '船', chuang: '床',
    chui: '吹', chun: '春', chuo: '戳',
    sha: '沙', shai: '晒', shan: '山', shang: '上', shao: '少', she: '蛇', shen: '深',
    sheng: '生', shi: '是', shou: '手', shu: '书', shua: '刷', shuai: '帅', shuan: '栓',
    shuang: '双', shui: '水', shun: '顺', shuo: '说',
    za: '杂', zai: '在', zan: '赞', zang: '脏', zao: '早', ze: '责', zen: '怎',
    zeng: '增', zi: '字', zong: '总', zou: '走', zu: '租', zuan: '钻', zui: '最', zun: '尊', zuo: '左',
    ca: '擦', cai: '才', can: '蚕', cao: '草', ce: '册', ci: '此', cong: '从', cou: '凑',
    cu: '粗', cuan: '窜', cui: '催', cun: '村', cuo: '错',
    sa: '洒', sai: '赛', san: '三', sang: '桑', sao: '扫', se: '色', sen: '森',
    seng: '僧', si: '四', song: '松', sou: '搜', su: '苏', suan: '酸', sui: '岁', sun: '孙', suo: '锁',
    ya: '呀', yan: '眼', yang: '羊', yao: '要', ye: '也', yi: '一', yin: '音', ying: '影',
    yo: '哟', yong: '用', you: '有', yu: '雨', yuan: '元', yue: '月', yun: '云',
    wa: '哇', wai: '外', wan: '万', wang: '王', wei: '为', wen: '文', weng: '翁', wo: '我', wu: '五',
    ji: '鸡', jia: '家', jian: '间', jiang: '江', jiao: '叫', jie: '姐', jin: '今', jing: '京',
    jiong: '窘', jiu: '九', ju: '句', juan: '卷', jue: '决', jun: '军',
    qi: '七', qia: '恰', qian: '千', qiang: '强', qiao: '桥', qie: '且', qin: '亲', qing: '请',
    qiong: '穷', qiu: '球', qu: '去', quan: '全', que: '缺', qun: '群',
    xi: '西', xia: '下', xian: '先', xiang: '想', xiao: '小', xie: '写', xin: '新', xing: '星',
    xiong: '兄', xiu: '休', xu: '须', xuan: '选', xue: '学', xun: '寻',
    gu: '古', gua: '瓜', guai: '怪', guan: '关', guang: '光', gui: '贵', gun: '滚', guo: '国',
    kua: '夸', kuai: '快', kuan: '宽', kuang: '狂', kui: '亏', kun: '困', kuo: '阔',
    hua: '花', huai: '怀', huan: '欢', huang: '黄', hui: '回', hun: '混', huo: '火',
    duan: '段', dui: '对', dun: '顿', duo: '多', tuan: '团', tui: '推', tun: '吞', tuo: '拖',
    nuan: '暖', nuo: '挪', luan: '乱', lun: '轮', luo: '罗', lve: '略', nve: '虐',
    jue2: '绝', lue: '略', nue: '虐',
    hao: '好', zhang: '张', zhao: '照', zhou: '周', zhen: '真', zheng: '正', zhu: '住', zhuo: '桌',
    kai: '开', kao: '考', kan: '看', ken: '肯', keng: '坑', kou: '口', hou: '后', hen: '很',
    hang: '航', heng: '横', gai: '该', gou: '狗', gan: '干', gen: '跟', geng: '更',
    beng: '蹦', peng: '碰', meng: '梦', feng: '风', deng: '等', teng: '疼', neng: '能', leng: '冷',
    gong: '工', kong: '空', hong: '红', long: '龙',
    bia: '比', dia: '嗲', pi: '批', mi: '米', di: '地', ti: '提', ni: '你', li: '里',
    guai: '怪', gun: '滚', guang: '光', zhan: '站', zang: '脏'
  };

  /* 声调标注：把无声调拼音按声调标上调号（tone: 1~4，5 或 0 = 轻声） */
  function markTone(base, tone) {
    if (!tone || tone === 5 || tone === 0) return base;
    var table = {
      a: ['ā', 'á', 'ǎ', 'à'], e: ['ē', 'é', 'ě', 'è'],
      i: ['ī', 'í', 'ǐ', 'ì'], o: ['ō', 'ó', 'ǒ', 'ò'],
      u: ['ū', 'ú', 'ǔ', 'ù'], v: ['ǖ', 'ǘ', 'ǚ', 'ǜ']
    };
    var key = null, idx = -1;
    if (base.indexOf('a') >= 0) { key = 'a'; idx = base.indexOf('a'); }
    else if (base.indexOf('o') >= 0) { key = 'o'; idx = base.indexOf('o'); }
    else if (base.indexOf('v') >= 0 && base.indexOf('e') >= 0) { key = 'v'; idx = base.indexOf('v'); }
    else if (base.indexOf('e') >= 0) { key = 'e'; idx = base.indexOf('e'); }
    else {
      for (var j = base.length - 1; j >= 0; j--) {
        if ('iuvo'.indexOf(base[j]) >= 0) { key = base[j]; idx = j; break; }
      }
    }
    if (key === null) return base;
    var repl = table[key][tone - 1];
    return base.substring(0, idx) + repl + base.substring(idx + 1);
  }

  /* 展示用：把内部 v 换成 ü */
  function displayPy(py) { return py.replace(/v/g, 'ü'); }

  var DATA = {
    VISEMES: VISEMES,
    INITIALS: INITIALS,
    FINALS: FINALS,
    WHOLE: WHOLE,
    SYLL: SYLL,
    markTone: markTone,
    displayPy: displayPy
  };

  global.PY = DATA;
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
})(typeof window !== 'undefined' ? window : this);
