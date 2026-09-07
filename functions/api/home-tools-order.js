// Cloudflare Pages Function：首页「在线工具」展示顺序读写（边缘 KV，跨设备共享）
// 依赖：KV 绑定名 OFFICIAL_APPS（与 /api/apps 共用同一个 KV 实例，键名区分）；
//       环境变量 ADMIN_KEY（管理员密钥，header x-admin-key 校验）
//   GET  /api/home-tools-order -> 返回 { order: [id...], updatedAt }
//                                    KV 为空时回退站点自带 data/home-tools-order.json 种子
//   POST /api/home-tools-order -> 管理员保存顺序（body: { order: [id...] }），写 KV 对全员实时生效

const KV = "OFFICIAL_APPS";
const KEY = "homeToolsOrder";

// 读取当前云端顺序；无则回退随站打包的种子文件
async function readOrder(env, request) {
  let saved = null;
  try { saved = await env[KV].get(KEY, "json"); } catch (e) { /* KV 未绑定或为空 */ }
  if (saved && Array.isArray(saved.order)) return saved;
  try {
    const seed = await fetch(new URL("/data/home-tools-order.json", request.url));
    if (seed.ok) {
      const seedJson = await seed.json();
      if (seedJson && Array.isArray(seedJson.builtinOrder)) {
        return { order: seedJson.builtinOrder, updatedAt: seedJson.version || null };
      }
    }
  } catch (e) { /* ignore */ }
  return { order: [], updatedAt: null };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const data = await readOrder(env, request);
  return Response.json(data);
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const key = request.headers.get("x-admin-key");
  if (!key || key !== env.ADMIN_KEY) {
    return new Response("Unauthorized", { status: 401 });
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
  await env[KV].put(KEY, JSON.stringify(saved));
  return Response.json({ ok: true, ...saved });
}
