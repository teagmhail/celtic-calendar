export type MonthInfo = {
    index: number;         // 0-11
    key: string;
    nameKey: string;
    days: number;
    startDate: Date;
    middleDate: Date;
    endDate: Date;
    // Optional if needed for the wheel:
    startAngle?: number;
    endAngle?: number;
};

export function buildMonthInfo(year: number): MonthInfo[] {
    const months: MonthInfo[] = [];
    let dayOfYear = 0;
    for (let i = 0; i < 12; i++) {
        const startDate = new Date(Date.UTC(year, i, 1));
        const days = new Date(Date.UTC(year, i + 1, 0)).getDate();
        const middleDate = new Date(Date.UTC(year, i, Math.ceil(days / 2)));
        const endDate = new Date(Date.UTC(year, i, days));
        const key = startDate.toLocaleString("en-GB", { timeZone: "UTC", month: 'long' }).toLowerCase();
        const nameKey = `months.${key}`;
        months.push({
            index: i,
            key,
            nameKey,
            days,
            startDate,
            middleDate,
            endDate
        });

        dayOfYear += days;
    }
    return months;
}
