import { generateIcsCalendar, type IcsCalendar } from "ts-ics";
import { fireEvents, solarEvents } from "../data/festivals";

const DAY_MS = 86_400_000;

/**
 * Generates an ICS calendar file for the given year with Celtic events.
 * @param {number} year - The year for which to generate the calendar.
 */
export function generateICS(
    year: number,
    t: (key: string) => string,
    includeSolarFestivals: boolean = false
) {
    const toIcsEvent = (key: string, startDate: Date) => ({
        start: { date: startDate },
        end: { date: new Date(startDate.getTime() + DAY_MS) },
        summary: t(`festivals.${key}.name`),
        uid: `${key}-${year}@celtic-calendar`,
        stamp: { date: new Date() },
    });

    const events = (
        includeSolarFestivals
            ? [...fireEvents, ...solarEvents]
            : fireEvents
    ).map(({ key, getDate }) => toIcsEvent(key, getDate(year)));

    const calendar: IcsCalendar = {
        events,
        name: `Celtic Calendar ${year}`,
        version: "2.0",
        prodId: "",
    };

    calendar.events?.sort((a, b) => {
        return a.start.date.getTime() - b.start.date.getTime();
    });

    const icsCalendarString = generateIcsCalendar(calendar);
    if (!icsCalendarString) {
        console.error("Failed to generate ICS calendar string.");
        return;
    }
    // Create a Blob and download the ICS file
    const blob = new Blob([icsCalendarString], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `celtic_calendar_${year}.ics`;
    document.body.appendChild(a);
    a.click();

    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
