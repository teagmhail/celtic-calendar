import { julian, moonphase } from "astronomia";
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { eventCategory, festivalNames, fireEvents, moonPhaseCategory, moonPhaseToEmoji, solarEvents, type CelticEvent, type MoonPhaseCategory } from "../data/festivals";
import { fetchTextCached } from "../utils/content-cache";
import { buildFestivalsForYear, formatClosestFestivalText } from "../utils/utils";
import "./FestivalWheel.css";
import { ModalPortal } from "./ModalPortal";
import * as dg from "./date-geometry";
import { buildMonthInfo, type MonthInfo } from "./wheel-months";
// Lazy-load markdown to reduce initial bundle size
const loadMarkdown = () => import("react-markdown");
const Markdown = lazy(loadMarkdown);

type Props = {
    year: number;
    includeFireFestivals: boolean;
    includeSolarFestivals: boolean;
    size?: number;
    radius?: number;
};
type WheelFestival = CelticEvent & { date: Date; angle: number; radius: number; clickable: boolean; };
type WheelMonth = MonthInfo & { startAngle: number; labelAngle: number };

const seasonSchemeNames = { celtic: "celtic", solar: "solar", meteo: "meteo" } as const;
type SeasonScheme = typeof seasonSchemeNames[keyof typeof seasonSchemeNames];
const yearStartOptions = { samhain: "samhain", imbolc: "imbolc", jan1: "jan-1" } as const;
type YearStart = typeof yearStartOptions[keyof typeof yearStartOptions];
const moonViewOptions = { none: "none", simple: "simple", emoji: "emoji" } as const;
type MoonView = typeof moonViewOptions[keyof typeof moonViewOptions];
// Season colors (with alpha for translucency)
const winterColor = "rgba(66,135,245,.12)";
const springColor = "rgba(76,175,80,.12)";
const summerColor = "rgba(255,193,7,.12)";
const autumnColor = "rgba(255,87,34,.12)";

// moon phases
const LUNATIONS_PER_YEAR = 12.3685;
const LUNAR_PHASE_DEFS: {
    key: MoonPhaseCategory; className: string; labelKey: string; offset: number; compute: (decimalYear: number) => number;
}[] = [
        { key: moonPhaseCategory.new, className: "new-moon", labelKey: "festival-wheel.lunar-phases.new", offset: 0, compute: moonphase.newMoon },
        { key: moonPhaseCategory.firstQuarter, className: "first-quarter", labelKey: "festival-wheel.lunar-phases.first-quarter", offset: 0.25, compute: moonphase.first },
        { key: moonPhaseCategory.full, className: "full-moon", labelKey: "festival-wheel.lunar-phases.full", offset: 0.5, compute: moonphase.full },
        { key: moonPhaseCategory.lastQuarter, className: "last-quarter", labelKey: "festival-wheel.lunar-phases.last-quarter", offset: 0.75, compute: moonphase.last },
    ];
type LunarPhase = { id: string; key: MoonPhaseCategory; className: string; labelKey: string; date: Date; angle: number; };

/** Build a donut slice path from angle a0 to a1 (degrees, 0..360). Handles wrap. */
function annularSectorPath(rInner: number, rOuter: number, a0: number, a1: number) {
    // normalize span 0..360
    const span = (a1 - a0 + 360) % 360;
    const large = span > 180 ? 1 : 0;
    const pO0 = dg.polarToCartesian(rOuter, a0);
    const pO1 = dg.polarToCartesian(rOuter, a1);
    const pI1 = dg.polarToCartesian(rInner, a1);
    const pI0 = dg.polarToCartesian(rInner, a0);
    return [
        `M ${pO0.x} ${pO0.y}`,
        `A ${rOuter} ${rOuter} 0 ${large} 1 ${pO1.x} ${pO1.y}`, // outer arc clockwise
        `L ${pI1.x} ${pI1.y}`,
        `A ${rInner} ${rInner} 0 ${large} 0 ${pI0.x} ${pI0.y}`, // inner arc back (counter-clockwise)
        `Z`
    ].join(' ');
}

function circlePath(cx: number, cy: number, r: number, startAngle = 0) {
    const start = dg.polarToCartesian(r, startAngle, cx, cy);
    const opposite = dg.polarToCartesian(r, startAngle + 180, cx, cy);
    return [
        `M ${start.x} ${start.y}`,
        `A ${r} ${r} 0 1 1 ${opposite.x} ${opposite.y}`,
        `A ${r} ${r} 0 1 1 ${start.x} ${start.y}`,
    ].join(' ');
}
function MonthRingDefs({ cx, cy, r1, r2, id1, id2 }: { cx: number; cy: number; r1: number; r2: number; id1: string; id2: string; }) {
    return (
        <defs>
            {/* Outer baseline for line 1 */}
            <path id={id1} d={circlePath(cx, cy, r1)} />
            {/* Inner baseline for line 2 (slightly closer to center) */}
            <path id={id2} d={circlePath(cx, cy, r2)} />
        </defs>
    );
}

/* Festival label paths (two concentric circles, one for each line of text) */
function FestivalLabelDefs({ rOuter, rInner, idOuter, idInner, startAngle }: { rOuter: number; rInner: number; idOuter: string; idInner: string; startAngle: number; }) {
    return (
        <defs>
            <path id={idOuter} d={circlePath(0, 0, rOuter, startAngle)} />
            <path id={idInner} d={circlePath(0, 0, rInner, startAngle)} />
        </defs>
    );
}

export function FestivalWheel({ year, includeFireFestivals, includeSolarFestivals, size = 500, radius = 200 }: Props) {
    //#region state and constants
    const { t, i18n } = useTranslation();
    const dateFmtFull = useMemo(() => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full' }), [i18n.language]);
    const [selectedFestival, setSelectedFestival] = useState<WheelFestival | null>(null);
    const [hoveredFestival, setHoveredFestival] = useState<WheelFestival | null>(null);
    const [longDescription, setLongDescription] = useState<string | null>(null);

    const center = size / 2;
    const totalDays = dg.isLeapYear(year) ? 366 : 365;

    const [seasonScheme, setSeasonScheme] = useState<SeasonScheme>(seasonSchemeNames.celtic); //default to Celtic
    type SeasonArc = { from: number; to: number; name: string; color: string; };
    const [yearStart, setYearStart] = useState<YearStart>(yearStartOptions.samhain); //default to Samhain
    const [moonView, setMoonView] = useState<MoonView>(moonViewOptions.none); //default to none

    const ring1Id = `month-ring-1`; const ring2Id = `month-ring-2`;
    const monthRadiusL1 = radius - 30; const monthRadiusL2 = radius - 42;

    const festivalLabelOuterId = 'festival-label-outer';
    const festivalLabelInnerId = 'festival-label-inner';
    const festivalLabelOuterAltId = 'festival-label-outer-alt';
    const festivalLabelInnerAltId = 'festival-label-inner-alt';
    const festivalLabelOuterRadius = radius + 57;
    const festivalLabelInnerRadius = radius + 45;

    const lunarPhaseRadius = radius + 30;


    function celticToWheelFestival(event: CelticEvent, radius: number, clickable: boolean): WheelFestival {
        const date = event.getDate(year);
        return { ...event, date, angle: dg.dateToAngle(date, totalDays, startAngle), radius, clickable };
    }

    function monthToWheel(month: MonthInfo): WheelMonth {
        return {
            ...month,
            startAngle: dg.dateToAngle(month.startDate, totalDays, startAngle),
            labelAngle: dg.dateToAngle(month.middleDate, totalDays, startAngle)
        };
    }

    //#endregion

    // Prefetch markdown component on mount to avoid first-open delay
    useEffect(() => { void loadMarkdown(); }, []);

    // Calculate the start of the year angle
    const startAngle = useMemo(() => {
        const getFireDate = (key: string) => fireEvents.find(e => e.key === key)!.getDate(year);
        const refDate =
            yearStart === yearStartOptions.samhain ? getFireDate(festivalNames.samhain) :
                yearStart === yearStartOptions.imbolc ? getFireDate(festivalNames.imbolc) :
                    new Date(Date.UTC(year, 0, 1));
        return dg.dateToAngle(refDate, totalDays, 0);
    }, [year, totalDays, yearStart]);

    const baseEvents = useMemo(
        () => buildFestivalsForYear(year, includeFireFestivals, includeSolarFestivals),
        [year, includeFireFestivals, includeSolarFestivals]
    );
    // The same text ControlsPanel shows for today/next festival to reuse for the Wheel "today" marker
    const closestFestivalText = useMemo(() => {
        return formatClosestFestivalText(baseEvents, new Date(), t);
    }, [baseEvents, i18n.language]);
    const wheelFestivals: WheelFestival[] = useMemo(() => {
        const list = baseEvents.map(e => celticToWheelFestival(e, 10, true));
        return list.sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [baseEvents, totalDays, startAngle, closestFestivalText]);
    const todayOnly = useMemo(() => {
        return celticToWheelFestival(({
            key: "today",
            nameKey: "festival-wheel.today",
            category: [eventCategory.today],
            shortDescriptionKey: closestFestivalText,
            longDescriptionKey: "",
            longDescriptionFile: "",
            location: "",
            getDate: () => new Date()
        } as CelticEvent), 6, false)
    }, [year, totalDays, startAngle, closestFestivalText]);
    const showToday = useMemo(() => year === new Date().getUTCFullYear(), [year]);

    const wheelMonths: WheelMonth[] = useMemo(
        () => buildMonthInfo(year).map(monthToWheel),
        [year, totalDays, startAngle]
    );

    const lunarPhases = useMemo(() => {
        const items: LunarPhase[] = [];
        // Prevent double-counting phases when our search window overlaps itself.
        const seen = new Set<string>();
        // how many lunations have elapsed since the 2000 epoch, just before this year begins
        const startK = Math.floor((year - 2000) * LUNATIONS_PER_YEAR) - 2;
        // how many lunations have elapsed since the 2000 epoch, just before this year ends
        const endK = Math.ceil(((year + 1) - 2000) * LUNATIONS_PER_YEAR) + 2;

        for (let baseK = startK; baseK <= endK; baseK++) {
            // Within each lunation, evaluate each specific phase (new, quarter, full, etc.).
            for (const def of LUNAR_PHASE_DEFS) {
                // Combines lunation index with the phase’s fractional offset (0, 0.25, 0.5, 0.75).
                const k = baseK + def.offset;
                // Converts that index back into the decimal year value the Meeus formula expects.
                const decimalYear = 2000 + k / LUNATIONS_PER_YEAR;
                // Asks astronomia for the jde of this phase.
                const jde = def.compute(decimalYear);
                const date = julian.JDEToDate(jde);
                // Ignores phases that do not fall in the selected calendar year.
                if (date.getUTCFullYear() !== year) continue;
                // Serializes the instant so we can build a dedupe key.
                const iso = date.toISOString();
                // Key combines phase type and timestamp to catch accidental duplicates.
                const dedupeKey = `${def.key}-${iso}`;
                // Skip anything we have already recorded while scanning the window.
                if (seen.has(dedupeKey)) continue;
                // Remembers that we have already added this occurrence.
                seen.add(dedupeKey);
                items.push({
                    id: dedupeKey,
                    key: def.key,
                    className: def.className,
                    labelKey: def.labelKey,
                    date,
                    angle: dg.dateToAngle(date, totalDays, startAngle),
                });

            }
        }

        items.sort((a, b) => a.date.getTime() - b.date.getTime());
        return items;
    }, [year, totalDays, startAngle]);

    useEffect(() => { setSelectedFestival(null); setHoveredFestival(null); }, [year]);
    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;
        if (selectedFestival?.longDescriptionFile) {
            const lang = i18n.language || "en";
            const url = `/locales/${lang}/${selectedFestival.longDescriptionFile}`;
            fetchTextCached(url, signal)
                .then(text => { if (!signal.aborted) setLongDescription(text); })
                .catch((err) => { if (!signal.aborted && (err as any)?.name !== 'AbortError') setLongDescription(null); });
        } else {
            setLongDescription(null);
        }
        return () => controller.abort();
    }, [selectedFestival, i18n.language]);
    // Prefetch on mount already warms the chunk; no extra hover prefetch needed
    useEffect(() => {
        if (!hoveredFestival) return;
        const updated = wheelFestivals.find(f => f.key === hoveredFestival.key);
        if (updated && updated !== hoveredFestival) setHoveredFestival(updated);
    }, [wheelFestivals]);

    //#region festivalmarkers
    const handleSelect = useCallback((f: WheelFestival) => setSelectedFestival(f), []);
    const handleHover = useCallback((f: WheelFestival | null) => setHoveredFestival(f), []);
    const noopSelect = useCallback((_f: WheelFestival) => { }, []);
    const at = (r: number, angle: number) => dg.polarToCartesian(r, angle);
    const renderFestivalMarker = useCallback((festival: WheelFestival) => {
        const dot = at(radius, festival.angle);
        const angle = dg.normalizeAngle(festival.angle);
        const useAltPath = angle >= 330 || angle <= 30;
        const pathStartAngle = useAltPath ? 180 : 0;
        const offsetPct = dg.normalizeAngle(festival.angle - pathStartAngle) / 360 * 100;
        const ids = useAltPath
            ? { outer: festivalLabelOuterAltId, inner: festivalLabelInnerAltId }
            : { outer: festivalLabelOuterId, inner: festivalLabelInnerId };

        return (
            <FestivalMarker
                key={festival.key}
                festival={festival}
                dot={dot}
                offsetPct={offsetPct}
                labelIds={ids}
                onClick={festival.clickable ? handleSelect : noopSelect}
                onHover={handleHover}
                t={t}
            />
        );
    }, [radius, handleSelect, handleHover, t]);

    const FestivalMarker = React.memo(({ festival, dot, offsetPct, labelIds, onClick, onHover, t }: {
        festival: WheelFestival;
        dot: { x: number; y: number };
        offsetPct: number;
        labelIds: { outer: string; inner: string; };
        onClick: (festival: WheelFestival) => void;
        onHover: (festival: WheelFestival) => void;
        t: (key: string) => string;
    }) => {
        const lines = t(festival.nameKey).split("\n");
        const hasSecondLine = lines.length > 1 && lines[1].trim().length > 0;
        return (
            <g>
                <circle cx={dot.x} cy={dot.y} className={`event-marker ${festival.category[0]}`} tabIndex={festival.clickable ? 0 : -1}
                    onClick={() => onClick(festival)}
                    onMouseEnter={() => onHover(festival)}
                    onFocus={() => onHover(festival)}
                    //onMouseLeave={() => setHoveredFestival(null)} // maybe remove it or add some lag
                    onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onClick(festival);
                        }
                    }}>
                    {/*<title>{`${t(festival.shortDescriptionKey)}\n`}
                        {`${festival.date.toLocaleDateString(i18n.language, { dateStyle: 'full' })}`}
                    </title>*/}
                </circle>
                <text className="festival-label" textAnchor="middle" dominantBaseline="middle">
                    <textPath href={`#${labelIds.outer}`} startOffset={`${offsetPct}%`}>
                        {festival.key === "today" ? "" : lines[0]}
                    </textPath>
                    {hasSecondLine && (
                        <textPath href={`#${labelIds.inner}`} startOffset={`${offsetPct}%`}>
                            {lines[1]}
                        </textPath>
                    )}
                </text>
            </g>
        );
    });
    //#endregion

    //#region lunar phases
    const renderLunarPhase = useCallback((phase: LunarPhase) => {
        const dot = at(lunarPhaseRadius, phase.angle);
        const tooltip = `${t(phase.labelKey)} - ${dateFmtFull.format(phase.date)}`;
        const r = 6;
        const isQuarter = phase.key === moonPhaseCategory.firstQuarter || phase.key === moonPhaseCategory.lastQuarter;
        const clipId = `moonClip-${phase.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
        return (
            <g>
                <title>{tooltip}</title>
                {moonView === moonViewOptions.emoji && (
                    <text x={dot.x} y={dot.y} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 12, cursor: 'default' }}>
                        {moonPhaseToEmoji(phase.key)}
                    </text>
                )}
                {moonView === moonViewOptions.simple && (
                    isQuarter ? (
                        <g>
                            <defs>
                                <clipPath id={clipId}>
                                    <circle cx={dot.x} cy={dot.y} r={r} />
                                </clipPath>
                            </defs>
                            {phase.key === moonPhaseCategory.firstQuarter ? (
                                <>
                                    <rect x={dot.x - r} y={dot.y - r} width={r} height={2 * r} className="half-moon-dark" clipPath={`url(#${clipId})`} />
                                    <rect x={dot.x} y={dot.y - r} width={r} height={2 * r} className="half-moon-light" clipPath={`url(#${clipId})`} />
                                </>
                            ) : (
                                <>
                                    <rect x={dot.x - r} y={dot.y - r} width={r} height={2 * r} className="half-moon-light" clipPath={`url(#${clipId})`} />
                                    <rect x={dot.x} y={dot.y - r} width={r} height={2 * r} className="half-moon-dark" clipPath={`url(#${clipId})`} />
                                </>
                            )}
                            <circle cx={dot.x} cy={dot.y} r={r} fill="none" />
                        </g>
                    ) : (
                        <circle
                            key={phase.id}
                            cx={dot.x}
                            cy={dot.y}
                            r={r}
                            className={`lunar-phase-marker ${phase.className}`}
                        />
                    )
                )}
            </g>
        );
    }, [lunarPhaseRadius, t, dateFmtFull, moonView]);
    const moonNewYearTick = useMemo(() => {
        const jan1 = new Date(Date.UTC(year, 0, 1));
        const angle = dg.dateToAngle(jan1, totalDays, startAngle);
        return {
            start: dg.polarToCartesian(lunarPhaseRadius - 7, angle),
            end: dg.polarToCartesian(lunarPhaseRadius + 7, angle),
        };
    }, [year, totalDays, startAngle, lunarPhaseRadius]);
    const renderMoonNewYearTick = useCallback(() => {
        if (moonView === moonViewOptions.none) { return; }
        return <line x1={moonNewYearTick.start.x} y1={moonNewYearTick.start.y}
            x2={moonNewYearTick.end.x} y2={moonNewYearTick.end.y} className="tick"
        />;
    }, [moonNewYearTick, moonView]);
    //#endregion

    //#region month markers
    const renderMonthMarker = useCallback((month: WheelMonth) => {
        const lineStart = at(radius - 15, month.startAngle);
        const lineEnd = at(radius - 45, month.startAngle);
        return (
            <MonthMarker
                key={month.key}
                month={month}
                lineStart={lineStart}
                lineEnd={lineEnd}
                t={t}
            />
        );
    }, [radius, t]);

    const MonthMarker = React.memo(({ month, lineStart, lineEnd, t }: {
        month: WheelMonth;
        lineStart: { x: number; y: number };
        lineEnd: { x: number; y: number };
        t: (key: string) => string;
    }) => {
        const name = t(month.nameKey).trim();
        const [line1, ...rest] = name.split(/\s+/);
        const line2 = rest.length ? rest.join(" ") : "";
        const offsetPct = (month.labelAngle / 360) * 100;
        return (
            <g>
                <line x1={lineStart.x} y1={lineStart.y} x2={lineEnd.x} y2={lineEnd.y} className="tick" />
                <text fontSize="12" textAnchor="middle" fill="#333">
                    <textPath href={`#${ring1Id}`} startOffset={`${offsetPct}%`}>{line1}</textPath>
                    {line2 && (
                        <textPath href={`#${ring2Id}`} startOffset={`${offsetPct}%`}>{line2}</textPath>
                    )}
                </text>
            </g >
        );
    });
    //#endregion

    //#region seasons
    // get angle in degrees for date 'd' using your existing conversion
    const angleOf = (d: Date) => dg.dateToAngle(d, totalDays, startAngle);

    // Build [start,end,label,color] for the 4 seasons
    function getSeasonArcs(scheme: SeasonScheme): SeasonArc[] {
        let seasons: number[] = [];
        if (scheme === seasonSchemeNames.solar) {
            // solstice/equinox
            seasons = [festivalNames.winter_solstice, festivalNames.spring_equinox, festivalNames.summer_solstice, festivalNames.autumn_equinox].map(key =>
                angleOf(solarEvents.find(e => e.key === key)!.getDate(year)));
        } else if (scheme === seasonSchemeNames.meteo) {
            // Dec 1 → Mar 1 → Jun 1 → Sep 1 → (Dec 1 next year)
            seasons = [Date.UTC(year - 1, 11, 1), Date.UTC(year, 2, 1), Date.UTC(year, 5, 1), Date.UTC(year, 8, 1)].map(date => angleOf(new Date(date)));
        } else {
            // Celtic: seasons begin at fire festivals (Samhain, Imbolc, Bealtaine, Lughnasa)
            seasons = [festivalNames.samhain, festivalNames.imbolc, festivalNames.beltane, festivalNames.lughnasadh].map(key =>
                angleOf(fireEvents.find(e => e.key === key)!.getDate(year)));
        }
        return [
            { from: seasons[0], to: seasons[1], name: "Winter", color: winterColor },
            { from: seasons[1], to: seasons[2], name: "Spring", color: springColor },
            { from: seasons[2], to: seasons[3], name: "Summer", color: summerColor },
            { from: seasons[3], to: seasons[0], name: "Autumn", color: autumnColor },
        ];
    }
    const seasonArcs = useMemo(() => getSeasonArcs(seasonScheme), [seasonScheme, year, totalDays, startAngle]);

    function renderSeasonArc(seasonArc: SeasonArc) {
        const bandOuter = radius - 14;
        const bandInner = radius - 45;
        return (
            <path
                key={seasonArc.name}
                d={annularSectorPath(bandInner, bandOuter, seasonArc.from, seasonArc.to)}
                fill={seasonArc.color}
            />
        );
    }
    //#endregion

    return (
        <>{/* Wheel controls floating panel (doesn't move the wheel) */}
            <aside className="wheel-controls" aria-label={t("festival-wheel.controls.name")}>
                <div className="wheel-controls-title">{t("festival-wheel.controls.name")}</div>
                <div className="wheel-controls-section">
                    <div id="seasons-label" className="floating-panel-label">{t("festival-wheel.controls.seasons.name")}:</div>
                    <div className="segmented  segmented-season" role="radiogroup" aria-labelledby="seasons-label">
                        <input type="radio" id="ss-celtic" name="ss" checked={seasonScheme === seasonSchemeNames.celtic} onChange={() => setSeasonScheme(seasonSchemeNames.celtic)} />
                        <label htmlFor="ss-celtic">{t("festival-wheel.controls.seasons.celtic")}</label>
                        <input type="radio" id="ss-astro" name="ss" checked={seasonScheme === seasonSchemeNames.solar} onChange={() => setSeasonScheme(seasonSchemeNames.solar)} />
                        <label htmlFor="ss-astro">{t("festival-wheel.controls.seasons.astronomical")}</label>
                        <input type="radio" id="ss-meteo" name="ss" checked={seasonScheme === seasonSchemeNames.meteo} onChange={() => setSeasonScheme(seasonSchemeNames.meteo)} />
                        <label htmlFor="ss-meteo">{t("festival-wheel.controls.seasons.meteorological")}</label>
                    </div>
                </div>
                <div className="wheel-controls-section">
                    <div id="year-start-label" className="floating-panel-label">{t("festival-wheel.controls.year-start.name")}:</div>
                    <div className="segmented  segmented-year" role="radiogroup" aria-labelledby="year-start-label">
                        <input type="radio" id="sy-samhain" name="sy" checked={yearStart === yearStartOptions.samhain} onChange={() => setYearStart(yearStartOptions.samhain)} />
                        <label htmlFor="sy-samhain">{t("festival-wheel.controls.year-start.samhain")}</label>
                        <input type="radio" id="sy-imbolc" name="sy" checked={yearStart === yearStartOptions.imbolc} onChange={() => setYearStart(yearStartOptions.imbolc)} />
                        <label htmlFor="sy-imbolc">{t("festival-wheel.controls.year-start.imbolc")}</label>
                        <input type="radio" id="sy-jan" name="sy" checked={yearStart === yearStartOptions.jan1} onChange={() => setYearStart(yearStartOptions.jan1)} />
                        <label htmlFor="sy-jan">{t("festival-wheel.controls.year-start.jan-1")}</label>
                    </div>
                </div>
                <div className="wheel-controls-section">
                    <div id="lunar-phases-label" className="floating-panel-label">{t("festival-wheel.controls.lunar-phases.name")}:</div>
                    <div className="segmented segmented-moon" role="radiogroup" aria-labelledby="lunar-phases-label">
                        <input type="radio" id="lp-none" name="lp" checked={moonView === moonViewOptions.none} onChange={() => setMoonView(moonViewOptions.none)} />
                        <label htmlFor="lp-none">{t("festival-wheel.controls.lunar-phases.none")}</label>
                        <input type="radio" id="lp-simple" name="lp" checked={moonView === moonViewOptions.simple} onChange={() => setMoonView(moonViewOptions.simple)} />
                        <label htmlFor="lp-simple">{t("festival-wheel.controls.lunar-phases.simple")}</label>
                        <input type="radio" id="lp-emoji" name="lp" checked={moonView === moonViewOptions.emoji} onChange={() => setMoonView(moonViewOptions.emoji)} />
                        <label htmlFor="lp-emoji">{t("festival-wheel.controls.lunar-phases.emoji")}</label>
                    </div>
                </div>
            </aside >

            <div className="wheel-stage">
                <div className="wheel-canvas">
                    <svg width={size} height={size} style={{ overflow: "visible" }} role="img" aria-label={`Festival wheel for year ${year}`}>
                        <g transform={`translate(${center}, ${center})`}>
                            {/* Background */}
                            <circle cx={0} cy={0} r={radius + 20} fill="#fdf6e3" stroke="#d6cbb3" strokeWidth="3" />
                            {/* Outer wheel */}
                            <circle cx={0} cy={0} r={radius} stroke="#444" strokeWidth="2" fill="none" />
                            {/* Season arcs */}
                            {seasonArcs.map(renderSeasonArc)}
                            {/* Festival Dots and Labels */}
                            <FestivalLabelDefs rOuter={festivalLabelOuterRadius} rInner={festivalLabelInnerRadius} idOuter={festivalLabelOuterId} idInner={festivalLabelInnerId} startAngle={0} />
                            <FestivalLabelDefs rOuter={festivalLabelOuterRadius} rInner={festivalLabelInnerRadius} idOuter={festivalLabelOuterAltId} idInner={festivalLabelInnerAltId} startAngle={180} />
                            {wheelFestivals.map(renderFestivalMarker)}
                            {showToday && renderFestivalMarker(todayOnly)}
                            {/* Months */}
                            <MonthRingDefs cx={0} cy={0} r1={monthRadiusL1} r2={monthRadiusL2} id1={ring1Id} id2={ring2Id} />
                            {wheelMonths.map(renderMonthMarker)}
                            {/* Center sun */}
                            <circle cx={0} cy={0} r={15} fill="#FFD700" strokeWidth="1" />
                            {/* Lunar phases */}
                            {lunarPhases.map(renderLunarPhase)}
                            {renderMoonNewYearTick()}
                        </g>
                    </svg>
                </div>
            </div>

            {/* Modal for displaying festival details */}
            {
                selectedFestival && (
                    <ModalPortal titleId="festival-title" onClose={() => setSelectedFestival(null)}>
                        <h2>{t(selectedFestival.nameKey)}</h2>
                        <div>{`~ ${dateFmtFull.format(selectedFestival.date)} ~`}</div>
                        <div className="modal-description">
                            <Suspense fallback={<div>Loading…</div>}>
                                <Markdown>
                                    {longDescription ?? t(selectedFestival.longDescriptionKey)}
                                </Markdown>
                            </Suspense>
                        </div>
                    </ModalPortal>
                )
            }

            {/* Floating panel for displaying festival short details */}
            <aside className="description-panel" aria-label={t("festival-wheel.controls.name")}>
                <div className="description-panel-title">{hoveredFestival ? t(hoveredFestival.nameKey) : '~'}</div>
                <div className="floating-panel-title">{hoveredFestival ? `~ ${dateFmtFull.format(hoveredFestival.date)} ~` : 'Hover over a festival'}</div>
                <div className="floating-panel-empty" style={{ textAlign: 'justify' }}>{hoveredFestival ? t(hoveredFestival.shortDescriptionKey) : ''}</div>
            </aside >
        </>
    );
};