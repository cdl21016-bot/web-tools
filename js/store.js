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
    homeToolsOrder: 'blog_home_tools_order',
    // 本地顺序的"最后写入时间"（ISO），用于与云端 updatedAt 比新旧，决定谁覆盖谁
    homeToolsOrderTs: 'blog_home_tools_order_ts',
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

  // ============================================
  // 管理员期望的内置工具展示顺序（随站发布，所有访客共享）
  // 优先级：用户本地 homeToolsOrder > 此处的 remoteHomeToolsOrder > 代码 BUILTIN_TOOLS
  // ============================================
  let remoteHomeToolsOrder = null;        // null = 尚未加载完成或加载失败
  let _remoteOrderLoaded = false;         // 远端加载流程已结束（不论成败）
  let _remoteOrderResolvers = [];         // 等待远端加载完成的回调列表

  function _markRemoteOrderLoaded() {
    _remoteOrderLoaded = true;
    _remoteOrderResolvers.forEach((r) => r(Array.isArray(remoteHomeToolsOrder) ? remoteHomeToolsOrder : []));
    _remoteOrderResolvers = [];
  }

  // 供 UI 等待远端顺序加载完成：用户若已动手调过顺序，本地仍有优先权，本回调只是通知"远端已就绪"
  function whenRemoteOrderReady() {
    return new Promise((res) => {
      if (_remoteOrderLoaded) res(Array.isArray(remoteHomeToolsOrder) ? remoteHomeToolsOrder : []);
      else _remoteOrderResolvers.push(res);
    });
  }

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

  // 加载管理员期望的内置工具顺序（用于跨设备同步）。
  // 数据源优先级：① /api/home-tools-order（边缘 KV，管理员在线上改的顺序实时存这里）
  //               ② data/home-tools-order.json（随站打包的静态种子，KV 不可用时兜底）
  // 覆盖策略（按时间戳比新旧，不再区分管理员/访客）：
  //   - 云端 updatedAt > 本地 homeToolsOrderTs → 云端胜，覆盖本地（所有设备都跟随最新一次修改，
  //     包括管理员自己的多台电脑；老版本"管理员本地优先"会导致管理员的 B 机永远不同步）
  //   - 本地更新或云端无时间（静态种子）→ 保持本地
  //   - 本地从未记录时间（老数据）→ 视为极旧，直接跟随云端
  // 异步、失败静默回退。
  function loadRemoteHomeToolsOrder() {
    let cloudTsSeen = -1; // -1 = 连云端数据都没拿到；0 = 拿到但无可靠时间戳（静态种子）
    // 返回 true 表示本地被云端覆盖了
    const applyRemote = (order, updatedAt) => {
      cloudTsSeen = _tsOf(updatedAt);
      if (!order || !order.length) return false;
      if (typeof _ensureHomeTools !== 'function') return false; // seedHomeTools 未跑完，异常防御
      const localOrder = getJSON(STORAGE_KEYS.homeToolsOrder, null);
      if (localOrder && localOrder.join('\n') === order.join('\n')) {
        // 顺序一致：只把时间戳补齐，避免下次重复重排
        setJSON(STORAGE_KEYS.homeToolsOrderTs, _tsOf(updatedAt) || new Date().toISOString());
        return false;
      }
      const cloudTs = _tsOf(updatedAt);
      const localTs = _tsOf(localStorage.getItem(STORAGE_KEYS.homeToolsOrderTs));
      // 管理员与访客统一按时间戳比新旧（本机刚改过的顺序由 localTs > cloudTs 保护，不会被回拉；
      // 管理员的其他电脑则能正常跟随云端最新顺序 —— 旧版"管理员本地永远优先"会导致 B 机永远不同步）
      // 云端没有时间（静态种子）且本地已有顺序 → 本地优先；否则比时间戳（本地无记录视为 0）
      if (cloudTs === 0 && localOrder) return false;
      if (cloudTs < localTs) return false;
      // 按云端顺序重排（内置项按 order，远端未列出的补在末尾；用户上传工具始终垫底）
      _ensureHomeTools();
      const tools = getHomeTools();
      const builtin = tools.filter((t) => t.builtin);
      const userTools = tools.filter((t) => !t.builtin);
      const orderIndex = new Map(order.map((id, i) => [id, i]));
      const orderedBuiltin = builtin.slice().sort((a, b) => {
        const ai = orderIndex.has(a.id) ? orderIndex.get(a.id) : Number.MAX_SAFE_INTEGER;
        const bi = orderIndex.has(b.id) ? orderIndex.get(b.id) : Number.MAX_SAFE_INTEGER;
        return ai - bi;
      });
      const ordered = orderedBuiltin.concat(userTools);
      const capped = ordered.slice(0, MAX_HOME_TOOLS);
      setJSON(STORAGE_KEYS.homeTools, capped);
      setJSON(STORAGE_KEYS.homeToolsOrder, capped.map((t) => t.id));
      setJSON(STORAGE_KEYS.homeToolsOrderTs, cloudTs ? new Date(cloudTs).toISOString() : new Date().toISOString());
      // 通知 UI 重新渲染（如已绑定）
      if (typeof window !== 'undefined' && typeof window.__refreshHomeToolsAfterRemoteOrder === 'function') {
        try { window.__refreshHomeToolsAfterRemoteOrder(); } catch (e) {}
      }
      return true;
    };
    return fetch('/api/home-tools-order', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((obj) => {
        const order = Array.isArray(obj && obj.order) ? obj.order.filter((s) => typeof s === 'string') : null;
        if (order && order.length) return applyRemote(order, obj && obj.updatedAt);
        throw new Error('empty');
      })
      .catch(() =>
        // KV 不可用 / 未部署 Functions：回退随站静态种子
        fetch('data/home-tools-order.json', { cache: 'no-cache' })
          .then((r) => (r.ok ? r.json() : null))
          .then((obj) => {
            const order = Array.isArray(obj && obj.builtinOrder) ? obj.builtinOrder.filter((s) => typeof s === 'string') : null;
            // 静态种子没有可靠时间戳（version 字符串），传 null 让本地已有顺序优先
            return applyRemote(order && order.length ? order : null, null);
          })
          .catch(() => false)
      )
      .then((applied) => {
        remoteHomeToolsOrder = getJSON(STORAGE_KEYS.homeToolsOrder, null) || null;
        // 管理员打开首页时自动补推：覆盖"同步功能上线前就调过顺序""云端还是空的"这类情况，
        // 让管理员不必重新拖一次卡片也能把当前顺序变成全网顺序。
        autoPublishForAdmin(cloudTsSeen);
        return remoteHomeToolsOrder;
      })
      .finally(() => { _markRemoteOrderLoaded(); });
  }

  // 管理员自动补推：仅当"云端没数据"或"本机顺序比云端新"时才推，避免用旧数据覆盖云端。
  function autoPublishForAdmin(cloudTs) {
    const key = (typeof localStorage !== 'undefined') ? (localStorage.getItem('adminKey') || '') : '';
    if (!key) return;
    const localOrder = getJSON(STORAGE_KEYS.homeToolsOrder, null);
    if (!Array.isArray(localOrder) || !localOrder.length) return;
    const localTs = _tsOf(localStorage.getItem(STORAGE_KEYS.homeToolsOrderTs));
    if (cloudTs >= 0 && localTs <= cloudTs) return; // 云端已有且不比本地旧：无需推
    publishHomeToolsOrder().then((ok) => {
      if (!ok) return;
      if (typeof window !== 'undefined' && typeof window.__showOrderSyncToast === 'function') {
        try { window.__showOrderSyncToast('已自动同步本机顺序到云端，所有设备生效'); } catch (e) {}
      }
    });
  }

  // 把可能是 ISO 时间 / version 字符串 / null 的值统一转成毫秒；无法解析返回 0
  function _tsOf(v) {
    if (!v) return 0;
    const t = Date.parse(v);
    return isNaN(t) ? 0 : t;
  }

  // 上一次云端同步失败的原因（供 UI 提示），成功时置空
  let lastOrderSyncError = '';
  function getOrderSyncError() { return lastOrderSyncError; }

  // 管理员把当前顺序推送到云端（KV），所有设备下次打开即生效。
  // 需要 localStorage 里有 adminKey；失败返回 false，原因见 getOrderSyncError()。
  function publishHomeToolsOrder() {
    const key = (typeof localStorage !== 'undefined') ? (localStorage.getItem('adminKey') || '') : '';
    if (!key) { lastOrderSyncError = '未开启管理员模式（请点🔑输入密钥）'; return Promise.resolve(false); }
    const order = getHomeTools().filter((t) => t.builtin).map((t) => t.id);
    return fetch('/api/home-tools-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
      body: JSON.stringify({ order }),
    })
      .then((r) => {
        if (!r.ok) {
          lastOrderSyncError = r.status === 401
            ? '密钥不被云端接受（401）：请点🔑重新输入管理员密钥'
            : (r.status === 404 ? '云端接口未部署（404）：请等 Pages 部署完成再试' : '服务端错误 ' + r.status);
          console.warn('[store] 顺序云端同步失败:', r.status);
          return false;
        }
        return r.json().then((data) => {
          remoteHomeToolsOrder = order;
          // 记录本次同步时间，避免本机下次把云端（同一份）当成"更新"来回重排
          setJSON(STORAGE_KEYS.homeToolsOrderTs, _tsOf(data && data.updatedAt) ? new Date(_tsOf(data.updatedAt)).toISOString() : new Date().toISOString());
          lastOrderSyncError = '';
          return true;
        }).catch(() => { lastOrderSyncError = ''; return true; });
      })
      .catch((e) => {
        lastOrderSyncError = '网络异常：' + (e && e.message ? e.message : e);
        console.warn('[store] 顺序云端同步异常:', e);
        return false;
      });
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

  // 管理员通过后台「编辑应用」更新官方目录（边缘函数 -> KV），对所有人实时可见
  async function updateOfficialApp(appData) {
    const key = (typeof localStorage !== 'undefined') ? (localStorage.getItem('adminKey') || '') : '';
    const res = await fetch('/api/apps', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
      body: JSON.stringify(appData || {}),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error((msg || '更新失败') + ' (' + res.status + ')');
    }
    const result = await res.json();
    if (result && result.app) {
      const idx = officialApps.findIndex((a) => a.id === result.app.id);
      if (idx !== -1) officialApps[idx] = result.app;
      else officialApps.unshift(result.app);
    }
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
    const ARTICLE_SEED_VER = 'v20260904-imagic';
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

    // 加载远端顺序（跨设备同步）。失败/无网络时静默回退到代码默认；不会覆盖已有的本地顺序。
    loadRemoteHomeToolsOrder();
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
    saveHomeToolsOrder(); // 持久化当前顺序, 防止下次 init() 被 ensureHomeTools() 重置
    return next;
  }

  // 读取管理员期望的工具展示顺序 (id 数组). 首次访问或未设置时返回 null.
  function getHomeToolsOrder() {
    return getJSON(STORAGE_KEYS.homeToolsOrder, null);
  }

  // 保存当前工具顺序到独立键, 用于 ensureHomeTools() 排序.
  function saveHomeToolsOrder() {
    const ids = getHomeTools().map((t) => t.id);
    setJSON(STORAGE_KEYS.homeToolsOrder, ids);
    // 记录本地写入时间：本机刚改过的顺序比云端旧值更新，避免被回拉
    setJSON(STORAGE_KEYS.homeToolsOrderTs, new Date().toISOString());
  }

  // 把 id 移到 targetId 之前（拖拽排序用）。返回新索引，失败返回 null。
  function reorderHomeToolBefore(id, targetId) {
    if (id === targetId) return null;
    const tools = getHomeTools();
    const from = tools.findIndex((t) => t.id === id);
    const to = tools.findIndex((t) => t.id === targetId);
    if (from === -1 || to === -1) return null;
    const [item] = tools.splice(from, 1);
    const newTo = tools.findIndex((t) => t.id === targetId); // 删除源后重新定位
    tools.splice(newTo, 0, item);
    setJSON(STORAGE_KEYS.homeTools, tools);
    saveHomeToolsOrder();
    return newTo;
  }

  // 置顶某个工具（移到最前）。已在最前则返回 0，失败返回 null。
  function pinHomeTool(id) {
    const tools = getHomeTools();
    const idx = tools.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    if (idx === 0) return 0;
    const [item] = tools.splice(idx, 1);
    tools.unshift(item);
    setJSON(STORAGE_KEYS.homeTools, tools);
    saveHomeToolsOrder();
    return 0;
  }

  // 导出管理员期望的工具展示顺序为 JSON 字符串（仅含 builtin id，便于跨设备同步）。
  // 用户上传的工具是个性化数据，不在此 JSON 里；他们仍用本地 homeToolsOrder 保留。
  function exportHomeToolsOrderJson() {
    const tools = getHomeTools();
    const builtinOrder = tools.filter((t) => t.builtin).map((t) => t.id);
    const today = new Date().toISOString().slice(0, 10);
    return JSON.stringify({
      version: 'v' + today.replace(/-/g, ''),
      builtinOrder,
    }, null, 2);
  }

  // 在浏览器端下载导出 JSON（管理员点「📤 发布到全网」时调用）。
  function downloadHomeToolsOrder() {
    const json = exportHomeToolsOrderJson();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'home-tools-order.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 300);
    return json;
  }

  // 重置展示顺序为代码默认（BUILTIN_TOOLS 数组顺序）。
  // ensureHomeTools() 定义在 seedHomeTools() 内部，本函数通过闭包变量在
  // seedHomeTools() 运行时被赋值（见下方），避免在 IIFE 顶层访问不到它。
  let _resetHomeToolsOrder = null;
  // ensureHomeTools 定义在 seedHomeTools() 内部，IIFE 顶层访问不到；
  // seedHomeTools() 运行时把引用赋到这里，供 loadRemoteHomeToolsOrder 使用（同 _resetHomeToolsOrder 模式）。
  let _ensureHomeTools = null;

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
      {
        id: 'tool_imagic',
        name: '图片魔法',
        icon: '🪄',
        description: '上传图片改格式(PNG/JPEG/WEBP)、改像素、压文件大小、加马赛克与Logo叠加，全程本地处理',
        builtin: true,
        src: 'tools/image-magic.html',
      },
      {
        id: 'tool_electric',
        name: '电工小工具',
        icon: '⚡',
        description: '输入负载功率自动选电线平方、空开与漏保型号；也可反查现有配置是否合适，还能估算材料用量与造价、导出施工单',
        builtin: true,
        src: 'tools/electrician-toolkit.html',
      },
    ];

    // 每次初始化都确保内置工具存在（按 id upsert），同时保留用户上传的工具。
    // 管理员通过 ↑↓ 调整的顺序由 STORAGE_KEYS.homeToolsOrder 持久化，本函数优先按此顺序组装。
    function ensureHomeTools() {
      const existing = getHomeTools();
      const existingBuiltinIds = new Set(
        existing.filter((t) => t.builtin).map((t) => t.id)
      );
      const userTools = existing.filter((t) => !t.builtin);

      // 内置工具元数据以代码定义为准升级（修复名称/描述/图标变更后旧 localStorage 不刷新），
      // 同时保留用户可能额外追加的字段（如自定义标签）。
      const builtinMap = new Map();
      BUILTIN_TOOLS.forEach((def) => {
        if (existingBuiltinIds.has(def.id)) {
          const old = existing.find((t) => t.id === def.id);
          builtinMap.set(def.id, Object.assign({}, old, def));
        } else {
          builtinMap.set(def.id, def);
        }
      });

      const orderList = getHomeToolsOrder();
      let ordered;
      if (orderList && orderList.length > 0) {
        // 按管理员保存的顺序组装: 已存在的工具按 orderList 排列,
        // 新出现的（不在 orderList 中）按 BUILTIN_TOOLS 顺序追加, 用户上传的也按 orderList 排.
        const allMap = new Map();
        builtinMap.forEach((t, id) => allMap.set(id, t));
        userTools.forEach((t) => allMap.set(t.id, t));

        const used = new Set();
        ordered = [];
        orderList.forEach((id) => {
          if (allMap.has(id) && !used.has(id)) {
            ordered.push(allMap.get(id));
            used.add(id);
          }
        });
        // 补全: 新增的内置按 BUILTIN_TOOLS 顺序, 用户工具按原顺序
        BUILTIN_TOOLS.forEach((def) => {
          if (!used.has(def.id) && allMap.has(def.id)) {
            ordered.push(allMap.get(def.id));
            used.add(def.id);
          }
        });
        userTools.forEach((t) => {
          if (!used.has(t.id)) {
            ordered.push(t);
            used.add(t.id);
          }
        });
      } else {
        // 无 order 历史: 按 BUILTIN_TOOLS 数组顺序 + 用户工具
        ordered = BUILTIN_TOOLS.map((def) => builtinMap.get(def.id)).concat(userTools);
      }

      const capped = ordered.slice(0, MAX_HOME_TOOLS);
      setJSON(STORAGE_KEYS.homeTools, capped);
      // 注：原先的"if (!orderList) saveHomeToolsOrder();" 已经移除；
      // 因为 ensureHomeTools 在 init() 同步阶段就会跑，会先把 homeToolsOrder 写入 BUILTIN_TOOLS 顺序，
      // 导致异步 loadRemoteHomeToolsOrder() 看 homeToolsOrder 不为 null → 不再覆盖远端 → 跨设备同步失败。
      // 现在 homeToolsOrder 的写入完全交给：① 用户主动调整 (moveHomeTool/pinHomeTool/reorderHomeToolBefore)；
      //                                       ② 远端顺序生效 (loadRemoteHomeToolsOrder)；
      //                                       ③ resetHomeToolsOrder() 按 reset 路径触发。
      // 完全没设置 homeToolsOrder 时，下次进首页仍按当前 homeTools 顺序展示，效果相同。
    }

    ensureHomeTools();
    _ensureHomeTools = ensureHomeTools; // 暴露给 IIFE 顶层（loadRemoteHomeToolsOrder 用）

    // 重置顺序：删除管理员自定义的顺序键，由 ensureHomeTools() 回退到默认。
    _resetHomeToolsOrder = function () {
      localStorage.removeItem(STORAGE_KEYS.homeToolsOrder);
      ensureHomeTools();
      return getHomeTools().map((t) => t.id);
    };
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
    updateOfficialApp,
    deleteOfficialApp,
    deleteApp,
    getAppCategories,
    ready,
    init,
    // 首页小工具
    getHomeTools,
    saveHomeTool,
    updateHomeTool,
    moveHomeTool,
    reorderHomeToolBefore,
    pinHomeTool,
    resetHomeToolsOrder: _resetHomeToolsOrder,
    getHomeToolsOrder,
    exportHomeToolsOrderJson,
    downloadHomeToolsOrder,
    whenRemoteOrderReady,
    publishHomeToolsOrder,
    getOrderSyncError,
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
