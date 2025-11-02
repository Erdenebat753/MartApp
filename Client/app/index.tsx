import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Dimensions,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import ARTestScreen from "../components/ARTestScreen";
import Map2D, { Point } from "../components/Map2D";

type Item = {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  price?: number | null;
};
const API_BASE = (() => {
  // Priority 1: explicit env
  const env = process.env.EXPO_PUBLIC_API_BASE;
  if (env && env.length > 0) return env;
  // Priority 2: platform smart defaults
  if (Platform.OS === "android") {
    // Android Emulator Host loopback
    return "http://10.46.73.109:8000";
  }
  return "http://127.0.0.1:8000";
})();
const MAP_W = 675;
const MAP_H = 878;

export default function IndexScreen() {
  const { height, width } = Dimensions.get("window");
  const half = Math.floor(height * 0.5);

  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [user, setUser] = useState<Point | null>(null);
  const [route, setRoute] = useState<Point[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/items`);
        const j = await r.json();
        setItems(Array.isArray(j) ? j : []);
      } catch (e) {
        console.log("GET /api/items failed:", e);
        setItems([]);
      }
    })();
  }, []);

  const doSearch = async () => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setResults([]);
      return;
    }
    // ensure we have items
    let pool = items;
    if (!pool || pool.length === 0) {
      try {
        const r = await fetch(`${API_BASE}/api/items`);
        const j = await r.json();
        pool = Array.isArray(j) ? j : [];
        setItems(pool);
      } catch (e) {
        console.log("search fetch /api/items failed:", e);
      }
    }
    setResults(
      (pool || [])
        .filter((it) => (it.name || "").toLowerCase().includes(q))
        .slice(0, 10)
    );
  };

  const navigateTo = async (it: Item) => {
    if (!user) {
      setRoute([]);
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/api/route/coords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: user, end: { x: it.x, y: it.y } }),
      });
      const j = await r.json();
      setRoute(j?.polyline || []);
    } catch (e) {
      console.log("POST /api/route/coords failed:", e);
      setRoute([]);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* TOP: AR */}
      <View style={{ height: half }}>
        <ARTestScreen />
        {/* Overlay search */}
        <View style={{ position: "absolute", left: 8, right: 8, top: 8 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="상품 검색 (예: 커피)"
              placeholderTextColor={"#aaa"}
              onSubmitEditing={doSearch}
              style={{
                flex: 1,
                padding: 10,
                backgroundColor: "#111",
                color: "#fff",
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#333",
              }}
            />
            <Pressable
              onPress={doSearch}
              style={{
                backgroundColor: "#1e90ff",
                paddingHorizontal: 12,
                borderRadius: 8,
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>Search</Text>
            </Pressable>
          </View>
          {results.length > 0 && (
            <View
              style={{
                backgroundColor: "#000000cc",
                borderRadius: 8,
                padding: 8,
                marginTop: 6,
                maxHeight: half - 80,
              }}
            >
              <ScrollView>
                {results.map((it) => (
                  <Pressable
                    key={it.id}
                    onPress={() => navigateTo(it)}
                    style={{ paddingVertical: 6 }}
                  >
                    <Text style={{ color: "#fff" }}>
                      {it.name} {it.price != null ? `• ₩${it.price}` : ""}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          {results.length === 0 && query.trim().length > 0 && (
            <View
              style={{
                backgroundColor: "#000000aa",
                borderRadius: 8,
                padding: 8,
                marginTop: 6,
              }}
            >
              <Text style={{ color: "#fff" }}>검색 결과가 없습니다.</Text>
              <Text style={{ color: "#bbb", marginTop: 4, fontSize: 12 }}>
                API_BASE: {API_BASE}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* BOTTOM: 2D Map */}
      <Map2D
        width={width}
        height={half}
        mapWidthPx={MAP_W}
        mapHeightPx={MAP_H}
        backgroundSource={require("@/assets/images/Frame1.png")}
        polyline={route}
        user={user}
        onLongPress={(p) => {
          setUser(p);
          setRoute([]);
        }}
      />
    </View>
  );
}
