// laburen-mcp-shop — single-file MCP server for Cloudflare Workers + D1

const PROTOCOL_VERSION = "2025-06-18";

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname !== "/mcp") return new Response("Not Found", { status: 404 });

    // Allowlist opcional por Origin
    if (!isOriginAllowed(req, env)) return new Response("Forbidden", { status: 403 });

    const v = req.headers.get("MCP-Protocol-Version");
    if (v && v !== PROTOCOL_VERSION && v !== "2025-03-26") {
      return new Response("Bad Request: unsupported MCP-Protocol-Version", { status: 400 });
    }

    if (req.method === "GET") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    let msg;
    try {
      msg = await req.json();
    } catch {
      return jsonrpcError(null, -32700, "Parse error", 400);
    }

    // Notificación sin id
    if (msg.id === undefined) return new Response(null, { status: 202 });

    try {
      const result = await route(msg, env);
      return json({ jsonrpc: "2.0", id: msg.id, result });
    } catch (e) {
      return jsonrpcError(msg.id ?? null, -32603, e?.message || "Internal error", 500);
    }
  }
};

async function route(msg, env) {
  switch (msg.method) {
    case "initialize":
      return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "laburen-mcp-shop", version: "1.0.0" },
        instructions:
          "Agente vendedor: listar productos, mostrar detalle, crear/editar carrito por conversación, y derivar a humano por Chatwoot con resumen."
      };

    case "ping":
      return {};

    case "tools/list":
      return { tools: listTools() };

    case "tools/call":
      return await callTool(env, msg.params);

    default:
      // JSON-RPC method not found
      throw new Error(`Method not found: ${msg.method}`);
  }
}

function listTools() {
  return [
    {
      name: "list_products",
      description: "Busca y lista productos. Filtros opcionales por texto y stock.",
      inputSchema: {
        type: "object",
        properties: {
          q: { type: "string" },
          inStockOnly: { type: "boolean", default: true },
          limit: { type: "number", default: 10 }
        }
      }
    },
    {
      name: "get_product",
      description: "Detalle de un producto por id.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "number" } },
        required: ["id"]
      }
    },
    {
      name: "create_cart",
      description: "Crea (o devuelve) un carrito por conversación. Puede incluir items iniciales.",
      inputSchema: {
        type: "object",
        properties: {
          conversation_id: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: { product_id: { type: "number" }, qty: { type: "number" } },
              required: ["product_id", "qty"]
            }
          }
        },
        required: ["conversation_id"]
      }
    },
    {
      name: "update_cart",
      description: "Actualiza cantidades (qty=0 elimina). Valida stock.",
      inputSchema: {
        type: "object",
        properties: {
          conversation_id: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: { product_id: { type: "number" }, qty: { type: "number" } },
              required: ["product_id", "qty"]
            }
          }
        },
        required: ["conversation_id", "items"]
      }
    },
    {
      name: "get_cart",
      description: "Devuelve carrito + items + total para una conversación.",
      inputSchema: {
        type: "object",
        properties: { conversation_id: { type: "string" } },
        required: ["conversation_id"]
      }
    },
    {
      name: "chatwoot_add_labels",
      description: "Mergea labels en Chatwoot (sin pisar). Requiere secrets.",
      inputSchema: {
        type: "object",
        properties: {
          conversation_id: { type: "string" },
          labels: { type: "array", items: { type: "string" } }
        },
        required: ["conversation_id", "labels"]
      }
    },
    {
      name: "chatwoot_handoff",
      description: "Nota privada + labels + (opcional) assign en Chatwoot.",
      inputSchema: {
        type: "object",
        properties: {
          conversation_id: { type: "string" },
          reason: { type: "string" },
          summary: { type: "string" }
        },
        required: ["conversation_id", "reason", "summary"]
      }
    }
  ];
}

async function callTool(env, params) {
  const name = params?.name;
  const args = params?.arguments || {};

  try {
    switch (name) {
      case "list_products":
        return toolOk(await listProducts(env, args));
      case "get_product":
        return toolOk(await getProduct(env, args));
      case "create_cart":
        return toolOk(await createCart(env, args));
      case "update_cart":
        return toolOk(await updateCart(env, args));
      case "get_cart":
        return toolOk(await getCart(env, args));
      case "chatwoot_add_labels":
        return toolOk(await chatwootAddLabels(env, args));
      case "chatwoot_handoff":
        return toolOk(await chatwootHandoff(env, args));
      default:
        return toolErr(`Unknown tool: ${String(name)}`);
    }
  } catch (e) {
    return toolErr(e?.message || "Tool error");
  }
}

function toolOk(structuredContent) {
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
    isError: false
  };
}

function toolErr(message) {
  return {
    content: [{ type: "text", text: message }],
    isError: true
  };
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function jsonrpcError(id, code, message, httpStatus) {
  return json({ jsonrpc: "2.0", id, error: { code, message } }, httpStatus);
}

function isOriginAllowed(req, env) {
  const origin = req.headers.get("Origin");
  const allow = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  if (allow.length === 0) return true;
  if (!origin) return false;
  return allow.includes(origin);
}

// ====== D1 Helpers ======
function assertDB(env) {
  if (!env.DB) throw new Error("Falta binding D1: DB (Settings > Variables & bindings > D1 Database)");
}

async function listProducts(env, args) {
  assertDB(env);
  const q = String(args?.q || "").trim();
  const inStockOnly = args?.inStockOnly ?? true;
  const limit = Math.min(Number(args?.limit ?? 10), 50);

  const where = [];
  const binds = [];

  if (q) {
    where.push("(name LIKE ? OR description LIKE ?)");
    binds.push(`%${q}%`, `%${q}%`);
  }
  if (inStockOnly) where.push("stock > 0");

  const sql = `SELECT id, name, description, price, stock
               FROM products
               ${where.length ? "WHERE " + where.join(" AND ") : ""}
               ORDER BY id ASC
               LIMIT ?`;
  binds.push(limit);

  const res = await env.DB.prepare(sql).bind(...binds).all();
  return { products: res.results ?? [], count: (res.results ?? []).length };
}

async function getProduct(env, args) {
  assertDB(env);
  const id = Number(args?.id);
  const row = await env.DB.prepare(
    "SELECT id, name, description, price, stock FROM products WHERE id = ?"
  ).bind(id).first();
  return { product: row || null };
}

async function createCart(env, args) {
  assertDB(env);
  const conversationId = String(args?.conversation_id);
  const items = Array.isArray(args?.items) ? args.items : [];

  await env.DB.prepare(
    "INSERT INTO carts (conversation_id) VALUES (?) ON CONFLICT(conversation_id) DO NOTHING"
  ).bind(conversationId).run();

  const cart = await env.DB.prepare(
    "SELECT id, conversation_id, created_at, updated_at FROM carts WHERE conversation_id = ?"
  ).bind(conversationId).first();

  if (!cart) throw new Error("No se pudo crear/leer el carrito");

  if (items.length) {
    await applyCartItems(env, cart.id, items);
    await env.DB.prepare("UPDATE carts SET updated_at = updated_at WHERE id = ?").bind(cart.id).run();
  }

  return await getCart(env, { conversation_id: conversationId });
}

async function updateCart(env, args) {
  assertDB(env);
  const conversationId = String(args?.conversation_id);
  const items = Array.isArray(args?.items) ? args.items : [];

  const cart = await env.DB.prepare("SELECT id FROM carts WHERE conversation_id = ?")
    .bind(conversationId).first();

  if (!cart) return await createCart(env, { conversation_id: conversationId, items });

  await applyCartItems(env, cart.id, items);
  await env.DB.prepare("UPDATE carts SET updated_at = updated_at WHERE id = ?").bind(cart.id).run();

  return await getCart(env, { conversation_id: conversationId });
}

async function getCart(env, args) {
  assertDB(env);
  const conversationId = String(args?.conversation_id);

  const cart = await env.DB.prepare(
    "SELECT id, conversation_id, created_at, updated_at FROM carts WHERE conversation_id = ?"
  ).bind(conversationId).first();

  if (!cart) return { cart: null, items: [], total: 0 };

  const res = await env.DB.prepare(
    `SELECT ci.product_id, p.name, p.price, ci.qty, (p.price * ci.qty) AS line_total
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.cart_id = ?
     ORDER BY ci.product_id ASC`
  ).bind(cart.id).all();

  const items = res.results ?? [];
  const total = items.reduce((acc, it) => acc + Number(it.line_total || 0), 0);

  return { cart, items, total };
}

// stock: validamos, NO descontamos
async function applyCartItems(env, cartId, items) {
  for (const it of items) {
    const productId = Number(it.product_id);
    const qty = Number(it.qty);
    if (!Number.isFinite(productId) || !Number.isFinite(qty)) continue;

    const p = await env.DB.prepare("SELECT stock FROM products WHERE id = ?").bind(productId).first();
    if (!p) continue;

    if (qty > 0 && qty > Number(p.stock)) {
      throw new Error(`Stock insuficiente (product_id=${productId}). Disponible=${p.stock}, pedido=${qty}`);
    }

    if (qty <= 0) {
      await env.DB.prepare("DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?")
        .bind(cartId, productId).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO cart_items (cart_id, product_id, qty)
         VALUES (?, ?, ?)
         ON CONFLICT(cart_id, product_id) DO UPDATE SET qty = excluded.qty`
      ).bind(cartId, productId, qty).run();
    }
  }
}

// ====== Chatwoot (opcional) ======
function need(env, key) {
  const v = env[key];
  if (!v) throw new Error(`Falta configurar ${key}`);
  return String(v);
}

async function chatwootAddLabels(env, args) {
  const base = need(env, "CHATWOOT_BASE_URL");
  const accountId = need(env, "CHATWOOT_ACCOUNT_ID");
  const token = need(env, "CHATWOOT_API_TOKEN");

  const conversationId = String(args.conversation_id);
  const labelsToAdd = (args.labels || []).map(String);

  const existing = await cwFetch(`${base}/api/v1/accounts/${accountId}/conversations/${conversationId}/labels`, token);
  const merged = Array.from(new Set([...(existing.payload || []), ...labelsToAdd]));

  const out = await cwFetch(
    `${base}/api/v1/accounts/${accountId}/conversations/${conversationId}/labels`,
    token,
    { labels: merged }
  );
  return { labels: out.payload || merged };
}

async function chatwootHandoff(env, args) {
  const base = need(env, "CHATWOOT_BASE_URL");
  const accountId = need(env, "CHATWOOT_ACCOUNT_ID");
  const token = need(env, "CHATWOOT_API_TOKEN");

  const conversationId = String(args.conversation_id);
  const reason = String(args.reason || "handoff");
  const summary = String(args.summary || "");

  await chatwootAddLabels(env, { conversation_id: conversationId, labels: ["handoff", `reason_${slug(reason)}`] });

  await cwFetch(
    `${base}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
    token,
    {
      content: `HANDOFF\nMotivo: ${reason}\n\nResumen:\n${summary}`,
      message_type: "outgoing",
      private: true,
      content_type: "text",
      content_attributes: {}
    }
  );

  return { ok: true };
}

async function cwFetch(url, token, body) {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "api_access_token": token },
    body: body ? JSON.stringify(body) : undefined
  });

  const txt = await res.text();
  let json = {};
  try { json = txt ? JSON.parse(txt) : {}; } catch {}

  if (!res.ok) throw new Error(`Chatwoot ${res.status}: ${txt || "error"}`);
  return json;
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}
