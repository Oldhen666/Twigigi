export const CA_PROVINCES: Record<string, string> = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon",
};

export const US_STATES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

export const PROVINCES: Record<string, Record<string, string>> = { US: US_STATES, CA: CA_PROVINCES };

export function normalizeCountry(value: string) {
  const key = value.trim().toLowerCase();
  if (key === "us" || key === "usa" || key === "united states" || key === "united states of america") return "US";
  if (key === "ca" || key === "canada") return "CA";
  return "";
}

export function provinceCode(value: string, country: string) {
  const raw = value.trim();
  if (!raw) return "";
  const tail = raw.includes("-") ? (raw.split("-").pop() ?? raw) : raw;
  const code = tail.toUpperCase();
  const named = raw.toLowerCase();
  const lists = country && PROVINCES[country] ? [[country, PROVINCES[country]] as const] : Object.entries(PROVINCES);
  for (const [, list] of lists) {
    if (list[code]) return code;
    const match = Object.entries(list).find(([, name]) => name.toLowerCase() === named);
    if (match) return match[0];
  }
  return "";
}

export function splitLocation(value: string) {
  const parts = value.split(",").map((item) => item.trim()).filter(Boolean);
  const city = parts[0] ?? "";
  let provinceRaw = "";
  let countryRaw = "";
  if (parts.length >= 3) {
    provinceRaw = parts.slice(1, -1).join(", ");
    countryRaw = parts[parts.length - 1] ?? "";
  } else if (parts.length === 2) {
    const second = parts[1] ?? "";
    if (provinceCode(second, "")) provinceRaw = second;
    else countryRaw = second;
  }
  let country = normalizeCountry(countryRaw);
  const province = provinceCode(provinceRaw, country);
  if (!country && province) {
    country = US_STATES[province] && !CA_PROVINCES[province] ? "US" : CA_PROVINCES[province] ? "CA" : "";
    if (country === "US" && CA_PROVINCES[province]) country = "";
  }
  if (province === "CA" && !country) country = "US";
  return { city, province: PROVINCES[country]?.[province] ? province : "", country };
}

export function joinLocation(city: string, province: string, country: string) {
  return [city, province, country].map((item) => item.trim()).filter(Boolean).join(", ");
}

export function placeProblem(value: string) {
  const { city, province, country } = splitLocation(value);
  if (!country) return "Choose a country.";
  if (!province) return "Choose a province.";
  if (city.length < 2) return "Enter a city or town.";
  return null;
}

type PlaceHit = { city?: string; locality?: string; countryCode?: string; principalSubdivision?: string; principalSubdivisionCode?: string };

function readPlace(data: PlaceHit) {
  const country = normalizeCountry(data.countryCode || "");
  const province = provinceCode(data.principalSubdivisionCode || "", country) || provinceCode(data.principalSubdivision || "", country);
  if (!country || !province) throw new Error("Only US and CA are available right now.");
  return { city: (data.city || data.locality || "").trim(), country, province };
}

export async function lookupIpPlace() {
  const response = await fetch("https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=en");
  if (!response.ok) throw new Error("Could not find this location.");
  return readPlace((await response.json()) as PlaceHit);
}

export async function lookupCurrentPlace() {
  if (typeof navigator === "undefined" || !navigator.geolocation) throw new Error("This browser cannot use your location.");
  let position: GeolocationPosition;
  try {
    position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
    });
  } catch (reason) {
    const denied = typeof reason === "object" && reason !== null && "code" in reason && (reason as { code: number }).code === 1;
    throw new Error(denied ? "Location permission was denied." : "Could not find this location.");
  }
  const params = new URLSearchParams({
    latitude: String(position.coords.latitude),
    longitude: String(position.coords.longitude),
    localityLanguage: "en",
  });
  const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`);
  if (!response.ok) throw new Error("Could not find this location.");
  return readPlace((await response.json()) as PlaceHit);
}
