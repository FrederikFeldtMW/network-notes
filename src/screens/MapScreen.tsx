import * as Location from "expo-location";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import {
  getAllPeople,
  getAllTrips,
  getLatestPersonLocation,
  updatePerson,
  type Person,
  type Trip,
} from "../db/database";
import { getCityContext, setCityContext } from "../utils/cityContext";
import { extractGeoLabel, geocodeCity, normalizeCity } from "../utils/geo";
import AppText from "../ui/components/AppText";
import Divider from "../ui/components/Divider";
import IconButton from "../ui/components/IconButton";
import PrimaryActionButton from "../ui/components/PrimaryActionButton";
import Screen from "../ui/components/Screen";
import { colors, shadows, spacing } from "../ui/theme";

const NYC = {
  latitude: 40.7128,
  longitude: -74.006,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function jitterCoords(lat: number, lng: number, seed: string) {
  const hash = hashString(seed);
  const offset = (hash % 1000) / 100000;
  const jitter = offset - 0.0045;
  return {
    latitude: lat + jitter,
    longitude: lng - jitter,
  };
}

function buildCityStats(people: Person[], trips: Trip[]) {
  const counts = new Map<string, number>();
  const tripCities: string[] = [];

  trips.forEach((trip) => {
    const city = normalizeCity(trip.city);
    if (!tripCities.includes(city)) {
      tripCities.push(city);
    }
  });

  people.forEach((person) => {
    const label = extractGeoLabel(person);
    if (!label) {
      return;
    }
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  const topCities = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([city]) => city);

  const pillCities = ["All", ...tripCities, ...topCities.filter((city) => !tripCities.includes(city))];

  return { pillCities, topCities };
}

function regionFromPoints(points: { lat: number; lng: number }[]) {
  if (points.length === 0) {
    return null;
  }
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;
  const latitudeDelta = Math.max(0.08, (maxLat - minLat) * 1.8);
  const longitudeDelta = Math.max(0.08, (maxLng - minLng) * 1.8);
  return { latitude, longitude, latitudeDelta, longitudeDelta };
}

export default function MapScreen() {
  const navigation = useNavigation<any>();
  const mapRef = useRef<MapView | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [region, setRegion] = useState(NYC);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [pillCities, setPillCities] = useState<string[]>(["All"]);
  const [selectedCity, setSelectedCity] = useState("All");

  const loadPeople = useCallback(async () => {
    const rows = await getAllPeople();
    setPeople(rows);
  }, []);

  const loadCityPills = useCallback(async () => {
    const [peopleRows, trips] = await Promise.all([getAllPeople(), getAllTrips()]);
    const { pillCities: pills } = buildCityStats(peopleRows, trips);
    setPillCities(pills);
  }, []);

  const hydrateCityLocations = useCallback(async () => {
    const rows = await getAllPeople();
    const updated: Person[] = [];
    for (const person of rows) {
      if (person.lat !== null && person.lng !== null) {
        updated.push(person);
        continue;
      }
      const label = extractGeoLabel(person);
      if (!label) {
        updated.push(person);
        continue;
      }
      const coords = await geocodeCity(label);
      if (!coords) {
        updated.push(person);
        continue;
      }
      const next = await updatePerson(person.id, {
        lat: coords.lat,
        lng: coords.lng,
        locationSource: "city",
      });
      updated.push(next ?? person);
    }
    setPeople(updated);
  }, []);

  const centerOnLocation = useCallback((latitude: number, longitude: number) => {
    const next = {
      latitude,
      longitude,
      latitudeDelta: 0.2,
      longitudeDelta: 0.2,
    };
    setRegion(next);
    mapRef.current?.animateToRegion(next, 600);
  }, []);

  const centerOnMe = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      setHasLocationPermission(false);
      return;
    }
    setHasLocationPermission(true);
    const position = await Location.getCurrentPositionAsync({});
    centerOnLocation(position.coords.latitude, position.coords.longitude);
  }, [centerOnLocation]);

  const handleCitySelect = useCallback(
    async (city: string, persist = true) => {
      setSelectedCity(city);
      if (persist) {
        await setCityContext(city === "All" ? null : city);
      }

      if (city === "All") {
        const points = people
          .filter((person) => person.lat !== null && person.lng !== null)
          .map((person) => ({ lat: person.lat as number, lng: person.lng as number }));
        const regionFromAll = regionFromPoints(points);
        if (regionFromAll) {
          setRegion(regionFromAll);
          mapRef.current?.animateToRegion(regionFromAll, 600);
          return;
        }
        setRegion(NYC);
        return;
      }

      const points = people
        .filter((person) => extractGeoLabel(person) === city)
        .filter((person) => person.lat !== null && person.lng !== null)
        .map((person) => ({ lat: person.lat as number, lng: person.lng as number }));

      const regionFromCity = regionFromPoints(points);
      if (regionFromCity) {
        setRegion(regionFromCity);
        mapRef.current?.animateToRegion(regionFromCity, 600);
        return;
      }

      const coords = await geocodeCity(city);
      if (coords) {
        const next = {
          latitude: coords.lat,
          longitude: coords.lng,
          latitudeDelta: 0.2,
          longitudeDelta: 0.2,
        };
        setRegion(next);
        mapRef.current?.animateToRegion(next, 600);
      }
    },
    [people]
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        await loadPeople();
        await loadCityPills();
        await hydrateCityLocations();
        const stored = await getCityContext();
        if (isActive) {
          setSelectedCity(stored);
          if (stored !== "All") {
            await handleCitySelect(stored, false);
          }
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === Location.PermissionStatus.GRANTED) {
          setHasLocationPermission(true);
          const position = await Location.getCurrentPositionAsync({});
          if (isActive && stored === "All") {
            centerOnLocation(position.coords.latitude, position.coords.longitude);
          }
        } else {
          setHasLocationPermission(false);
          const latest = await getLatestPersonLocation();
          if (isActive && latest && stored === "All") {
            centerOnLocation(latest.lat, latest.lng);
          } else if (isActive && stored === "All") {
            setRegion(NYC);
          }
        }
      })().catch((error: unknown) => {
        if (isActive) {
          console.error("Failed to load map", error);
        }
      });
      return () => {
        isActive = false;
      };
    }, [loadPeople, loadCityPills, hydrateCityLocations, centerOnLocation, handleCitySelect])
  );

  const markers = useMemo(
    () =>
      people
        .filter((person) => person.lat !== null && person.lng !== null)
        .map((person) => {
          const coords = jitterCoords(person.lat as number, person.lng as number, person.id);
          const isMatch = selectedCity === "All" || extractGeoLabel(person) === selectedCity;
          return (
            <Marker
              key={person.id}
              coordinate={coords}
              opacity={isMatch ? 1 : 0.3}
              onPress={() => setSelectedPerson(person)}
            />
          );
        }),
    [people, selectedCity]
  );

  return (
    <Screen padded={false}>
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          region={region}
          showsUserLocation={hasLocationPermission}
        >
          {markers}
        </MapView>

        <View style={styles.pillBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillContent}
          >
            {pillCities.map((city) => {
              const isActive = city === selectedCity;
              return (
                <Pressable
                  key={city}
                  onPress={() => handleCitySelect(city)}
                  style={[styles.cityPill, isActive && styles.cityPillActive]}
                >
                  <AppText
                    variant="caption"
                    style={[styles.cityPillText, isActive && styles.cityPillTextActive]}
                  >
                    {city}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.fabStack}>
          <IconButton name="locate" onPress={centerOnMe} />
          <IconButton
            name="add"
            variant="filled"
            color="#ffffff"
            onPress={() => navigation.navigate("People", { screen: "QuickAdd" })}
            style={styles.fabFilled}
          />
        </View>

        <Modal
          visible={!!selectedPerson}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedPerson(null)}
        >
          <View style={styles.sheetBackdrop}>
            <View style={styles.sheetCard}>
              <AppText variant="subtitle">{selectedPerson?.name ?? "Contact"}</AppText>
              <AppText variant="muted" style={{ marginTop: 6 }}>
                {selectedPerson?.city ?? selectedPerson?.placeLabel ?? ""}
              </AppText>
              {selectedPerson?.locationSource === "city" && (
                <AppText variant="muted" style={{ marginTop: 6 }}>
                  City-level pin
                </AppText>
              )}
              <Divider />
              <PrimaryActionButton
                title="Open profile"
                onPress={() => {
                  if (selectedPerson?.id) {
                    navigation.navigate("People", {
                      screen: "PersonDetail",
                      params: { personId: selectedPerson.id },
                    });
                  }
                  setSelectedPerson(null);
                }}
              />
              <Pressable onPress={() => setSelectedPerson(null)} style={styles.closePressable}>
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
  pillBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: spacing.xxl + 8,
  },
  pillContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  cityPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
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
  fabStack: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    gap: spacing.sm,
    ...shadows.floating,
  },
  fabFilled: {
    backgroundColor: colors.accent,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.2)",
    padding: spacing.lg,
  },
  sheetCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  closePressable: {
    marginTop: spacing.sm,
    alignSelf: "center",
  },
});