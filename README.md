# Real-Time Order Tracker & Live Support System (CSC337 – Lab 04)

Full-stack app demonstrating **REST, WebSockets (Socket.io), JSON-RPC 2.0, and Server-Sent Events** in one project.

- **Frontend:** static HTML/JS (Vercel/Netlify) – `frontend/`
- **Backend:** Node.js + Express + Socket.io (Render/Railway) – `backend/`

**Live URLs**
- Frontend: `<PASTE VERCEL URL>`
- Backend: `<PASTE RENDER URL>`

## Local setup
```bash
cd backend && npm install && npm start      # http://localhost:4000
# in another terminal, serve the frontend:
cd frontend && npx serve .                  # or just open index.html
```
Env vars (backend): `PORT` (auto on Render), `CLIENT_ORIGIN` (frontend URL for CORS, e.g. `https://my-app.vercel.app`; default `*`).
Frontend: edit the `API` constant at the top of the script in `frontend/index.html`.

## Protocols & endpoints

### 1. REST – `/api/v1`
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/catalog` | List products |
| GET | `/api/v1/orders` | List orders |
| GET | `/api/v1/orders/:id` | Get one order |
| POST | `/api/v1/orders` | Create order `{customerName, items:[{productId, qty}]}` |
| PATCH | `/api/v1/orders/:id/status` | Update status `{status}` |
| DELETE | `/api/v1/orders/:id` | Delete order |

### 2. WebSockets (Socket.io) events
| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `order:created` | server → all | order | New order broadcast |
| `order:status_update` | server → all | order | Real-time status change |
| `chat:join` | client → server | `{room, role, name}` | Join 1-on-1 chat room (room = order ID) |
| `chat:history` | server → client | `[message]` | Past messages on join |
| `chat:message` | both | `{text}` / `{from, role, text, time}` | Send / receive chat message |
| `chat:typing` | both | `{name}` | Typing indicator |
| `chat:system` | server → room | `{text, time}` | Join/leave notices |

### 3. JSON-RPC 2.0 – `POST /rpc`
Methods: `listOrders`, `getOrderStatus {orderId}`, `cancelOrder {orderId}`. Supports batch, notifications, and standard error codes (-32700, -32600, -32601, -32603; custom -32001 not found, -32002 not cancellable).
```bash
curl -X POST $BACKEND/rpc -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"cancelOrder","params":{"orderId":"ORD-1001"},"id":1}'
```

### 4. Server-Sent Events – `GET /events`
Streams `alert` events `{level, message, time}` on new orders, status changes/cancellations, and a periodic system-health message.
```bash
curl -N $BACKEND/events
```

## Deployment
- **Backend (Render):** Web Service → Root Directory `backend`, Build `npm install`, Start `npm start`, env `CLIENT_ORIGIN=<frontend url>`.
- **Frontend (Vercel):** Root Directory `frontend`, Framework "Other", no build command.

> Note: data is stored in memory and resets on restart (free-tier Render also sleeps after inactivity).
