import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { API_BASE } from "../../constants/api";
import { useItems } from "../../hooks/useItems";
import { useMartMeta } from "../../hooks/useMartMeta";
import { useRouteCompute } from "../../hooks/useRoute";
import { useSlamStart } from "../../hooks/useSlamStart";
import { useLists } from "../../hooks/useLists";

type ChatbotResp = { intent: string; item_ids: number[]; reply: string };

export default function ChatTab() {
  const { width, height } = Dimensions.get("window");
  const router = useRouter();
  const { mart } = useMartMeta();
  const { items } = useItems(mart?.id);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<ChatbotResp | null>(null);
  const { compute } = useRouteCompute();
  const [user, setUser] = useState<{ x:number; y:number } | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const { lists, create, appendItems } = useLists();
  const safeLists = Array.isArray(lists) ? (lists as any[]) : ([] as any[]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);

  // Initialize user from slam start (no polling here)
  useSlamStart(items, (p) => setUser({ x: p.x, y: p.y }), (deg) => setHeading(Number(deg || 0)));

  const resolved = useMemo(() => {
    const map = new Map(items.map(it => [it.id, it] as const));
    const ids = resp?.item_ids || [];
    return ids.map(id => ({ id, item: map.get(id) })).filter(Boolean) as { id:number; item:any }[];
  }, [resp, items]);

  const ask = async () => {
    const t = text.trim();
    if (!t) return;
    try {
      setLoading(true);
      setError(null);
      const r = await fetch(`${API_BASE}/api/chatbot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const j = await r.json();
      setResp(j);
    } catch (e: any) {
      setError(e?.message || String(e));
      setResp(null);
    } finally {
      setLoading(false);
    }
  };

  const routeToFirst = async () => {
    if (!resp || !resp.item_ids?.length) return;
    if (!user) return;
    const id = resp.item_ids[0];
    const it = items.find(x => x.id === id);
    if (!it) return;
    try { await compute(user, { x: it.x, y: it.y }); } catch {}
    router.push("/(tabs)/ar");
  };

  const addToSelectedList = async () => {
    if (!resp || !resp.item_ids?.length) return;
    let listId = selectedListId;
    if (!listId) {
      // Create default list if none selected
      const l = await create("Recommendations");
      listId = l.id;
      setSelectedListId(listId);
    }
    await appendItems(listId!, resp.item_ids);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0b0b0f" }} edges={["top"]}>
      <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Chatbot</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Асуултаа бичнэ үү"
          placeholderTextColor="#888"
          onSubmitEditing={ask}
          style={{ flex: 1, backgroundColor: '#121212', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#333' }}
        />
        <Pressable onPress={ask} disabled={loading} style={{ backgroundColor: loading ? '#555' : '#1e90ff', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{loading ? '...' : 'Send'}</Text>
        </Pressable>
      </View>

      {error && (
        <Text style={{ color: '#ff6b6b', marginTop: 8 }}>Алдаа: {error}</Text>
      )}

      <ScrollView style={{ marginTop: 12 }}>
        {resp && (
          <View style={{ backgroundColor: '#111', borderRadius: 8, padding: 12 }}>
            <Text style={{ color: '#aaa', marginBottom: 6 }}>Intent: <Text style={{ color: '#fff' }}>{resp.intent}</Text></Text>
            <Text style={{ color: '#fff', marginBottom: 10 }}>{resp.reply}</Text>
            {resolved.length > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={{ color: '#aaa' }}>Items:</Text>
                {resolved.map(({ id, item }) => (
                  <Text key={id} style={{ color: '#fff' }}>#{id} • {item?.name ?? 'Unknown'}</Text>
                ))}
              </View>
            )}
            {resp.intent === 'recommendation' && resolved.length > 0 && (
              <View style={{ marginTop: 12, gap: 8 }}>
                <Text style={{ color: '#aaa' }}>Add to list:</Text>
                {/* Simple picker substitute */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                  {safeLists.map((l, i) => {
                    const lid = (l as any)?.id ?? i;
                    const lname = (l as any)?.name;
                    const isSel = selectedListId != null && (l as any)?.id === selectedListId;
                    return (
                      <Pressable key={String(lid)} onPress={() => { const idVal = (l as any)?.id; if (typeof idVal === 'number') setSelectedListId(idVal); }} style={{ backgroundColor: isSel ? '#1e90ff' : '#333', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 }}>
                        <Text style={{ color: '#fff' }}>{lname || `List #${lid}`}</Text>
                      </Pressable>
                    );
                  })}
                  <Pressable onPress={async () => { const l = await create('New List'); setSelectedListId(l.id); }} style={{ backgroundColor: '#2e8b57', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ color: '#fff' }}>+ New</Text>
                  </Pressable>
                </ScrollView>
                <Pressable onPress={addToSelectedList} style={{ backgroundColor: '#2e8b57', borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Add items</Text>
                </Pressable>
              </View>
            )}
            {resolved.length > 0 && (
              <Pressable onPress={routeToFirst} style={{ marginTop: 12, backgroundColor: '#1e90ff', borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Route to first result</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}
