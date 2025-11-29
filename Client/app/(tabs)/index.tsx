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
  Divider,
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
  const handleQuickCreateList = React.useCallback(async () => {
    const l = await create(`목록 ${safeLists.length + 1}`);
    setSelectedListId(l.id);
  }, [create, safeLists.length]);

  const selectedListName = React.useMemo(() => {
    const l = safeLists.find((x: any) => (x as any)?.id === selectedListId);
    return (l as any)?.name || (selectedListId != null ? `목록 #${selectedListId}` : "없음");
  }, [safeLists, selectedListId]);

  const totalLists = safeLists.length;
  const { totalQty, totalValue } = useMemo(() => {
    let qty = 0;
    let value = 0;
    for (const list of safeLists) {
      const listId = (list as any)?.id ?? 0;
      const ids: number[] = (list as any)?.item_ids || [];
      for (const id of ids) {
        const amount = getQty(listId, id);
        qty += amount;
        const item: any = itemsById.get(id);
        if (item) {
          value += effectivePrice(item) * amount;
        }
      }
    }
    return { totalQty: qty, totalValue: value };
  }, [safeLists, itemsById, quantities]);
  const totalValueText = fmtPrice(totalValue) ?? "0 ₩";
  const martAddress =
    mart && typeof (mart as any)?.address === "string"
      ? String((mart as any).address)
      : undefined;
  const heroSubtitle = mart?.name
    ? `${mart.name}${martAddress ? ` · ${martAddress}` : ""}`
    : `총 ${totalLists}개 목록과 ${totalQty || 0}개 상품을 한눈에 관리해보세요.`;
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [modalImageUri, setModalImageUri] = useState<string | null>(null);

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
      <Box
        key={it.id}
        bg="#151728"
        borderWidth={1}
        borderColor="#1f233d"
        rounded="2xl"
        px={3}
        py={3}
        mb={2}
        shadow={1}
      >
        <HStack alignItems="center" space={3}>
          <Pressable style={{ flex: 1 }} onPress={() => onAddFromSearch(it.id)}>
            <HStack alignItems="center" space={3}>
              {uri ? (
                <Image
                  source={{ uri }}
                  alt={it?.name || String(it?.id)}
                  width={12}
                  height={12}
                  borderRadius={12}
                />
              ) : (
                <Box width={12} height={12} borderRadius={12} bg="#1f2937" />
              )}
              <VStack flex={1} space={0.5}>
                <Text color="white" fontWeight="600" numberOfLines={1}>
                  {it?.name ?? `#${it?.id}`}
                </Text>
                <HStack space={2} alignItems="center" flexWrap="wrap">
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
          <Button
            size="sm"
            colorScheme="emerald"
            variant="solid"
            onPress={() => onAddFromSearch(it.id)}
          >
            담기
          </Button>
        </HStack>
      </Box>
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
        <VStack space={3}>
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
              <Text color="white" fontSize="md" fontWeight="600" numberOfLines={2}>
                {it?.name ?? `#${id}`}
              </Text>
              <HStack alignItems="center" flexWrap="wrap" space={2}>
                {saleActive && (
                  <Text
                    color="#9ca3af"
                    fontSize="xs"
                    textDecorationLine="line-through"
                  >
                    {fmtPrice(basePrice)}
                  </Text>
                )}
                <Text color="#f1f5f9" fontSize="sm" fontWeight="700">
                  {fmtPrice(unit)}
                </Text>
                <Text color="#9ca3af" fontSize="xs">
                  합계 {fmtPrice(line)}
                </Text>
              </HStack>
              <HStack alignItems="center" flexWrap="wrap" space={1}>
                {cat && (
                  <Badge
                    colorScheme="coolGray"
                    rounded="full"
                    px={2}
                    py={0.5}
                    _text={{ fontSize: 9 }}
                  >
                    {cat}
                  </Badge>
                )}
                {saleInfo && (
                  <Badge
                    colorScheme="rose"
                    rounded="full"
                    px={2}
                    py={0.5}
                    _text={{ fontSize: 9 }}
                  >
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
            </VStack>
          </Pressable>
        </HStack>
        <HStack space={3} alignItems="center" justifyContent="space-between">
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
        </HStack>
        </VStack>
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
      style={{ flex: 1, backgroundColor: "#05050b" }}
      edges={["top"]}
    >
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 48,
          paddingTop: 12,
        }}
      >
        <VStack space={5}>
          <Box
            bg="#16182c"
            borderWidth={1}
            borderColor="#242949"
            rounded="3xl"
            p={5}
            shadow={6}
          >
            <Text color="#7c84b5" fontSize="xs" letterSpacing={1.5}>
              스마트 쇼핑
            </Text>
            <Heading color="white" mt={2} size="lg">
              {mart?.name || "내 장보기 허브"}
            </Heading>
            <Text color="#cfd4f4" mt={1} fontSize="sm">
              {heroSubtitle}
            </Text>
            <HStack mt={5} space={3}>
              <Box
                flex={1}
                bg="#1d2040"
                px={4}
                py={3}
                rounded="2xl"
                borderWidth={1}
                borderColor="#2f3559"
              >
                <Text color="#9ea6d8" fontSize="xs">
                  총 목록
                </Text>
                <Heading color="white" size="md">
                  {totalLists}
                </Heading>
              </Box>
              <Box
                flex={1}
                bg="#1d2040"
                px={4}
                py={3}
                rounded="2xl"
                borderWidth={1}
                borderColor="#2f3559"
              >
                <Text color="#9ea6d8" fontSize="xs">
                  총 수량
                </Text>
                <Heading color="white" size="md">
                  {totalQty}
                </Heading>
              </Box>
              <Box
                flex={1}
                bg="#1d2040"
                px={4}
                py={3}
                rounded="2xl"
                borderWidth={1}
                borderColor="#2f3559"
              >
                <Text color="#9ea6d8" fontSize="xs">
                  예상 금액
                </Text>
                <Heading color="white" size="md">
                  {totalValueText}
                </Heading>
              </Box>
            </HStack>
            <Button
              mt={5}
              colorScheme="info"
              leftIcon={<Icon as={Plus} color="white" size="sm" />}
              borderRadius="full"
              onPress={handleQuickCreateList}
            >
              빠른 목록 만들기
            </Button>
          </Box>

          <VStack space={3}>
            <HStack alignItems="center" justifyContent="space-between">
              <Heading color="white" size="sm">
                목록 관리
              </Heading>
              <Text color="#7f86ad" fontSize="xs">
                원하는 목록을 선택해 상품을 추가하세요.
              </Text>
            </HStack>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 6 }}
            >
              <HStack space={3}>
                {safeLists.map((l, i) => {
                  const lid = (l as any)?.id ?? i;
                  const lname = (l as any)?.name || `목록 #${lid}`;
                  const isSel =
                    selectedListId != null && (l as any)?.id === selectedListId;
                  const qty = listTotalQty(l);
                  const total = fmtPrice(listTotal(l));
                  return (
                    <Pressable
                      key={String(lid)}
                      onPress={() => {
                        const idVal = (l as any)?.id;
                        if (typeof idVal === "number") setSelectedListId(idVal);
                      }}
                    >
                      <Box
                        px={4}
                        py={3}
                        borderRadius={24}
                        borderWidth={1}
                        borderColor={isSel ? "#47a5ff" : "#22263e"}
                        bg={isSel ? "#1d2842" : "#0f1324"}
                      >
                        <Text
                          color={isSel ? "#ffffff" : "#c0c6e4"}
                          fontWeight="700"
                        >
                          {lname}
                        </Text>
                        <Text color="#8e94b8" fontSize="xs">
                          {qty}개 · {total}
                        </Text>
                      </Box>
                    </Pressable>
                  );
                })}
                <Pressable onPress={handleQuickCreateList}>
                  <Box
                    px={4}
                    py={3}
                    borderRadius={24}
                    borderWidth={1}
                    borderColor="#2b2f4a"
                    borderStyle="dashed"
                    bg="#0d101f"
                  >
                    <HStack space={1} alignItems="center">
                      <Icon as={Plus} color="#9ea6d8" size="xs" />
                      <Text color="#c3c9ef">새 목록</Text>
                    </HStack>
                    <Text color="#6e7397" fontSize="xs">
                      빠르게 시작
                    </Text>
                  </Box>
                </Pressable>
              </HStack>
            </ScrollView>
            <Box
              bg="#111423"
              px={4}
              py={3}
              rounded="2xl"
              borderWidth={1}
              borderColor="#1f2338"
            >
              <Text color="#7f86ad" fontSize="xs">
                현재 추가 대상
              </Text>
              <Text color="#f8fafc" fontSize="md" fontWeight="700">
                {selectedListName}
              </Text>
            </Box>
          </VStack>

          <Box
            bg="#0f111d"
            borderWidth={1}
            borderColor="#1b1f33"
            rounded="3xl"
            p={5}
            shadow={2}
          >
            <Heading color="white" size="sm">
              상품 검색
            </Heading>
            <Text color="#8087ad" fontSize="xs" mt={1}>
              검색 결과를 누르거나 담기 버튼을 눌러 선택된 목록에 추가하세요.
            </Text>
            <Box
              mt={4}
              bg="#15182b"
              borderRadius={20}
              borderWidth={1}
              borderColor="#232743"
              px={4}
              py={2}
            >
              <HStack alignItems="center" space={3}>
                <MagnifyingGlass size={20} color="#9ca3af" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="상품 이름을 입력하세요"
                  placeholderTextColor="#6e7397"
                  style={{
                    flex: 1,
                    color: "#f8fafc",
                    fontSize: 15,
                    paddingVertical: 8,
                  }}
                />
                {search.length > 0 && (
                  <Pressable onPress={() => setSearch("")}>
                    <Text color="#7f86ad" fontSize="xs">
                      초기화
                    </Text>
                  </Pressable>
                )}
              </HStack>
            </Box>
            {search.trim().length > 0 && (
              <ScrollView
                style={{ marginTop: 12, maxHeight: 260 }}
                contentContainerStyle={{ paddingVertical: 4 }}
              >
                {results.map((it) => renderSearchRow(it))}
                {results.length === 0 && (
                  <Text color="#8188ab" textAlign="center" py={3}>
                    결과가 없습니다.
                  </Text>
                )}
              </ScrollView>
            )}
          </Box>

          <VStack space={3}>
            <Heading color="white" size="sm">
              목록 상세
            </Heading>
            {safeLists.map((l, i) => {
              const listId = (l as any)?.id ?? i;
              const hasItems = (l.item_ids || []).length > 0;
              const qty = listTotalQty(l);
              const totalLabel = fmtPrice(listTotal(l));
              const isTarget = selectedListId === listId;
              return (
                <Box
                  key={String(listId)}
                  bg="#101223"
                  borderWidth={1}
                  borderColor="#1e2137"
                  rounded="3xl"
                  p={4}
                  shadow={1}
                >
                  <HStack alignItems="center" justifyContent="space-between">
                    <VStack flex={1} space={0.5}>
                      <Text color="#6f769a" fontSize="xs">
                        쇼핑 목록
                      </Text>
                      <Heading color="white" size="md">
                        {(l as any)?.name || `목록 #${listId}`}
                      </Heading>
                      <Text color="#9299c2" fontSize="xs">
                        {qty}개 · {totalLabel}
                      </Text>
                    </VStack>
                    {isTarget && (
                      <Badge colorScheme="info" rounded="full" _text={{ fontSize: 10 }}>
                        현재 선택
                      </Badge>
                    )}
                  </HStack>
                  <Divider my={4} bg="#1e233a" />
                  {hasItems ? (
                    <VStack space={2}>
                      {(l.item_ids || []).map((id: number) =>
                        renderListItemRow(l, id)
                      )}
                    </VStack>
                  ) : (
                    <Text color="#6e7397">
                      아직 담은 상품이 없습니다. 검색해서 담아보세요.
                    </Text>
                  )}
                  <Divider my={4} bg="#1e233a" />
                  <HStack space={2}>
                    <Button
                      flex={1}
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
                      variant="outline"
                      colorScheme="coolGray"
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
                  <HStack space={2} mt={2}>
                    <Button
                      flex={1}
                      variant="ghost"
                      leftIcon={<Icon as={PencilSimple} color="white" size="xs" />}
                      onPress={async () => {
                        /* TODO: rename modal */
                      }}
                    >
                      이름 변경
                    </Button>
                    <Button
                      flex={1}
                      colorScheme="rose"
                      variant="outline"
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
                </Box>
              );
            })}
            {lists.length === 0 && (
              <Text color="#9ca3af" textAlign="center" mt={4}>
                목록이 없습니다. 새 목록을 만들어 보세요.
              </Text>
            )}
          </VStack>
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
    </SafeAreaView>
  );
}
