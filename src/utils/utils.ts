import { fireEvents, solarEvents, type CelticEvent } from "../data/festivals";

const DAY_MS = 86_400_000;
const startOfDayMs = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function getTodaysFestival(events: CelticEvent[], today: Date): CelticEvent | null {
    const todayMs = startOfDayMs(today);
    return (
        events
            .filter(e => e.key !== "today")
            .find(e => startOfDayMs(e.getDate(today.getFullYear())) === todayMs)
        || null
    );
}

export function getNextFestival(events: CelticEvent[], today: Date): { event: CelticEvent; daysRemaining: number } | null {
    const yr = today.getFullYear();
    const upcoming = events
        .map(e => ({ e, d: e.getDate(yr) }))
        .filter(({ d }) => d > today)
        .sort((a, b) => a.d.getTime() - b.d.getTime());
    if (upcoming.length === 0) { return null; }
    const next = upcoming[0];
    const daysRemaining = Math.ceil((next.d.getTime() - today.getTime()) / DAY_MS);
    return { event: next.e, daysRemaining };
}

export function buildFestivalsForYear(year: number, includeFireFestivals: boolean, includeSolarFestivals: boolean): CelticEvent[] {
    return [
        ...(includeFireFestivals ? fireEvents : []),
        ...(includeSolarFestivals ? solarEvents : []),
    ].sort((a, b) => a.getDate(year).getTime() - b.getDate(year).getTime());
}

export function formatClosestFestivalText(
    events: CelticEvent[], today: Date,
    t: (key: string, params?: Record<string, unknown>) => string
): string {
    const todays = getTodaysFestival(events, today);
    if (todays) { return t("todays-festival", { festivalName: t(todays.nameKey) }); }
    const next = getNextFestival(events, today);
    if (!next) return "";
    return t("next-festival", { festivalName: t(next.event.nameKey), daysRemaining: next.daysRemaining });
}
