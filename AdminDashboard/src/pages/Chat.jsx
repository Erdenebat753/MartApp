import React, { useEffect, useState } from "react";
import ChatPanel from "../components/ChatPanel";
import { getSlamStart } from "../api";

export default function ChatPage() {
  const [chatInput, setChatInput] = useState("");
  const [chatReply, setChatReply] = useState(null);
  const [slamStart, setSlamStart] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await getSlamStart();
        setSlamStart(s);
      } catch {}
    })();
  }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Chat</h2>
      <ChatPanel
        full
        chatInput={chatInput}
        setChatInput={setChatInput}
        chatReply={chatReply}
        setChatReply={setChatReply}
        device={slamStart ? { x: slamStart.x, y: slamStart.y, z: slamStart.z ?? null } : null}
      />
    </div>
  );
}
