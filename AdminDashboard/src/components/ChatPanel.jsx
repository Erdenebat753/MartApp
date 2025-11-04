import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chatBot } from "../chatApi";

export default function ChatPanel({ chatInput, setChatInput, chatReply, setChatReply, device, full = false }) {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const scrollRef = useRef(null);
  const canSend = useMemo(() => !!chatInput && !loading, [chatInput, loading]);

  const onSend = useCallback(async () => {
    if (!canSend) return;
    setLoading(true);
    try {
      const text = chatInput;
      // push user bubble
      setMessages((prev) => [...prev, { role: "user", text }]);
      setChatInput("");
      // call API
      const res = await chatBot(text, device ?? null);
      // expose to parent (assistant bubble appended in effect)
      if (setChatReply) setChatReply(res);
    } catch (e) {
      const msg = e?.message || String(e);
      alert("Chat failed: " + msg);
    } finally {
      setLoading(false);
    }
  }, [canSend, chatInput, device, setChatInput, setChatReply]);

  // Append assistant message when reply changes
  useEffect(() => {
    if (!chatReply) return;
    setMessages((prev) => [
      ...prev,
      { role: "assistant", text: chatReply.reply, intent: chatReply.intent, item_ids: chatReply.item_ids || [] },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatReply?.reply, chatReply?.intent]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={full ? {
        position: "relative",
        width: "100%",
        background: "var(--panel)",
        padding: 12,
        borderRadius: 12,
        border: "1px solid var(--border)",
        color: "var(--text)",
        display: "flex",
        flexDirection: "column",
        minHeight: "60vh",
      } : {
        position: "absolute",
        right: 8,
        bottom: 8,
        width: 420,
        background: "var(--panel)",
        zIndex: 10,
        padding: 10,
        borderRadius: 10,
        border: "1px solid var(--border)",
        color: "var(--text)",
        boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontWeight: 700 }}>Assistant</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {device && (
            <span style={{ fontSize: 12, opacity: 0.8 }}>
              device: ({Math.round(device.x)}, {Math.round(device.y)}){typeof device.z === 'number' ? ` · z=${device.z}` : ''}
            </span>
          )}
          <button onClick={() => setMessages([])} style={{ padding: "6px 10px", background: "transparent", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6 }}>
            Clear
          </button>
        </div>
      </div>
      <div ref={scrollRef} style={full ? { flex: 1, overflow: "auto", padding: 8, border: "1px solid var(--border)", borderRadius: 8, background: "rgba(0,0,0,0.15)", marginBottom: 8 } : { maxHeight: 260, overflow: "auto", padding: 6, border: "1px solid var(--border)", borderRadius: 8, background: "rgba(0,0,0,0.15)", marginBottom: 8 }}>
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 6 }}>
              <div style={{ maxWidth: "80%", background: isUser ? "#3b82f6" : "#0b0b0f", color: isUser ? "#0b1220" : "var(--text)", border: "1px solid var(--border)", padding: "8px 10px", borderRadius: 10 }}>
                {!isUser && (
                  <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>Bot</div>
                )}
                <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
                {!isUser && (
                  <div style={{ fontSize: 11, opacity: 0.8, marginTop: 6 }}>
                    {m.intent && <span>intent: <code>{m.intent}</code></span>}
                    {Array.isArray(m.item_ids) && m.item_ids.length > 0 && (
                      <span> · items: {m.item_ids.map((id) => `#${id}`).join(", ")}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ background: "#0b0b0f", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 10px", borderRadius: 10 }}>
              <span style={{ opacity: 0.8 }}>Typing…</span>
            </div>
          </div>
        )}
        {!messages.length && !loading && (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Start a conversation — try “Where is cola?”</div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSend();
          }}
          placeholder="Type a message..."
          style={{ flex: 1, padding: 10, background: "#0b0b0f", border: "1px solid #3f3f46", color: "#e5e7eb", borderRadius: 8 }}
        />
        <button
          onClick={onSend}
          disabled={!canSend}
          style={{ padding: "10px 12px", background: canSend ? "#27272a" : "#1f2937", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 8, opacity: canSend ? 1 : 0.6 }}
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
