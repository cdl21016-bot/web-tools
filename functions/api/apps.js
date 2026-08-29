// Cloudflare Pages Function：官方应用目录读写（边缘 KV）
// 依赖：KV 绑定名 OFFICIAL_APPS；环境变量 ADMIN_KEY（管理员密钥）
//   GET  /api/apps -> 返回官方应用数组（优先读 KV，空则回退站点自带 data/official-apps.json）
//   POST /api/apps -> 管理员新增（需 header x-admin-key === env.ADMIN_KEY），写入 KV 对全员实时可见

const KV = "OFFICIAL_APPS";

async function readApps(env, request) {
  let apps = null;
  try { apps = await env[KV].get("apps", "json"); } catch (e) { /* KV 未绑定或为空 */ }
  if (Array.isArray(apps) && apps.length) return apps;
  // 回退到随站打包的种子数据，保证首次未写入 KV 前也有内容
  try {
    const seed = await fetch(new URL("/data/official-apps.json", request.url));
    if (seed.ok) return await seed.json();
  } catch (e) { /* ignore */ }
  return [];
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const apps = await readApps(env, request);
  return Response.json(apps);
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
  if (!body || !body.name) {
    return new Response("name required", { status: 400 });
  }
  const apps = await readApps(env, request);
  const app = {
    id: "app-" + Date.now().toString(36),
    name: String(body.name || ""),
    description: String(body.description || ""),
    link: String(body.link || ""),
    introHtml: String(body.introHtml || ""),
    introFileName: String(body.introFileName || ""),
    icon: body.icon || "📦",
    email: String(body.email || ""),
    wechat: String(body.wechat || ""),
    price: Number(body.price || 0),
    chargeMode: body.chargeMode === "paid" ? "paid" : "free",
    uploadDate: new Date().toISOString().slice(0, 10),
    official: true,
  };
  apps.unshift(app);
  await env[KV].put("apps", JSON.stringify(apps));
  return Response.json({ ok: true, app });
}

export async function onRequestDelete(context) {
  const { env, request } = context;
  const key = request.headers.get("x-admin-key");
  if (!key || key !== env.ADMIN_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }
  let body;
  try { body = await request.json(); } catch (e) {
    return new Response("Bad Request", { status: 400 });
  }
  const { id } = body || {};
  if (!id) {
    return new Response("id required", { status: 400 });
  }
  const apps = await readApps(env, request);
  const filtered = apps.filter((a) => a.id !== id);
  if (filtered.length === apps.length) {
    return new Response("Not Found", { status: 404 });
  }
  await env[KV].put("apps", JSON.stringify(filtered));
  return Response.json({ ok: true });
}
