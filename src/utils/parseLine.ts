export type ParseResult = {
  name: string | null;
  age?: number | null;
  city?: string | null;
  placeMetCandidate?: string | null;
  company?: string | null;
  occupation?: string | null;
  notes?: string | null;
  confidence: number;
};

const CITY_ALIASES: { aliases: string[]; city: string }[] = [
  { aliases: ["nyc", "new york", "manhattan", "new york city"], city: "New York City" },
  { aliases: ["la", "los angeles"], city: "Los Angeles" },
  { aliases: ["sf", "san francisco"], city: "San Francisco" },
  { aliases: ["dc", "washington", "washington dc", "washington, dc"], city: "Washington, DC" },
  { aliases: ["copenhagen", "kobenhavn"], city: "Copenhagen" },
  { aliases: ["london"], city: "London" },
  { aliases: ["paris"], city: "Paris" },
];

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "cool",
  "guy",
  "girl",
  "person",
  "someone",
  "named",
  "name",
  "is",
  "met",
  "at",
  "in",
  "on",
  "with",
  "from",
  "of",
  "he",
  "she",
  "they",
  "i",
  "we",
  "was",
  "were",
  "just",
  "really",
  "very",
  "today",
]);

const VENUE_KEYWORDS = ["lounge", "cafe", "bar", "hotel", "restaurant", "house"];

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function normalizeSpacing(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractCity(input: string) {
  const lower = input.toLowerCase();
  for (const entry of CITY_ALIASES) {
    if (entry.aliases.some((alias) => lower.includes(alias))) {
      return entry.city;
    }
  }
  return null;
}

function extractVenue(input: string) {
  const venueMatch = input.match(
    /\b([A-Za-z0-9'& ]{0,30}(?:lounge|cafe|bar|hotel|restaurant|house)[A-Za-z0-9'& ]{0,20})\b/i
  );
  if (!venueMatch) {
    return null;
  }
  return normalizeSpacing(venueMatch[1]);
}

function extractAfterPattern(input: string, pattern: RegExp) {
  const match = input.match(pattern);
  if (!match || !match[1]) {
    return null;
  }
  const trimmed = normalizeSpacing(match[1]);
  const tokens = trimmed.split(/\s+/).slice(0, 3);
  const filtered = tokens.filter((token) => !STOPWORDS.has(token.toLowerCase()));
  if (filtered.length === 0) {
    return null;
  }
  return toTitleCase(filtered.join(" "));
}

function extractTitleCaseBigram(input: string) {
  const match = input.match(/\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/);
  if (!match) {
    return null;
  }
  return `${match[1]} ${match[2]}`;
}

function extractOccupation(input: string) {
  const companyMatch = input.match(
    /(?:owns a company called|company called)\s+([A-Za-z0-9'&\- ]{2,40})/i
  );
  if (companyMatch?.[1]) {
    const company = normalizeSpacing(companyMatch[1]);
    return { company, occupation: `Owner @ ${company}` };
  }

  const ownsMatch = input.match(/\bowns\s+([A-Za-z0-9'&\-]{2,20})/i);
  if (ownsMatch?.[1]) {
    const company = ownsMatch[1];
    return { company, occupation: `Owner @ ${company}` };
  }

  return { company: null, occupation: null };
}

function extractAge(input: string) {
  const match = input.match(/\b(\d{1,3})\b/);
  if (!match) {
    return null;
  }
  const value = Number.parseInt(match[1], 10);
  if (value >= 1 && value <= 120) {
    return value;
  }
  return null;
}

function removePhrase(source: string, phrase: string | null) {
  if (!phrase) {
    return source;
  }
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.replace(new RegExp(escaped, "gi"), " ");
}

function normalizeNotes(value: string) {
  const trimmed = normalizeSpacing(value.replace(/\s+and\s+/gi, " ").replace(/\s+\./g, "."));
  if (!trimmed) {
    return null;
  }
  const lower = trimmed.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function parseLineToPersonPayload(input: string): ParseResult {
  const raw = normalizeSpacing(input);
  if (!raw) {
    return { name: null, confidence: 0 };
  }

  const commaTokens = raw.split(",").map((token) => token.trim()).filter(Boolean);
  let age = extractAge(raw);

  let name: string | null = null;
  let confidence = 0.2;

  const namedMatch = extractAfterPattern(raw, /(?:named|name is)\s+([A-Za-z][A-Za-z'\- ]{2,40})/i);
  if (namedMatch) {
    name = namedMatch;
    confidence = 0.9;
  }

  if (!name) {
    const metMatch = extractAfterPattern(raw, /\bmet\s+([A-Za-z][A-Za-z'\- ]{2,40})/i);
    if (metMatch) {
      name = metMatch;
      confidence = 0.75;
    }
  }

  if (!name) {
    const titleMatch = extractTitleCaseBigram(raw);
    if (titleMatch) {
      name = titleMatch;
      confidence = 0.6;
    }
  }

  if (!name && commaTokens.length > 0) {
    const candidate = commaTokens[0];
    if (candidate.split(/\s+/).length <= 3 && candidate.length <= 26) {
      name = toTitleCase(candidate);
      confidence = 0.55;
    }
  }

  const city = extractCity(raw);
  const venue = extractVenue(raw);

  let placeMetCandidate: string | null = null;
  if (venue && city) {
    placeMetCandidate = venue.toLowerCase().includes(city.toLowerCase())
      ? venue
      : `${venue} ${city}`;
  } else if (venue) {
    placeMetCandidate = venue;
  } else if (city) {
    placeMetCandidate = city;
  }

  const { company, occupation } = extractOccupation(raw);

  let notes = raw;
  notes = removePhrase(notes, name);
  notes = removePhrase(notes, placeMetCandidate);
  notes = removePhrase(notes, company);
  notes = notes.replace(/\b(i was|i met|met|named|name is|owns a company called|company called|owns)\b/gi, " ");
  notes = normalizeNotes(notes);

  if (!notes || notes.length < 3) {
    notes = null;
  }

  return {
    name,
    age,
    city: city ?? null,
    placeMetCandidate: placeMetCandidate ?? null,
    company,
    occupation,
    notes,
    confidence,
  };
}