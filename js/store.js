/**
 * store.js - 数据存储层
 * 管理文章、标签、APP 文件数据
 * 使用 localStorage（元数据）+ IndexedDB（文件 Blob）持久化，内置示例数据
 */

const Store = (function () {
  const STORAGE_KEYS = {
    articles: 'blog_articles',
    apps: 'blog_apps',
    theme: 'blog_theme',
    downloadCounts: 'blog_download_counts',
    homeTools: 'blog_home_tools',
  };

  const MAX_HOME_TOOLS = 24; // 主页最多展示 24 个在线工具窗口（4 页，每页 6 格）

  // ============================================
  // 示例文章数据
  // ============================================
  const sampleArticles = (typeof SAMPLE_ARTICLES !== 'undefined' ? SAMPLE_ARTICLES : []);

  // ============================================
  // 示例 APP 数据
  // ============================================
  const sampleApps = [
    {
      id: 'app-001',
      name: 'Snipaste',
      description: '截图 + 贴图神器，支持标注、取色、马赛克，办公必备。',
      version: '2.8.2',
      size: '12.5 MB',
      platform: 'Windows',
      category: '截图工具',
      icon: '📸',
      uploadDate: '2026-07-05',
      hasFile: false, // 示例数据无实际文件
    },
    {
      id: 'app-002',
      name: 'Everything',
      description: '最快的文件搜索工具，秒搜全盘文件，告别慢速搜索。',
      version: '1.4.1',
      size: '3.2 MB',
      platform: 'Windows',
      category: '文件管理',
      icon: '🔍',
      uploadDate: '2026-07-03',
      fileData: null,
    },
    {
      id: 'app-003',
      name: 'Typora',
      description: '所见即所得的 Markdown 编辑器，沉浸式写作体验。',
      version: '1.9.3',
      size: '85.6 MB',
      platform: '全平台',
      category: '文档写作',
      icon: '📝',
      uploadDate: '2026-07-01',
      fileData: null,
    },
  ];

  // ============================================
  // 工具函数
  // ============================================
  function getJSON(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      console.error('读取存储失败:', key, e);
      return fallback;
    }
  }

  function setJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('写入存储失败:', key, e);
      // 可能是 localStorage 满了
      if (e.name === 'QuotaExceededError') {
        alert('存储空间已满，请删除一些旧文件后再试。');
      }
      return false;
    }
  }

  function generateId(prefix) {
    return (prefix || 'id') + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
  }

  // ============================================
  // IndexedDB 文件存储（支持大文件）
  // ============================================
  const DB_NAME = 'BlogDB';
  const DB_VERSION = 1;
  const FILE_STORE = 'appFiles';
  let dbInstance = null;

  function openDB() {
    return new Promise((resolve, reject) => {
      if (dbInstance) {
        resolve(dbInstance);
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        dbInstance = request.result;
        resolve(dbInstance);
      };
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(FILE_STORE)) {
          db.createObjectStore(FILE_STORE, { keyPath: 'id' });
        }
      };
    });
  }

  function saveAppFile(id, blob, fileName, fileType) {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(FILE_STORE, 'readwrite');
        const store = tx.objectStore(FILE_STORE);
        const record = { id, blob, fileName, fileType, size: blob.size };
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  function getAppFile(id) {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(FILE_STORE, 'readonly');
        const store = tx.objectStore(FILE_STORE);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    });
  }

  function deleteAppFile(id) {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(FILE_STORE, 'readwrite');
        const store = tx.objectStore(FILE_STORE);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  // ============================================
  // 官方应用目录（随站发布的静态文件，所有访客共享，0 成本上线必需）
  // ============================================
  let officialApps = [];
  let _readyResolvers = [];
  let _readyDone = false;

  function _markReady() {
    _readyDone = true;
    _readyResolvers.forEach((r) => r());
    _readyResolvers = [];
  }

  // 供 UI 在首屏渲染前等待官方目录加载完成
  function ready() {
    return new Promise((res) => {
      if (_readyDone) res();
      else _readyResolvers.push(res);
    });
  }

  function loadOfficialApps() {
    // 优先读边缘函数（KV，支持管理员实时写回）；失败或为空则回退到随站打包的官方目录
    fetch('/api/apps', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((arr) => {
        if (Array.isArray(arr) && arr.length) { officialApps = arr; return; }
        throw new Error('empty');
      })
      .catch(() => {
        return fetch('data/official-apps.json')
          .then((r) => (r.ok ? r.json() : []))
          .then((arr) => { officialApps = Array.isArray(arr) ? arr : []; })
          .catch(() => { officialApps = []; });
      })
      .then(() => { migrateLegacyApps(); _markReady(); });
  }

  // 管理员通过后台「添加应用」写回官方目录（边缘函数 -> KV），对所有人实时可见
  async function addOfficialApp(appData) {
    const key = (typeof localStorage !== 'undefined') ? (localStorage.getItem('adminKey') || '') : '';
    const res = await fetch('/api/apps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
      body: JSON.stringify(appData || {}),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error((msg || '发布失败') + ' (' + res.status + ')');
    }
    const result = await res.json();
    if (result && result.app) officialApps.unshift(result.app);
    return result;
  }

  // 管理员通过后台「删除应用」从官方目录移除（边缘函数 -> KV），对所有人实时可见
  async function deleteOfficialApp(id) {
    const key = (typeof localStorage !== 'undefined') ? (localStorage.getItem('adminKey') || '') : '';
    const res = await fetch('/api/apps', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error((msg || '删除失败') + ' (' + res.status + ')');
    }
    officialApps = officialApps.filter((a) => a.id !== id);
    return res.json();
  }

  // 旧版曾把内置示例写进 localStorage（个人层），这里移除与官方目录重复的示例，避免重复展示
  function migrateLegacyApps() {
    if (!officialApps.length) return;
    const migKey = 'blog_apps_migrated_v1';
    if (localStorage.getItem(migKey)) return;
    const personal = getJSON(STORAGE_KEYS.apps, []);
    const officialIds = new Set(officialApps.map((a) => a.id));
    const cleaned = personal.filter((a) => a && a.id && !officialIds.has(a.id));
    if (cleaned.length !== personal.length) setJSON(STORAGE_KEYS.apps, cleaned);
    try { localStorage.setItem(migKey, '1'); } catch (e) {}
  }

  // ============================================
  // 初始化数据
  // ============================================
  function init() {
    // 初始化文章（带种子版本；升级时按 id 合并：新增/覆盖内置文章，保留用户自建文章）
    const ARTICLE_SEED_VER = 'v20260904-txtsm';
    if (localStorage.getItem('blog_articles_seed_ver') !== ARTICLE_SEED_VER) {
      // 以 id 为键合并：仅「补全缺失」的内置文章，绝不覆盖已存储（可能被管理员改过日期/内容）的文章，
      // 用户在界面自建的文章（id 不在内置清单内）予以保留，避免被清掉。
      const existing = getArticles();
      const byId = new Map();
      existing.forEach((a) => byId.set(a.id, a));
      sampleArticles.forEach((s) => { if (!byId.has(s.id)) byId.set(s.id, s); });
      const merged = Array.from(byId.values());
      setJSON(STORAGE_KEYS.articles, merged);
      try { localStorage.setItem('blog_articles_seed_ver', ARTICLE_SEED_VER); } catch (e) {}
    }

    // 初始化 APP：官方目录从随站发布的 data/official-apps.json 异步加载（完成后通过 ready() 通知 UI）
    loadOfficialApps();

    // 初始化首页小工具（确保内置工具齐全，并保留用户上传）
    seedHomeTools();
  }

  // ============================================
  // 文章操作
  // ============================================
  function getArticles() {
    return getJSON(STORAGE_KEYS.articles, sampleArticles);
  }

  function getArticle(id) {
    return getArticles().find((a) => a.id === id) || null;
  }

  function saveArticle(article) {
    const articles = getArticles();
    if (article.id) {
      const index = articles.findIndex((a) => a.id === article.id);
      if (index !== -1) {
        articles[index] = { ...articles[index], ...article };
      } else {
        articles.unshift(article);
      }
    } else {
      article.id = generateId('article');
      articles.unshift(article);
    }
    setJSON(STORAGE_KEYS.articles, articles);
    return article;
  }

  function deleteArticle(id) {
    const articles = getArticles().filter((a) => a.id !== id);
    setJSON(STORAGE_KEYS.articles, articles);
  }

  function searchArticles(keyword) {
    if (!keyword) return getArticles();
    const lower = keyword.toLowerCase();
    return getArticles().filter(
      (a) =>
        a.title.toLowerCase().includes(lower) ||
        a.excerpt.toLowerCase().includes(lower) ||
        a.tags.some((t) => t.toLowerCase().includes(lower))
    );
  }

  function getArticlesByTag(tag) {
    if (!tag || tag === '全部') return getArticles();
    return getArticles().filter((a) => a.tags.includes(tag));
  }

  function getAllTags() {
    const tagCount = {};
    getArticles().forEach((a) => {
      a.tags.forEach((t) => {
        tagCount[t] = (tagCount[t] || 0) + 1;
      });
    });
    return Object.entries(tagCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  function getAdjacentArticles(id) {
    const articles = getArticles();
    const index = articles.findIndex((a) => a.id === id);
    return {
      prev: index > 0 ? articles[index - 1] : null,
      next: index < articles.length - 1 ? articles[index + 1] : null,
    };
  }

  function getStats() {
    const articles = getArticles();
    const tags = getAllTags();
    const apps = getApps();
    return {
      articles: articles.length,
      tags: tags.length,
      apps: apps.length,
    };
  }

  // ============================================
  // APP 操作
  // ============================================
  // 个人层：仅存用户在本机新增/修改的应用（localStorage）
  function getPersonalApps() {
    return getJSON(STORAGE_KEYS.apps, []);
  }

  // 合并层：官方目录（data/official-apps.json，所有人共享）叠加个人层
  function getApps() {
    const personal = getPersonalApps();
    if (officialApps.length === 0 && personal.length === 0) return sampleApps;
    const map = new Map();
    officialApps.forEach((a) => map.set(a.id, a));
    personal.forEach((a) => { if (a && a.id) map.set(a.id, a); });
    return Array.from(map.values());
  }

  function getApp(id) {
    return getApps().find((a) => a.id === id) || null;
  }

  function saveApp(app) {
    const personal = getPersonalApps();
    if (app.id) {
      const index = personal.findIndex((a) => a.id === app.id);
      if (index !== -1) {
        personal[index] = { ...personal[index], ...app };
      } else {
        personal.unshift(app);
      }
    } else {
      app.id = generateId('app');
      personal.unshift(app);
    }
    setJSON(STORAGE_KEYS.apps, personal);
    return app;
  }

  function deleteApp(id) {
    const personal = getPersonalApps().filter((a) => a.id !== id);
    setJSON(STORAGE_KEYS.apps, personal);
  }

  function getAppCategories() {
    const cats = new Set();
    getApps().forEach((a) => cats.add(a.category));
    return Array.from(cats);
  }

  // ============================================
  // 首页 HTML 小工具
  // ============================================
  function getHomeTools() {
    return getJSON(STORAGE_KEYS.homeTools, []) || [];
  }

  function saveHomeTool(tool) {
    const tools = getHomeTools();
    tools.push(tool);
    setJSON(STORAGE_KEYS.homeTools, tools);
    return tool;
  }

  function deleteHomeTool(id) {
    const tools = getHomeTools().filter((t) => t.id !== id);
    setJSON(STORAGE_KEYS.homeTools, tools);
  }

  // 更新某个小工具的字段（名称/图标/使用说明等），内置或用户上传均可
  function updateHomeTool(id, patch) {
    const tools = getHomeTools();
    const idx = tools.findIndex((t) => t.id === id);
    if (idx !== -1) {
      tools[idx] = { ...tools[idx], ...patch };
      setJSON(STORAGE_KEYS.homeTools, tools);
      return tools[idx];
    }
    return null;
  }

  // 调整小工具顺序：dir = -1 上移 / 1 下移，成功返回新索引，失败返回 null
  function moveHomeTool(id, dir) {
    const tools = getHomeTools();
    const idx = tools.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    const next = idx + dir;
    if (next < 0 || next >= tools.length) return null;
    const tmp = tools[idx];
    tools[idx] = tools[next];
    tools[next] = tmp;
    setJSON(STORAGE_KEYS.homeTools, tools);
    return next;
  }

  // 首次访问时预置两个内置工具（PKG 随机字符串生成器、书法字体生成器）
  function seedHomeTools() {
    // 内置工具清单（按 id 固定）。新增内置工具时在此追加即可。
    const BUILTIN_TOOLS = [
      {
        id: 'tool_pkg',
        name: 'PKG箱号随机生成器',
        icon: '📦',
        description: '生成有规律/无规律的箱号、随机字符串，支持复制与防重复',
        builtin: true,
        src: 'tools/pkg-string-generator.html',
      },
      {
        id: 'tool_cal',
        name: '书法字体生成器',
        icon: '🖌️',
        description: '输入汉字生成王羲之风格行书/楷书/草书，可导出 PNG（每次最多 100 字）',
        builtin: true,
        src: 'tools/calligraphy-generator.html',
        cover: 'tools/assets/calligraphy-cover.png',
      },
      {
        id: 'tool_qr',
        name: '二维码在线生成器',
        icon: '🔳',
        description: '批量表格打码（XLS/XLSX/CSV 每格右侧生成二维码）或单条生成二维码/一维码并下载 PNG',
        builtin: true,
        src: 'tools/qr-generator.html',
      },
      {
        id: 'tool_pdf',
        name: 'PDF拆分合并与签名',
        icon: '📄',
        description: 'PDF 拆分（每页 / 指定页码范围）、多个 PDF 合并，并支持用笔手写签名嵌入',
        builtin: true,
        src: 'tools/pdf-tool.html',
      },
      {
        id: 'tool_format',
        name: '表格格式整理工具',
        icon: '📊',
        description: '离线整理 xlsx / xls / csv：时间列拆分、多姓名拆分、合并单元格拆分、清理特殊字符并导出',
        builtin: true,
        src: 'tools/index.html',
      },
      {
        id: 'tool_gif',
        name: '动图制作',
        icon: '🎞️',
        description: '上传视频转为 GIF 动图，可选帧率、像素尺寸与起始时间',
        builtin: true,
        src: 'tools/gif-maker.html',
      },
      {
        id: 'tool_upscale',
        name: '图片放大器',
        icon: '🔍',
        description: '智能放大图片：兰佐斯重采样 + 临近像素智能混合，放大后不模糊、补全细节',
        builtin: true,
        src: 'tools/image-upscaler.html',
      },
      {
        id: 'tool_zodiac',
        name: '星座查询',
        icon: '✨',
        description: '农历生日查星座、天干地支五行、生肖象性',
        builtin: true,
        src: 'tools/星座查询.html',
      },
      {
        id: 'tool_pyfmt',
        name: 'Python 代码格式修正',
        icon: '🐍',
        description: '检测 Python 代码语法/格式错误并自动修正，支持 4/2 空格或 Tab，可下载 TXT',
        builtin: true,
        src: 'tools/python-formatter.html',
      },
      {
        id: 'tool_fortune',
        name: '运势预测（塔罗）',
        icon: '🔮',
        description: '输入星座与出生年月日，说出想测的事，塔罗牌为你揭示明日运势',
        builtin: true,
        src: 'tools/fortune-teller.html',
      },
      {
        id: 'tool_pycmd',
        name: 'Python 常用函数合集',
        icon: '📖',
        description: '常用 Python 函数速查：77 个常用函数，每条带中文说明与语法示例，输入中文关键字即可带出相关函数',
        builtin: true,
        src: 'tools/python-commands.html',
      },
      {
        id: 'tool_ratecalc',
        name: '存贷款利率计算器',
        icon: '💰',
        description: '输入存/贷款方式与期数、银行利率，算出每月利息收入或每月应还金额（等额本息/等额本金）',
        builtin: true,
        src: 'tools/rate-calculator.html',
      },
      {
        id: 'tool_typo',
        name: '标点符号修改器',
        icon: '📝',
        description: '自动规范中文标点：文本可直接复制，文档支持 TXT / Excel / Word 导入并生成修正文件',
        builtin: true,
        src: 'tools/typo-fixer.html',
      },
      {
        id: 'tool_excelsplit',
        name: '一键拆合Excel',
        icon: '🗂️',
        description: '按某一列的不同内容一键拆成多个 Sheet（可选打包成多个文件的 ZIP），或把多个 Sheet / 文件合并回一张总表，支持按表头智能对齐',
        builtin: true,
        src: 'tools/excel-split-merge.html',
      },
      {
        id: 'tool_exceltoc',
        name: '一键添加目录页',
        icon: '📑',
        description: '在所有工作表最前面插入一页可点击跳转的目录：有表头取表头为名称、无表头用 Sheet 名，并在每个表头右上角加「返回目录」按钮',
        builtin: true,
        src: 'tools/excel-toc.html',
      },
      {
        id: 'tool_excelmulti',
        name: '多表格拆合',
        icon: '🗃️',
        description: '拖拽多个列格式相同的表格合并成一个多 Sheet 文件（可另附总表），或把一个多 Sheet 文件拆成多个独立表格打包下载',
        builtin: true,
        src: 'tools/excel-multisheet.html',
      },
      {
        id: 'tool_txtsm',
        name: '文本拆合',
        icon: '📜',
        description: '选一列按分隔符拆成多列（右侧插入），或勾选多列用分隔符合并成一列（可指定插入位置），纯本地处理',
        builtin: true,
        src: 'tools/text-split-merge.html',
      },
    ];

    // 每次初始化都确保内置工具存在（按 id upsert），同时保留用户上传的工具。
    function ensureHomeTools() {
      const existing = getHomeTools();
      const existingBuiltinIds = new Set(
        existing.filter((t) => t.builtin).map((t) => t.id)
      );
      const userTools = existing.filter((t) => !t.builtin);
      const merged = BUILTIN_TOOLS.slice();
      // 内置工具元数据以代码定义为准升级（修复名称/描述/图标变更后旧 localStorage 不刷新），
      // 同时保留用户可能额外追加的字段（如自定义标签）。
      BUILTIN_TOOLS.forEach((def, i) => {
        if (existingBuiltinIds.has(def.id)) {
          const old = existing.find((t) => t.id === def.id);
          merged[i] = Object.assign({}, old, def);
        }
      });
      const capped = merged.concat(userTools).slice(0, MAX_HOME_TOOLS);
      setJSON(STORAGE_KEYS.homeTools, capped);
    }

    ensureHomeTools();
  }

  // ============================================
  // 主题操作
  // ============================================
  function getTheme() {
    return localStorage.getItem(STORAGE_KEYS.theme) || 'light';
  }

  function setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  }

  // ============================================
  // 用户管理（已移除：账号仅存于本机 localStorage，无法跨设备保存，
  // 改为「管理员密钥」模式 —— 见 app.js 的 isAdmin() 与 adminKey）
  // ============================================

  // ============================================
  // 下载量统计
  // ============================================
  function incrementDownloadCount(appId) {
    const counts = getJSON(STORAGE_KEYS.downloadCounts, {});
    counts[appId] = (counts[appId] || 0) + 1;
    setJSON(STORAGE_KEYS.downloadCounts, counts);
  }

  function getDownloadCount(appId) {
    const counts = getJSON(STORAGE_KEYS.downloadCounts, {});
    return counts[appId] || 0;
  }

  function getAllDownloadCounts() {
    return getJSON(STORAGE_KEYS.downloadCounts, {});
  }

  // 初始化
  init();

  // ============================================
  // 导出公共 API
  // ============================================
  return {
    // 文章
    getArticles,
    getArticle,
    saveArticle,
    deleteArticle,
    searchArticles,
    getArticlesByTag,
    getAllTags,
    getAdjacentArticles,
    getStats,
    // APP
    getApps,
    getApp,
    saveApp,
    addOfficialApp,
    deleteOfficialApp,
    deleteApp,
    getAppCategories,
    ready,
    // 首页小工具
    getHomeTools,
    saveHomeTool,
    updateHomeTool,
    moveHomeTool,
    deleteHomeTool,
    MAX_HOME_TOOLS,
    // 主题
    getTheme,
    setTheme,
    // 下载量统计
    incrementDownloadCount,
    getDownloadCount,
    getAllDownloadCounts,
    // 工具
    generateId,
    // IndexedDB 文件存储
    saveAppFile,
    getAppFile,
    deleteAppFile,
  };
})();
