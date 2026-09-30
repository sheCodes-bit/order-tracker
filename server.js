const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 4000;
const ORIGIN = process.env.CLIENT_ORIGIN || "*"; // comma-separated list in production
const corsOrigin = ORIGIN === "*" ? true : ORIGIN.split(",");

const app = express();
app.use(cors({ origin: corsOrigin }));
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: corsOrigin, methods: ["GET", "POST"] } });

// ---------- In-memory data ----------
const STATUSES = ["PLACED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
const catalog = [
  { id: 1, name: "Wireless Mouse", price: 1500 },
  { id: 2, name: "Mechanical Keyboard", price: 6500 },
  { id: 3, name: "USB-C Hub", price: 3200 },
  { id: 4, name: "Laptop Stand", price: 2800 },
];
const orders = [];
let nextId = 1001;
const chatHistory = {}; // room -> [messages]

// ---------- SSE (/events) ----------
const sseClients = new Set();
function broadcastAlert(level, message) {
  const payload = JSON.stringify({ level, message, time: new Date().toISOString() });
  for (const res of sseClients) res.write(`event: alert\ndata: ${payload}\n\n`);
}
app.get("/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write(`event: alert\ndata: ${JSON.stringify({ level: "info", message: "Connected to live alerts", time: new Date().toISOString() })}\n\n`);
  sseClients.add(res);
  const ping = setInterval(() => res.write(": keep-alive\n\n"), 25000);
  req.on("close", () => { clearInterval(ping); sseClients.delete(res); });
});
// periodic system alert so the stream visibly "lives"
setInterval(() => broadcastAlert("info", `System healthy. Active orders: ${orders.filter(o => !["DELIVERED", "CANCELLED"].includes(o.status)).length}`), 30000);

// ---------- Shared business logic ----------
function setStatus(order, status) {
  order.status = status;
  order.updatedAt = new Date().toISOString();
  io.emit("order:status_update", order);           // WebSocket push
  broadcastAlert(status === "CANCELLED" ? "warning" : "info", `Order ${order.id} is now ${status}`); // SSE push
  return order;
}

// ---------- REST: /api/v1 ----------
app.get("/", (_req, res) => res.json({ ok: true, service: "order-tracker" }));
app.get("/api/v1/catalog", (_req, res) => res.json(catalog));
app.get("/api/v1/orders", (_req, res) => res.json(orders));
app.get("/api/v1/orders/:id", (req, res) => {
  const o = orders.find(x => x.id === req.params.id);
  return o ? res.json(o) : res.status(404).json({ error: "Order not found" });
});
app.post("/api/v1/orders", (req, res) => {
  const { customerName, items } = req.body || {};
  if (!customerName || !Array.isArray(items) || !items.length)
    return res.status(400).json({ error: "customerName and non-empty items[] required" });
  const lines = items.map(i => {
    const p = catalog.find(c => c.id === i.productId);
    return p ? { ...p, qty: Number(i.qty) || 1 } : null;
  });
  if (lines.includes(null)) return res.status(400).json({ error: "Unknown productId" });
  const order = {
    id: `ORD-${nextId++}`, customerName, items: lines,
    total: lines.reduce((s, l) => s + l.price * l.qty, 0),
    status: "PLACED", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  orders.push(order);
  io.emit("order:created", order);
  broadcastAlert("info", `New order ${order.id} by ${customerName}`);
  res.status(201).json(order);
});
app.patch("/api/v1/orders/:id/status", (req, res) => {
  const o = orders.find(x => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: "Order not found" });
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of ${STATUSES.join(", ")}` });
  res.json(setStatus(o, status));
});
app.delete("/api/v1/orders/:id", (req, res) => {
  const i = orders.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: "Order not found" });
  orders.splice(i, 1);
  res.status(204).end();
});

// ---------- JSON-RPC 2.0: /rpc ----------
const rpcMethods = {
  listOrders: () => orders,
  getOrderStatus: ({ orderId }) => {
    const o = orders.find(x => x.id === orderId);
    if (!o) throw { code: -32001, message: "Order not found" };
    return { orderId, status: o.status, updatedAt: o.updatedAt };
  },
  cancelOrder: ({ orderId }) => {
    const o = orders.find(x => x.id === orderId);
    if (!o) throw { code: -32001, message: "Order not found" };
    if (["SHIPPED", "DELIVERED", "CANCELLED"].includes(o.status))
      throw { code: -32002, message: `Cannot cancel an order that is ${o.status}` };
    return setStatus(o, "CANCELLED");
  },
};
function handleRpc(req) {
  if (!req || req.jsonrpc !== "2.0" || typeof req.method !== "string")
    return { jsonrpc: "2.0", error: { code: -32600, message: "Invalid Request" }, id: req?.id ?? null };
  const fn = rpcMethods[req.method];
  const isNotification = req.id === undefined;
  if (!fn) return isNotification ? null : { jsonrpc: "2.0", error: { code: -32601, message: "Method not found" }, id: req.id };
  try {
    const result = fn(req.params || {});
    return isNotification ? null : { jsonrpc: "2.0", result, id: req.id };
  } catch (e) {
    return isNotification ? null : { jsonrpc: "2.0", error: { code: e.code || -32603, message: e.message || "Internal error" }, id: req.id };
  }
}
app.post("/rpc", (req, res) => {
  const body = req.body;
  if (Array.isArray(body)) {                       // batch support
    const out = body.map(handleRpc).filter(Boolean);
    return out.length ? res.json(out) : res.status(204).end();
  }
  const out = handleRpc(body);
  return out ? res.json(out) : res.status(204).end();
});
// malformed JSON -> Parse error
app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed")
    return res.status(400).json({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null });
  res.status(500).json({ error: "Server error" });
});

// ---------- Socket.io ----------
io.on("connection", socket => {
  socket.on("chat:join", ({ room, role, name }) => {
    if (!room) return;
    socket.data = { room, role: role || "customer", name: name || "Guest" };
    socket.join(room);
    socket.emit("chat:history", chatHistory[room] || []);
    io.to(room).emit("chat:system", { text: `${socket.data.name} (${socket.data.role}) joined`, time: new Date().toISOString() });
  });
  socket.on("chat:message", ({ text }) => {
    const { room, role, name } = socket.data || {};
    if (!room || !text?.trim()) return;
    const msg = { from: name, role, text: text.trim().slice(0, 500), time: new Date().toISOString() };
    (chatHistory[room] ||= []).push(msg);
    io.to(room).emit("chat:message", msg);
  });
  socket.on("chat:typing", () => {
    const { room, name } = socket.data || {};
    if (room) socket.to(room).emit("chat:typing", { name });
  });
  socket.on("disconnect", () => {
    const { room, name, role } = socket.data || {};
    if (room) io.to(room).emit("chat:system", { text: `${name} (${role}) left`, time: new Date().toISOString() });
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
