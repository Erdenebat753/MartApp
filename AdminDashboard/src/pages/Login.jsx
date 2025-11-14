import React, { useState } from "react";
import { API_BASE } from "../config";
import { loginRequest, setToken } from "../auth";

export default function Login({ onLoggedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await loginRequest(API_BASE, username, password);
      setToken(res.access_token);
      onLoggedIn?.(res);
      if (typeof window !== "undefined") {
        if (!window.location.hash || window.location.hash === "#login") {
          window.location.hash = "#map";
        }
        setTimeout(() => {
          try {
            window.location.reload();
          } catch {
            // ignore
          }
        }, 0);
      }
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={submit} style={{ width: 320, padding: 24, border: "1px solid #ddd", borderRadius: 8, background: "#fff" }}>
        <h2 style={{ margin: 0, marginBottom: 16 }}>Admin Login</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label>
            <div>Username</div>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
          </label>
          <label>
            <div>Password</div>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          </label>
          {error && <div style={{ color: "#c00" }}>{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </div>
      </form>
    </div>
  );
}
