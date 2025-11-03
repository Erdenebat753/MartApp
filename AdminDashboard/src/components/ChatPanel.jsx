import React from "react";
import { chatBot } from "../chatApi";

export default function ChatPanel({ chatInput, setChatInput, chatReply, setChatReply }) {
  return (
    <div onMouseDown={(e)=>e.stopPropagation()} onClick={(e)=>e.stopPropagation()} style={{ position: "absolute", right: 8, bottom: 8, width: 360, background: "rgba(0,0,0,0.8)", zIndex: 10, padding: 10, borderRadius: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontWeight: 600 }}>Chatbot</div>
        <span style={{ fontSize: 12, opacity: 0.8 }}>Ask about products</span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={chatInput} onChange={(e)=>setChatInput(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: 6 }} />
        <button onClick={async ()=>{ try { const device = null; const res = await chatBot(chatInput, device); setChatReply(res);} catch(e){ alert("Chat failed"); } }} style={{ padding: "6px 10px" }}>Send</button>
      </div>
      {chatReply && (
        <div style={{ marginTop: 8, fontSize: 13, lineHeight: "18px" }}>
          <div style={{ whiteSpace: "pre-wrap" }}>{chatReply.reply}</div>
        </div>
      )}
    </div>
  );
}

