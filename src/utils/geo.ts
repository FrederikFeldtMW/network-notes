import * as Location from "expo-location";
import type { Person } from "../db/database";

const CITY_ALIASES: { aliases: string[]; city: string }[] = [
  { aliases: ["nyc", "new york", "manhattan", "new york city"], city: "New York City" },
  { aliases: ["la", "los angeles"], city: "Los Angeles" },
  { aliases: ["sf", "san francisco"], city: "San Francisco" },
  { aliases: ["copenhagen", "kobenhavn"], city: "Copenhagen" },
  { aliases: ["dc", "washington", "washington dc", "washington, dc"], city: "Washington, DC" },
  { aliases: ["london"], city: "London" },
  { aliases: ["paris"], city: "Paris" },
];

export function normalizeCity(input: string) {
  const lower = input.trim().toLowerCase();
  const match = CITY_ALIASES.find((entry) =>
    entry.aliases.some((alias) => lower.includes(alias))
  );
  return match ? match.city : input.trim();
}

export function extractGeoLabel(person: Person) {
  if (person.city?.trim()) {
    return normalizeCity(person.city);
  }
  if (person.tags) {
    const normalized = normalizeCity(person.tags);
    if (normalized !== person.tags) {
      return normalized;
    }
  }
  if (person.placeLabel) {
    const normalized = normalizeCity(person.placeLabel);
    if (normalized !== person.placeLabel) {
      return normalized;
    }
  }
  return null;
}

export async function geocodeCity(city: string) {
  const results = await Location.geocodeAsync(city);
  if (!results || results.length === 0) {
    return null;
  }
  return {
    lat: results[0].latitude,
    lng: results[0].longitude,
  };
}