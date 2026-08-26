/** A company is the economic entity; listings are its tradable securities. */
export type EquityStatus = "public" | "private";
export type EquityRole =
  | "model-lab"
  | "cloud-inference"
  | "compute"
  | "data-center"
  | "services"
  | "enterprise-platform"
  | "logistics";
export type ListingType = "primary" | "secondary" | "adr" | "gdr";

export interface ExchangeSession {
  id: string;
  name: string;
  country: string;
  timezone: string;
  currency: string;
  /** Regular trading segments in local exchange time. A market can split its day. */
  sessions: Array<{ open: string; close: string }>;
  /** Source-supplied closures are kept with the snapshot; fixed holidays vary by venue. */
  calendarSource: string;
}

export interface EquityListing {
  ticker: string;
  exchangeId: string;
  listingType: ListingType;
  /** Deposit receipt ratio, when the quote is not one ordinary share. */
  ordinarySharesPerReceipt?: number;
}

export interface EquityEntity {
  id: string;
  name: string;
  status: EquityStatus;
  roles: EquityRole[];
  listings: EquityListing[];
  relatedLabs: string[];
  /** Human-readable reason for inclusion; this is not an investment rating. */
  exposureNote: string;
}

export const EXCHANGES: Record<string, ExchangeSession> = {
  nasdaq: { id: "nasdaq", name: "Nasdaq", country: "US", timezone: "America/New_York", currency: "USD", sessions: [{ open: "09:30", close: "16:00" }], calendarSource: "curated-exchange-schedule" },
  nyse: { id: "nyse", name: "NYSE", country: "US", timezone: "America/New_York", currency: "USD", sessions: [{ open: "09:30", close: "16:00" }], calendarSource: "curated-exchange-schedule" },
  lse: { id: "lse", name: "London Stock Exchange", country: "GB", timezone: "Europe/London", currency: "GBP", sessions: [{ open: "08:00", close: "16:30" }], calendarSource: "curated-exchange-schedule" },
  hkex: { id: "hkex", name: "Hong Kong Exchange", country: "HK", timezone: "Asia/Hong_Kong", currency: "HKD", sessions: [{ open: "09:30", close: "12:00" }, { open: "13:00", close: "16:00" }], calendarSource: "curated-exchange-schedule" },
  tyo: { id: "tyo", name: "Japan Exchange", country: "JP", timezone: "Asia/Tokyo", currency: "JPY", sessions: [{ open: "09:00", close: "11:30" }, { open: "12:30", close: "15:30" }], calendarSource: "curated-exchange-schedule" },
  nse: { id: "nse", name: "National Stock Exchange of India", country: "IN", timezone: "Asia/Kolkata", currency: "INR", sessions: [{ open: "09:15", close: "15:30" }], calendarSource: "curated-exchange-schedule" },
  bse: { id: "bse", name: "BSE India", country: "IN", timezone: "Asia/Kolkata", currency: "INR", sessions: [{ open: "09:15", close: "15:30" }], calendarSource: "curated-exchange-schedule" },
  sse: { id: "sse", name: "Shanghai Stock Exchange", country: "CN", timezone: "Asia/Shanghai", currency: "CNY", sessions: [{ open: "09:30", close: "11:30" }, { open: "13:00", close: "15:00" }], calendarSource: "curated-exchange-schedule" },
  twse: { id: "twse", name: "Taiwan Stock Exchange", country: "TW", timezone: "Asia/Taipei", currency: "TWD", sessions: [{ open: "09:00", close: "13:30" }], calendarSource: "curated-exchange-schedule" },
  sgx: { id: "sgx", name: "Singapore Exchange", country: "SG", timezone: "Asia/Singapore", currency: "SGD", sessions: [{ open: "09:00", close: "12:00" }, { open: "13:00", close: "17:00" }], calendarSource: "curated-exchange-schedule" },
  nasdaq_omx: { id: "nasdaq_omx", name: "Nasdaq Stockholm", country: "SE", timezone: "Europe/Stockholm", currency: "SEK", sessions: [{ open: "09:00", close: "17:30" }], calendarSource: "curated-exchange-schedule" },
  copenhagen: { id: "copenhagen", name: "Nasdaq Copenhagen", country: "DK", timezone: "Europe/Copenhagen", currency: "DKK", sessions: [{ open: "09:00", close: "17:00" }], calendarSource: "curated-exchange-schedule" },
};

/** Curated coverage universe. Inclusion is exposure context, never a recommendation. */
export const EQUITY_ENTITIES: EquityEntity[] = [
  { id: "openai", name: "OpenAI", status: "private", roles: ["model-lab"], listings: [], relatedLabs: ["openai"], exposureNote: "Private model lab; show public relationships separately from direct equity." },
  { id: "anthropic", name: "Anthropic", status: "private", roles: ["model-lab"], listings: [], relatedLabs: ["anthropic"], exposureNote: "Private model lab; cloud and strategic relationships are indirect exposure." },
  { id: "microsoft", name: "Microsoft", status: "public", roles: ["cloud-inference", "enterprise-platform"], listings: [{ ticker: "MSFT", exchangeId: "nasdaq", listingType: "primary" }], relatedLabs: ["openai"], exposureNote: "Cloud distribution and strategic model exposure across a diversified company." },
  { id: "alphabet", name: "Alphabet", status: "public", roles: ["model-lab", "cloud-inference"], listings: [{ ticker: "GOOGL", exchangeId: "nasdaq", listingType: "primary" }], relatedLabs: ["google"], exposureNote: "Model ownership and cloud distribution inside a diversified company." },
  { id: "amazon", name: "Amazon", status: "public", roles: ["cloud-inference", "enterprise-platform"], listings: [{ ticker: "AMZN", exchangeId: "nasdaq", listingType: "primary" }], relatedLabs: ["anthropic"], exposureNote: "Cloud distribution and strategic model exposure, not a pure-play lab." },
  { id: "nvidia", name: "NVIDIA", status: "public", roles: ["compute"], listings: [{ ticker: "NVDA", exchangeId: "nasdaq", listingType: "primary" }], relatedLabs: [], exposureNote: "Compute supply signal; stock performance is not an inference-cost measure." },
  { id: "tsmc", name: "Taiwan Semiconductor Manufacturing", status: "public", roles: ["compute"], listings: [{ ticker: "2330", exchangeId: "twse", listingType: "primary" }, { ticker: "TSM", exchangeId: "nyse", listingType: "adr", ordinarySharesPerReceipt: 5 }], relatedLabs: [], exposureNote: "Semiconductor manufacturing capacity, with local share and ADR listings." },
  { id: "oracle", name: "Oracle", status: "public", roles: ["cloud-inference", "data-center"], listings: [{ ticker: "ORCL", exchangeId: "nyse", listingType: "primary" }], relatedLabs: [], exposureNote: "Cloud and data-center capacity signal inside a diversified company." },
  { id: "coreweave", name: "CoreWeave", status: "public", roles: ["cloud-inference", "data-center"], listings: [{ ticker: "CRWV", exchangeId: "nasdaq", listingType: "primary" }], relatedLabs: [], exposureNote: "Specialized GPU-cloud and infrastructure exposure." },
  { id: "equinix", name: "Equinix", status: "public", roles: ["data-center"], listings: [{ ticker: "EQIX", exchangeId: "nasdaq", listingType: "primary" }], relatedLabs: [], exposureNote: "Colocation and interconnection exposure; AI is one part of demand." },
  { id: "accenture", name: "Accenture", status: "public", roles: ["services"], listings: [{ ticker: "ACN", exchangeId: "nyse", listingType: "primary" }], relatedLabs: [], exposureNote: "Enterprise AI deployment and managed-services demand signal." },
  { id: "tcs", name: "Tata Consultancy Services", status: "public", roles: ["services"], listings: [{ ticker: "TCS", exchangeId: "nse", listingType: "primary" }], relatedLabs: [], exposureNote: "India-listed enterprise implementation and services signal." },
  { id: "maersk", name: "A.P. Moller - Maersk", status: "public", roles: ["logistics"], listings: [{ ticker: "MAERSK-B", exchangeId: "copenhagen", listingType: "primary" }], relatedLabs: [], exposureNote: "Tracked only as an infrastructure logistics proxy, not direct AI exposure." },
];

export function getExchange(exchangeId: string): ExchangeSession | null {
  return EXCHANGES[exchangeId] ?? null;
}

function minutes(value: string): number {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}

function localParts(date: Date, timezone: string): { weekday: number; minutes: number; date: string } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(value.weekday);
  return { weekday, minutes: Number(value.hour) * 60 + Number(value.minute), date: `${value.year}-${value.month}-${value.day}` };
}

export type SessionState = "pre-open" | "open" | "lunch" | "post-close" | "weekend";

/** Session state uses exchange-local wall time; it does not assume one global close. */
export function exchangeSession(exchangeId: string, at: Date = new Date(), closedDates: string[] = []): { exchange: ExchangeSession; state: SessionState; localDate: string; localTime: string } | null {
  const exchange = getExchange(exchangeId);
  if (!exchange) return null;
  const parts = localParts(at, exchange.timezone);
  const local = new Intl.DateTimeFormat("en-GB", { timeZone: exchange.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
  if (parts.weekday === 0 || parts.weekday === 6) return { exchange, state: "weekend", localDate: parts.date, localTime: local };
  if (closedDates.includes(parts.date)) return { exchange, state: "post-close", localDate: parts.date, localTime: local };
  if (parts.minutes < minutes(exchange.sessions[0].open)) return { exchange, state: "pre-open", localDate: parts.date, localTime: local };
  for (let i = 0; i < exchange.sessions.length; i += 1) {
    const session = exchange.sessions[i];
    const open = minutes(session.open);
    const close = minutes(session.close);
    if (parts.minutes >= open && parts.minutes < close) return { exchange, state: "open", localDate: parts.date, localTime: local };
    if (i < exchange.sessions.length - 1 && parts.minutes >= close && parts.minutes < minutes(exchange.sessions[i + 1].open)) return { exchange, state: "lunch", localDate: parts.date, localTime: local };
  }
  return { exchange, state: "post-close", localDate: parts.date, localTime: local };
}

export function entityById(id: string): EquityEntity | null {
  return EQUITY_ENTITIES.find((entity) => entity.id === id) ?? null;
}

export function listingCount(): number {
  return EQUITY_ENTITIES.reduce((count, entity) => count + entity.listings.length, 0);
}

export function primaryListing(entity: EquityEntity): EquityListing | null {
  return entity.listings.find((listing) => listing.listingType === "primary") ?? entity.listings[0] ?? null;
}
