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
    { py: 'ong', h: '', tip: 'o 后发后鼻音 ng（普通话无单字，音近粤语 ON）', seq: ['o', 'ng'], audio: { pure: 'ong', cantonese: '安' } }
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

  /* 发音铁律：中文 TTS 读「汉字」才可靠；读带调号的拉丁拼音（bō/ōng/ǖ…）会漏读、
   * 读错甚至没声。所以卡片网格（声母/韵母/整体认读）一律朗读下方范例汉字 h，让 TTS 用
   * 最稳的方式发声；拼读组合则由 app.js 用 SYLL_TONE 取「声调专属汉字」来实现四声变化。
   * （ong 无独立汉字，示范字只能是「东」这类带声母字，属语言事实，读它最稳。） */

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
    hao: '好', zhang: '张', zhao: '照', zhou: '周', zhen: '真', zheng: '正', zhu: '住', zhuo: '桌',
    kai: '开', kao: '考', kan: '看', ken: '肯', keng: '坑', kou: '口', hou: '后', hen: '很',
    hang: '航', heng: '横', gai: '该', gou: '狗', gan: '干', gen: '跟', geng: '更',
    beng: '蹦', peng: '碰', meng: '梦', feng: '风', deng: '等', teng: '疼', neng: '能', leng: '冷',
    gong: '工', kong: '空', hong: '红', long: '龙',
    bia: '比', dia: '嗲', pi: '批', mi: '米', di: '地', ti: '提', ni: '你', li: '里',
    guai: '怪', gun: '滚', guang: '光', zhan: '站', zang: '脏'
  };

  /* 拼读组合：按所选声调给出对应示范汉字（汉字自带声调，TTS 才能正确读出入声变化）
   * 索引：数组 [一声, 二声, 三声, 四声]；缺失声调用空串，调用方回退读拼音音节。
   * 注意 key 用「u 形式」（ü→u），与拼读组合里 base.replace('v','u') 后的查表键一致。 */
  var SYLL_TONE = {
    ba: ['八', '拔', '把', '爸'], pa: ['趴', '爬', '钯', '怕'], ma: ['妈', '麻', '马', '骂'],
    fa: ['发', '乏', '法', '珐'], da: ['搭', '答', '打', '大'], ta: ['他', '沓', '塔', '踏'],
    na: ['那', '拿', '哪', '那'], la: ['拉', '剌', '喇', '辣'], ga: ['嘎', '钆', '尕', '尬'],
    ka: ['喀', '喀', '卡', '咯'], ha: ['哈', '蛤', '哈', '哈'],
    bai: ['掰', '白', '百', '败'], pai: ['拍', '排', '迫', '派'], mai: ['埋', '埋', '买', '卖'],
    dai: ['呆', '呆', '逮', '带'], tai: ['胎', '台', '呔', '太'], nai: ['奶', '奈', '奶', '奈'],
    lai: ['来', '来', '喇', '赖'],
    bao: ['包', '雹', '宝', '报'], pao: ['抛', '袍', '跑', '泡'], mao: ['猫', '毛', '卯', '帽'],
    dao: ['刀', '叨', '导', '到'], tao: ['涛', '桃', '讨', '套'], nao: ['孬', '挠', '垴', '闹'],
    lao: ['捞', '劳', '老', '涝'],
    ban: ['班', '班', '板', '办'], pan: ['攀', '盘', '盼', '盼'], man: ['颟', '蛮', '满', '慢'],
    dan: ['单', '弹', '胆', '但'], tan: ['摊', '谈', '坦', '叹'], nan: ['囡', '南', '赧', '难'],
    lan: ['栏', '兰', '懒', '烂'],
    bang: ['帮', '帮', '绑', '棒'], pang: ['乓', '旁', '耪', '胖'], mang: ['芒', '忙', '莽', '芒'],
    dang: ['当', '裆', '挡', '荡'], tang: ['汤', '糖', '淌', '烫'], lang: ['啷', '狼', '朗', '浪'],
    bian: ['边', '边', '扁', '变'], pian: ['片', '便', '谝', '片'], mian: ['面', '绵', '免', '面'],
    dian: ['颠', '田', '点', '电'], tian: ['天', '田', '忝', '掭'], nian: ['拈', '年', '撵', '念'],
    lian: ['连', '连', '脸', '练'],
    biao: ['标', '膘', '表', '鳔'], piao: ['飘', '瓢', '瞟', '票'], miao: ['喵', '苗', '秒', '庙'],
    diao: ['刁', '蜩', '屌', '吊'], tiao: ['挑', '条', '挑', '跳'], niao: ['鸟', '鸟', '鸟', '尿'],
    liao: ['撩', '聊', '了', '料'],
    bie: ['憋', '别', '瘪', '别'], pie: ['撇', '撇', '苤', '撇'], mie: ['咩', '灭', '灭', '灭'],
    bin: ['宾', '斌', '鬓', '殡'], pin: ['拼', '贫', '品', '聘'], min: ['民', '民', '敏', '民'],
    bing: ['冰', '邴', '丙', '病'], ping: ['乒', '平', '摒', '娉'], ming: ['明', '明', '酩', '命'],
    ding: ['丁', '丁', '顶', '定'], ting: ['听', '亭', '挺', '听'], ning: ['宁', '宁', '拧', '宁'],
    ling: ['令', '灵', '领', '令'],
    bo: ['波', '博', '簸', '薄'], po: ['坡', '婆', '叵', '破'], mo: ['摸', '模', '抹', '墨'],
    me: ['么', '么', '么', '么'],
    bu: ['逋', '醭', '补', '不'], pu: ['扑', '仆', '普', '铺'], mu: ['母', '模', '母', '木'],
    fu: ['夫', '扶', '府', '父'], du: ['都', '读', '堵', '度'], tu: ['突', '图', '土', '兔'],
    nu: ['奴', '奴', '努', '怒'], lu: ['撸', '卢', '鲁', '路'],
    cha: ['插', '查', '衩', '岔'], chai: ['拆', '柴', '茝', '虿'], chan: ['搀', '馋', '产', '颤'],
    chang: ['昌', '长', '场', '唱'], chao: ['抄', '朝', '吵', '耖'], che: ['车', '车', '扯', '彻'],
    chen: ['抻', '沉', '碜', '衬'], cheng: ['称', '成', '逞', '秤'], chi: ['吃', '迟', '尺', '翅'],
    chong: ['充', '虫', '宠', '冲'], chou: ['抽', '愁', '丑', '臭'], chu: ['出', '除', '楚', '处'],
    chuan: ['穿', '船', '喘', '串'], chuang: ['窗', '床', '闯', '创'], chui: ['吹', '垂', '锤', '锤'],
    chun: ['春', '纯', '蠢', '蠢'], chuo: ['戳', '戳', '绰', '辍'],
    sha: ['杀', '啥', '傻', '厦'], shai: ['筛', '筛', '色', '晒'], shan: ['山', '姗', '闪', '扇'],
    shang: ['伤', '尝', '赏', '上'], shao: ['烧', '勺', '少', '哨'], she: ['奢', '蛇', '舍', '设'],
    shen: ['身', '神', '审', '甚'], sheng: ['生', '绳', '省', '胜'], shi: ['湿', '时', '史', '是'],
    shou: ['收', '熟', '手', '受'], shu: ['书', '熟', '暑', '树'], shua: ['刷', '刷', '耍', '刷'],
    shuai: ['衰', '帅', '甩', '帅'], shuan: ['栓', '栓', '涮', '栓'], shuang: ['双', '双', '爽', '双'],
    shui: ['谁', '水', '水', '睡'], shun: ['顺', '顺', '吮', '顺'], shuo: ['说', '说', '朔', '硕'],
    za: ['杂', '咱', '咋', '炸'], zai: ['灾', '栽', '宰', '在'], zan: ['簪', '咱', '攒', '赞'],
    zang: ['脏', '藏', '驵', '葬'], zao: ['遭', '凿', '早', '造'], ze: ['责', '泽', '咋', '仄'],
    zen: ['怎', '怎', '怎', '怎'], zeng: ['增', '曾', '甑', '赠'], zi: ['资', '兹', '子', '字'],
    zong: ['宗', '鬃', '总', '纵'], zou: ['邹', '走', '走', '奏'], zu: ['租', '卒', '祖', '助'],
    zuan: ['钻', '钻', '纂', '钻'], zui: ['咀', '罪', '嘴', '最'], zun: ['尊', '尊', '撙', '尊'],
    zuo: ['作', '琢', '左', '做'],
    ca: ['擦', '擦', '礤', '擦'], cai: ['猜', '才', '采', '菜'], can: ['餐', '蚕', '惨', '灿'],
    cao: ['操', '曹', '草', '糙'], ce: ['测', '册', '册', '册'], ci: ['疵', '词', '此', '次'],
    cong: ['匆', '从', '璁', '悰'], cou: ['凑', '凑', '凑', '凑'], cu: ['粗', '粗', '簇', '醋'],
    cuan: ['蹿', '攒', '窜', '窜'], cui: ['催', '摧', '璀', '脆'], cun: ['村', '存', '忖', '寸'],
    cuo: ['撮', '措', '脞', '错'],
    sa: ['撒', '洒', '撒', '萨'], sai: ['塞', '赛', '塞', '赛'], san: ['三', '伞', '散', '散'],
    sang: ['桑', '嗓', '嗓', '丧'], sao: ['骚', '扫', '扫', '臊'], se: ['色', '色', '色', '色'],
    sen: ['森', '森', '森', '森'], seng: ['僧', '僧', '僧', '僧'], si: ['私', '祀', '死', '四'],
    song: ['松', '宋', '耸', '送'], sou: ['搜', '嗽', '叟', '嗽'], su: ['苏', '俗', '俗', '素'],
    suan: ['酸', '算', '算', '算'], sui: ['虽', '随', '髓', '岁'], sun: ['孙', '笋', '笋', '损'],
    suo: ['缩', '索', '所', '锁'],
    ya: ['呀', '牙', '雅', '亚'], yan: ['烟', '颜', '眼', '艳'], yang: ['央', '羊', '养', '样'],
    yao: ['要', '摇', '咬', '要'], ye: ['耶', '爷', '也', '业'], yi: ['一', '移', '已', '义'],
    yin: ['音', '银', '引', '印'], ying: ['应', '迎', '影', '硬'], yo: ['哟', '哟', '哟', '哟'],
    yong: ['拥', '庸', '勇', '用'], you: ['优', '游', '友', '右'], yu: ['迂', '鱼', '雨', '玉'],
    yuan: ['冤', '园', '远', '院'], yue: ['约', '月', '月', '越'], yun: ['晕', '云', '允', '运'],
    wa: ['哇', '娃', '瓦', '袜'], wai: ['歪', '歪', '崴', '外'], wan: ['弯', '完', '晚', '万'],
    wang: ['汪', '王', '往', '忘'], wei: ['危', '为', '伟', '卫'], wen: ['温', '文', '稳', '问'],
    weng: ['翁', '翁', '蓊', '瓮'], wo: ['窝', '蜗', '我', '卧'], wu: ['屋', '吴', '五', '物'],
    ji: ['机', '集', '几', '记'], jia: ['家', '夹', '假', '价'], jian: ['间', '尖', '减', '件'],
    jiang: ['江', '强', '讲', '匠'], jiao: ['交', '嚼', '搅', '叫'], jie: ['接', '节', '姐', '介'],
    jin: ['今', '金', '紧', '进'], jing: ['京', '睛', '景', '敬'], jiong: ['扃', '炯', '窘', '窘'],
    jiu: ['究', '究', '九', '就'], ju: ['居', '局', '举', '句'], juan: ['涓', '卷', '卷', '倦'],
    jue: ['撅', '决', '蹶', '倔'], jun: ['军', '菌', '俊', '俊'],
    qi: ['七', '齐', '起', '气'], qia: ['掐', '拤', '卡', '洽'], qian: ['千', '前', '浅', '欠'],
    qiang: ['枪', '强', '抢', '呛'], qiao: ['敲', '桥', '巧', '窍'], qie: ['切', '茄', '且', '怯'],
    qin: ['亲', '琴', '寝', '沁'], qing: ['青', '情', '请', '庆'], qiong: ['穷', '穷', '穷', '穷'],
    qiu: ['秋', '球', '糗', '遒'], qu: ['区', '渠', '取', '去'], quan: ['圈', '全', '犬', '劝'],
    que: ['缺', '瘸', '怯', '确'], qun: ['裙', '裙', '裙', '群'],
    xi: ['西', '习', '喜', '系'], xia: ['虾', '峡', '下', '夏'], xian: ['先', '闲', '显', '线'],
    xiang: ['香', '祥', '想', '向'], xiao: ['消', '淆', '小', '笑'], xie: ['些', '鞋', '写', '谢'],
    xin: ['心', '信', '衅', '信'], xing: ['星', '行', '醒', '幸'], xiong: ['凶', '雄', '兄', '熊'],
    xiu: ['休', '岫', '朽', '袖'], xu: ['须', '徐', '许', '序'], xuan: ['宣', '旋', '选', '眩'],
    xue: ['靴', '学', '雪', '血'], xun: ['勋', '寻', '训', '训'],
    gu: ['姑', '骨', '古', '故'], gua: ['瓜', '刮', '寡', '挂'], guai: ['乖', '怪', '拐', '怪'],
    guan: ['关', '莞', '管', '惯'], guang: ['光', '广', '广', '逛'], gui: ['规', '瑰', '鬼', '贵'],
    gun: ['滚', '滚', '棍', '棍'], guo: ['锅', '国', '果', '过'],
    kua: ['夸', '垮', '跨', '跨'], kuai: ['快', '快', '蒯', '快'], kuan: ['宽', '款', '款', '款'],
    kuang: ['狂', '狂', '矿', '况'], kui: ['亏', '魁', '傀', '愧'], kun: ['昆', '捆', '困', '困'],
    kuo: ['阔', '阔', '阔', '阔'],
    hua: ['花', '华', '画', '化'], huai: ['怀', '怀', '坏', '坏'], huan: ['欢', '还', '缓', '换'],
    huang: ['黄', '黄', '恍', '晃'], hui: ['灰', '回', '悔', '会'], hun: ['昏', '魂', '混', '混'],
    huo: ['活', '火', '祸', '或'],
    duan: ['端', '段', '短', '段'], dui: ['堆', '堆', '对', '对'], dun: ['墩', '顿', '趸', '顿'],
    duo: ['多', '夺', '朵', '堕'], tuan: ['团', '团', '团', '团'], tui: ['推', '颓', '腿', '退'],
    tun: ['吞', '屯', '囤', '褪'], tuo: ['拖', '陀', '妥', '唾'],
    nuan: ['暖', '暖', '暖', '暖'], nuo: ['挪', '挪', '懦', '糯'], luan: ['乱', '乱', '乱', '乱'],
    lun: ['轮', '轮', '论', '论'], luo: ['啰', '罗', '裸', '落'],
    lue: ['略', '略', '略', '略'], nue: ['虐', '虐', '虐', '虐'],
    hao: ['蒿', '豪', '好', '号'], zhang: ['张', '丈', '掌', '丈'], zhao: ['招', '着', '找', '照'],
    zhou: ['州', '轴', '肘', '宙'], zhen: ['针', '诊', '枕', '阵'], zheng: ['正', '征', '整', '正'],
    zhu: ['朱', '竹', '主', '住'], zhuo: ['卓', '浊', '琢', '桌'],
    kai: ['开', '凯', '凯', '盖'], kao: ['考', '考', '烤', '靠'], kan: ['看', '堪', '砍', '看'],
    ken: ['肯', '肯', '啃', '肯'], keng: ['坑', '坑', '坑', '坑'], kou: ['抠', '口', '口', '扣'],
    hou: ['侯', '猴', '吼', '后'], hen: ['痕', '很', '狠', '恨'], hang: ['航', '航', '恍', '巷'],
    heng: ['横', '横', '哼', '横'], gai: ['该', '盖', '改', '盖'], gou: ['沟', '狗', '狗', '够'],
    gan: ['干', '甘', '赶', '干'], gen: ['根', '跟', '艮', '根'], geng: ['更', '耕', '梗', '更'],
    beng: ['崩', '甭', '绷', '蹦'], peng: ['怦', '蓬', '捧', '碰'], meng: ['蒙', '萌', '猛', '梦'],
    feng: ['风', '逢', '讽', '凤'], deng: ['灯', '邓', '等', '凳'], teng: ['疼', '疼', '疼', '疼'],
    neng: ['能', '能', '能', '能'], leng: ['棱', '冷', '冷', '愣'], gong: ['工', '拱', '巩', '共'],
    kong: ['空', '恐', '孔', '控'], hong: ['轰', '红', '哄', '哄'], long: ['龙', '龙', '拢', '弄'],
    pi: ['批', '皮', '匹', '屁'], mi: ['眯', '迷', '米', '密'], di: ['低', '敌', '底', '地'],
    ti: ['梯', '提', '体', '替'], ni: ['妮', '泥', '你', '腻'], li: ['离', '梨', '李', '力'],
    dia: ['嗲', '嗲', '嗲', '嗲'], bia: ['逼', '比', '比', '避'],
    /* —— 以下补齐所有合法组合（缺项曾导致朗读回退读拉丁拼音，音质不可靠）——
     * 某声调无常用单字时留空串，由 anyToneChar() 借用同音节其他声调的字顶上 */
    zha: ['扎', '扎', '眨', '炸'], zhe: ['遮', '折', '者', '这'], zhi: ['织', '直', '只', '志'],
    zhai: ['摘', '宅', '窄', '债'], zhui: ['追', '', '', '坠'], zhan: ['沾', '', '展', '站'],
    zhun: ['谆', '', '准', ''], zhong: ['中', '', '种', '重'],
    bi: ['逼', '鼻', '比', '必'], ben: ['奔', '', '', '笨'], pen: ['喷', '', '', '喷'],
    mei: ['没', '没', '美', '妹'], mou: ['', '某', '', ''], miu: ['', '', '', '谬'],
    men: ['闷', '门', '', '闷'],
    fo: ['佛', '佛', '佛', '佛'], fei: ['飞', '肥', '匪', '废'], fan: ['翻', '烦', '反', '饭'],
    fen: ['分', '坟', '粉', '份'], fang: ['方', '房', '仿', '放'],
    de: ['', '得', '', ''], dei: ['', '', '得', ''], dou: ['都', '', '抖', '豆'],
    diu: ['丢', '', '', ''], die: ['跌', '蝶', '', ''], den: ['', '', '', '扽'], dong: ['东', '', '懂', '动'],
    tou: ['偷', '头', '', '透'], tie: ['贴', '', '铁', '帖'], tong: ['通', '同', '统', '痛'],
    ne: ['呢', '', '', ''], nei: ['', '内', '', ''], nou: ['', '', '', '耨'],
    niu: ['妞', '牛', '扭', '拗'], nie: ['捏', '苶', '', '聂'], nen: ['', '', '', '嫩'],
    nin: ['', '您', '', ''], nang: ['囔', '囊', '', ''], nong: ['', '农', '', '弄'],
    le: ['', '', '', '了'], lei: ['勒', '雷', '累', '泪'], lou: ['搂', '楼', '', '漏'],
    liu: ['溜', '流', '六', ''], lie: ['', '', '咧', '列'], lin: ['', '林', '', '赁'],
    ge: ['哥', '格', '', '个'], gei: ['', '', '', '给'], gao: ['高', '', '搞', '告'],
    gang: ['刚', '', '岗', '杠'],
    ke: ['科', '', '可', '刻'], ku: ['哭', '', '苦', '库'], kang: ['康', '', '扛', '炕'],
    he: ['喝', '和', '', '贺'], hu: ['呼', '', '虎', '户'], hai: ['咳', '还', '海', '害'],
    hei: ['黑', '', '', ''], han: ['憨', '寒', '喊', '汉'],
    re: ['', '', '', '热'], ri: ['', '', '', '日'], ru: ['', '', '', '入'], rui: ['', '', '', '锐'],
    rao: ['', '饶', '', '绕'], rou: ['', '柔', '', '肉'], ran: ['', '然', '染', ''],
    ren: ['', '人', '', '任'], run: ['', '', '', '闰'], rang: ['', '瓤', '', '让'],
    reng: ['扔', '', '', ''], rong: ['', '荣', '', '容'],
    cen: ['', '', '', '岑'], cang: ['', '藏', '', ''], ceng: ['', '曾', '', '']
  };

  /* 返回某音节在指定声调下的示范汉字；无则返回空串 */
  function toneChar(base, tone) {
    var arr = SYLL_TONE[base];
    if (arr && arr[tone - 1]) return arr[tone - 1];
    return '';
  }

  /* 返回某音节任一非空声调的示范汉字（该声调无常用单字时借用）。
   * 目的：保证拼读朗读永远是汉字（中文 TTS 读汉字才稳），绝不回退读拉丁拼音。 */
  function anyToneChar(base) {
    var arr = SYLL_TONE[base];
    if (arr) for (var i = 0; i < arr.length; i++) if (arr[i]) return arr[i];
    return '';
  }

  /* 普通话声韵拼合规则：某声母能否与某韵母相拼（声韵配合规律）。
   * 教学准确性：x+a、b+ong、g+iu、sh+ong、y+u 这类普通话里不存在的音节，
   * 在拼读页必须判错并禁止朗读，不能显示成一个假的拼音。
   * 覆盖拼读器可选的 24 个韵母；已与 SYLL 示范字表全量交叉验证（SYLL 收录的音节全部判合法）。 */
  var SPELL_RULES = {
    b:  'a o i u ai ao ie an en in ang eng ing',
    p:  'a o i u ai ao ie an en in ang eng ing',
    m:  'a o e i u ai ei ao ou iu ie an en in ang eng ing',
    f:  'a o u ei an en ang eng',
    d:  'a e i u ai ei ui ao ou iu ie an en un ang eng ing ong',
    t:  'a i u ai ui ao ou ie an un ang eng ing ong',
    n:  'a e i u v ai ei ao ou iu ie ve an en in ang eng ing ong',
    l:  'a e i u v ai ei ao ou iu ie ve an in un ang eng ing ong',
    g:  'a e u ai ei ui ao ou an en un ang eng ong',
    k:  'a e u ai ui ao ou an en un ang eng ong',
    h:  'a e u ai ei ui ao ou an en un ang eng ong',
    j:  'i v iu ie ve in vn ing',
    q:  'i v iu ie ve in vn ing',
    x:  'i v iu ie ve in vn ing',
    zh: 'a e i u ai ui ao ou an en un ang eng ong',
    ch: 'a e i u ai ui ao ou an en un ang eng ong',
    sh: 'a e i u ai ui ao ou an en un ang eng',
    r:  'e i u ui ao ou an en un ang eng ong',
    z:  'a e i u ai ui ao ou an en un ang eng ong',
    c:  'a e i u ai ui ao ou an en un ang eng ong',
    s:  'a e i u ai ui ao ou an en un ang eng ong',
    y:  'a o e i v ao ou iu ve an in vn ang ing ong',
    w:  'a o u ai ui an en un ang eng'
  };

  /* 判断声母+韵母能否相拼。
   * iniPy 为空串 = 零声母（单韵母）：普通话中只有 ong 不能单独成音节（必须前拼声母）。 */
  function canSpell(iniPy, finPy) {
    if (!iniPy) return finPy !== 'ong';
    var rule = SPELL_RULES[iniPy];
    if (!rule) return true;   /* 未收录的声母不拦截（理论上不存在） */
    return (' ' + rule + ' ').indexOf(' ' + finPy + ' ') >= 0;
  }

  /* 拼写规范化：按《汉语拼音方案》的省写/改写规则，把「声母+韵母」拼成规范音节，
   * 保证调号标在正确字母上。规则：
   *  - j/q/x/y 后的 ü 写作 u（不带点）：j+v→ju、j+vn→jun、j+ve→jue、y+v→yu…
   *  - y+iu→you、w+ui→wei、w+un→wen（iou/uei/uen 的零声母/半元音形式，调号在 o/e）
   *  - 零声母时 i/u/ü 行改写：i→yi、u→wu、v→yu、ie→ye、ve→yue、iu→you、
   *    ui→wei、un→wen、in→yin、ing→ying、vn→yun
   * 返回规范拼写（无声调）。 */
  function normSyll(iniPy, finPy) {
    if (!iniPy) {
      var zero = { i: 'yi', u: 'wu', v: 'yu', ie: 'ye', ve: 'yue', iu: 'you', ui: 'wei', un: 'wen', in: 'yin', ing: 'ying', vn: 'yun' };
      return zero[finPy] || finPy;
    }
    if (iniPy === 'y' || iniPy === 'j' || iniPy === 'q' || iniPy === 'x') {
      var f = finPy === 'v' ? 'u' : (finPy === 'vn' ? 'un' : (finPy === 've' ? 'ue' : finPy));
      if (iniPy === 'y' && finPy === 'iu') f = 'ou';   /* y+iu → you */
      return iniPy + f;
    }
    var base = iniPy + finPy;
    if (base === 'wui') return 'wei';   /* w+ui → wei（调号在 e） */
    if (base === 'wun') return 'wen';   /* w+un → wen（调号在 e） */
    return base;
  }

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
    else if (base.indexOf('v') >= 0 && base.indexOf('e') >= 0) { key = 'e'; idx = base.indexOf('e'); }
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
    SYLL_TONE: SYLL_TONE,
    toneChar: toneChar,
    anyToneChar: anyToneChar,
    canSpell: canSpell,
    normSyll: normSyll,
    markTone: markTone,
    displayPy: displayPy
  };

  global.PY = DATA;
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
})(typeof window !== 'undefined' ? window : this);
