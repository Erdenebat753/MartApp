import React, { useMemo, useState } from "react";
import { Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useItems } from "../../hooks/useItems";
import { useMartMeta } from "../../hooks/useMartMeta";
import { useLists } from "../../hooks/useLists";
import {
  Box,
  Button,
  HStack,
  VStack,
  Text,
  Input,
  ScrollView,
  Badge,
  Icon,
  Heading,
  Image,
} from "native-base";
import {
  MagnifyingGlass,
  Plus,
  Trash,
  PencilSimple,
  Cube,
} from "phosphor-react-native";
import { API_BASE } from "../../constants/api";

export default function HomePage() {
  const router = useRouter();
  const { mart } = useMartMeta();
  const { items } = useItems(mart?.id);
  const { lists, create, update, remove, appendItems, removeItem } = useLists();
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
      return `${Math.round(Number(p)).toLocaleString()} ₮`;
    } catch {
      return `${p}`;
    }
  };

  const safeLists = Array.isArray(lists) ? (lists as any[]) : ([] as any[]);

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

  const renderSearchRow = (it: any) => {
    const uri = resolveImageUrl(it?.image_url || null);
    const priceText = fmtPrice(it?.price ?? null);
    return (
      <HStack
        key={it.id}
        alignItems="center"
        justifyContent="space-between"
        px={3}
        py={2.5}
        style={{ borderBottomWidth: 1, borderBottomColor: "#1d1d22" }}
      >
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
    return (
      <HStack
        key={id}
        alignItems="center"
        justifyContent="space-between"
        bg="#151515"
        rounded="md"
        px={2.5}
        py={2}
      >
        <HStack alignItems="center" space={3} flex={1}>
          {uri ? (
            <Image
              source={{ uri }}
              alt={it?.name || String(id)}
              width={10}
              height={10}
              borderRadius={8}
            />
          ) : (
            <Box width={10} height={10} borderRadius={8} bg="#1f2937" />
          )}
          <VStack flex={1}>
            <Text color="white" numberOfLines={1}>
              {it?.name ?? `#${id}`}
            </Text>
            <HStack space={2} alignItems="center">
              <Text color="#9ca3af" fontSize="xs">
                {fmtPrice(unit)}
              </Text>
              {saleInfo && (
                <Badge
                  colorScheme="rose"
                  rounded="full"
                  _text={{ fontSize: 10 }}
                >
                  {saleInfo}
                </Badge>
              )}
            </HStack>
            {note && (
              <Text color="#9ca3af" fontSize="xs" numberOfLines={1}>
                {note}
              </Text>
            )}
          </VStack>
        </HStack>
        <HStack space={2} alignItems="center">
          <Button size="sm" variant="subtle" onPress={() => decQty(listId, id)}>
            -
          </Button>
          <Input
            width={12}
            value={String(q)}
            onChangeText={(t) => setQty(listId, id, Number(t))}
            keyboardType="numeric"
            textAlign="center"
            bg="#0f0f12"
            color="white"
          />
          <Button size="sm" variant="subtle" onPress={() => incQty(listId, id)}>
            +
          </Button>
          <Text color="#e5e7eb" width={16} textAlign="right">
            {fmtPrice(line)}
          </Text>
          <Button
            size="sm"
            variant="subtle"
            onPress={() => removeItem(list.id, id)}
          >
            Remove
          </Button>
        </HStack>
      </HStack>
    );
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

  const addItemToSelected = async (itemId: number) => {
    if (!itemsById.has(itemId)) return;
    let lid = selectedListId;
    if (!lid) {
      const created = await create("My List");
      lid = created.id;
      setSelectedListId(lid);
    }
    await appendItems(lid!, [itemId]);
    Alert.alert("Added", `#${itemId} жаг?аал?ад н?мл??.`);
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#0b0b0f" }}
      edges={["top"]}
    >
      <Box flex={1} bg="#0b0b0f" p={4}>
        <HStack alignItems="center" justifyContent="space-between" mb={3}>
          <Heading color="white" size="md">
            My Lists
          </Heading>
          <Box />
        </HStack>

        {/* New list quick-add removed per request */}

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
                <Badge
                  key={String(lid)}
                  onTouchEnd={() => {
                    const idVal = (l as any)?.id;
                    if (typeof idVal === "number") setSelectedListId(idVal);
                  }}
                  rounded="full"
                  variant={isSel ? "solid" : "subtle"}
                  colorScheme={isSel ? "info" : "coolGray"}
                  px={3}
                  py={1.5}
                >
                  <Text color="white">{lname || `List #${lid}`}</Text>
                </Badge>
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

        {/* Item search to add into the selected list */}
        <HStack space={2} mb={3}>
          <Input
            flex={1}
            value={search}
            onChangeText={setSearch}
            placeholder="Хай?"
            variant="filled"
            bg="#121212"
            color="white"
            InputLeftElement={
              <Icon as={MagnifyingGlass} ml={3} color="#9ca3af" />
            }
          />
        </HStack>

        {search.trim().length > 0 && (
          <Box maxH={220} bg="#0f0f12" rounded="md" mb={3}>
            <ScrollView>
              {results.map((it) => renderSearchRow(it))}
              {results.length === 0 && (
                <Text color="#9ca3af" px={3} py={3}>
                  Ү? дүн алга.
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
                      Rename
                    </Button>
                    <Button
                      colorScheme="rose"
                      variant="solid"
                      leftIcon={<Icon as={Trash} color="white" size="xs" />}
                      onPress={async () => {
                        Alert.alert(
                          "У??га??",
                          "Эн? жаг?аал??г үн????? ???га? ???",
                          [
                            { text: "Ц??ла?", style: "cancel" },
                            {
                              text: "У??га?",
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
                      Delete
                    </Button>
                  </HStack>
                </HStack>
                <Text color="#aaa" mt={1}>
                  Items:{" "}
                  {Array.isArray((l as any)?.item_ids)
                    ? (l as any).item_ids.length
                    : 0}
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
                    Total:
                  </Text>
                  <Text color="#e5e7eb" fontWeight="700">
                    {fmtPrice(listTotal(l))}
                  </Text>
                </HStack>
                <HStack space={2} mt={2.5}>
                  <Button
                    colorScheme="info"
                    onPress={() =>
                      router.push({ pathname: "/(tabs)/ar", params: {} })
                    }
                  >
                    Open AR
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
                    Clear
                  </Button>
                </HStack>
              </Box>
            ))}
            {lists.length === 0 && (
              <Text color="#9ca3af" textAlign="center" mt={4}>
                ?аг?аал? алга. ???? ?ин? н??л?.
              </Text>
            )}
          </VStack>
        </ScrollView>
      </Box>
    </SafeAreaView>
  );
}
