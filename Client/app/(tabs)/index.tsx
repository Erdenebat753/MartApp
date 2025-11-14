import React, { useMemo, useState } from "react";
import { Alert, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useItems } from "../../hooks/useItems";
import { useCategories } from "../../hooks/useCategories";
import { useMartMeta } from "../../hooks/useMartMeta";
import { useLists } from "../../hooks/useLists";
import {
  Box,
  Button,
  HStack,
  VStack,
  Text,
  ScrollView,
  Badge,
  Icon,
  Heading,
  Image,
  Modal,
} from "native-base";
import {
  MagnifyingGlass,
  Plus,
  Trash,
  PencilSimple,
} from "phosphor-react-native";
import { API_BASE } from "../../constants/api";

export default function HomePage() {
  const router = useRouter();
  const { mart } = useMartMeta();
  const { items } = useItems(mart?.id);
  const { categories } = useCategories(mart?.id);
  const catNameOf = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of categories || []) m.set(Number(c.id), String(c.name));
    return m;
  }, [categories]);
  const { lists, create, update, remove, removeItem, appendItems, reload } =
    useLists();
  // Removed free-text list name input; use one-click Add
  const itemsById = useMemo(
    () => new Map(items.map((it) => [it.id, it] as const)),
    [items]
  );
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const resolveImageUrl = (raw?: string | null): string | null => {
    if (!raw || raw.length === 0) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    return `${API_BASE}${raw.startsWith("/") ? "" : "/"}${raw}`;
  };
  const fmtPrice = (p?: number | null): string | null => {
    if (p == null) return null;
    try {
      // 한국 통화 기호: ₩ (U+20A9)
      return Math.round(Number(p)).toLocaleString() + " \u20A9";
    } catch {
      return String(p);
    }
  };

  const safeLists = useMemo(() => (
    Array.isArray(lists) ? (lists as any[]) : ([] as any[])
  ), [lists]);

  // pick first list by default so user can add from search immediately
  React.useEffect(() => {
    if (selectedListId == null && safeLists.length > 0) {
      const idVal = (safeLists[0] as any)?.id;
      if (typeof idVal === "number") setSelectedListId(idVal);
    }
  }, [safeLists, selectedListId]);

  useFocusEffect(
    React.useCallback(() => {
      reload();
    }, [reload])
  );

  const selectedListName = React.useMemo(() => {
    const l = safeLists.find((x: any) => (x as any)?.id === selectedListId);
    return (l as any)?.name || (selectedListId != null ? `List #${selectedListId}` : "없음");
  }, [safeLists, selectedListId]);

  // quantities per list:item (client-side)
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const keyOf = (listId: number, itemId: number) => `${listId}:${itemId}`;
  const getQty = (listId: number, itemId: number) => {
    const q = quantities[keyOf(listId, itemId)];
    return q && q > 0 ? q : 1;
  };
  const setQty = (listId: number, itemId: number, val: number) => {
    const v = Math.max(1, Math.min(9999, Math.floor(Number(val) || 1)));
    setQuantities((prev) => ({ ...prev, [keyOf(listId, itemId)]: v }));
  };
  const incQty = (listId: number, itemId: number) =>
    setQty(listId, itemId, getQty(listId, itemId) + 1);
  const decQty = (listId: number, itemId: number) =>
    setQty(listId, itemId, getQty(listId, itemId) - 1);
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [modalImageUri, setModalImageUri] = useState<string | null>(null);

  const effectivePrice = (it: any): number => {
    const base = Number(it?.price ?? 0) || 0;
    const sp = it?.sale_percent;
    const end = it?.sale_end_at ? new Date(it.sale_end_at) : null;
    const now = new Date();
    const active = sp != null && (!end || now <= end);
    if (active) return Math.max(0, Math.round(base * (1 - Number(sp) / 100)));
    return Math.round(base);
  };
  const saleLeft = (it: any): string | null => {
    if (!it?.sale_percent) return null;
    if (!it?.sale_end_at) return `${it.sale_percent}%`;
    try {
      const end = new Date(it.sale_end_at);
      const now = new Date();
      const diff = end.getTime() - now.getTime();
      if (diff <= 0) return `expired`;
      const mins = Math.floor(diff / 60000);
      const d = Math.floor(mins / (60 * 24));
      const h = Math.floor((mins % (60 * 24)) / 60);
      const m = mins % 60;
      if (d > 0) return `${it.sale_percent}% · ${d}d ${h}h left`;
      if (h > 0) return `${it.sale_percent}% · ${h}h ${m}m left`;
      return `${it.sale_percent}% · ${m}m left`;
    } catch {
      return `${it.sale_percent}%`;
    }
  };

  const onAddFromSearch = async (itemId: number) => {
    if (selectedListId == null) {
      Alert.alert("목록 선택", "먼저 상단에서 목록을 선택하세요.");
      return;
    }
    try {
      await appendItems(selectedListId, [itemId]);
      setSearch("");
    } catch (e: any) {
      Alert.alert("추가 실패", e?.message || String(e));
    }
  };

  const renderSearchRow = (it: any) => {
    const uri = resolveImageUrl(it?.image_url || null);
    const priceText = fmtPrice(it?.price ?? null);
    const cat = it?.category_id != null ? catNameOf.get(Number(it.category_id)) : null;
    return (
      <HStack
        key={it.id}
        alignItems="center"
        justifyContent="space-between"
        px={3}
        py={2.5}
        style={{ borderBottomWidth: 1, borderBottomColor: "#1d1d22" }}
      >
        <Pressable style={{ flex: 1 }} onPress={() => onAddFromSearch(it.id)}>
        <HStack alignItems="center" space={3} flex={1}>
          {uri ? (
            <Image
              source={{ uri }}
              alt={it?.name || String(it?.id)}
              width={10}
              height={10}
              borderRadius={8}
            />
          ) : (
            <Box width={10} height={10} borderRadius={8} bg="#1f2937" />
          )}
          <VStack flex={1} space={0.5}>
            <Text color="white" numberOfLines={1}>
              {it?.name ?? `#${it?.id}`}
            </Text>
            <HStack space={2} alignItems="center">
              {priceText && (
                <Text color="#9ca3af" fontSize="xs">
                  {priceText}
                </Text>
              )}
              {cat && (
                <Badge colorScheme="coolGray" rounded="full" _text={{ fontSize: 10 }}>
                  {cat}
                </Badge>
              )}
              {it?.sale_percent != null && (
                <Badge
                  colorScheme="rose"
                  rounded="full"
                  _text={{ fontSize: 10 }}
                >{`${it.sale_percent}%`}</Badge>
              )}
            </HStack>
          </VStack>
        </HStack>
        </Pressable>
        <HStack space={2}>
          <Button size="sm" colorScheme="emerald" onPress={() => onAddFromSearch(it.id)}>
            담기
          </Button>
        </HStack>
      </HStack>
    );
  };

  const renderListItemRow = (list: any, id: number) => {
    const it: any = itemsById.get(id);
    const uri = it ? resolveImageUrl(it.image_url || null) : null;
    const listId = (list as any)?.id ?? 0;
    const q = getQty(listId, id);
    const unit = it ? effectivePrice(it) : 0;
    const line = unit * q;
    const saleInfo = it ? saleLeft(it) : null;
    const note = it?.note || null;
    const description = it?.description || null;
    const cat = it?.category_id != null ? catNameOf.get(Number(it.category_id)) : null;
    const basePrice = Math.round(Number(it?.price ?? 0) || 0);
    const salePercent =
      it?.sale_percent != null ? Number(it.sale_percent) : null;
    const saleEndDate = it?.sale_end_at ? new Date(it.sale_end_at) : null;
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
    const isExpanded = expandedItemId === id;
    return (
      <Box
        key={id}
        bg="#12121a"
        borderWidth={1}
        borderColor="#1c1c24"
        rounded="xl"
        px={3}
        py={3}
        shadow={1}
      >
        <HStack alignItems="center" space={4}>
          <Pressable
            onPress={() => {
              setExpandedItemId(isExpanded ? null : id);
            }}
            onLongPress={() => uri && setModalImageUri(uri)}
            delayLongPress={250}
            hitSlop={10}
            style={{ borderRadius: 16 }}
          >
            {uri ? (
              <Image
                source={{ uri }}
                alt={it?.name || String(id)}
                width={16}
                height={16}
                borderRadius={16}
              />
            ) : (
              <Box
                width={16}
                height={16}
                borderRadius={16}
                bg="#1f2937"
              />
            )}
          </Pressable>
          <Pressable
            onPress={() => setExpandedItemId(isExpanded ? null : id)}
            style={{ flex: 1 }}
          >
            <VStack flex={1} space={1}>
              <HStack alignItems="flex-start" justifyContent="space-between">
                <Text color="white" fontSize="md" fontWeight="600" numberOfLines={1}>
                  {it?.name ?? `#${id}`}
                </Text>
                <VStack alignItems="flex-end" space={0}>
                  {saleActive && (
                    <Text
                      color="#9ca3af"
                      fontSize="xs"
                      textDecorationLine="line-through"
                    >
                      {fmtPrice(basePrice)}
                    </Text>
                  )}
                  <Text color="#e5e7eb" fontSize="sm">
                    {fmtPrice(unit)}
                  </Text>
                </VStack>
              </HStack>
              <HStack alignItems="center" flexWrap="wrap" space={1}>
                {cat && (
                  <Badge colorScheme="coolGray" rounded="full" _text={{ fontSize: 10 }}>
                    {cat}
                  </Badge>
                )}
                {saleInfo && (
                  <Badge colorScheme="rose" rounded="full" _text={{ fontSize: 10 }}>
                    {saleInfo}
                  </Badge>
                )}
              </HStack>
              {isExpanded && (
                <>
                  {note && (
                    <Text color="#9ca3af" fontSize="xs" numberOfLines={1}>
                      {note}
                    </Text>
                  )}
                  {description && (
                    <Text color="#7c88a1" fontSize="xs" numberOfLines={2}>
                      {description}
                    </Text>
                  )}
                  {saleActive && salePercent != null && (
                    <Text color="#fbbf24" fontSize="xs">
                      -{salePercent}% 할인{" "}
                      {saleEndsLabel ? `· ${saleEndsLabel}까지` : "· 종료일 미정"}
                    </Text>
                  )}
                </>
              )}
              <Text color="#9ca3af" fontSize="xs">
                합계 {fmtPrice(line)}
              </Text>
            </VStack>
          </Pressable>
          <VStack space={2} alignItems="flex-end">
            <HStack space={1}>
              <Button size="sm" variant="ghost" onPress={() => decQty(listId, id)}>
                -
              </Button>
              <TextInput
                value={String(q)}
                onChangeText={(t) => setQty(listId, id, Number(t))}
                keyboardType="numeric"
                style={{
                  width: 56,
                  backgroundColor: "#0d0d13",
                  color: "#ffffff",
                  textAlign: "center",
                  borderRadius: 8,
                  paddingHorizontal: 6,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: "#1c1c24",
                }}
              />
              <Button size="sm" variant="ghost" onPress={() => incQty(listId, id)}>
                +
              </Button>
            </HStack>
            <Button
              size="sm"
              variant="ghost"
              colorScheme="rose"
              onPress={() => removeItem(listId, id)}
            >
              삭제
            </Button>
          </VStack>
        </HStack>
      </Box>
    );
  };

  const listTotalQty = (list: any) => {
    const listId = (list as any)?.id ?? 0;
    const ids: number[] = (list as any)?.item_ids || [];
    let sum = 0;
    for (const id of ids) {
      sum += getQty(listId, id);
    }
    return sum;
  };

  const listTotal = (list: any) => {
    const listId = (list as any)?.id ?? 0;
    const ids: number[] = (list as any)?.item_ids || [];
    let sum = 0;
    for (const id of ids) {
      const it: any = itemsById.get(id);
      if (!it) continue;
      sum += effectivePrice(it) * getQty(listId, id);
    }
    return sum;
  };
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [] as typeof items;
    return (items || [])
      .filter((it) => (it.name || "").toLowerCase().includes(q))
      .slice(0, 15);
  }, [search, items]);
  // addItemToSelected removed (no quick-add from search)

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#0b0b0f" }}
      edges={["top"]}
    >
      <Box flex={1} bg="#0b0b0f" p={4}>
        <HStack alignItems="center" justifyContent="space-between" mb={3}>
          <Heading color="white" size="md">
            내 목록
          </Heading>
          <Box />
        </HStack>

        {/* Add button removed per request */}

        {/* Target list selector for adding items from search */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, marginBottom: 10 }}
        >
          <HStack space={2}>
            {safeLists.map((l, i) => {
              const lid = (l as any)?.id ?? i;
              const lname = (l as any)?.name;
              const isSel =
                selectedListId != null && (l as any)?.id === selectedListId;
              return (
                <Button
                  key={String(lid)}
                  size="sm"
                  variant={isSel ? "solid" : "subtle"}
                  colorScheme={isSel ? "info" : "coolGray"}
                  borderRadius={999}
                  px={3}
                  py={1.5}
                  onPress={() => {
                    const idVal = (l as any)?.id;
                    if (typeof idVal === "number") setSelectedListId(idVal);
                  }}
                >
                  <Text color="white">{lname || `List #${lid}`}</Text>
                </Button>
              );
            })}
            <Badge
              onTouchEnd={async () => {
                const l = await create("New List");
                setSelectedListId(l.id);
              }}
              rounded="full"
              variant="solid"
              colorScheme="emerald"
              px={3}
              py={1.5}
            >
              <HStack space={1} alignItems="center">
                <Icon as={Plus} color="white" size="xs" />
                <Text color="white">New</Text>
              </HStack>
            </Badge>
          </HStack>
        </ScrollView>

        {/* Show selected list prominently so users know the target */}
        <HStack alignItems="center" mb={2}>
          <Text color="#9ca3af">선택된 목록: </Text>
          <Text color="#e5e7eb" fontWeight="700">{selectedListName}</Text>
        </HStack>

        {/* Item search to add into the selected list */}
        <HStack space={2} mb={3} alignItems="center">
          {/* Use RN TextInput to avoid outlineWidth casting bug on Android */}
          <MagnifyingGlass size={20} color="#9ca3af" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="검색..."
            placeholderTextColor="#9ca3af"
            style={{
              flex: 1,
              backgroundColor: "#121212",
              color: "#ffffff",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: "#333333",
            }}
          />
        </HStack>

        {search.trim().length > 0 && (
          <Box maxH={220} bg="#0f0f12" rounded="md" mb={3}>
            <ScrollView>
              {results.map((it) => renderSearchRow(it))}
              {results.length === 0 && (
                <Text color="#9ca3af" px={3} py={3}>
                  결과가 없습니다.
                </Text>
              )}
            </ScrollView>
          </Box>
        )}

        <ScrollView style={{ flex: 1 }}>
          <VStack space={2}>
            {safeLists.map((l, i) => (
              <Box
                key={String((l as any)?.id ?? i)}
                bg="#111"
                rounded="md"
                p={3}
              >
                <HStack alignItems="center" justifyContent="space-between">
                  <Heading color="white" size="sm">
                    {(l as any)?.name || `List #${(l as any)?.id ?? i}`}
                  </Heading>
                  <HStack space={2}>
                    <Button
                      variant="subtle"
                      leftIcon={
                        <Icon as={PencilSimple} color="white" size="xs" />
                      }
                      onPress={async () => {
                        /* TODO: rename modal */
                      }}
                    >
                      이름 변경
                    </Button>
                    <Button
                      colorScheme="rose"
                      variant="solid"
                      leftIcon={<Icon as={Trash} color="white" size="xs" />}
                      onPress={async () => {
                        Alert.alert(
                          "삭제하시겠습니까?",
                          "이 목록을 정말 삭제하시겠습니까?",
                          [
                            { text: "취소", style: "cancel" },
                            {
                              text: "삭제",
                              style: "destructive",
                              onPress: async () => {
                                const idVal = (l as any)?.id;
                                if (typeof idVal === "number") {
                                  await remove(idVal);
                                  if (selectedListId === idVal)
                                    setSelectedListId(null);
                                }
                              },
                            },
                          ]
                        );
                      }}
                    >
                      삭제
                    </Button>
                  </HStack>
                </HStack>
                <Text color="#aaa" mt={1}>
                  항목:{" "}
                  {Array.isArray((l as any)?.item_ids)
                    ? (l as any).item_ids.length
                    : 0}
                  {" · "}
                  수량 합계: {listTotalQty(l)}
                </Text>
                {(l.item_ids || []).length > 0 && (
                  <VStack mt={2} space={1.5}>
                    {(l.item_ids || []).map((id: number) =>
                      renderListItemRow(l, id)
                    )}
                  </VStack>
                )}
                <HStack alignItems="center" justifyContent="flex-end" mt={2}>
                  <Text color="#9ca3af" mr={2}>
                    합계:
                  </Text>
                  <Text color="#e5e7eb" fontWeight="700">
                    {fmtPrice(listTotal(l))}
                  </Text>
                </HStack>
                <HStack space={2} mt={2.5}>
                  <Button
                    colorScheme="info"
                    onPress={() => {
                      const idVal = (l as any)?.id;
                      router.push({
                        pathname: "/(tabs)/ar",
                        params: idVal != null ? { listId: String(idVal) } : {},
                      });
                    }}
                  >
                    AR 열기
                  </Button>
                  <Button
                    variant="subtle"
                    onPress={async () => {
                      const idVal = (l as any)?.id;
                      if (typeof idVal === "number") {
                        await update(idVal, { item_ids: [] });
                      }
                    }}
                  >
                    비우기
                  </Button>
                </HStack>
              </Box>
            ))}
            {lists.length === 0 && (
              <Text color="#9ca3af" textAlign="center" mt={4}>
                목록이 없습니다. 새 목록을 만들어 보세요.
              </Text>
            )}
          </VStack>
        </ScrollView>
        <Modal
          isOpen={Boolean(modalImageUri)}
          onClose={() => setModalImageUri(null)}
          size="full"
        >
          <Modal.Content bg="#0b0b0f" maxWidth="90%" rounded="2xl">
            <Modal.CloseButton />
            <Modal.Body>
              {modalImageUri && (
                <Image
                  source={{ uri: modalImageUri }}
                  alt="item"
                  width="100%"
                  height={260}
                  borderRadius={16}
                  resizeMode="contain"
                />
              )}
            </Modal.Body>
          </Modal.Content>
        </Modal>
      </Box>
    </SafeAreaView>
  );
}
