import { julian, solstice } from "astronomia";

export const eventCategory = {
    none: null,
    fire: "fire",
    solar: "solar",
    christian: "christian",
    today: "today"
} as const;
export type EventCategory = typeof eventCategory[keyof typeof eventCategory];

// Type-safe emoji mapping for categories (excludes null)
export const categoryEmoji = {
    fire: "🔥",
    solar: "☀️",
    christian: "✝️",
    today: "📅",
} as const satisfies Record<Exclude<EventCategory, null>, string>;

export function categoryToEmoji(category: EventCategory | null | undefined): string {
    return category ? (categoryEmoji[category] ?? "") : "";
}

export const festivalNames = {
    imbolc: "imbolc",
    beltane: "beltane",
    lughnasadh: "lughnasadh",
    samhain: "samhain",
    spring_equinox: "spring-equinox",
    summer_solstice: "summer-solstice",
    autumn_equinox: "autumn-equinox",
    winter_solstice: "winter-solstice"
} as const;

export type CelticEvent = {
    key: string;
    category: EventCategory[];
    nameKey: string;
    shortDescriptionKey: string;
    longDescriptionKey: string;
    longDescriptionFile: string;
    location: string;
    getDate: (year: number) => Date;
};

export const defaultCelticEvent: CelticEvent = {
    key: "",
    category: [],
    nameKey: "",
    shortDescriptionKey: "",
    longDescriptionKey: "",
    longDescriptionFile: "",
    location: "",
    getDate: (year: number) => new Date(year, 0, 1),
};

// Small helpers for brevity and safety
const fixedUTC = (monthIndex0: number, day: number) => (year: number) => new Date(Date.UTC(year, monthIndex0, day));
const ensureLeadingCategory = (lead: Exclude<EventCategory, null>, cats: EventCategory[] = []) =>
    [lead, ...cats.filter(c => c !== lead)];

function createCelticEvent(
    event: Partial<CelticEvent> & Pick<CelticEvent, "key" | "getDate">
): CelticEvent {
    return {
        ...defaultCelticEvent,
        ...event,
        key: event.key,
        category: event.category ?? [],
        nameKey: `festivals.${event.key}.name`,
        shortDescriptionKey: `festivals.${event.key}.shortDescription`,
        longDescriptionKey: `festivals.${event.key}.longDescription`,
        location: "",
    };
}

export const fireEvents: CelticEvent[] = [
    createCelticEvent({
        key: festivalNames.imbolc,
        getDate: fixedUTC(1, 1), // Feb 1
        longDescriptionFile: "descriptions/imbolc.md"
    }),
    createCelticEvent({
        key: festivalNames.beltane,
        getDate: fixedUTC(4, 1), // May 1
    }),
    createCelticEvent({
        key: festivalNames.lughnasadh,
        getDate: fixedUTC(7, 1), // Aug 1
    }),
    createCelticEvent({
        key: festivalNames.samhain,
        getDate: fixedUTC(9, 31), // Oct 31
    })
].map(event => ({
    ...event,
    category: ensureLeadingCategory(eventCategory.fire, event.category)
}));

// Cache solar dates per year to avoid recomputation
const solarCache = new Map<number, {
    spring_equinox: Date;
    summer_solstice: Date;
    autumn_equinox: Date;
    winter_solstice: Date;
}>();

function getSolarDates(year: number) {
    const cached = solarCache.get(year);
    if (cached) return cached;
    const spring = julian.JDEToDate(solstice.march(year));
    const summer = julian.JDEToDate(solstice.june(year));
    const autumn = julian.JDEToDate(solstice.september(year));
    const winter = julian.JDEToDate(solstice.december(year));
    const entry = {
        spring_equinox: spring,
        summer_solstice: summer,
        autumn_equinox: autumn,
        winter_solstice: winter,
    } as const;
    solarCache.set(year, entry as any);
    return entry;
}

export const solarEvents: CelticEvent[] = [
    createCelticEvent({
        key: festivalNames.spring_equinox,
        getDate: (year) => getSolarDates(year).spring_equinox,
    }),
    createCelticEvent({
        key: festivalNames.summer_solstice,
        getDate: (year) => getSolarDates(year).summer_solstice,
    }),
    createCelticEvent({
        key: festivalNames.autumn_equinox,
        getDate: (year) => getSolarDates(year).autumn_equinox,
    }),
    createCelticEvent({
        key: festivalNames.winter_solstice,
        getDate: (year) => getSolarDates(year).winter_solstice,
    })
].map(event => ({
    ...event,
    category: ensureLeadingCategory(eventCategory.solar, event.category)
}));

// moon phases
export const moonPhaseCategory = {
    new: "new",
    firstQuarter: "firstQuarter",
    full: "full",
    lastQuarter: "lastQuarter"
} as const;
export type MoonPhaseCategory = typeof moonPhaseCategory[keyof typeof moonPhaseCategory];

export const moonEmoji = {
    new: "🌑",
    firstQuarter: "🌓",
    full: "🌕",
    lastQuarter: "🌗"
} as const;
export function moonPhaseToEmoji(category: MoonPhaseCategory | null | undefined): string {
    return category ? (moonEmoji[category] ?? "") : "";
}