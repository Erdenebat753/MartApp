import { API_BASE } from "./config";

async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}

export async function getSegments() {
  return jsonFetch(`${API_BASE}/api/segments`);
}

export async function createFreeSegment(polyline) {
  return jsonFetch(`${API_BASE}/api/segments/free`, {
    method: "POST",
    body: JSON.stringify({ polyline }),
  });
}

export async function deleteSegment(id) {
  const res = await fetch(`${API_BASE}/api/segments/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return true;
}

export async function routeByCoords(start, end) {
  return jsonFetch(`${API_BASE}/api/route/coords`, {
    method: "POST",
    body: JSON.stringify({ start, end }),
  });
}

export async function planRoute(start, item_ids) {
  return jsonFetch(`${API_BASE}/api/route/plan`, {
    method: "POST",
    body: JSON.stringify({ start, item_ids }),
  });
}

export async function getItems() {
  return jsonFetch(`${API_BASE}/api/items`);
}

export async function createItem(item) {
  return jsonFetch(`${API_BASE}/api/items`, {
    method: "POST",
    body: JSON.stringify(item),
  });
}

export async function createSlamStart(data) {
  return jsonFetch(`${API_BASE}/api/slam`, {
    method: "POST",
    body: JSON.stringify({
      x: Number(data.x),
      y: Number(data.y),
      z: data.z === "" || data.z == null ? null : Number(data.z),
      heading_deg: data.heading_deg === "" || data.heading_deg == null ? null : Number(data.heading_deg),
    }),
  });
}

export async function updateItem(id, item) {
  return jsonFetch(`${API_BASE}/api/items/${id}`, {
    method: "PUT",
    body: JSON.stringify(item),
  });
}

export async function deleteItem(id) {
  const res = await fetch(`${API_BASE}/api/items/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return true;
}

export async function getSlamStart() {
  return jsonFetch(`${API_BASE}/api/slam`);
}
