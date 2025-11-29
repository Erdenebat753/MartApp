import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { API_BASE } from "../../constants/api";
import { useItems } from "../../hooks/useItems";
import { useMartMeta } from "../../hooks/useMartMeta";
import { useRouteCompute } from "../../hooks/useRoute";
import { useSlamStart } from "../../hooks/useSlamStart";
import { useLists, ItemList } from "../../hooks/useLists";

type ChatbotResp = { intent: string; item_ids: number[]; reply: string };

export default function ChatTab() {
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
  const totalLists = safeLists.length;

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
  const heroTitle = mart?.name || "스마트 쇼핑 챗봇";
  const heroSubtitle =
    mart?.name != null
      ? `${mart.name}에서 챗봇에게 필요한 상품을 물어보세요.`
      : "AI에게 원하는 상품을 말하면 바로 추천해 드릴게요.";
  const matchesLabel =
    resolved.length > 0 ? `${resolved.length}개 추천` : "추천 대기 중";
  const lastInteraction =
    resp && resp.item_ids?.length
      ? new Date().toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

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
      setStatusMessage("최소 한 개의 상품을 선택하세요.");
      return;
    }
    let listId = selectedListId;
    let fallbackList: ItemList | null = null;
    if (!listId) {
      const l = await create("추천 목록");
      listId = l.id;
      fallbackList = l;
      setSelectedListId(listId);
    }
    try {
      setAdding(true);
      await appendItems(listId!, toAdd, fallbackList ?? undefined);
      setStatusMessage("목록에 상품을 추가했습니다.");
      setError(null);
    } catch (e: any) {
      setStatusMessage(null);
      setError(e?.message || String(e));
    } finally {
      setAdding(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>스마트 어시스턴트</Text>
          <Text style={styles.heroTitle}>{heroTitle}</Text>
          <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatBox}>
              <Text style={styles.heroStatLabel}>목록 수</Text>
              <Text style={styles.heroStatValue}>{totalLists}</Text>
            </View>
            <View style={styles.heroStatBox}>
              <Text style={styles.heroStatLabel}>최근 추천</Text>
              <Text style={styles.heroStatValue}>{matchesLabel}</Text>
            </View>
            <View style={styles.heroStatBox}>
              <Text style={styles.heroStatLabel}>마지막 대화</Text>
              <Text style={styles.heroStatValue}>
                {lastInteraction || "-"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>챗봇에게 질문하기</Text>
              <Text style={styles.sectionCaption}>
                원하는 상품을 적으면 AI가 바로 추천해 드립니다.
              </Text>
            </View>
          </View>
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="예: 국거리 소고기 찾아줘"
              placeholderTextColor="#7f8395"
              onSubmitEditing={ask}
              style={styles.textInput}
            />
            <Pressable
              onPress={ask}
              disabled={loading}
              style={[
                styles.primaryButton,
                loading && styles.primaryButtonDisabled,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? "..." : "전송"}
              </Text>
            </Pressable>
          </View>
          {error && <Text style={styles.errorText}>에러: {error}</Text>}
        </View>

        {resp ? (
          <View style={styles.responseCard}>
            <View style={styles.intentRow}>
              <Text style={styles.intentBadge}>{resp.intent}</Text>
              <Text style={styles.intentLabel}>AI 응답</Text>
            </View>
            <Text style={styles.replyText}>{resp.reply}</Text>
            {resolved.length > 0 ? (
              <>
                <View style={styles.matchesRow}>
                  <Text style={styles.matchesLabel}>
                    {resolved.length}개의 상품과 일치합니다.
                  </Text>
                  <View style={styles.matchesActions}>
                    <Pressable onPress={checkAll} style={styles.outlineButton}>
                      <Text style={styles.outlineButtonText}>전체 선택</Text>
                    </Pressable>
                    <Pressable onPress={clearAll} style={styles.outlineButton}>
                      <Text style={styles.outlineButtonText}>선택 해제</Text>
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.subtleText}>
                  선택됨: {checkedCount}/{resolved.length}
                </Text>
                <View style={styles.itemsList}>
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
                        style={[
                          styles.itemCard,
                          isChecked && styles.itemCardActive,
                        ]}
                      >
                        <View style={styles.itemRow}>
                          {uri ? (
                            <Image source={{ uri }} style={styles.itemImage} />
                          ) : (
                            <View style={styles.itemImage} />
                          )}
                          <View style={styles.itemBody}>
                            <Text style={styles.itemName} numberOfLines={2}>
                              {item?.name ?? `#${id}`}
                            </Text>
                            <View style={styles.itemPriceRow}>
                              {saleActive && (
                                <Text style={styles.itemPriceBase}>
                                  {fmtPrice(basePrice)}
                                </Text>
                              )}
                              <Text style={styles.itemPrice}>
                                {fmtPrice(price)}
                              </Text>
                            </View>
                            {item?.note && (
                              <Text style={styles.itemMeta}>{item.note}</Text>
                            )}
                            {item?.description && (
                              <Text style={styles.itemMeta} numberOfLines={2}>
                                {item.description}
                              </Text>
                            )}
                            {saleActive && salePercent != null && (
                              <Text style={styles.itemSale}>
                                -{salePercent}% 할인{" "}
                                {saleEndsLabel
                                  ? `· ${saleEndsLabel}까지`
                                  : "· 종료일 미정"}
                              </Text>
                            )}
                          </View>
                          <View
                            style={[
                              styles.checkbox,
                              isChecked && styles.checkboxActive,
                            ]}
                          >
                            {isChecked && <View style={styles.checkboxDot} />}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <Text style={styles.subtleText}>일치하는 상품이 없습니다.</Text>
            )}
            {resolved.length > 0 && (
              <>
                <Text style={styles.subtleText}>
                  선택한 상품만 목록에 추가됩니다.
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.listChips}
                >
                  {safeLists.map((l, i) => {
                    const lid = (l as any)?.id ?? i;
                    const lname = (l as any)?.name;
                    const isSel =
                      selectedListId != null && (l as any)?.id === selectedListId;
                    return (
                      <Pressable
                        key={String(lid)}
                        onPress={() => {
                          const idVal = (l as any)?.id;
                          if (typeof idVal === "number") setSelectedListId(idVal);
                        }}
                        style={[
                          styles.listChip,
                          isSel && styles.listChipActive,
                        ]}
                      >
                        <Text style={styles.listChipText}>
                          {lname || `목록 #${lid}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={async () => {
                      const l = await create("추천 목록");
                      setSelectedListId(l.id);
                    }}
                    style={[styles.listChip, styles.newListChip]}
                  >
                    <Text style={styles.listChipText}>+ 새 목록</Text>
                  </Pressable>
                </ScrollView>
                <Pressable
                  onPress={addToSelectedList}
                  disabled={adding}
                  style={[
                    styles.secondaryButton,
                    adding && styles.secondaryButtonDisabled,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>
                    {adding ? "추가 중..." : "선택한 상품 담기"}
                  </Text>
                </Pressable>
                {statusMessage && (
                  <Text style={styles.successText}>{statusMessage}</Text>
                )}
              </>
            )}
            {resolved.length > 0 && (
              <Pressable onPress={routeToFirst} style={styles.primaryButtonLarge}>
                <Text style={styles.primaryButtonText}>첫 번째 결과로 이동</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderTitle}>지금 바로 질문해보세요</Text>
            <Text style={styles.placeholderDesc}>
              예) “유기농 우유 추천해줘” 또는 “돼지고기 할인 상품 있어?” 와 같이 자연어로 말하면 됩니다.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#05050b" },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
    gap: 16,
  },
  heroCard: {
    backgroundColor: "#15182b",
    borderRadius: 32,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1f2340",
  },
  heroEyebrow: {
    color: "#7d83af",
    fontSize: 12,
    letterSpacing: 1,
  },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "700", marginTop: 6 },
  heroSubtitle: { color: "#cbd1ff", marginTop: 4, fontSize: 13 },
  heroStatsRow: { flexDirection: "row", marginTop: 16, gap: 8 },
  heroStatBox: {
    flex: 1,
    backgroundColor: "#1d2038",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "#262a47",
  },
  heroStatLabel: { color: "#9ba0c6", fontSize: 12 },
  heroStatValue: { color: "#fff", fontSize: 16, fontWeight: "600" },
  sectionCard: {
    backgroundColor: "#0f111d",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#191c2d",
    gap: 12,
  },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between" },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  sectionCaption: { color: "#8e93ad", fontSize: 13, marginTop: 4 },
  inputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  textInput: {
    flex: 1,
    backgroundColor: "#16192c",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#262b4d",
  },
  primaryButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
  },
  primaryButtonDisabled: { backgroundColor: "#4c5b85" },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  errorText: { color: "#ff6b6b" },
  responseCard: {
    backgroundColor: "#0f111d",
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1d2136",
    gap: 12,
  },
  intentRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  intentBadge: {
    color: "#fff",
    backgroundColor: "#1e40af",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "600",
  },
  intentLabel: { color: "#8087ad", fontSize: 12 },
  replyText: { color: "#f8fafc", fontSize: 15, lineHeight: 21 },
  matchesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  matchesLabel: { color: "#9ca3af", fontSize: 13 },
  matchesActions: { flexDirection: "row", gap: 8 },
  outlineButton: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  outlineButtonText: { color: "#e2e8f0", fontSize: 12 },
  subtleText: { color: "#7f87a5", fontSize: 12 },
  itemsList: { gap: 10 },
  itemCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e2134",
    backgroundColor: "#151728",
    padding: 12,
  },
  itemCardActive: { borderColor: "#3b82f6" },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "#1f2337",
  },
  itemBody: { flex: 1 },
  itemName: { color: "#fff", fontWeight: "600" },
  itemPriceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemPriceBase: {
    color: "#9ca3af",
    fontSize: 12,
    textDecorationLine: "line-through",
  },
  itemPrice: { color: "#f1f5f9", fontSize: 15, fontWeight: "700" },
  itemMeta: { color: "#7c88a1", fontSize: 12, marginTop: 2 },
  itemSale: { color: "#fbbf24", fontSize: 12, marginTop: 4 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f445c",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxActive: { borderColor: "#3b82f6" },
  checkboxDot: {
    width: 12,
    height: 12,
    borderRadius: 4,
    backgroundColor: "#3b82f6",
  },
  listChips: { flexGrow: 0, marginTop: 6 },
  listChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1c1f2f",
    borderWidth: 1,
    borderColor: "#272c41",
    marginRight: 8,
  },
  listChipActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  listChipText: { color: "#f8fafc", fontSize: 12 },
  newListChip: { backgroundColor: "#34d399", borderColor: "#34d399" },
  secondaryButton: {
    marginTop: 8,
    backgroundColor: "#25634a",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonDisabled: { backgroundColor: "#1f4736" },
  secondaryButtonText: { color: "#fff", fontWeight: "700" },
  successText: { color: "#80ffb3", fontSize: 12, marginTop: 4 },
  primaryButtonLarge: {
    marginTop: 12,
    backgroundColor: "#3b82f6",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  placeholderCard: {
    backgroundColor: "#101223",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1c1f32",
  },
  placeholderTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  placeholderDesc: { color: "#9ca3af", marginTop: 6, lineHeight: 20 },
});
