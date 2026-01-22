import Calendar from "react-native-calendars/src/calendar";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { memo, useCallback, useMemo, useState } from "react";
import {
  Modal,
  StyleSheet,
  View,
} from "react-native";
import {
  createTrip,
  getDistinctCities,
  getUpcomingTrips,
  type Trip,
} from "../db/database";
import type { TodayStackParamList } from "../navigation/TodayStack";
import AppText from "../ui/components/AppText";
import Divider from "../ui/components/Divider";
import Input from "../ui/components/Input";
import PrimaryActionButton from "../ui/components/PrimaryActionButton";
import Row from "../ui/components/Row";
import Screen from "../ui/components/Screen";
import { colors, spacing } from "../ui/theme";

const CITY_ALIASES = [
  { alias: "NYC", city: "New York City" },
  { alias: "SF", city: "San Francisco" },
  { alias: "LA", city: "Los Angeles" },
  { alias: "DC", city: "Washington, DC" },
  { alias: "SEA", city: "Seattle" },
];

type DateRange = {
  startDate: string | null;
  endDate: string | null;
};

type TripsNav = NativeStackNavigationProp<TodayStackParamList, "Trips">;

type TripRowProps = {
  trip: Trip;
  onPress: (tripId: string) => void;
};

const TripRow = memo(({ trip, onPress }: TripRowProps) => (
  <Row
    title={trip.city}
    subtitle={
      `${new Date(trip.startDate).toDateString()}` +
      (trip.endDate ? ` → ${new Date(trip.endDate).toDateString()}` : "")
    }
    right={
      <AppText variant="caption" style={{ color: colors.accent }}>
        Edit
      </AppText>
    }
    onPress={() => onPress(trip.id)}
  />
));

TripRow.displayName = "TripRow";

export default function TripsScreen() {
  const navigation = useNavigation<TripsNav>();
  const [city, setCity] = useState("");
  const [knownCities, setKnownCities] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });
  const [tempRange, setTempRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadTrips = useCallback(async () => {
    const now = new Date().toISOString();
    const rows = await getUpcomingTrips(now);
    setTrips(rows);
  }, []);

  const loadCities = useCallback(async () => {
    const rows = await getDistinctCities();
    setKnownCities(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      Promise.all([loadTrips(), loadCities()]).catch((error: unknown) => {
        if (isActive) {
          console.error("Failed to load trips data", error);
        }
      });
      return () => {
        isActive = false;
      };
    }, [loadTrips, loadCities])
  );

  const suggestions = useMemo(() => {
    const input = city.trim().toLowerCase();
    if (!input) {
      return [];
    }
    const results: string[] = [];
    const seen = new Set<string>();
    const add = (value: string) => {
      const key = value.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        results.push(value);
      }
    };

    CITY_ALIASES.forEach(({ alias, city: canonical }) => {
      if (
        alias.toLowerCase().includes(input) ||
        canonical.toLowerCase().includes(input)
      ) {
        add(canonical);
      }
    });

    knownCities.forEach((known) => {
      if (known.toLowerCase().includes(input)) {
        add(known);
      }
    });

    return results.slice(0, 6);
  }, [city, knownCities]);

  const markedDates = useMemo(() => {
    if (!tempRange.startDate) {
      return {};
    }
    const marks: Record<string, any> = {};
    const start = tempRange.startDate;
    const end = tempRange.endDate ?? tempRange.startDate;
    let current = new Date(start);
    const endDate = new Date(end);
    while (current <= endDate) {
      const dateString = current.toISOString().slice(0, 10);
      marks[dateString] = {
        startingDay: dateString === start,
        endingDay: dateString === end,
        color: colors.accent,
        textColor: "#ffffff",
      };
      current.setDate(current.getDate() + 1);
    }
    return marks;
  }, [tempRange]);

  const openCalendar = useCallback(() => {
    setTempRange(dateRange);
    setIsCalendarVisible(true);
  }, [dateRange]);

  const handleDayPress = useCallback(
    (day: { dateString: string }) => {
      const { dateString } = day;
      if (!tempRange.startDate || (tempRange.startDate && tempRange.endDate)) {
        setTempRange({ startDate: dateString, endDate: null });
        return;
      }
      if (dateString < tempRange.startDate) {
        setTempRange({ startDate: dateString, endDate: null });
        return;
      }
      setTempRange({ startDate: tempRange.startDate, endDate: dateString });
    },
    [tempRange]
  );

  const formattedRange = useMemo(() => {
    if (!dateRange.startDate) {
      return "Select dates";
    }
    const start = new Date(dateRange.startDate).toDateString();
    if (!dateRange.endDate || dateRange.endDate === dateRange.startDate) {
      return start;
    }
    const end = new Date(dateRange.endDate).toDateString();
    return `${start} → ${end}`;
  }, [dateRange]);

  const saveTrip = async () => {
    const trimmedCity = city.trim();
    if (!trimmedCity || !dateRange.startDate) {
      return;
    }
    setIsSaving(true);
    try {
      await createTrip({
        city: trimmedCity,
        startDate: new Date(dateRange.startDate).toISOString(),
        endDate: dateRange.endDate
          ? new Date(dateRange.endDate).toISOString()
          : null,
      });
      setCity("");
      setDateRange({ startDate: null, endDate: null });
      await loadTrips();
    } catch (error) {
      console.error("Failed to save trip", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTripPress = useCallback(
    (tripId: string) => {
      navigation.navigate("TripDetail", { tripId });
    },
    [navigation]
  );

  return (
    <Screen>
      <AppText variant="title">Trips</AppText>
      <AppText variant="muted" style={{ marginBottom: spacing.lg }}>
        Plan ahead and reach out.
      </AppText>

      <Input
        label="City"
        value={city}
        onChangeText={(text) => {
          setCity(text);
          setShowSuggestions(text.trim().length > 0);
        }}
        placeholder="e.g. Seattle"
      />
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map((suggestion, index) => (
            <View key={suggestion}>
              <Row
                title={suggestion}
                onPress={() => {
                  setCity(suggestion);
                  setShowSuggestions(false);
                }}
              />
              {index < suggestions.length - 1 && <Divider />}
            </View>
          ))}
        </View>
      )}

      <AppText variant="caption" style={{ marginBottom: spacing.xs }}>
        Dates
      </AppText>
      <Row title={formattedRange} onPress={openCalendar} />

      <View style={{ marginTop: spacing.md }}>
        <PrimaryActionButton title={isSaving ? "Saving…" : "Add Trip"} loading={isSaving} onPress={saveTrip} />
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <AppText variant="subtitle">Upcoming</AppText>
        <Divider />
        {trips.length === 0 ? (
          <AppText variant="muted" style={{ paddingVertical: spacing.sm }}>
            Add a trip to get pre-trip reach-outs.
          </AppText>
        ) : (
          trips.map((trip, index) => (
            <View key={trip.id}>
              <TripRow trip={trip} onPress={handleTripPress} />
              {index < trips.length - 1 && <Divider />}
            </View>
          ))
        )}
      </View>

      <Modal
        visible={isCalendarVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsCalendarVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Calendar
              style={{ width: "100%" }}
              markingType="period"
              markedDates={markedDates}
              onDayPress={handleDayPress}
            />
            <View style={styles.modalActions}>
              <Row title="Cancel" onPress={() => setIsCalendarVisible(false)} />
              <Row
                title="Done"
                onPress={() => {
                  setDateRange(tempRange);
                  setIsCalendarVisible(false);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  suggestions: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    borderRadius: 10,
    marginBottom: spacing.md,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  modalActions: {
    marginTop: spacing.sm,
  },
});