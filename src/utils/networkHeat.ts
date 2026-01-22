import type { Person, RecentNoteItem } from "../db/database";
import { normalizeCity } from "./geo";

export type HeatNode = {
  id: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
  color: string;
};

const CONTEXT_KEYWORDS = [
  "met",
  "coffee",
  "dinner",
  "lunch",
  "breakfast",
  "hotel",
  "restaurant",
  "bar",
  "lounge",
  "cafe",
  "trip",
];

const WARM = "#E2C4A4";
const COOL = "#B9C7D6";

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function buildNetworkHeat(people: Person[], notes: RecentNoteItem[], seedKey: string) {
  const noteCounts = new Map<string, number>();
  const latestNoteAt = new Map<string, string>();
  const contextCounts = new Map<string, number>();
  const cityCounts = new Map<string, number>();

  notes.forEach((item) => {
    const personId = item.person.id;
    noteCounts.set(personId, (noteCounts.get(personId) ?? 0) + 1);
    const prev = latestNoteAt.get(personId);
    if (!prev || item.note.createdAt > prev) {
      latestNoteAt.set(personId, item.note.createdAt);
    }

    const content = item.note.content.toLowerCase();
    if (CONTEXT_KEYWORDS.some((keyword) => content.includes(keyword)) || item.note.placeLabel) {
      contextCounts.set(personId, (contextCounts.get(personId) ?? 0) + 1);
    }

    const place = item.person.city ?? item.person.placeLabel ?? item.note.placeLabel;
    if (place) {
      const city = normalizeCity(place);
      cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
    }
  });

  const maxCityCount = Math.max(1, ...Array.from(cityCounts.values()));
  const now = Date.now();

  const scored = people.map((person) => {
    const last = latestNoteAt.get(person.id) ?? person.lastInteractionAt ?? person.createdAt;
    const days = Math.floor((now - new Date(last).getTime()) / 86400000);
    const recency = clamp(1 - days / 60, 0, 1);
    const freq = clamp((noteCounts.get(person.id) ?? 0) / 5, 0, 1);
    const context = clamp((contextCounts.get(person.id) ?? 0) / 3, 0, 1);

    let geoBoost = 0;
    const cityLabel = person.city ?? person.placeLabel ?? null;
    if (cityLabel) {
      const count = cityCounts.get(normalizeCity(cityLabel)) ?? 0;
      geoBoost = clamp(count / maxCityCount, 0, 1);
    }

    const score = recency * 0.5 + freq * 0.3 + context * 0.1 + geoBoost * 0.1;
    return { person, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const nodes = scored.slice(0, 30).map(({ person, score }) => {
    const hash = hashString(`${seedKey}-${person.id}`);
    const x = 0.08 + (hash % 1000) / 1000 * 0.84;
    const y = 0.12 + ((hash / 1000) % 1000) / 1000 * 0.76;
    const size = 6 + score * 14;
    const opacity = 0.06 + score * 0.18;
    const color = score > 0.5 ? WARM : COOL;
    return {
      id: person.id,
      x,
      y,
      size,
      opacity,
      color,
    };
  });

  if (nodes.length >= 10) {
    return nodes;
  }

  const fillerCount = 12 - nodes.length;
  for (let i = 0; i < fillerCount; i += 1) {
    const hash = hashString(`${seedKey}-f-${i}`);
    nodes.push({
      id: `filler-${i}`,
      x: 0.1 + (hash % 1000) / 1000 * 0.8,
      y: 0.15 + ((hash / 1000) % 1000) / 1000 * 0.7,
      size: 6 + (hash % 6),
      opacity: 0.05 + (hash % 10) / 200,
      color: COOL,
    });
  }

  return nodes;
}

export function buildNudge(people: Person[], notes: RecentNoteItem[]) {
  const cityCounts = new Map<string, number>();
  notes.forEach((item) => {
    const place = item.person.city ?? item.person.placeLabel ?? item.note.placeLabel;
    if (!place) {
      return;
    }
    const city = normalizeCity(place);
    cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
  });

  let topCity: string | null = null;
  let topCount = 0;
  cityCounts.forEach((count, city) => {
    if (count > topCount) {
      topCount = count;
      topCity = city;
    }
  });

  if (topCity && topCount >= 2) {
    return `You have been expanding in ${topCity} lately.`;
  }

  const drifting = people.find((person) => {
    const last = person.lastInteractionAt ?? person.createdAt;
    const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
    return days >= 45;
  });

  if (drifting) {
    return "Someone you met recently is drifting.";
  }

  if (topCity) {
    return "A place you visit often keeps showing up.";
  }

  return null;
}