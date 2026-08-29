/**
 * router.js - 极简哈希路由
 * 提供 app.js 所需的全局 Router：
 *   Router.register(pattern, handler)  // pattern 形如 '/article/:id'
 *   Router.notFound(handler)
 *   Router.init()                       // 启动监听并渲染当前路由
 *   Router.navigate(path)               // 编程式跳转，path 形如 '/article/123'
 *
 * 路由基于 location.hash（#/...），无需服务端配置即可在任意静态托管上运行。
 */
const Router = (function () {
  const routes = [];
  let notFoundHandler = null;

  // 解析当前 hash，返回 { path, query }
  function parseHash() {
    let hash = window.location.hash || '';
    if (hash.startsWith('#')) hash = hash.slice(1);
    if (hash === '' || hash === '#') hash = '/';
    if (!hash.startsWith('/')) hash = '/' + hash;

    const [rawPath, queryStr] = hash.split('?');
    const path = rawPath || '/';
    const query = {};
    if (queryStr) {
      new URLSearchParams(queryStr).forEach((value, key) => {
        query[key] = value;
      });
    }
    return { path, query };
  }

  // 匹配注册路由，支持 :param 动态段
  function matchRoute(path) {
    const pathSegs = path.split('/').filter(Boolean);
    for (const route of routes) {
      const patternSegs = route.pattern.split('/').filter(Boolean);
      if (patternSegs.length !== pathSegs.length) continue;

      const params = {};
      let matched = true;
      for (let i = 0; i < patternSegs.length; i++) {
        if (patternSegs[i].startsWith(':')) {
          params[patternSegs[i].slice(1)] = decodeURIComponent(pathSegs[i]);
        } else if (patternSegs[i] !== pathSegs[i]) {
          matched = false;
          break;
        }
      }
      if (matched) return { handler: route.handler, params };
    }
    return null;
  }

  function render() {
    const { path, query } = parseHash();
    const matched = matchRoute(path);
    if (matched) {
      matched.handler({ params: matched.params, query, path });
    } else if (notFoundHandler) {
      notFoundHandler({ params: {}, query, path });
    }
    // 路由切换后回到顶部
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  }

  function navigate(target) {
    if (typeof target !== 'string') return;
    let path = target.startsWith('/') ? target : '/' + target;
    // 统一前缀为 '#'，避免被当作页面内锚点
    if (window.location.hash === '#' + path) {
      render(); // 相同路由强制重渲染
    } else {
      window.location.hash = path;
    }
  }

  function register(pattern, handler) {
    routes.push({ pattern, handler });
  }

  function notFound(handler) {
    notFoundHandler = handler;
  }

  function init() {
    window.addEventListener('hashchange', render);
    render();
  }

  return { register, notFound, init, navigate };
})();
