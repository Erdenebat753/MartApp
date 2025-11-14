import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Image } from "react-native";
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
  // dimensions currently unused; omit destructuring to avoid lint warnings
  const router = useRouter();
  const { mart } = useMartMeta();
  const { items } = useItems(mart?.id);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<ChatbotResp | null>(null);
  const { compute } = useRouteCompute();
  const [user, setUser] = useState<{ x: number; y: number } | null>(null);
  const [, setHeading] = useState<number>(0);
  const { lists, create, appendItems } = useLists();
  const safeLists = Array.isArray(lists) ? (lists as any[]) : ([] as any[]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [checkedIds, setCheckedIds] = useState<Record<number, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Initialize user from slam start (no polling here)
  useSlamStart(
    items,
    (p) => setUser({ x: p.x, y: p.y }),
    (deg) => setHeading(Number(deg || 0))
  );

  const resolved = useMemo(() => {
    const map = new Map(items.map((it) => [it.id, it] as const));
    const ids = resp?.item_ids || [];
    return ids.map((id) => ({ id, item: map.get(id) })).filter(Boolean) as {
      id: number;
      item: any;
    }[];
  }, [resp, items]);

  const resolveImageUrl = (raw?: string | null): string | null => {
    if (!raw || raw.length === 0) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    return `${API_BASE}${raw.startsWith("/") ? "" : "/"}${raw}`;
  };

  const fmtPrice = (value?: number | null) => {
    if (value == null) return "-";
    try {
      return Math.round(Number(value)).toLocaleString() + " ₩";
    } catch {
      return String(value);
    }
  };

  const effectivePrice = (it: any) => {
    const base = Math.round(Number(it?.price ?? 0) || 0);
    const sp = it?.sale_percent;
    if (sp != null && sp > 0) {
      return Math.max(0, Math.round(base * (1 - Number(sp) / 100)));
    }
    return base;
  };

  useEffect(() => {
    if (resp?.item_ids?.length) {
      const next: Record<number, boolean> = {};
      resp.item_ids.forEach((id) => {
        next[id] = true;
      });
      setCheckedIds(next);
    } else {
      setCheckedIds({});
    }
    setStatusMessage(null);
  }, [resp]);

  const toggleCheck = (id: number) => {
    setCheckedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const checkAll = () => {
    const next: Record<number, boolean> = {};
    resolved.forEach(({ id }) => {
      next[id] = true;
    });
    setCheckedIds(next);
  };

  const clearAll = () => {
    setCheckedIds({});
  };

  const checkedCount = resolved.filter((r) => checkedIds[r.id]).length;

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
    const it = items.find((x) => x.id === id);
    if (!it) return;
    try {
      await compute(user, { x: it.x, y: it.y });
    } catch {}
    router.push("/(tabs)/ar");
  };

  const addToSelectedList = async () => {
    if (!resp) return;
    const toAdd = resolved
      .filter((r) => checkedIds[r.id])
      .map((r) => Number(r.id));
    if (toAdd.length === 0) {
      setStatusMessage("Please select at least one item.");
      return;
    }
    let listId = selectedListId;
    if (!listId) {
      const l = await create("Recommendations");
      listId = l.id;
      setSelectedListId(listId);
    }
    try {
      setAdding(true);
      await appendItems(listId!, toAdd);
      setStatusMessage("Items added to the list.");
      setError(null);
    } catch (e: any) {
      setStatusMessage(null);
      setError(e?.message || String(e));
    } finally {
      setAdding(false);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#0b0b0f" }}
      edges={["top"]}
    >
      <View style={{ flex: 1, padding: 16 }}>
        <Text
          style={{
            color: "#fff",
            fontSize: 18,
            fontWeight: "700",
            marginBottom: 8,
          }}
        >
          챗봇
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="질문을 입력하세요"
            placeholderTextColor="#888"
            onSubmitEditing={ask}
            style={{
              flex: 1,
              backgroundColor: "#121212",
              color: "#fff",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: "#333",
            }}
          />
          <Pressable
            onPress={ask}
            disabled={loading}
            style={{
              backgroundColor: loading ? "#555" : "#1e90ff",
              borderRadius: 8,
              paddingHorizontal: 16,
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              {loading ? "..." : "전송"}
            </Text>
          </Pressable>
        </View>

        {error && (
          <Text style={{ color: "#ff6b6b", marginTop: 8 }}>
            에러: {error}
          </Text>
        )}

        <ScrollView style={{ marginTop: 12 }}>
          {resp && (
            <View
              style={{
                backgroundColor: "#111",
                borderRadius: 12,
                padding: 16,
                gap: 10,
              }}
            >
              <Text style={{ color: "#aaa", marginBottom: 4 }}>
                Intent: <Text style={{ color: "#fff" }}>{resp.intent}</Text>
              </Text>
              <Text style={{ color: "#fff" }}>{resp.reply}</Text>
              {resolved.length > 0 ? (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 6,
                    }}
                  >
                    <Text style={{ color: "#9ca3af", fontSize: 12 }}>
                      Matches: {resolved.length}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <Pressable
                        onPress={checkAll}
                        style={{
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: "#2e8b57",
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                        }}
                      >
                        <Text style={{ color: "#fff", fontSize: 12 }}>
                          Check all
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={clearAll}
                        style={{
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: "#444",
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                        }}
                      >
                        <Text style={{ color: "#fff", fontSize: 12 }}>
                          Clear selection
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                  <Text style={{ color: "#777", fontSize: 12 }}>
                    Selected: {checkedCount}/{resolved.length}
                  </Text>
                  <View style={{ marginTop: 10, gap: 10 }}>
                    {resolved.map(({ id, item }) => {
                      const uri = resolveImageUrl(item?.image_url || null);
                      const price = effectivePrice(item);
                      const basePrice = Math.round(
                        Number(item?.price ?? 0) || 0
                      );
                      const salePercent = item?.sale_percent;
                      const saleEndDate = item?.sale_end_at
                        ? new Date(item.sale_end_at)
                        : null;
                      const now = new Date();
                      const saleActive =
                        salePercent != null &&
                        salePercent > 0 &&
                        (!saleEndDate || now <= saleEndDate);
                      const saleEndsLabel = saleEndDate
                        ? saleEndDate.toLocaleString("ko-KR", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : null;
                      const isChecked = Boolean(checkedIds[id]);
                      return (
                        <Pressable
                          key={id}
                          onPress={() => toggleCheck(id)}
                          style={{
                            backgroundColor: "#1a1a1f",
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: isChecked ? "#1e90ff" : "#2b2e38",
                            padding: 12,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 12,
                            }}
                          >
                            {uri ? (
                              <Image
                                source={{ uri }}
                                style={{
                                  width: 64,
                                  height: 64,
                                  borderRadius: 12,
                                  backgroundColor: "#222",
                                }}
                              />
                            ) : (
                              <View
                                style={{
                                  width: 64,
                                  height: 64,
                                  borderRadius: 12,
                                  backgroundColor: "#222",
                                }}
                              />
                            )}
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  color: "#fff",
                                  fontWeight: "600",
                                  marginBottom: 4,
                                }}
                                numberOfLines={1}
                              >
                                {item?.name ?? `#${id}`}
                              </Text>
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                {saleActive && (
                                  <Text
                                    style={{
                                      color: "#9ca3af",
                                      fontSize: 12,
                                      textDecorationLine: "line-through",
                                    }}
                                  >
                                    {fmtPrice(basePrice)}
                                  </Text>
                                )}
                                <Text
                                  style={{
                                    color: "#e5e7eb",
                                    fontSize: 14,
                                    fontWeight: "600",
                                  }}
                                >
                                  {fmtPrice(price)}
                                </Text>
                              </View>
                              {item?.note && (
                                <Text
                                  style={{
                                    color: "#7c88a1",
                                    fontSize: 12,
                                    marginTop: 2,
                                  }}
                                >
                                  {item.note}
                                </Text>
                              )}
                              {item?.description && (
                                <Text
                                  style={{
                                    color: "#7c88a1",
                                    fontSize: 12,
                                    marginTop: 2,
                                  }}
                                  numberOfLines={2}
                                >
                                  {item.description}
                                </Text>
                              )}
                              {saleActive && salePercent != null && (
                                <Text
                                  style={{ color: "#fbbf24", fontSize: 12 }}
                                >
                                  -{salePercent}% 할인 {saleEndsLabel ? `· ${saleEndsLabel}까지` : "· 종료일 미정"}
                                </Text>
                              )}
                            </View>
                            <View
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: isChecked ? "#1e90ff" : "#444",
                                justifyContent: "center",
                                alignItems: "center",
                              }}
                            >
                              {isChecked && (
                                <View
                                  style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: 3,
                                    backgroundColor: "#1e90ff",
                                  }}
                                />
                              )}
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : (
                <Text style={{ color: "#999" }}>No matching items.</Text>
              )}
              {resolved.length > 0 && (
                <>
                  <Text
                    style={{
                      color: "#9ca3af",
                      fontSize: 12,
                      marginTop: 6,
                    }}
                  >
                    Only checked items will be added to a list.
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ flexGrow: 0, marginTop: 6 }}
                  >
                    {safeLists.map((l, i) => {
                      const lid = (l as any)?.id ?? i;
                      const lname = (l as any)?.name;
                      const isSel =
                        selectedListId != null &&
                        (l as any)?.id === selectedListId;
                      return (
                        <Pressable
                          key={String(lid)}
                          onPress={() => {
                            const idVal = (l as any)?.id;
                            if (typeof idVal === "number")
                              setSelectedListId(idVal);
                          }}
                          style={{
                            backgroundColor: isSel ? "#1e90ff" : "#333",
                            borderRadius: 16,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            marginRight: 8,
                          }}
                        >
                          <Text style={{ color: "#fff" }}>
                            {lname || `List #${lid}`}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      onPress={async () => {
                        const l = await create("추천 목록");
                        setSelectedListId(l.id);
                      }}
                      style={{
                        backgroundColor: "#4f9f70",
                        borderRadius: 16,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        marginRight: 8,
                      }}
                    >
                      <Text style={{ color: "#fff" }}>+ New list</Text>
                    </Pressable>
                  </ScrollView>
                  <Pressable
                    onPress={addToSelectedList}
                    disabled={adding}
                    style={{
                      marginTop: 8,
                      backgroundColor: adding ? "#567c59" : "#2e8b57",
                      borderRadius: 10,
                      paddingVertical: 12,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>
                      {adding ? "Adding..." : "Add selected items"}
                    </Text>
                  </Pressable>
                  {statusMessage && (
                    <Text
                      style={{
                        color: "#80ffb3",
                        fontSize: 12,
                        marginTop: 4,
                      }}
                    >
                      {statusMessage}
                    </Text>
                  )}
                </>
              )}
              {resolved.length > 0 && (
                <Pressable
                  onPress={routeToFirst}
                  style={{
                    marginTop: 8,
                    backgroundColor: "#1e90ff",
                    borderRadius: 10,
                    paddingVertical: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>
                    Go to first result
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}