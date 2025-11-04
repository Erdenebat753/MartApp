import React, { useEffect, useState } from "react";
import { View, Dimensions, Text, TextInput, Pressable, ScrollView, Alert } from "react-native";
import ARTestScreen from "../../components/ARTestScreen";
import Map2D, { Point } from "../../components/Map2D";
import { MAP_HEIGHT_PX, MAP_WIDTH_PX } from "../../constants/map";
import { useItems } from "../../hooks/useItems";
import { useSlamStart } from "../../hooks/useSlamStart";
import { useSensorHeading } from "../../hooks/useSensorHeading";
import { useRouteCompute } from "../../hooks/useRoute";
import { API_BASE } from "../../constants/api";
import { PIXELS_PER_METER } from "../../constants/map";
import type { Item } from "../../src/types";

export default function ARTab() {
  const { width, height } = Dimensions.get("window");
  const half = Math.floor(height * 0.5);
  const { items } = useItems();
  const [slamStart, setSlamStart] = useState<Point | null>(null);
  const [headingBase, setHeadingBase] = useState<number>(0);
  const [user, setUser] = useState<Point | null>(null);
  const [deviceYaw0, setDeviceYaw0] = useState<number | null>(null);
  const [deviceYaw, setDeviceYaw] = useState<number>(0);
  const [camStart, setCamStart] = useState<[number,number,number] | null>(null);
  const [camNow, setCamNow] = useState<[number,number,number] | null>(null);
  const [useYawOnly, setUseYawOnly] = useState<boolean>(false);
  const [alignment, setAlignment] = useState<"Gravity"|"GravityAndHeading"|"Camera">("GravityAndHeading");
  const [useSensor, setUseSensor] = useState<boolean>(false);
  const { headingDeg: sensorHeading, available: sensorAvailable } = useSensorHeading(150);
  const [ppm, setPpm] = useState<number>(PIXELS_PER_METER);
  const [transUseCurrentYaw, setTransUseCurrentYaw] = useState<boolean>(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const { route, compute, clear } = useRouteCompute();
  const [debug, setDebug] = useState(true);

  // Kick off initial SLAM fetch (no-op if already fetched by poller)
  useSlamStart(items, () => {}, () => {});

  const normalizeDeg = (d: number) => {
    let x = d % 360;
    if (x < 0) x += 360;
    return x;
  };

  // Use SLAM start once, then update by Viro camera deltas
  useSlamStart(items, (p)=>{
    setSlamStart(p);
    setUser(p);
    // reset camera anchor on new SLAM start
    setCamStart(null);
    setDeviceYaw0(null);
  }, (deg)=>{
    setHeadingBase(Number(deg || 0));
  });

  const yawUsed = useSensor ? sensorHeading : deviceYaw;
  const effectiveHeading = (() => {
    const base = Number(headingBase || 0);
    const d0 = deviceYaw0 ?? yawUsed;
    // Invert delta sign to match admin/map rotation direction
    const delta = normalizeDeg(d0 - yawUsed);
    return normalizeDeg(base + delta);
  })();

  // Map arrow uses absolute heading: server base + device delta.
  const headingForMap = useYawOnly
    ? normalizeDeg((deviceYaw0 ?? yawUsed) - yawUsed)
    : effectiveHeading;

  // Recompute user map position from camera movement
  useEffect(() => {
    if (!slamStart || !camStart || !camNow) return;
    const dx = camNow[0] - camStart[0];
    const dz = camNow[2] - camStart[2];
    // compensate AR forward (-Z): use -dz so forward increases +Y in up-coords
    const vx = dx;
    const vy = -dz;
    const yawRef = transUseCurrentYaw ? yawUsed : (deviceYaw0 ?? yawUsed);
    const theta = (headingBase - yawRef) * Math.PI / 180;
    const rx =  Math.cos(theta) * vx - Math.sin(theta) * vy;
    const ry =  Math.sin(theta) * vx + Math.cos(theta) * vy; // up-positive
    const px = rx * ppm;
    const pyDown = -ry * ppm; // convert up->down for image coords
    setUser({ x: slamStart.x + px, y: slamStart.y + pyDown });
  }, [slamStart, camStart, camNow, headingBase, deviceYaw0]);

  const doSearch = () => {
    const q = query.trim().toLowerCase();
    if (!q) { setResults([]); return; }
    setResults((items || []).filter(it => (it.name || "").toLowerCase().includes(q)).slice(0, 10));
  };

  const navigateTo = (it: Item) => {
    if (!user) {
      Alert.alert("No location", "Current location is not set yet.");
      return;
    }
    Alert.alert(
      "Start navigation",
      `Navigate to \"${it.name}\"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start",
          style: "default",
          onPress: async () => {
            try {
              await compute(user, { x: it.x, y: it.y });
              setResults([]);
            } catch {}
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* TOP: AR */}
      <View style={{ height: half }}>
        <ARTestScreen alignment={alignment} onDevicePose={(pos, yawDeg) => {
          if (!useSensor) setDeviceYaw(yawDeg);
          setCamNow(pos);
          if (slamStart && !camStart) setCamStart(pos);
          if (deviceYaw0 === null) setDeviceYaw0(useSensor ? sensorHeading : yawDeg);
        }} onTrackingState={(st, rsn)=>{
          if (debug) console.log('[AR tracking]', st, rsn);
        }} />
        {/* Debug toggle */}
        <View style={{ position: 'absolute', right: 8, top: 8, gap: 6, zIndex: 1000, elevation: 1000 }}>
          <Pressable onPress={() => setDebug((v)=>!v)} style={{ backgroundColor: '#00000088', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 6 }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>{debug ? 'Debug: ON' : 'Debug: OFF'}</Text>
          </Pressable>
          <Pressable onPress={() => setUseYawOnly(v=>!v)} style={{ backgroundColor: '#00000088', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>{useYawOnly ? 'Heading Mode: YAW' : 'Heading Mode: SLAM+YAW'}</Text>
          </Pressable>
          <Pressable onPress={() => setUseSensor(v=>!v)} style={{ backgroundColor: '#00000088', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>Sensor: {useSensor ? (sensorAvailable ? 'ON' : 'N/A') : 'OFF'}</Text>
          </Pressable>
          <Pressable onPress={() => setAlignment(a=> a==="GravityAndHeading"?"Camera": a==="Camera"?"Gravity":"GravityAndHeading")} style={{ backgroundColor: '#00000088', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>Align: {alignment}</Text>
          </Pressable>
          <Pressable onPress={() => { setCamStart(camNow); setDeviceYaw0(deviceYaw); }} style={{ backgroundColor: '#00000088', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>Reset Cam Anchor</Text>
          </Pressable>
          <Pressable onPress={() => { 
            // set base heading to current effective heading, zero future delta
            // after this, effectiveHeading remains visually same but base value updates
            const eff = effectiveHeading;
            setHeadingBase(eff);
            setDeviceYaw0(deviceYaw);
          }} style={{ backgroundColor: '#00000088', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>Set Base = Now</Text>
          </Pressable>
          {debug && (
            <View style={{ backgroundColor: '#000000CC', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, zIndex: 1001, elevation: 1001 }}>
              <Text style={{ color: '#fff', fontSize: 11 }}>yaw0:{deviceYaw0===null?'-':deviceYaw0.toFixed(1)} yaw:{yawUsed.toFixed(1)} sens:{sensorAvailable?sensorHeading.toFixed(1):'N/A'}</Text>
              <Text style={{ color: '#fff', fontSize: 11 }}>headBase:{headingBase.toFixed(1)} eff:{effectiveHeading.toFixed(1)} map:{headingForMap.toFixed(1)}</Text>
              <Text style={{ color: '#fff', fontSize: 11 }}>cam0:{camStart?`${camStart[0].toFixed(2)},${camStart[1].toFixed(2)},${camStart[2].toFixed(2)}`:'-'}</Text>
              <Text style={{ color: '#fff', fontSize: 11 }}>cam :{camNow?`${camNow[0].toFixed(2)},${camNow[1].toFixed(2)},${camNow[2].toFixed(2)}`:'-'}</Text>
              {camStart && camNow && (
                <Text style={{ color: '#fff', fontSize: 11 }}>
                  d:(x:{(camNow[0]-camStart[0]).toFixed(2)} z:{(camNow[2]-camStart[2]).toFixed(2)}) ppm:{ppm}
                </Text>
              )}
              <Text style={{ color: '#fff', fontSize: 11 }}>user:{user?`${user.x.toFixed(1)},${user.y.toFixed(1)}`:'-'}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pressable onPress={() => setPpm(p=>Math.max(10, p-20))} style={{ backgroundColor: '#00000088', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontSize: 12 }}>PPM -</Text>
            </Pressable>
            <Pressable onPress={() => setPpm(p=>p+20)} style={{ backgroundColor: '#00000088', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontSize: 12 }}>PPM +</Text>
            </Pressable>
            <Pressable onPress={() => setTransUseCurrentYaw(v=>!v)} style={{ backgroundColor: '#00000088', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontSize: 12 }}>Trans Rot: {transUseCurrentYaw ? 'CURRENT' : 'BASE'}</Text>
            </Pressable>
          </View>
          <Pressable onPress={async ()=>{
            try {
              const r = await fetch(`${API_BASE}/api/slam`);
              const j = await r.json();
              if (j && j.x != null && j.y != null) {
                const p = { x: Number(j.x), y: Number(j.y) };
                setSlamStart(p);
                setUser(p);
                setHeadingBase(Number(j.heading_deg || 0));
                setCamStart(null);
                setDeviceYaw0(null);
              }
            } catch (e) {}
          }} style={{ backgroundColor: '#00000088', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>Recenter SLAM</Text>
          </Pressable>
          <Pressable onPress={()=> clear()} style={{ backgroundColor: '#00000088', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>Clear Route</Text>
          </Pressable>
        </View>
        {/* Overlay search */}
        <View style={{ position: "absolute", left: 8, right: 8, top: 8 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search product"
              placeholderTextColor={"#aaa"}
              onSubmitEditing={doSearch}
              style={{ flex: 1, padding: 10, backgroundColor: "#111", color: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#333" }}
            />
            <Pressable onPress={doSearch} style={{ backgroundColor: "#1e90ff", paddingHorizontal: 12, borderRadius: 8, justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "600" }}>Search</Text>
            </Pressable>
          </View>
          {results.length > 0 && (
            <View style={{ backgroundColor: "#000000cc", borderRadius: 8, padding: 8, marginTop: 6, maxHeight: half - 80 }}>
              <ScrollView>
                {results.map((it) => (
                  <Pressable key={it.id} onPress={() => navigateTo(it)} style={{ paddingVertical: 6 }}>
                    <Text style={{ color: "#fff" }}>{it.name} {it.price != null ? `• ₩${it.price}` : ""}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          {results.length === 0 && query.trim().length > 0 && (
            <View style={{ backgroundColor: "#000000aa", borderRadius: 8, padding: 8, marginTop: 6 }}>
              <Text style={{ color: "#fff" }}>No results.</Text>
            </View>
          )}
        </View>
      </View>

      {/* BOTTOM: 2D Map */}
      <Map2D
        width={width}
        height={half}
        mapWidthPx={MAP_WIDTH_PX}
        mapHeightPx={MAP_HEIGHT_PX}
        backgroundSource={require("@/assets/images/Frame1.png")}
        polyline={route}
        user={user}
        headingDeg={headingForMap}
        headingInvert={false}
        debug={debug}
        onLongPress={(_p) => { /* disabled manual set while SLAM live */ }}
      />
    </View>
  );
}
