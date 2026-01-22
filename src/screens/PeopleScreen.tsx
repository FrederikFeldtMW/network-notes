import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAllPeople, type Person } from "../db/database";
import type { PeopleStackParamList } from "../navigation/PeopleStack";
import { getCityContext, setCityContext } from "../utils/cityContext";
import { extractGeoLabel, normalizeCity } from "../utils/geo";
import AppText from "../ui/components/AppText";
import IconButton from "../ui/components/IconButton";
import Input from "../ui/components/Input";
import PrimaryActionButton from "../ui/components/PrimaryActionButton";
import Screen from "../ui/components/Screen";
import { colors, spacing } from "../ui/theme";

type PeopleNav = NativeStackNavigationProp<PeopleStackParamList, "PeopleList">;

type Node = {
  id: string;
  name: string;
  city: string;
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  driftX: number;
  driftY: number;
};

const WARM = "#E4B98C";
const COOL = "#9FB3C8";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const hashString = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

function mixColor(a: string, b: string, amount: number) {
  const parse = (hex: string) => hex.replace("#", "");
  const aHex = parse(a);
  const bHex = parse(b);
  const ar = Number.parseInt(aHex.slice(0, 2), 16);
  const ag = Number.parseInt(aHex.slice(2, 4), 16);
  const ab = Number.parseInt(aHex.slice(4, 6), 16);
  const br = Number.parseInt(bHex.slice(0, 2), 16);
  const bg = Number.parseInt(bHex.slice(2, 4), 16);
  const bb = Number.parseInt(bHex.slice(4, 6), 16);
  const rr = Math.round(ar + (br - ar) * amount);
  const rg = Math.round(ag + (bg - ag) * amount);
  const rb = Math.round(ab + (bb - ab) * amount);
  return `#${rr.toString(16).padStart(2, "0")}${rg
    .toString(16)
    .padStart(2, "0")}${rb.toString(16).padStart(2, "0")}`;
}

function buildNodes(people: Person[]) {
  const width = Dimensions.get("window").width;
  const height = Dimensions.get("window").height;
  const clusters = new Map<string, Person[]>();

  people.forEach((person) => {
    const label = extractGeoLabel(person) ?? "Other";
    const city = normalizeCity(label);
    const existing = clusters.get(city) ?? [];
    existing.push(person);
    clusters.set(city, existing);
  });

  const clusterEntries = Array.from(clusters.entries());
  const clusterSpacing = width * 0.7;
  const startX = width * 0.2;

  const nodes: Node[] = [];

  clusterEntries.forEach(([city, members], index) => {
    const centerX = startX + index * clusterSpacing;
    members.forEach((person, idx) => {
      const days = Math.floor(
        (Date.now() - new Date(person.lastInteractionAt ?? person.createdAt).getTime()) /
          86400000
      );
      const recency = clamp(1 - days / 60, 0, 1);
      const frequency = clamp(1 / (idx + 1), 0, 1);
      const context = person.placeLabel ? 0.8 : 0.4;
      const strength = recency * 0.6 + frequency * 0.3 + context * 0.1;

      const y = height * 0.2 + (1 - strength) * height * 0.5 + (idx % 5) * 12;
      const size = 10 + frequency * 12;
      const color = mixColor(COOL, WARM, recency);
      const opacity = clamp(0.4 + context * 0.4, 0.3, 0.8);
      const hash = hashString(person.id);
      const driftX = ((hash % 10) - 5) * 0.6;
      const driftY = (((hash / 10) % 10) - 5) * 0.8;

      nodes.push({
        id: person.id,
        name: person.name,
        city,
        x: centerX + (idx % 3) * 24 - 24,
        y,
        size,
        color,
        opacity,
        driftX,
        driftY,
      });
    });
  });

  return { nodes: nodes.slice(0, 150), clusters: clusterEntries.map(([city]) => city) };
}

const FieldNode = memo(function FieldNode({
  node,
  drift,
  onPress,
  onLongPress,
  highlight,
}: {
  node: Node;
  drift: Animated.Value;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
  highlight: boolean;
}) {
  const translateX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [node.x, node.x + node.driftX],
  });
  const translateY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [node.y, node.y + node.driftY],
  });

  return (
    <Pressable
      onPress={() => onPress(node.id)}
      onLongPress={() => onLongPress(node.id)}
      style={styles.nodePressable}
    >
      <Animated.View
        style={{
          position: "absolute",
          width: node.size,
          height: node.size,
          borderRadius: node.size / 2,
          backgroundColor: node.color,
          opacity: node.opacity,
          transform: [
            { translateX },
            { translateY },
            { scale: highlight ? 1.2 : 1 },
          ],
        }}
      />
    </Pressable>
  );
});

FieldNode.displayName = "FieldNode";

export default function PeopleScreen() {
  const navigation = useNavigation<PeopleNav>();
  const insets = useSafeAreaInsets();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selectedCity, setSelectedCity] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [actionPersonId, setActionPersonId] = useState<string | null>(null);
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scale = useRef(new Animated.Value(1)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const scaleRef = useRef(1);
  const pinchDistanceRef = useRef<number | null>(null);

  useEffect(() => {
    const id = scale.addListener(({ value }) => {
      scaleRef.current = value;
    });
    return () => {
      scale.removeListener(id);
    };
  }, [scale]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 12000,
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 12000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [drift]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        const rows = await getAllPeople();
        const context = await getCityContext();
        if (isActive) {
          setSelectedCity(context);
          const { nodes: built } = buildNodes(rows);
          setNodes(built);
        }
      })().catch(() => undefined);
      return () => {
        isActive = false;
      };
    }, [])
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2 || gestureState.numberActiveTouches > 1,
      onPanResponderGrant: () => {
        pan.setOffset({ x: pan.x.__getValue(), y: pan.y.__getValue() });
        pan.setValue({ x: 0, y: 0 });
        pinchDistanceRef.current = null;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (evt.nativeEvent.touches.length === 2) {
          const [a, b] = evt.nativeEvent.touches;
          const dx = a.pageX - b.pageX;
          const dy = a.pageY - b.pageY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (!pinchDistanceRef.current) {
            pinchDistanceRef.current = distance;
            return;
          }
          const nextScale = clamp(
            (distance / pinchDistanceRef.current) * scaleRef.current,
            0.6,
            2.2
          );
          scale.setValue(nextScale);
          return;
        }
        pan.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        pinchDistanceRef.current = null;
      },
    })
  ).current;

  const handlePress = useCallback(
    (personId: string) => {
      navigation.navigate("PersonDetail", { personId });
    },
    [navigation]
  );

  const handleLongPress = useCallback((personId: string) => {
    setActionPersonId(personId);
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchTerm(value);
      const term = value.trim().toLowerCase();
      if (!term) {
        setHighlightId(null);
        return;
      }
      const match = nodes.find((node) => node.name.toLowerCase().includes(term));
      if (match) {
        setHighlightId(match.id);
        setTimeout(() => setHighlightId(null), 1200);
        Animated.parallel([
          Animated.timing(pan, {
            toValue: { x: -match.x + 80, y: -match.y + 180 },
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1.2,
            duration: 350,
            useNativeDriver: true,
          }),
        ]).start();
      }
    },
    [nodes, pan, scale]
  );

  const cityLabels = useMemo(() => {
    const unique = Array.from(new Set(nodes.map((node) => node.city)));
    return unique.map((city, index) => ({ city, x: 80 + index * 220, y: 80 }));
  }, [nodes]);

  const zoomedOutOpacity = scale.interpolate({
    inputRange: [0.6, 1.1],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const handleCitySelect = useCallback(
    async (city: string) => {
      await setCityContext(city === "All" ? null : city);
      setSelectedCity(city);
      if (city === "All") {
        Animated.parallel([
          Animated.timing(pan, {
            toValue: { x: 0, y: 0 },
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
        return;
      }
      const match = nodes.find((node) => node.city === city);
      if (match) {
        Animated.parallel([
          Animated.timing(pan, {
            toValue: { x: -match.x + 100, y: -match.y + 200 },
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1.4,
            duration: 350,
            useNativeDriver: true,
          }),
        ]).start();
      }
    },
    [nodes, pan, scale]
  );

  return (
    <Screen padded={false}>
      <View style={styles.container} {...panResponder.panHandlers}>
        <Animated.View
          style={{
            flex: 1,
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale },
            ],
          }}
        >
          {nodes.map((node) => (
            <FieldNode
              key={node.id}
              node={node}
              drift={drift}
              onPress={handlePress}
              onLongPress={handleLongPress}
              highlight={node.id === highlightId}
            />
          ))}
        </Animated.View>

        <View style={[styles.overlay, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.searchRow}>
            <Input
              value={searchTerm}
              onChangeText={handleSearchChange}
              placeholder="Search a name"
            />
            {selectedCity !== "All" && (
              <Pressable onPress={() => handleCitySelect("All")}>
                <AppText variant="caption" style={styles.resetText}>
                  All
                </AppText>
              </Pressable>
            )}
          </View>

          <View style={styles.cityStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {cityLabels.map((item) => (
                <Pressable key={item.city} onPress={() => handleCitySelect(item.city)}>
                  <Animated.View style={{ opacity: zoomedOutOpacity }}>
                    <AppText variant="caption" style={styles.cityLabel}>
                      {item.city}
                    </AppText>
                  </Animated.View>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {selectedCity !== "All" && (
            <Pressable
              style={styles.jumpToMap}
              onPress={async () => {
                await setCityContext(selectedCity);
                navigation.getParent()?.navigate("Map");
              }}
            >
              <AppText variant="caption" style={styles.jumpText}>
                Jump to Map
              </AppText>
            </Pressable>
          )}
        </View>

        <View style={[styles.fab, { bottom: insets.bottom + spacing.lg }]}> 
          <IconButton
            name="add"
            size={22}
            color="#ffffff"
            variant="filled"
            onPress={() => navigation.navigate("QuickAdd")}
            style={styles.fabButton}
          />
        </View>

        <Modal
          visible={!!actionPersonId}
          transparent
          animationType="fade"
          onRequestClose={() => setActionPersonId(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <AppText variant="subtitle">Quick actions</AppText>
              <PrimaryActionButton
                title="Add note"
                onPress={() => {
                  if (actionPersonId) {
                    navigation.navigate("PersonDetail", { personId: actionPersonId });
                  }
                  setActionPersonId(null);
                }}
              />
              <View style={{ marginTop: spacing.sm }}>
                <PrimaryActionButton
                  title="Open profile"
                  onPress={() => {
                    if (actionPersonId) {
                      navigation.navigate("PersonDetail", { personId: actionPersonId });
                    }
                    setActionPersonId(null);
                  }}
                />
              </View>
              <Pressable onPress={() => setActionPersonId(null)} style={styles.modalClose}>
                <AppText variant="caption" style={{ color: colors.muted }}>
                  Close
                </AppText>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  nodePressable: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  overlay: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  resetText: {
    color: colors.accent,
  },
  cityStrip: {
    marginTop: spacing.sm,
  },
  cityLabel: {
    color: colors.muted,
    marginRight: spacing.md,
  },
  jumpToMap: {
    marginTop: spacing.sm,
  },
  jumpText: {
    color: colors.accent,
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
  },
  fabButton: {
    backgroundColor: colors.accent,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  modalClose: {
    marginTop: spacing.sm,
    alignSelf: "center",
  },
});