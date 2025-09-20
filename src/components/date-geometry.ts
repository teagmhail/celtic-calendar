const MS_PER_DAY = 86_400_000;
const DEG2RAD = Math.PI / 180;

/** Returns the day of the year (1-366) for a given date. */
export function dayOfYear(date: Date): number {
    // Use UTC components so local time-of-day and DST don’t skew the count
    const y = date.getUTCFullYear();
    const t0 = Date.UTC(y, 0, 0); // 00:00 UTC, 31 Dec (prev yr)
    const d = Date.UTC(y, date.getUTCMonth(), date.getUTCDate());
    return Math.floor((d - t0) / MS_PER_DAY);
}

/** True if the Gregorian year is a leap year (366 days) */
export const isLeapYear = (year: number): boolean =>
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

/** Normalize angle to 0-360 */
export const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360;

/** Convert date to angle (0-360) */
export function dateToAngle(date: Date, totalDays: number, startAngle: number = 0): number {
    const day = dayOfYear(date); // 1-365/366
    return normalizeAngle((day - 1) * 360 / totalDays - startAngle);
}

/** Convert polar to cartesian coordinates (0° at top, clockwise) */
export const polarToCartesian = (r: number, angleDeg: number, cx: number = 0, cy: number = 0) => {
    const angleRad = (angleDeg - 90) * DEG2RAD;
    return {
        x: cx + r * Math.cos(angleRad),
        y: cy + r * Math.sin(angleRad),
    };
};