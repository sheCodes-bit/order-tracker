#  TrackDesk: Real-Time Order Tracker & Live Support System

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?logo=socket.io&logoColor=white)
![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react&logoColor=black)
![Deployed](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render&logoColor=white)
![Frontend](https://img.shields.io/badge/Frontend-Vercel-000000?logo=vercel&logoColor=white)

> **Course:** CSC337 – Lab Assignment 04
> **Topic:** Communication Protocols in Web Applications (REST · WebSockets · JSON-RPC 2.0 · Server-Sent Events)

##  Live Links

| Component | URL |
|-----------|-----|
|  Frontend (Vercel) | `https://<your-app>.vercel.app` |
|  Backend (Render) | `https://<your-api>.onrender.com` |

##  Project Overview

**TrackDesk** is a full-stack web application where customers can browse a product catalog, place orders, and track them in real time, while support agents update order statuses and chat directly with customers.

The main goal of this project is to demonstrate **four different communication protocols working together in a single application**, each used for the job it does best:

| Protocol | Used For | Why This Protocol? |
|----------|----------|--------------------|
| **REST** | Catalog & order CRUD | Simple, stateless resource management |
| **WebSockets (Socket.io)** | Live order status + 1-on-1 chat | Low-latency, bidirectional communication |
| **JSON-RPC 2.0** | Action-style commands (e.g. `cancelOrder`) | Method-oriented calls that don't map cleanly to resources |
| **Server-Sent Events (SSE)** | Live system alerts | Lightweight one-way server → client streaming |

---

##  Features

-  **Product catalog** and order placement (REST)
-  **Live orders dashboard** – status changes appear instantly without refreshing (WebSocket)
-  **1-on-1 live chat** between Customer and Support Agent, with chat history, join/leave notices, and typing indicators (WebSocket rooms)
-  **Order cancellation** through a JSON-RPC 2.0 method with proper error codes
-  **System alerts feed** pushed by the server (SSE)
-  **Role switching** – Customer view vs. Support Agent view
-  Responsive UI with light/dark theme
- In-app protocol documentation and JSON-RPC playground

---

**How the pieces connect:** every status change (whether made through REST or RPC) goes through one shared function that updates the order, broadcasts a **WebSocket** event to all clients, and pushes an **SSE** alert.

---

##  Tech Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React, TypeScript, Vite, Tailwind CSS, `socket.io-client` |
| Backend | Node.js, Express, Socket.io, CORS |
| Deployment | Render (backend), Vercel (frontend) |
| Data | In-memory store (resets on restart) |

---

##  Getting Started (Local Setup)

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or newer
- npm
- Git

### 1. Clone the repository
```bash
git clone https://github.com/<sheCodes-bit>/<order-tracker>.git
cd <order-tracker>
```

### 2. Run the backend
```bash
cd backend
npm install
npm start
```
The server starts at **http://localhost:4000**. Quick check: opening `http://localhost:4000/` return `{"ok":true,"service":"order-tracker"}`.

### 3. Run the frontend
```bash
cd frontend
npm install
cp .env.example .env    
npm run dev
```
Open the URL printed in the terminal (usually `http://localhost:5173`).

### Environment Variables

| Where | Variable | Description | Example |
|-------|----------|-------------|---------|
| Backend | `PORT` | Server port (set automatically by Render) | `4000` |
| Backend | `CLIENT_ORIGIN` | Allowed frontend origin(s) for CORS, comma-separated. Defaults to `*` | `https://my-app.vercel.app` |
| Frontend | `VITE_API_URL` | Base URL of the backend | `https://my-api.onrender.com` |

---

##  API Reference

### 1️ REST API: `/api/v1`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/catalog` | List all products |
| `GET` | `/api/v1/orders` | List all orders |
| `GET` | `/api/v1/orders/:id` | Get a single order |
| `POST` | `/api/v1/orders` | Create an order |
| `PATCH` | `/api/v1/orders/:id/status` | Update an order's status |
| `DELETE` | `/api/v1/orders/:id` | Delete an order |

**Create order: request**
```json
POST /api/v1/orders
{
  "customerName": "Ayesha",
  "items": [{ "productId": 1, "qty": 2 }, { "productId": 3, "qty": 1 }]
}
```

**Response `201 Created`**
```json
{
  "id": "ORD-1001",
  "customerName": "Ayesha",
  "items": [
    { "id": 1, "name": "Wireless Mouse", "price": 1500, "qty": 2 },
    { "id": 3, "name": "USB-C Hub", "price": 3200, "qty": 1 }
  ],
  "total": 6200,
  "status": "PLACED",
  "createdAt": "2026-09-30T10:00:00.000Z",
  "updatedAt": "2026-09-30T10:00:00.000Z"
}
```

**Order statuses:** `PLACED` → `PROCESSING` → `SHIPPED` → `DELIVERED` (or `CANCELLED`)

---

###  WebSocket Events (Socket.io)

Connect to the backend base URL using `socket.io-client`.

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `order:created` | `Order` | A new order was placed |
| `order:status_update` | `Order` | An order's status changed (broadcast to all clients) |
| `chat:history` | `Message[]` | Previous messages, sent right after joining a room |
| `chat:message` | `{ from, role, text, time }` | New chat message in the room |
| `chat:system` | `{ text, time }` | Join / leave notices |
| `chat:typing` | `{ name }` | The other participant is typing |

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `chat:join` | `{ room, role, name }` | Join the chat room (**room = order ID**) |
| `chat:message` | `{ text }` | Send a message to the current room |
| `chat:typing` | – | Notify the room that the user is typing |

**Example**
```js
import { io } from "socket.io-client";
const socket = io(import.meta.env.VITE_API_URL);

socket.on("order:status_update", (order) => console.log(order.id, order.status));

socket.emit("chat:join", { room: "ORD-1001", role: "customer", name: "Ayesha" });
socket.emit("chat:message", { text: "Where is my order?" });
```

**Chat design:** each order has its own room, so the customer and the support agent who join the same order ID share a private conversation. Message history is kept per room.

---

###  JSON-RPC 2.0: `POST /rpc`

| Method | Params | Description |
|--------|--------|-------------|
| `listOrders` | – | Returns all orders |
| `getOrderStatus` | `{ "orderId": "ORD-1001" }` | Returns the current status |
| `cancelOrder` | `{ "orderId": "ORD-1001" }` | Cancels an order (only if not shipped/delivered) |

**Request**
```json
{ "jsonrpc": "2.0", "method": "cancelOrder", "params": { "orderId": "ORD-1001" }, "id": 1 }
```

**Success response**
```json
{ "jsonrpc": "2.0", "result": { "id": "ORD-1001", "status": "CANCELLED" }, "id": 1 }
```

**Error response**
```json
{ "jsonrpc": "2.0", "error": { "code": -32002, "message": "Cannot cancel an order that is SHIPPED" }, "id": 1 }
```

| Code | Meaning |
|------|---------|
| `-32700` | Parse error (invalid JSON) |
| `-32600` | Invalid request |
| `-32601` | Method not found |
| `-32603` | Internal error |
| `-32001` | Order not found *(custom)* |
| `-32002` | Order cannot be cancelled *(custom)* |

Batch requests and notifications (requests without an `id`) are also supported.

```bash
curl -X POST https://<your-api>.onrender.com/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"listOrders","id":1}'
```

---

### Server-Sent Events: `GET /events`

A one-way stream from the server to the browser. Each message is an `alert` event:

```json
{ "level": "info", "message": "Order ORD-1001 is now SHIPPED", "time": "2026-09-30T10:05:00.000Z" }
```

Alerts are pushed when a new order is created, when a status changes, when an order is cancelled (`level: "warning"`), and as a periodic system-health message every 30 seconds.

```js
const es = new EventSource(`${API_URL}/events`);
es.addEventListener("alert", (e) => console.log(JSON.parse(e.data)));
```
```bash
curl -N https://<your-api>.onrender.com/events
```


## Testing Checklist

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Open the catalog page | Products load from `/api/v1/catalog` |
| 2 | Place an order | New order appears in the dashboard immediately |
| 3 | Open two tabs (Customer + Agent), change the status as Agent | Customer tab updates instantly, no refresh |
| 4 | Join the same order's chat in both tabs and send messages | Messages appear in real time with typing indicator |
| 5 | Click **Cancel Order** as Customer | Status becomes `CANCELLED` (via JSON-RPC) |
| 6 | Cancel an already shipped order | Error toast: *Cannot cancel an order that is SHIPPED* |
| 7 | Watch the Alerts page | Live alerts appear for each action above |

---

##  Screenshots

| Shop | Orders Dashboard |
|------|------------------|
| <img width="315" height="341" alt="image" src="https://github.com/user-attachments/assets/4406a5d2-f22b-481a-a985-740c8214a004" /> | <img width="299" height="298" alt="image" src="https://github.com/user-attachments/assets/8dfe9230-de1d-4b6b-b5d6-481e4447d00c" /> |

| Live Chat | Live Alerts |
|-----------|-------------|
| <img width="294" height="276" alt="image" src="https://github.com/user-attachments/assets/520a5fe1-b072-4293-8f13-e696f7e44bc8" /> | <img width="308" height="191" alt="image" src="https://github.com/user-attachments/assets/94b53cd3-5879-453f-b757-3635c8444a95" /> |

---

##  Limitations & Future Improvements

- Data is stored **in memory** and resets whenever the server restarts. A database such as MongoDB or PostgreSQL would make it persistent.
- No authentication: roles (Customer / Agent) are selected in the UI for demonstration purposes. JWT-based auth would secure this.
- Render's free tier sleeps after inactivity, so the first request can be slow.
- Possible extensions: multiple agents per room, file sharing in chat, order history per user, rate limiting.

---

## Developer

**Name:** `<Esha Minahil>`
**Registration No.:** `<SP24-BSE-010>`
**Course:** CSC337, Advanced Web Technology
**Email:** `<eshaminahil.official@gmail.com>`

---
