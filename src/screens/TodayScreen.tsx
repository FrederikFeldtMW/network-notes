import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  addNote,
  getAllPeople,
  getAllTrips,
  getRecentNotesWithPeople,
  getUpcomingTrips,
  upsertPersonByName,
  updatePersonLastInteraction,
  type Trip,
  type Person,
  type RecentNoteItem,
} from "../db/database";
import type { TodayStackParamList } from "../navigation/TodayStack";
import { getCityContext, setCityContext } from "../utils/cityContext";
import { normalizeCity } from "../utils/geo";
import { buildNetworkHeat, buildNudge, type HeatNode } from "../utils/networkHeat";
import { parseLineToPersonPayload } from "../utils/parseLine";
import { ensureSeedData, SEED_ENABLED } from "../utils/seedData";
import { getCurrentLocationWithPlaceLabel } from "../utils/location";
import AppText from "../ui/components/AppText";
import IconButton from "../ui/components/IconButton";
import Input from "../ui/components/Input";
import PrimaryActionButton from "../ui/components/PrimaryActionButton";
import Screen from "../ui/components/Screen";
import { colors, spacing } from "../ui/theme";

type TodayNav = NativeStackNavigationProp<TodayStackParamList, "TodayHome">;

type PendingEntry = {
  name: string;
  age: number | null;
  city: string | null;
  placeMetCandidate: string | null;
  notes: string | null;
  occupation: string | null;
  typedGeo: boolean;
  location: { lat: number; lng: number; placeLabel?: string } | null;
};

type CityPresence = {
  city: string;
  intensity: number;
};

type IntentCard = {
  id: string;
  personId: string;
  name: string;
  reason: string;
  context: string | null;
};

const PLACEHOLDERS = [
  "Type a person... (e.g. alex, 22, Polo Lounge LA)",
  "Who did you meet today?",
  "Anyone worth remembering?",
  "Where were you tonight?",
];

function formatDatePill(date: Date) {
  const month = date.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const day = date.getDate();
  return `${month} ${day}`;
}

function useDailyPlaceholder() {
  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const stored = await AsyncStorage.getItem("daily_placeholder");
      const storedDate = await AsyncStorage.getItem("daily_placeholder_date");
      if (stored && storedDate === today) {
        setPlaceholder(stored);
        return;
      }
      const next = PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)];
      await AsyncStorage.setItem("daily_placeholder", next);
      await AsyncStorage.setItem("daily_placeholder_date", today);
      setPlaceholder(next);
    };
    load().catch(() => undefined);
  }, []);

  return placeholder;
}

function buildCityPresence(people: Person[], trips: Trip[], notes: RecentNoteItem[]) {
  const counts = new Map<string, number>();
  const bump = (city: string, amount: number) => {
    counts.set(city, (counts.get(city) ?? 0) + amount);
  };

  people.forEach((person) => {
    const label = person.city ?? person.placeLabel;
    if (label) {
      bump(normalizeCity(label), 1);
    }
  });

  notes.forEach((item) => {
    const label = item.person.city ?? item.person.placeLabel ?? item.note.placeLabel;
    if (label) {
      bump(normalizeCity(label), 0.5);
    }
  });

  trips.forEach((trip) => {
    bump(normalizeCity(trip.city), 1.5);
  });

  const max = Math.max(1, ...Array.from(counts.values()));
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([city, value]) => ({
      city,
      intensity: 0.35 + (value / max) * 0.65,
    }));
}

function buildIntentCards(
  people: Person[],
  notes: RecentNoteItem[],
  upcomingTrip: Trip | null
) {
  const noteCounts = new Map<string, number>();
  const latestNote = new Map<string, RecentNoteItem>();

  notes.forEach((item) => {
    const personId = item.person.id;
    noteCounts.set(personId, (noteCounts.get(personId) ?? 0) + 1);
    const prev = latestNote.get(personId);
    if (!prev || item.note.createdAt > prev.note.createdAt) {
      latestNote.set(personId, item);
    }
  });

  const candidates: Array<IntentCard & { score: number }> = [];

  people.forEach((person) => {
    const latest = latestNote.get(person.id);
    const lastDate = latest?.note.createdAt ?? person.lastInteractionAt ?? person.createdAt;
    const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
    const count = noteCounts.get(person.id) ?? 0;
    const context = person.city ?? person.placeLabel ?? latest?.note.placeLabel ?? null;

    let reason: string | null = null;
    let score = 0;

    if (upcomingTrip?.city && person.city && normalizeCity(person.city) === normalizeCity(upcomingTrip.city)) {
      reason = `You will be in ${upcomingTrip.city} soon`;
      score = 5;
    } else if (days <= 7) {
      reason = "You met them recently";
      score = 4;
    } else if (count >= 4 && days >= 30) {
      reason = "Strong connection, quiet lately";
      score = 3.8;
    } else if (days >= 60) {
      reason = "You have not logged anything in a while";
      score = 3.4;
    } else if (count === 1 && days >= 45) {
      reason = "A one-off worth remembering";
      score = 3.1;
    }

    if (reason) {
      candidates.push({
        id: `${person.id}-${reason}`,
        personId: person.id,
        name: person.name,
        reason,
        context,
        score,
      });
    }
  });

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ score, ...card }) => card);
}

function NetworkHeatBackground({ nodes, visible }: { nodes: HeatNode[]; visible: boolean }) {
  const { width, height } = Dimensions.get("window");
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 8000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [anim, visible]);

  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.heatLayer}>
      {nodes.map((node, index) => {
        const scale = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.05 + (index % 3) * 0.02],
        });
        return (
          <Animated.View
            key={node.id}
            style={{
              position: "absolute",
              width: node.size,
              height: node.size,
              borderRadius: node.size / 2,
              backgroundColor: node.color,
              opacity: node.opacity,
              transform: [
                { translateX: node.x * width },
                { translateY: node.y * height },
                { scale },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

export default function TodayScreen() {
  const navigation = useNavigation<TodayNav>();
  const insets = useSafeAreaInsets();
  const [line, setLine] = useState("");
  const [rawInput, setRawInput] = useState("");
  const [pending, setPending] = useState<PendingEntry | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [askWhereVisible, setAskWhereVisible] = useState(false);
  const [askNameVisible, setAskNameVisible] = useState(false);
  const [nameText, setNameText] = useState("");
  const [whereText, setWhereText] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [heatNodes, setHeatNodes] = useState<HeatNode[]>([]);
  const [nudgeText, setNudgeText] = useState<string | null>(null);
  const [showNudge, setShowNudge] = useState(false);
  const [upcomingTrip, setUpcomingTrip] = useState<Trip | null>(null);
  const [cityPresence, setCityPresence] = useState<CityPresence[]>([]);
  const [intentCards, setIntentCards] = useState<IntentCard[]>([]);
  const [cityContext, setCityContextState] = useState("All");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const nudgeOpacity = useRef(new Animated.Value(0)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const inputPulse = useRef(new Animated.Value(1)).current;
  const placeholder = useDailyPlaceholder();

  const seedKey = new Date().toISOString().slice(0, 10);
  const isOverview = line.trim().length === 0 && !isKeyboardVisible;

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        const stored = await getCityContext();
        if (isActive) {
          setCityContextState(stored);
        }
      })().catch(() => undefined);
      return () => {
        isActive = false;
      };
    }, [])
  );

  const reloadOverview = useCallback(async () => {
    if (SEED_ENABLED) {
      await ensureSeedData();
    }

    const [people, notes, trips, upcomingTrips] = await Promise.all([
      getAllPeople(),
      getRecentNotesWithPeople(300),
      getAllTrips(),
      getUpcomingTrips(new Date().toISOString()),
    ]);

    const nextTrip = upcomingTrips[0] ?? null;
    setUpcomingTrip(nextTrip);
    setHeatNodes(buildNetworkHeat(people, notes, seedKey));
    setCityPresence(buildCityPresence(people, trips, notes));
    setIntentCards(buildIntentCards(people, notes, nextTrip));

    const nudge = buildNudge(people, notes);
    if (!nudge) {
      return;
    }
    const storedDate = await AsyncStorage.getItem("daily_nudge_date");
    if (storedDate === seedKey) {
      return;
    }
    await AsyncStorage.setItem("daily_nudge_date", seedKey);
    setNudgeText(nudge);
  }, [seedKey]);

  useEffect(() => {
    reloadOverview().catch(() => undefined);
  }, [reloadOverview]);

  useEffect(() => {
    if (!nudgeText || !isOverview) {
      setShowNudge(false);
      nudgeOpacity.setValue(0);
      return;
    }

    setShowNudge(true);
    nudgeOpacity.setValue(0);
    Animated.timing(nudgeOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(nudgeOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowNudge(false));
    }, 5000);

    return () => clearTimeout(timer);
  }, [isOverview, nudgeText, nudgeOpacity]);

  const showToast = useCallback(() => {
    setToastVisible(true);
    toastOpacity.setValue(0);
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start(() => setToastVisible(false));
      }, 700);
    });
  }, [toastOpacity]);

  const pulseInput = useCallback(() => {
    inputPulse.setValue(0.98);
    Animated.timing(inputPulse, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [inputPulse]);

  const persistEntry = useCallback(
    async (entry: PendingEntry, overrideLabel?: string | null, skipLocation?: boolean) => {
      const label = overrideLabel ?? entry.placeMetCandidate ?? null;
      const normalizedCity = label ? normalizeCity(label) : null;
      const shouldSetCity = entry.city ?? (normalizedCity && normalizedCity !== label ? normalizedCity : null);
      const storeLatLng = !skipLocation && entry.location && label;

      const person = await upsertPersonByName({
        name: entry.name,
        city: shouldSetCity,
        age: entry.age,
        placeLabel: label,
        lat: storeLatLng ? entry.location?.lat ?? null : null,
        lng: storeLatLng ? entry.location?.lng ?? null : null,
        locationSource: storeLatLng ? "gps" : label ? "city" : null,
      });

      const noteParts: string[] = [];
      if (entry.occupation) {
        noteParts.push(entry.occupation);
      }
      if (entry.notes) {
        noteParts.push(entry.notes);
      }
      const noteContent = noteParts.join(". ").trim();

      if (noteContent) {
        await addNote({
          personId: person.id,
          content: noteContent,
          lat: storeLatLng ? entry.location?.lat ?? null : null,
          lng: storeLatLng ? entry.location?.lng ?? null : null,
          placeLabel: label,
        });
      }

      await updatePersonLastInteraction(person.id, new Date().toISOString());
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast();
      pulseInput();
      reloadOverview().catch(() => undefined);
    },
    [showToast, pulseInput, reloadOverview]
  );

  const beginLocationFlow = useCallback(
    async (payload: ReturnType<typeof parseLineToPersonPayload>, overrideName?: string | null) => {
      const name = overrideName ?? payload.name ?? "Someone";
      const location = await getCurrentLocationWithPlaceLabel();
      const candidateLabel = payload.placeMetCandidate ?? payload.city ?? location?.placeLabel ?? null;
      const typedGeo = Boolean(payload.placeMetCandidate || payload.city);

      const entry: PendingEntry = {
        name,
        age: payload.age ?? null,
        city: payload.city ?? null,
        placeMetCandidate: candidateLabel,
        notes: payload.notes ?? null,
        occupation: payload.occupation ?? null,
        typedGeo,
        location,
      };

      setPending(entry);

      if (candidateLabel) {
        setConfirmVisible(true);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }

      setAskWhereVisible(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    []
  );

  const submitLine = useCallback(async () => {
    const rawText = line;
    const parsed = parseLineToPersonPayload(rawText);
    if (!rawText.trim()) {
      return;
    }

    setRawInput(rawText);
    setLine("");

    if (!parsed.name || parsed.confidence < 0.4) {
      setAskNameVisible(true);
      return;
    }

    await beginLocationFlow(parsed);
  }, [line, beginLocationFlow]);

  const handleCityTap = useCallback(
    async (city: string) => {
      await setCityContext(city === "All" ? null : city);
      setCityContextState(city);
    },
    []
  );

  const tripDaysAway = upcomingTrip
    ? Math.max(
        0,
        Math.ceil(
          (new Date(upcomingTrip.startDate).getTime() - Date.now()) / 86400000
        )
      )
    : null;

  return (
    <Screen>
      <NetworkHeatBackground nodes={heatNodes} visible={isOverview} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <AppText variant="caption" style={styles.brandMark}>✦</AppText>
            <View style={styles.datePill}>
              <AppText variant="caption" style={styles.dateText}>
                {formatDatePill(new Date())}
              </AppText>
            </View>
            <IconButton name="settings-outline" onPress={() => navigation.navigate("Settings")} />
          </View>

          {isOverview && (
            <View style={styles.overviewWrap}>
              <AppText variant="muted" style={styles.exploreText}>Explore your network</AppText>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cityStrip}
              >
                <Pressable
                  onPress={() => handleCityTap("All")}
                  style={[styles.cityPill, cityContext === "All" && styles.cityPillActive]}
                >
                  <AppText
                    variant="caption"
                    style={[styles.cityPillText, cityContext === "All" && styles.cityPillTextActive]}
                  >
                    All
                  </AppText>
                </Pressable>
                {cityPresence.map((item) => {
                  const active = cityContext === item.city;
                  return (
                    <Pressable
                      key={item.city}
                      onPress={() => handleCityTap(item.city)}
                      style={[styles.cityPill, active && styles.cityPillActive]}
                    >
                      <AppText
                        variant="caption"
                        style={[styles.cityPillText, active && styles.cityPillTextActive]}
                      >
                        {item.city}
                      </AppText>
                      <View
                        style={[
                          styles.cityUnderline,
                          { opacity: item.intensity },
                          active && styles.cityUnderlineActive,
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </ScrollView>

              {upcomingTrip && tripDaysAway !== null && (
                <Pressable
                  onPress={() => navigation.navigate("TripDetail", { tripId: upcomingTrip.id })}
                  style={styles.tripLine}
                >
                  <AppText variant="muted">
                    You will be in {upcomingTrip.city} in {tripDaysAway} days
                  </AppText>
                </Pressable>
              )}
            </View>
          )}

          {showNudge && nudgeText && (
            <Animated.View style={{ opacity: nudgeOpacity, marginBottom: spacing.md }}>
              <AppText variant="muted" style={styles.nudgeText}>{nudgeText}</AppText>
            </Animated.View>
          )}

          <Animated.View style={{ transform: [{ scale: inputPulse }] }}>
            <TextInput
              value={line}
              onChangeText={setLine}
              placeholder={placeholder}
              placeholderTextColor={colors.muted}
              style={styles.notepadInput}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={submitLine}
            />
          </Animated.View>

          {isOverview && intentCards.length > 0 && (
            <View style={styles.intentSection}>
              <AppText variant="subtitle">Worth a thought</AppText>
              <View style={styles.intentList}>
                {intentCards.map((card) => (
                  <Pressable
                    key={card.id}
                    onPress={() => navigation.navigate("PersonDetail", { personId: card.personId })}
                    style={styles.intentCard}
                  >
                    <AppText variant="body" style={styles.intentName}>{card.name}</AppText>
                    <AppText variant="muted" style={styles.intentReason}>{card.reason}</AppText>
                    {card.context ? (
                      <AppText variant="caption" style={styles.intentContext}>{card.context}</AppText>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <Modal
          visible={askNameVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAskNameVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <AppText variant="subtitle">Who did you meet?</AppText>
              <Input
                value={nameText}
                onChangeText={setNameText}
                placeholder="Name"
              />
              <PrimaryActionButton
                title="Save"
                onPress={async () => {
                  const parsed = parseLineToPersonPayload(rawInput);
                  await beginLocationFlow(parsed, nameText.trim() || null);
                  setNameText("");
                  setAskNameVisible(false);
                }}
              />
              <View style={{ marginTop: spacing.sm }}>
                <PrimaryActionButton
                  title="Skip"
                  onPress={async () => {
                    const parsed = parseLineToPersonPayload(rawInput);
                    await beginLocationFlow(parsed, parsed.name ?? "Someone");
                    setNameText("");
                    setAskNameVisible(false);
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={confirmVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <AppText variant="subtitle">Confirm place</AppText>
              <AppText variant="body" style={{ marginTop: spacing.sm }}>
                Did you meet {pending?.name ?? "them"} at
                {" \""}{pending?.placeMetCandidate ?? ""}{"\""}?
              </AppText>
              <View style={{ marginTop: spacing.md }}>
                <PrimaryActionButton
                  title="Yes"
                  onPress={async () => {
                    if (pending) {
                      await persistEntry(pending);
                    }
                    setConfirmVisible(false);
                    setPending(null);
                  }}
                />
              </View>
              <View style={{ marginTop: spacing.sm }}>
                <PrimaryActionButton
                  title="No"
                  onPress={async () => {
                    if (pending?.typedGeo) {
                      await persistEntry(pending, null, true);
                      setConfirmVisible(false);
                      setPending(null);
                      return;
                    }
                    setConfirmVisible(false);
                    setAskWhereVisible(true);
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={askWhereVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAskWhereVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <AppText variant="subtitle">Where did you meet them?</AppText>
              <Input
                value={whereText}
                onChangeText={setWhereText}
                placeholder="e.g. Polo Lounge, LA"
              />
              <PrimaryActionButton
                title="Save"
                onPress={async () => {
                  if (pending) {
                    const text = whereText.trim();
                    await persistEntry(pending, text || null, !text);
                  }
                  setWhereText("");
                  setAskWhereVisible(false);
                  setPending(null);
                }}
              />
              <View style={{ marginTop: spacing.sm }}>
                <PrimaryActionButton
                  title="Skip"
                  onPress={async () => {
                    if (pending) {
                      await persistEntry(pending, null, true);
                    }
                    setWhereText("");
                    setAskWhereVisible(false);
                    setPending(null);
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>

        {toastVisible && (
          <Animated.View style={[styles.toast, { opacity: toastOpacity }]}> 
            <AppText variant="caption" style={{ color: colors.surface }}>
              Saved to People ✓
            </AppText>
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    minHeight: 500,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  brandMark: {
    color: colors.muted,
  },
  datePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  dateText: {
    color: colors.muted,
  },
  overviewWrap: {
    marginBottom: spacing.md,
  },
  exploreText: {
    marginBottom: spacing.sm,
  },
  cityStrip: {
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  cityPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  cityPillActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoft,
  },
  cityPillText: {
    color: colors.muted,
  },
  cityPillTextActive: {
    color: colors.accent,
  },
  cityUnderline: {
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginTop: 4,
  },
  cityUnderlineActive: {
    opacity: 1,
  },
  tripLine: {
    marginTop: spacing.sm,
  },
  notepadInput: {
    fontSize: 16,
    color: colors.text,
    paddingVertical: spacing.sm,
    paddingHorizontal: 2,
  },
  intentSection: {
    marginTop: spacing.lg,
  },
  intentList: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  intentCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  intentName: {
    color: colors.text,
  },
  intentReason: {
    marginTop: 4,
  },
  intentContext: {
    marginTop: 4,
    color: colors.muted,
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
  toast: {
    position: "absolute",
    bottom: spacing.xxl,
    alignSelf: "center",
    backgroundColor: "#111111",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  heatLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  nudgeText: {
    color: colors.muted,
  },
});