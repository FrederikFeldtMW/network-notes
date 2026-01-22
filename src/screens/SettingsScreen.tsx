import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import * as Notifications from "expo-notifications";
import {
  cancelAllScheduledNotifs,
  requestNotifPermission,
  scheduleDailySummary,
  scheduleTripReminders,
} from "../utils/notifications";
import AppText from "../ui/components/AppText";
import Divider from "../ui/components/Divider";
import Input from "../ui/components/Input";
import PrimaryActionButton from "../ui/components/PrimaryActionButton";
import Row from "../ui/components/Row";
import Screen from "../ui/components/Screen";
import { colors, spacing } from "../ui/theme";

const STORAGE_KEYS = {
  dailyEnabled: "notif_daily_enabled",
  tripEnabled: "notif_trip_enabled",
  dailyHour: "notif_daily_hour",
  dailyMinute: "notif_daily_minute",
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function SettingsScreen() {
  const [dailyEnabled, setDailyEnabled] = useState(false);
  const [tripEnabled, setTripEnabled] = useState(false);
  const [hour, setHour] = useState("9");
  const [minute, setMinute] = useState("0");
  const [notifGranted, setNotifGranted] = useState(true);

  const loadSettings = useCallback(async () => {
    const [
      dailyEnabledValue,
      tripEnabledValue,
      hourValue,
      minuteValue,
    ] = await AsyncStorage.multiGet([
      STORAGE_KEYS.dailyEnabled,
      STORAGE_KEYS.tripEnabled,
      STORAGE_KEYS.dailyHour,
      STORAGE_KEYS.dailyMinute,
    ]);
    setDailyEnabled(dailyEnabledValue[1] === "true");
    setTripEnabled(tripEnabledValue[1] === "true");
    setHour(hourValue[1] ?? "9");
    setMinute(minuteValue[1] ?? "0");
  }, []);

  const checkPermission = useCallback(async () => {
    const current = await Notifications.getPermissionsAsync();
    setNotifGranted(current.status === "granted");
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings().catch(() => undefined);
      checkPermission().catch(() => undefined);
    }, [loadSettings, checkPermission])
  );

  const applySchedule = useCallback(
    async (nextDaily: boolean, nextTrip: boolean, nextHour: string, nextMinute: string) => {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.dailyEnabled, String(nextDaily)],
        [STORAGE_KEYS.tripEnabled, String(nextTrip)],
        [STORAGE_KEYS.dailyHour, nextHour],
        [STORAGE_KEYS.dailyMinute, nextMinute],
      ]);

      const granted = await requestNotifPermission();
      setNotifGranted(granted);
      if (!granted) {
        return;
      }

      await cancelAllScheduledNotifs();
      if (nextDaily) {
        const h = clamp(Number.parseInt(nextHour, 10) || 9, 0, 23);
        const m = clamp(Number.parseInt(nextMinute, 10) || 0, 0, 59);
        await scheduleDailySummary(h, m);
      }
      if (nextTrip) {
        await scheduleTripReminders();
      }
    },
    []
  );

  const handleEnableNotifications = async () => {
    const granted = await requestNotifPermission();
    setNotifGranted(granted);
    if (!granted) {
      Alert.alert(
        "Notifications disabled",
        "Enable notifications in system settings."
      );
    }
  };

  return (
    <Screen>
      <AppText variant="title" style={{ marginBottom: spacing.lg }}>
        Settings
      </AppText>

      {!notifGranted && (
        <View style={styles.notice}>
          <AppText variant="caption" style={{ color: colors.muted, marginBottom: spacing.sm }}>
            Notifications are off.
          </AppText>
          <PrimaryActionButton title="Enable notifications" onPress={handleEnableNotifications} />
        </View>
      )}

      <View style={{ marginTop: spacing.lg }}>
        <AppText variant="subtitle">Daily reminder</AppText>
        <Divider />
        <Row
          title={dailyEnabled ? "On" : "Off"}
          subtitle="Tap to toggle"
          onPress={() => {
            const next = !dailyEnabled;
            setDailyEnabled(next);
            applySchedule(next, tripEnabled, hour, minute).catch(() => undefined);
          }}
        />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <AppText variant="subtitle">Time (24h)</AppText>
        <Divider />
        <View style={styles.timeRow}>
          <Input
            label="Hour"
            value={hour}
            onChangeText={setHour}
            placeholder="9"
            keyboardType="number-pad"
            onEndEditing={() =>
              applySchedule(dailyEnabled, tripEnabled, hour, minute).catch(
                () => undefined
              )
            }
          />
          <Input
            label="Minute"
            value={minute}
            onChangeText={setMinute}
            placeholder="0"
            keyboardType="number-pad"
            onEndEditing={() =>
              applySchedule(dailyEnabled, tripEnabled, hour, minute).catch(
                () => undefined
              )
            }
          />
        </View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <AppText variant="subtitle">Trip reminders</AppText>
        <Divider />
        <Row
          title={tripEnabled ? "On" : "Off"}
          subtitle="Tap to toggle"
          onPress={() => {
            const next = !tripEnabled;
            setTripEnabled(next);
            applySchedule(dailyEnabled, next, hour, minute).catch(() => undefined);
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  timeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  notice: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
});