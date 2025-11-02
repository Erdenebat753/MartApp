import { API_BASE } from "./config";

export async function chatBot(text, device=null) {
  const res = await fetch(`${API_BASE}/api/chatbot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, device }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

