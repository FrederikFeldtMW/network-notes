import * as SQLite from "expo-sqlite";

export type Person = {
  id: string;
  name: string;
  city: string | null;
  tags: string | null;
  importance: number;
  createdAt: string;
  updatedAt: string;
  lastInteractionAt: string | null;
  placeLabel: string | null;
  lat: number | null;
  lng: number | null;
  phoneContactId: string | null;
  phoneNumber: string | null;
  preferredChannel: string | null;
  age: number | null;
};

export type CreatePersonInput = {
  name: string;
  city?: string | null;
  tags?: string | null;
  importance?: number;
  lastInteractionAt?: string | null;
  placeLabel?: string | null;
  lat?: number | null;
  lng?: number | null;
  phoneContactId?: string | null;
  phoneNumber?: string | null;
  preferredChannel?: string | null;
  age?: number | null;
};

export type Note = {
  id: string;
  personId: string;
  content: string;
  createdAt: string;
  needsFollowUp: number;
  followUpAt: string | null;
  lat: number | null;
  lng: number | null;
  placeLabel: string | null;
};

export type AddNoteInput = {
  personId: string;
  content: string;
  needsFollowUp?: number;
  followUpAt?: string | null;
  lat?: number | null;
  lng?: number | null;
  placeLabel?: string | null;
};

export type Trip = {
  id: string;
  city: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
};

export type CreateTripInput = {
  city: string;
  startDate: string;
  endDate?: string | null;
};

export type Snooze = {
  personId: string;
  untilDate: string;
};

export type FollowUpItem = {
  note: Note;
  person: {
    id: string;
    name: string;
    city: string | null;
    placeLabel: string | null;
  };
};

export type TripReachout = {
  personId: string;
  status: "pending" | "done";
};

export type RecentNoteItem = {
  note: Note;
  person: {
    id: string;
    name: string;
    city: string | null;
    placeLabel: string | null;
  };
};

let db: SQLite.SQLiteDatabase | null = null;

async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync("network-notes.db");
  }
  return db;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function init() {
  const database = await getDb();
  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      city TEXT,
      tags TEXT,
      importance INTEGER NOT NULL DEFAULT 3,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      lastInteractionAt TEXT,
      placeLabel TEXT,
      lat REAL,
      lng REAL,
      phoneContactId TEXT,
      phoneNumber TEXT,
      preferredChannel TEXT,
      age INTEGER
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY NOT NULL,
      personId TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      needsFollowUp INTEGER NOT NULL DEFAULT 0,
      followUpAt TEXT,
      lat REAL,
      lng REAL,
      placeLabel TEXT
    );

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY NOT NULL,
      city TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS snoozes (
      personId TEXT PRIMARY KEY NOT NULL,
      untilDate TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trip_reachouts (
      id TEXT PRIMARY KEY NOT NULL,
      tripId TEXT NOT NULL,
      personId TEXT NOT NULL,
      status TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  try {
    await database.execAsync(`ALTER TABLE people ADD COLUMN placeLabel TEXT;`);
  } catch {
    // Column already exists or migration not needed.
  }

  try {
    await database.execAsync(
      `ALTER TABLE notes ADD COLUMN needsFollowUp INTEGER NOT NULL DEFAULT 0;`
    );
  } catch {
    // Column already exists or migration not needed.
  }

  try {
    await database.execAsync(`ALTER TABLE notes ADD COLUMN followUpAt TEXT;`);
  } catch {
    // Column already exists or migration not needed.
  }

  try {
    await database.execAsync(`ALTER TABLE people ADD COLUMN phoneContactId TEXT;`);
  } catch {
    // Column already exists or migration not needed.
  }

  try {
    await database.execAsync(`ALTER TABLE people ADD COLUMN phoneNumber TEXT;`);
  } catch {
    // Column already exists or migration not needed.
  }

  try {
    await database.execAsync(`ALTER TABLE people ADD COLUMN preferredChannel TEXT;`);
  } catch {
    // Column already exists or migration not needed.
  }

  try {
    await database.execAsync(`ALTER TABLE people ADD COLUMN age INTEGER;`);
  } catch {
    // Column already exists or migration not needed.
  }
}

export async function createPerson(input: CreatePersonInput) {
  const database = await getDb();
  const now = new Date().toISOString();
  const person: Person = {
    id: generateId(),
    name: input.name.trim(),
    city: input.city?.trim() ? input.city.trim() : null,
    tags: input.tags?.trim() ? input.tags.trim() : null,
    importance: input.importance ?? 3,
    createdAt: now,
    updatedAt: now,
    lastInteractionAt: input.lastInteractionAt ?? null,
    placeLabel: input.placeLabel ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    phoneContactId: input.phoneContactId ?? null,
    phoneNumber: input.phoneNumber ?? null,
    preferredChannel: input.preferredChannel ?? null,
    age: input.age ?? null,
  };

  await database.runAsync(
    `INSERT INTO people (
      id, name, city, tags, importance, createdAt, updatedAt, lastInteractionAt, placeLabel, lat, lng, phoneContactId, phoneNumber, preferredChannel, age
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      person.id,
      person.name,
      person.city,
      person.tags,
      person.importance,
      person.createdAt,
      person.updatedAt,
      person.lastInteractionAt,
      person.placeLabel,
      person.lat,
      person.lng,
      person.phoneContactId,
      person.phoneNumber,
      person.preferredChannel,
      person.age,
    ]
  );

  return person;
}

export async function upsertPersonByName(input: CreatePersonInput) {
  const database = await getDb();
  const name = input.name.trim();
  const existing = await database.getFirstAsync<Person>(
    `SELECT
      id, name, city, tags, importance, createdAt, updatedAt, lastInteractionAt, placeLabel, lat, lng, phoneContactId, phoneNumber, preferredChannel, age
     FROM people
     WHERE LOWER(name) = LOWER(?)
     LIMIT 1`,
    [name]
  );

  if (!existing) {
    return createPerson(input);
  }

  const now = new Date().toISOString();
  const updated: Person = {
    ...existing,
    name,
    city: existing.city || (input.city?.trim() || null),
    tags: input.tags !== undefined ? input.tags?.trim() || null : existing.tags,
    importance:
      input.importance !== undefined ? input.importance : existing.importance,
    lastInteractionAt:
      input.lastInteractionAt !== undefined
        ? input.lastInteractionAt
        : existing.lastInteractionAt,
    placeLabel: existing.placeLabel || input.placeLabel || null,
    lat: input.lat ?? existing.lat,
    lng: input.lng ?? existing.lng,
    phoneContactId:
      input.phoneContactId !== undefined
        ? input.phoneContactId
        : existing.phoneContactId,
    phoneNumber:
      input.phoneNumber !== undefined ? input.phoneNumber : existing.phoneNumber,
    preferredChannel:
      input.preferredChannel !== undefined
        ? input.preferredChannel
        : existing.preferredChannel,
    age: existing.age ?? input.age ?? null,
    updatedAt: now,
  };

  await database.runAsync(
    `UPDATE people
     SET name = ?,
         city = ?,
         tags = ?,
         importance = ?,
         updatedAt = ?,
         lastInteractionAt = ?,
         placeLabel = ?,
         lat = ?,
         lng = ?,
         phoneContactId = ?,
         phoneNumber = ?,
         preferredChannel = ?,
         age = ?
     WHERE id = ?`,
    [
      updated.name,
      updated.city,
      updated.tags,
      updated.importance,
      updated.updatedAt,
      updated.lastInteractionAt,
      updated.placeLabel,
      updated.lat,
      updated.lng,
      updated.phoneContactId,
      updated.phoneNumber,
      updated.preferredChannel,
      updated.age,
      updated.id,
    ]
  );

  return updated;
}

export async function updatePerson(
  personId: string,
  input: Partial<CreatePersonInput>
) {
  const database = await getDb();
  const existing = await getPersonById(personId);
  if (!existing) {
    return null;
  }
  const now = new Date().toISOString();
  const updated: Person = {
    ...existing,
    name: input.name !== undefined ? input.name.trim() : existing.name,
    city:
      input.city !== undefined
        ? input.city?.trim() || null
        : existing.city,
    tags:
      input.tags !== undefined
        ? input.tags?.trim() || null
        : existing.tags,
    importance:
      input.importance !== undefined ? input.importance : existing.importance,
    lastInteractionAt:
      input.lastInteractionAt !== undefined
        ? input.lastInteractionAt
        : existing.lastInteractionAt,
    placeLabel:
      input.placeLabel !== undefined ? input.placeLabel : existing.placeLabel,
    lat: input.lat !== undefined ? input.lat : existing.lat,
    lng: input.lng !== undefined ? input.lng : existing.lng,
    phoneContactId:
      input.phoneContactId !== undefined
        ? input.phoneContactId
        : existing.phoneContactId,
    phoneNumber:
      input.phoneNumber !== undefined ? input.phoneNumber : existing.phoneNumber,
    preferredChannel:
      input.preferredChannel !== undefined
        ? input.preferredChannel
        : existing.preferredChannel,
    age: input.age !== undefined ? input.age : existing.age,
    updatedAt: now,
  };

  await database.runAsync(
    `UPDATE people
     SET name = ?,
         city = ?,
         tags = ?,
         importance = ?,
         updatedAt = ?,
         lastInteractionAt = ?,
         placeLabel = ?,
         lat = ?,
         lng = ?,
         phoneContactId = ?,
         phoneNumber = ?,
         preferredChannel = ?,
         age = ?
     WHERE id = ?`,
    [
      updated.name,
      updated.city,
      updated.tags,
      updated.importance,
      updated.updatedAt,
      updated.lastInteractionAt,
      updated.placeLabel,
      updated.lat,
      updated.lng,
      updated.phoneContactId,
      updated.phoneNumber,
      updated.preferredChannel,
      updated.age,
      personId,
    ]
  );

  return updated;
}

export async function deletePerson(personId: string) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM notes WHERE personId = ?`, [personId]);
  await database.runAsync(
    `DELETE FROM trip_reachouts WHERE personId = ?`,
    [personId]
  );
  await database.runAsync(`DELETE FROM snoozes WHERE personId = ?`, [personId]);
  await database.runAsync(`DELETE FROM people WHERE id = ?`, [personId]);
}

export async function getAllPeople() {
  const database = await getDb();
  const rows = await database.getAllAsync<Person>(
    `SELECT
      id, name, city, tags, importance, createdAt, updatedAt, lastInteractionAt, placeLabel, lat, lng, phoneContactId, phoneNumber, preferredChannel, age
     FROM people
     ORDER BY updatedAt DESC`
  );
  return rows;
}

export async function getPersonById(id: string) {
  const database = await getDb();
  const row = await database.getFirstAsync<Person>(
    `SELECT
      id, name, city, tags, importance, createdAt, updatedAt, lastInteractionAt, placeLabel, lat, lng, phoneContactId, phoneNumber, preferredChannel, age
     FROM people
     WHERE id = ?`,
    [id]
  );
  return row ?? null;
}

export async function getNotesForPerson(personId: string) {
  const database = await getDb();
  const rows = await database.getAllAsync<Note>(
    `SELECT
      id, personId, content, createdAt, needsFollowUp, followUpAt, lat, lng, placeLabel
     FROM notes
     WHERE personId = ?
     ORDER BY createdAt DESC`,
    [personId]
  );
  return rows;
}

export async function addNote(input: AddNoteInput) {
  const database = await getDb();
  const now = new Date().toISOString();
  const note: Note = {
    id: generateId(),
    personId: input.personId,
    content: input.content.trim(),
    createdAt: now,
    needsFollowUp: input.needsFollowUp ?? 0,
    followUpAt: input.followUpAt ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    placeLabel: input.placeLabel ?? null,
  };

  await database.runAsync(
    `INSERT INTO notes (
      id, personId, content, createdAt, needsFollowUp, followUpAt, lat, lng, placeLabel
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      note.id,
      note.personId,
      note.content,
      note.createdAt,
      note.needsFollowUp,
      note.followUpAt,
      note.lat,
      note.lng,
      note.placeLabel,
    ]
  );

  return note;
}

export async function updateNoteCreatedAt(noteId: string, createdAt: string) {
  const database = await getDb();
  await database.runAsync(
    `UPDATE notes
     SET createdAt = ?
     WHERE id = ?`,
    [createdAt, noteId]
  );
}

export async function updatePersonLastInteraction(
  personId: string,
  isoDate: string
) {
  const database = await getDb();
  await database.runAsync(
    `UPDATE people
     SET lastInteractionAt = ?
     WHERE id = ?`,
    [isoDate, personId]
  );
}

export async function updatePersonPlaceLabel(
  personId: string,
  placeLabel: string | null
) {
  const database = await getDb();
  await database.runAsync(
    `UPDATE people
     SET placeLabel = ?
     WHERE id = ?`,
    [placeLabel, personId]
  );
}

export async function getNotesWithLocation() {
  const database = await getDb();
  const rows = await database.getAllAsync<Note>(
    `SELECT
      id, personId, content, createdAt, needsFollowUp, followUpAt, lat, lng, placeLabel
     FROM notes
     WHERE lat IS NOT NULL AND lng IS NOT NULL
     ORDER BY createdAt DESC`
  );
  return rows;
}

export async function getRecentNotesWithPeople(limit = 50) {
  const database = await getDb();
  const rows = await database.getAllAsync<{
    id: string;
    personId: string;
    content: string;
    createdAt: string;
    needsFollowUp: number;
    followUpAt: string | null;
    lat: number | null;
    lng: number | null;
    placeLabel: string | null;
    personName: string;
    personCity: string | null;
    personPlaceLabel: string | null;
  }>(
    `SELECT
      n.id,
      n.personId,
      n.content,
      n.createdAt,
      n.needsFollowUp,
      n.followUpAt,
      n.lat,
      n.lng,
      n.placeLabel,
      p.name as personName,
      p.city as personCity,
      p.placeLabel as personPlaceLabel
     FROM notes n
     JOIN people p ON p.id = n.personId
     ORDER BY n.createdAt DESC
     LIMIT ?`,
    [limit]
  );

  return rows.map((row) => ({
    note: {
      id: row.id,
      personId: row.personId,
      content: row.content,
      createdAt: row.createdAt,
      needsFollowUp: row.needsFollowUp,
      followUpAt: row.followUpAt,
      lat: row.lat,
      lng: row.lng,
      placeLabel: row.placeLabel,
    },
    person: {
      id: row.personId,
      name: row.personName,
      city: row.personCity,
      placeLabel: row.personPlaceLabel,
    },
  }));
}

export async function createTrip(input: CreateTripInput) {
  const database = await getDb();
  const now = new Date().toISOString();
  const trip: Trip = {
    id: generateId(),
    city: input.city.trim(),
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    createdAt: now,
  };

  await database.runAsync(
    `INSERT INTO trips (
      id, city, startDate, endDate, createdAt
    ) VALUES (?, ?, ?, ?, ?)`,
    [trip.id, trip.city, trip.startDate, trip.endDate, trip.createdAt]
  );

  return trip;
}

export async function updateTrip(
  tripId: string,
  input: { city: string; startDate: string; endDate: string | null }
) {
  const database = await getDb();
  await database.runAsync(
    `UPDATE trips
     SET city = ?,
         startDate = ?,
         endDate = ?
     WHERE id = ?`,
    [input.city.trim(), input.startDate, input.endDate, tripId]
  );
}

export async function deleteTrip(tripId: string) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM trip_reachouts WHERE tripId = ?`, [tripId]);
  await database.runAsync(`DELETE FROM trips WHERE id = ?`, [tripId]);
}

export async function getTripById(tripId: string) {
  const database = await getDb();
  const row = await database.getFirstAsync<Trip>(
    `SELECT id, city, startDate, endDate, createdAt
     FROM trips
     WHERE id = ?`,
    [tripId]
  );
  return row ?? null;
}

export async function getAllTrips() {
  const database = await getDb();
  const rows = await database.getAllAsync<Trip>(
    `SELECT
      id, city, startDate, endDate, createdAt
     FROM trips
     ORDER BY startDate ASC`
  );
  return rows;
}

export async function getUpcomingTrips(nowIso: string) {
  const database = await getDb();
  const rows = await database.getAllAsync<Trip>(
    `SELECT
      id, city, startDate, endDate, createdAt
     FROM trips
     WHERE startDate >= ?
     ORDER BY startDate ASC`,
    [nowIso]
  );
  return rows;
}

export async function getDistinctCities() {
  const database = await getDb();
  const rows = await database.getAllAsync<{ city: string }>(
    `SELECT DISTINCT city FROM (
      SELECT city FROM people WHERE city IS NOT NULL AND TRIM(city) != ''
      UNION ALL
      SELECT city FROM trips WHERE city IS NOT NULL AND TRIM(city) != ''
    )
    ORDER BY city ASC`
  );
  return rows.map((row) => row.city);
}

export async function getPeopleForCity(city: string) {
  const database = await getDb();
  const query = `%${city.toLowerCase()}%`;
  const rows = await database.getAllAsync<Person>(
    `SELECT
      id, name, city, tags, importance, createdAt, updatedAt, lastInteractionAt, placeLabel, lat, lng, phoneContactId, phoneNumber, preferredChannel, age
     FROM people
     WHERE LOWER(city) LIKE ?
        OR LOWER(tags) LIKE ?
        OR LOWER(placeLabel) LIKE ?
     ORDER BY updatedAt DESC`,
    [query, query, query]
  );
  return rows;
}

export async function getLatestNoteForPerson(personId: string) {
  const database = await getDb();
  const row = await database.getFirstAsync<Note>(
    `SELECT
      id, personId, content, createdAt, needsFollowUp, followUpAt, lat, lng, placeLabel
     FROM notes
     WHERE personId = ?
     ORDER BY createdAt DESC
     LIMIT 1`,
    [personId]
  );
  return row ?? null;
}

export async function getFollowUpsDue(nowIso: string) {
  const database = await getDb();
  const rows = await database.getAllAsync<{
    id: string;
    personId: string;
    content: string;
    createdAt: string;
    needsFollowUp: number;
    followUpAt: string | null;
    lat: number | null;
    lng: number | null;
    placeLabel: string | null;
    personName: string;
    personCity: string | null;
    personPlaceLabel: string | null;
  }>(
    `SELECT
      n.id,
      n.personId,
      n.content,
      n.createdAt,
      n.needsFollowUp,
      n.followUpAt,
      n.lat,
      n.lng,
      n.placeLabel,
      p.name as personName,
      p.city as personCity,
      p.placeLabel as personPlaceLabel
     FROM notes n
     JOIN people p ON p.id = n.personId
     WHERE n.needsFollowUp = 1
       AND n.followUpAt IS NOT NULL
       AND n.followUpAt <= ?
     ORDER BY n.followUpAt ASC`,
    [nowIso]
  );

  return rows.map((row) => ({
    note: {
      id: row.id,
      personId: row.personId,
      content: row.content,
      createdAt: row.createdAt,
      needsFollowUp: row.needsFollowUp,
      followUpAt: row.followUpAt,
      lat: row.lat,
      lng: row.lng,
      placeLabel: row.placeLabel,
    },
    person: {
      id: row.personId,
      name: row.personName,
      city: row.personCity,
      placeLabel: row.personPlaceLabel,
    },
  }));
}

export async function markFollowUpDone(noteId: string) {
  const database = await getDb();
  await database.runAsync(
    `UPDATE notes
     SET needsFollowUp = 0,
         followUpAt = NULL
     WHERE id = ?`,
    [noteId]
  );
}

export async function setTripReachoutStatus(
  tripId: string,
  personId: string,
  status: "pending" | "done"
) {
  const database = await getDb();
  const now = new Date().toISOString();
  const reachoutId = `${tripId}-${personId}`;
  await database.runAsync(
    `INSERT OR REPLACE INTO trip_reachouts (
      id, tripId, personId, status, updatedAt
    ) VALUES (?, ?, ?, ?, ?)`,
    [reachoutId, tripId, personId, status, now]
  );
}

export async function getTripReachouts(tripId: string) {
  const database = await getDb();
  const rows = await database.getAllAsync<TripReachout>(
    `SELECT personId, status
     FROM trip_reachouts
     WHERE tripId = ?`,
    [tripId]
  );
  return rows;
}

export async function setSnooze(personId: string, untilDate: string) {
  const database = await getDb();
  await database.runAsync(
    `INSERT OR REPLACE INTO snoozes (personId, untilDate)
     VALUES (?, ?)`,
    [personId, untilDate]
  );
}

export async function getActiveSnoozes(nowIso: string) {
  const database = await getDb();
  const rows = await database.getAllAsync<Snooze>(
    `SELECT personId, untilDate
     FROM snoozes
     WHERE untilDate > ?`,
    [nowIso]
  );
  return rows;
}

export async function getLatestPersonLocation() {
  const database = await getDb();
  const row = await database.getFirstAsync<{ lat: number; lng: number }>(
    `SELECT lat, lng
     FROM people
     WHERE lat IS NOT NULL AND lng IS NOT NULL
     ORDER BY updatedAt DESC
     LIMIT 1`
  );
  return row ?? null;
}