// Cloudflare Pages Function：首页「在线工具」展示顺序读写（边缘 KV，跨设备共享）
// 依赖：KV 绑定名 OFFICIAL_APPS（与 /api/apps 共用同一个 KV 实例，键名区分）；
//       环境变量 ADMIN_KEY（管理员密钥，header x-admin-key 校验）
//   GET  /api/home-tools-order -> 返回 { order: [id...], updatedAt }
//                                    KV 为空时回退站点自带 data/home-tools-order.json 种子
//   POST /api/home-tools-order -> 管理员保存顺序（body: { order: [id...] }），写 KV 对全员实时生效

const KV = "OFFICIAL_APPS";
const KEY = "homeToolsOrder";

// 读取当前云端顺序；无则回退随站打包的种子文件
// 返回体带 kv 自检字段（ok / unbound / error:…），便于从外部 curl 判断 KV 对本接口是否可用
async function readOrder(env, request) {
  let saved = null;
  let kv = "unknown";
  try {
    if (!env[KV]) {
      kv = "unbound";                       // KV 绑定名不存在
    } else {
      saved = await env[KV].get(KEY, "json");
      kv = "ok";
    }
  } catch (e) {
    kv = "error:" + String(e && e.message ? e.message : e).slice(0, 120);
  }
  if (saved && Array.isArray(saved.order)) return { ...saved, kv };
  try {
    const seed = await fetch(new URL("/data/home-tools-order.json", request.url));
    if (seed.ok) {
      const seedJson = await seed.json();
      if (seedJson && Array.isArray(seedJson.builtinOrder)) {
        return { order: seedJson.builtinOrder, updatedAt: seedJson.version || null, kv, fromSeed: true };
      }
    }
  } catch (e) { /* ignore */ }
  return { order: [], updatedAt: null, kv };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const data = await readOrder(env, request);
  return Response.json(data);
}

export async function onRequestPost(context) {
  const { env, request } = context;
  // 环境变量缺失属于服务端配置问题，单独报 500，避免和"密钥输错"的 401 混淆
  if (!env.ADMIN_KEY) {
    return Response.json(
      { error: "ADMIN_KEY not configured", hint: "Cloudflare Pages → Settings → Environment variables 里配置 ADMIN_KEY" },
      { status: 500 }
    );
  }
  const key = request.headers.get("x-admin-key");
  if (!key || key !== env.ADMIN_KEY) {
    return Response.json({ error: "Unauthorized", hint: "密钥与云端 ADMIN_KEY 不一致，请在页面点🔑重新输入" }, { status: 401 });
  }
  let body;
  try { body = await request.json(); } catch (e) {
    return new Response("Bad Request", { status: 400 });
  }
  const order = body && Array.isArray(body.order) ? body.order : null;
  if (!order) {
    return new Response("order array required", { status: 400 });
  }
  // 清洗：仅保留字符串 id、去重、限制数量，防止异常数据撑爆 KV
  const clean = [...new Set(order.filter((id) => typeof id === "string" && id.length > 0))].slice(0, 100);
  const saved = { order: clean, updatedAt: new Date().toISOString() };
  try {
    await env[KV].put(KEY, JSON.stringify(saved));
  } catch (e) {
    // KV 未绑定 / 绑定名不符时走到这里；返回明确 JSON，避免请求崩成 1101 让前端无从判断
    return Response.json({ error: "KV write failed", detail: String(e) }, { status: 500 });
  }
  return Response.json({ ok: true, ...saved });
}
