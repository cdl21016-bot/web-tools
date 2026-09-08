// 首页「工具顺序」同步诊断 —— 复制整段到浏览器 F12 Console 回车运行
// 它会：① 检查 Store/密钥是否存在 ② 用本机密钥真实 POST 一次 ③ 读出状态码与云端是否真的写入
(async () => {
  const out = (...a) => console.log('%c[诊断]', 'color:#0a0;font-weight:bold', ...a);
  out('1. Store 是否存在：', typeof Store, '| publish 函数：', typeof (typeof Store !== 'undefined' && Store.publishHomeToolsOrder));
  const key = (typeof localStorage !== 'undefined') ? localStorage.getItem('adminKey') : null;
  out('2. adminKey 是否存在：', !!key, key ? '(长度 ' + key.length + ')' : '(空)');
  if (!key) { out('❌ 没输密钥：首页点齿轮 ⚙️ 输入与 Cloudflare ADMIN_KEY 一致的值'); return; }
  out('3. 用本机密钥直接 POST /api/home-tools-order ...');
  try {
    const resp = await fetch('/api/home-tools-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
      body: JSON.stringify({ order: ['tool_pkg', 'tool_cal', 'tool_qr', 'tool_pdf', 'tool_format'] })
    });
    const txt = await resp.text();
    out('   POST 状态码：', resp.status);
    out('   POST 响应体：', txt);
    if (resp.status === 200) {
      out('✅ POST 成功！等 3 秒再读云端确认...');
      await new Promise(r => setTimeout(r, 3000));
      const g = await (await fetch('/api/home-tools-order')).json();
      out('   GET updatedAt 现在：', g.updatedAt, (g.updatedAt && g.updatedAt.includes('T')) ? '✅ 已是 ISO 时间，写入成功！' : '⚠️ 仍是种子值（写入疑似失败）');
    } else if (resp.status === 401) {
      out('❌ 401 = 本机密钥和云端 ADMIN_KEY 不一致。去 Cloudflare Pages → Settings → Environment variables 看 ADMIN_KEY 真实值，或改个新值后在首页齿轮重输。');
    } else if (resp.status === 500) {
      out('❌ 500 = 服务端报错，把上面的响应体发给我。');
    } else if (resp.status === 404) {
      out('❌ 404 = 接口未部署，等 1 分钟硬刷新重试。');
    }
  } catch (e) { out('❌ fetch 异常：', e.message); }
})();
