import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import packageJson from "../../package.json";
import i18n from "../i18n";
import { buildFestivalsForYear, formatClosestFestivalText } from "../utils/utils";
import "./ControlsPanel.css";
import { generateICS } from "./generate-ics";
import { ModalPortal } from "./ModalPortal";

type Props = {
    year: number;
    setYear: (year: number) => void;
    includeSolarFestivals: boolean;
    setIncludeSolarFestivals: (value: boolean) => void;
    showWheel: boolean;
    setShowWheel: (value: boolean) => void;
};

export function ControlsPanel({ year, setYear, includeSolarFestivals, setIncludeSolarFestivals, showWheel, setShowWheel }: Props) {
    const { t } = useTranslation();
    const [showInfo, setShowInfo] = useState(false);
    const infoBtnRef = useRef<HTMLButtonElement | null>(null);

    // Year bounds and helpers
    const MIN_YEAR = 1900;
    const MAX_YEAR = 2099;
    const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
    const decYear = () => setYear(clamp(year - 1, MIN_YEAR, MAX_YEAR));
    const incYear = () => setYear(clamp(year + 1, MIN_YEAR, MAX_YEAR));

    // Determine today's festival or next festival
    const events = useMemo(() => buildFestivalsForYear(year, true, includeSolarFestivals), [year, includeSolarFestivals]);
    const closestFestival = useMemo(() => formatClosestFestivalText(events, new Date(), t), [events, i18n.language]);

    return (
        <div className="controls-wrapper">
            <div className="controls-panel">
                <dl className="controls-dl" onSubmit={(e) => e.preventDefault()}>
                    <dt><label htmlFor="year-input">{t("controls.year")}:</label></dt>
                    <dd>
                        <div className="year-stepper" role="group" aria-label={t("controls.year")}>
                            <button type="button" className="year-btn" onClick={decYear}>
                                &lsaquo;
                            </button>

                            <input
                                id="year-input"
                                className="year-input"
                                type="number"
                                inputMode="numeric"
                                min={MIN_YEAR}
                                max={MAX_YEAR}
                                step={1}
                                value={Number.isFinite(year) ? year : ""}
                                onChange={(e) => {
                                    const v = e.target.value.trim();
                                    if (v === "") return; // allow empty while typing
                                    const n = Number(v);
                                    if (Number.isFinite(n)) setYear(clamp(n, MIN_YEAR, MAX_YEAR));
                                }}
                                onBlur={(e) => {
                                    const raw = Number(e.target.value);
                                    const n = Number.isFinite(raw) ? raw : new Date().getFullYear();
                                    setYear(clamp(n, MIN_YEAR, MAX_YEAR));
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
                                        e.preventDefault();
                                        incYear();
                                    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
                                        e.preventDefault();
                                        decYear();
                                    }
                                }}
                                aria-live="polite"
                            />

                            <button type="button" className="year-btn" onClick={incYear}>
                                &rsaquo;
                            </button>
                        </div>
                    </dd>

                    <dt>{t("controls.festivals")}:</dt>
                    <dd>
                        <div className="segmented segmented-multi" role="group" aria-label={t("controls.festivals")}>
                            {/* Fire: locked ON for now */}
                            <input type="checkbox" id="ft-fire" checked readOnly />
                            <label htmlFor="ft-fire" data-locked="true">🔥 {t("controls.fire")}</label>

                            {/* Solar: toggle */}
                            <input type="checkbox" id="ft-solar" checked={includeSolarFestivals} onChange={e => setIncludeSolarFestivals(e.target.checked)} />
                            <label htmlFor="ft-solar">☀️ {t("controls.solar")}</label>

                            {/* Other: disabled for now */}
                            <input type="checkbox" id="ft-other" disabled aria-describedby="ft-other-tip" />
                            <label htmlFor="ft-other" aria-disabled="true" className="is-disabled" title={"soon"}>{t("controls.other")}</label>
                            <span id="ft-other-tip" className="sr-only">{"soon"}</span>
                        </div>
                    </dd>

                    <dt>{t("controls.view")}:</dt>
                    <dd>
                        <div className="segmented" role="radiogroup" aria-label={t("controls.view")}>
                            <input type="radio" id="viz-wheel" name="viz" value="wheel" checked={showWheel} onChange={() => setShowWheel(true)} />
                            <label htmlFor="viz-wheel">{t("controls.wheel")}</label>
                            <input type="radio" id="viz-table" name="viz" value="table" checked={!showWheel} onChange={() => setShowWheel(false)} />
                            <label htmlFor="viz-table">{t("controls.table")}</label>
                        </div>
                    </dd>

                    <dt aria-hidden="true"></dt>
                    <dd><button type="button" onClick={() => generateICS(year, t, includeSolarFestivals)}>{t("controls.generate-ics")}</button></dd>
                </dl>
            </div>
            <div className="controls-header">
                <div><h1>{t("title")}</h1></div>
                <div><h2>{closestFestival}</h2></div>
            </div>
            <button type="button" ref={infoBtnRef} className="info-btn" aria-label={t("controls.info")}
                onClick={() => setShowInfo(true)} title={t("controls.info")}>?</button>
            {showInfo && (
                <ModalPortal titleId="about-title" onClose={() => setShowInfo(false)} openerRef={infoBtnRef}
                    initialFocusSelector="button"  // focus first button inside modal
                >
                    <h2 className="about-title" id="about-title">{t("about.title")}</h2>
                    <h3>{`v${packageJson.version}`}</h3>
                    <div className="controls-panel" style={{ textAlign: "center" }}>
                        <dl className="controls-dl" onSubmit={(e) => e.preventDefault()}>
                            <dt></dt>
                            <dd>
                                <div className="segmented segmented-lang" role="radiogroup" aria-label={t("controls.language")}>
                                    <input type="radio" id="lang-en" name="lang" value="en" checked={i18n.language === "en"} onChange={() => i18n.changeLanguage("en")} />
                                    <label htmlFor="lang-en">en</label>

                                    <input type="radio" id="lang-ga" name="lang" value="ga" checked={i18n.language === "ga"} onChange={() => i18n.changeLanguage("ga")} />
                                    <label htmlFor="lang-ga">ga</label>

                                    <input type="radio" id="lang-ru" name="lang" value="ru" checked={i18n.language === "ru"} onChange={() => i18n.changeLanguage("ru")} />
                                    <label htmlFor="lang-ru">ru</label>
                                </div>
                            </dd>
                        </dl>
                    </div>
                    <p className="modal-description">{t("about.description")}</p>
                    {/* Credits */}
                    <section className="modal-section">
                        <ul className="modal-list">
                            {(t("about.credits-list", { returnObjects: true }) as string[])
                                .map((note, idx) => <li key={idx}>{note}</li>)}
                        </ul>
                    </section>

                    {/* Release notes */}
                    <section className="modal-section">
                        <h3>{t("about.release-notes")}</h3>
                        <ul className="modal-list">
                            {(t("about.changelog", { returnObjects: true }) as { version: string, description: string }[]).map(
                                (entry, idx) => (
                                    <li key={idx}>
                                        <strong>{entry.version}</strong> — {entry.description}
                                    </li>
                                )
                            )}
                        </ul>
                        <span>{new Date().getFullYear() === 2025 ? "2025" : `2025 - ${year}`} • Dmitry Petruk</span>
                        <br /><a href="https://teagmhail.github.io/">website</a>
                    </section>
                </ModalPortal>
            )}
        </div>
    );
}