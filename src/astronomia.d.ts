declare module 'astronomia' {
    export namespace solstice {
        function march(year: number): number; // Returns Julian date
        function june(year: number): number; // Returns Julian date
        function september(year: number): number; // Returns Julian date
        function december(year: number): number; // Returns Julian date
    };
    export namespace julian {
        export function CalendarToJD(y: number, m: number, d: number, isJulian: boolean): number;
        export function CalendarGregorianToJD(y: number, m: number, d: number): number;
        export function CalendarJulianToJD(y: number, m: number, d: number): number;
        export function LeapYearJulian(y: number): boolean;
        export function LeapYearGregorian(y: number): boolean;
        export function JDToCalendar(jd: number, isJulian: boolean): { year: number; month: number; day: number };
        export function JDToCalendarGregorian(jd: number): { year: number; month: number; day: number };
        export function JDToCalendarJulian(jd: number): { year: number; month: number; day: number };
        export function isJDCalendarGregorian(jd: number): boolean;
        export function isCalendarGregorian(year: number, month?: number, day?: number): boolean;
        export function JDToDate(jd: number): Date;
        export function DateToJD(date: Date): number;
        export function JDEToDate(jde: number): Date;
        export function DateToJDE(date: Date): number;
        export function MJDToJD(mjd: number): number;
        export function JDToMJD(jd: number): number;
        export function DayOfWeek(jd: number): number;
        export function DayOfYearGregorian(y: number, m: number, d: number): number;
        export function DayOfYearJulian(y: number, m: number, d: number): number;
        export function DayOfYear(y: number, m: number, d: number, leap: boolean): number;
        export function DayOfYearToCalendar(n: number, leap: boolean): { month: number; day: number };
        export function DayOfYearToCalendarGregorian(year: number, n: number): CalendarGregorian;
        export function DayOfYearToCalendarJulian(year: number, n: number): CalendarJulian;
    }
    export namespace moonphase {
        export const meanLunarMonth: number;
        export function meanNew(year: number): number;
        export function meanFirst(year: number): number;
        export function meanFull(year: number): number;
        export function meanLast(year: number): number;
        export function newMoon(year: number): number;
        export function first(year: number): number;
        export function full(year: number): number;
        export function last(year: number): number;
    }
}