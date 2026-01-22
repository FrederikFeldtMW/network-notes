import * as Location from "expo-location";

export type LocationResult = {
  lat: number;
  lng: number;
  placeLabel?: string;
};

export async function ensureLocationPermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED;
}

export async function getCurrentLocation(): Promise<LocationResult | null> {
  const hasPermission = await ensureLocationPermission();
  if (!hasPermission) {
    return null;
  }

  const position = await Location.getCurrentPositionAsync({});
  const { latitude, longitude } = position.coords;
  let placeLabel: string | undefined;

  try {
    const [place] = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });
    if (place) {
      const parts = [place.name, place.city, place.region].filter(Boolean);
      if (parts.length > 0) {
        placeLabel = parts.join(", ");
      }
    }
  } catch {
    placeLabel = undefined;
  }

  return {
    lat: latitude,
    lng: longitude,
    placeLabel,
  };
}

export async function getCurrentLocationWithPlaceLabel(): Promise<
  LocationResult | null
> {
  const hasPermission = await ensureLocationPermission();
  if (!hasPermission) {
    return null;
  }

  const position = await Location.getCurrentPositionAsync({});
  const { latitude, longitude } = position.coords;
  let placeLabel: string | undefined;

  try {
    const [place] = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });
    if (place) {
      const name = place.name ?? undefined;
      const street = place.street ?? undefined;
      const city = place.city ?? undefined;
      const region = place.region ?? undefined;

      if (name) {
        placeLabel = name;
      } else if (street || city) {
        placeLabel = [street, city].filter(Boolean).join(", ");
      } else if (city) {
        placeLabel = city;
      } else if (region) {
        placeLabel = region;
      }
    }
  } catch {
    placeLabel = undefined;
  }

  return {
    lat: latitude,
    lng: longitude,
    placeLabel,
  };
}
