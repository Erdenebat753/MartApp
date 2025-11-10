import { API_BASE } from "./config";
import { getToken, clearToken } from "./auth";

async function jsonFetch(url, opts = {}) {
  const token = getToken();
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
    ...opts,
  });
  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      throw new Error("Unauthorized");
    }
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

export async function routeByCoords(start, end, algorithm = 'astar') {
  return jsonFetch(`${API_BASE}/api/route/coords`, {
    method: "POST",
    body: JSON.stringify({ start, end, algorithm }),
  });
}

export async function planRoute(start, item_ids) {
  return jsonFetch(`${API_BASE}/api/route/plan`, {
    method: "POST",
    body: JSON.stringify({ start, item_ids }),
  });
}

export async function getItems(mart_id) {
  const qp = mart_id != null ? `?mart_id=${encodeURIComponent(mart_id)}` : "";
  return jsonFetch(`${API_BASE}/api/items${qp}`);
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

// Categories
export async function getCategories(mart_id) {
  const qp = mart_id != null ? `?mart_id=${encodeURIComponent(mart_id)}` : "";
  return jsonFetch(`${API_BASE}/api/categories${qp}`);
}
export async function createCategory(cat) {
  return jsonFetch(`${API_BASE}/api/categories`, {
    method: "POST",
    body: JSON.stringify(cat),
  });
}
export async function updateCategory(id, cat) {
  return jsonFetch(`${API_BASE}/api/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(cat),
  });
}
export async function deleteCategory(id) {
  const res = await fetch(`${API_BASE}/api/categories/${id}`, { method: "DELETE", headers: { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) } });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return true;
}

// Marts
export async function getMarts() {
  return jsonFetch(`${API_BASE}/api/marts`);
}

export async function getMart(id) {
  return jsonFetch(`${API_BASE}/api/marts/${id}`);
}

export async function createMart(mart) {
  return jsonFetch(`${API_BASE}/api/marts`, {
    method: "POST",
    body: JSON.stringify(mart),
  });
}

export async function updateMart(id, mart) {
  return jsonFetch(`${API_BASE}/api/marts/${id}`, {
    method: "PUT",
    body: JSON.stringify(mart),
  });
}

export async function uploadMartImage(id, file) {
  const form = new FormData();
  form.append("file", file);
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/marts/${id}/map-image`, {
    method: "POST",
    body: form,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}

// Upload an item image; returns { image_url }
export async function uploadItemImage(file) {
  const form = new FormData();
  form.append("file", file);
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/items/upload-image`, {
    method: "POST",
    body: form,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}
