import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addNote,
  createPerson,
  getAllPeople,
  updateNoteCreatedAt,
  updatePersonLastInteraction,
} from "../db/database";

export const SEED_ENABLED = __DEV__ && false;
const SEED_KEY = "seed_data_done";

const CITIES = [
  { name: "New York City", weight: 30, places: ["Soho House", "Polo Lounge", "The Bowery Hotel", "Cafe Gitane"] },
  { name: "Los Angeles", weight: 22, places: ["Polo Lounge", "Chateau Marmont", "Alfred Coffee", "The Ivy"] },
  { name: "San Francisco", weight: 16, places: ["Tartine", "The Battery", "Blue Bottle", "Hotel Vitale"] },
  { name: "Copenhagen", weight: 10, places: ["Hotel Sanders", "Apollo Bar", "The Living Room", "La Banchina"] },
  { name: "London", weight: 12, places: ["Soho House", "Chiltern Firehouse", "Sketch", "The Hoxton"] },
  { name: "Berlin", weight: 6, places: ["Bonanza Coffee", "Hotel Orania", "Michelberger", "Cafe Einstein"] },
  { name: "Paris", weight: 10, places: ["Hotel Costes", "Cafe de Flore", "Le Marais", "The Hoxton Paris"] },
];

const FIRST_NAMES = [
  "Blake",
  "Ava",
  "Maya",
  "Liam",
  "Noah",
  "Sofia",
  "Ella",
  "Ethan",
  "Lucas",
  "Chloe",
  "Mateo",
  "Nina",
  "Leo",
  "Isla",
  "Amir",
  "Sienna",
  "James",
  "Zoe",
  "Theo",
  "Freya",
  "Aria",
  "Miles",
  "Jade",
  "Max",
  "Iris",
  "Kai",
  "Ruby",
  "Owen",
  "Mila",
  "Ezra",
];

const LAST_NAMES = [
  "Anderson",
  "Lopez",
  "Nguyen",
  "Patel",
  "Cohen",
  "Baker",
  "Miller",
  "Kim",
  "Singh",
  "Hughes",
  "Clark",
  "Martinez",
  "Reed",
  "Turner",
  "Brooks",
  "Davis",
  "Rivera",
  "Stewart",
  "Parker",
  "Scott",
  "Wright",
  "Foster",
  "Diaz",
  "Hall",
  "Morgan",
  "Price",
  "Ward",
  "Cole",
  "Barnes",
  "Shaw",
];

const NOTE_SNIPPETS = [
  "Great energy",
  "We talked about travel",
  "Works in design",
  "Introduced by a friend",
  "Shared a long walk",
  "Interested in startups",
  "Quiet but thoughtful",
  "Has a new project",
  "Lives near the park",
  "We should catch up soon",
];

const randomItem = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

const pickCity = () => {
  const total = CITIES.reduce((sum, city) => sum + city.weight, 0);
  let roll = Math.random() * total;
  for (const city of CITIES) {
    roll -= city.weight;
    if (roll <= 0) {
      return city;
    }
  }
  return CITIES[0];
};

const randomDateWithin = (daysBack: number) => {
  const now = Date.now();
  const offset = Math.floor(Math.random() * daysBack) * 86400000;
  return new Date(now - offset).toISOString();
};

const uniqueName = (used: Set<string>) => {
  let name = "";
  while (!name || used.has(name)) {
    name = `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
  }
  used.add(name);
  return name;
};

export async function ensureSeedData() {
  if (!SEED_ENABLED) {
    return false;
  }

  const done = await AsyncStorage.getItem(SEED_KEY);
  if (done === "true") {
    return false;
  }

  const existing = await getAllPeople();
  if (existing.length > 0) {
    await AsyncStorage.setItem(SEED_KEY, "true");
    return false;
  }

  const usedNames = new Set<string>();
  for (let i = 0; i < 100; i += 1) {
    const cityData = pickCity();
    const name = uniqueName(usedNames);
    const placeLabel = Math.random() > 0.6 ? randomItem(cityData.places) : null;
    const createdAt = randomDateWithin(260);

    const person = await createPerson({
      name,
      city: cityData.name,
      placeLabel,
      importance: Math.random() > 0.7 ? 4 : 3,
      lastInteractionAt: createdAt,
    });

    const noteCount = 1 + Math.floor(Math.random() * 5);
    let latestNote = createdAt;
    for (let n = 0; n < noteCount; n += 1) {
      const noteAt = randomDateWithin(320);
      if (noteAt > latestNote) {
        latestNote = noteAt;
      }
      const snippet = randomItem(NOTE_SNIPPETS);
      const notePlace = placeLabel ?? (Math.random() > 0.7 ? randomItem(cityData.places) : null);
      const note = await addNote({
        personId: person.id,
        content: notePlace ? `${snippet} at ${notePlace}.` : `${snippet}.`,
        placeLabel: notePlace,
      });
      await updateNoteCreatedAt(note.id, noteAt);
    }

    await updatePersonLastInteraction(person.id, latestNote);
  }

  await AsyncStorage.setItem(SEED_KEY, "true");
  return true;
}