import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
// Lazy-load markdown to reduce initial bundle size
const loadMarkdown = () => import('react-markdown');
const Markdown = lazy(loadMarkdown);
import { categoryToEmoji, type CelticEvent } from "../data/festivals";
import { buildFestivalsForYear } from "../utils/utils";
import "./FestivalTable.css";
import { ModalPortal } from "./ModalPortal";
import { fetchTextCached } from "../utils/content-cache";

type Props = {
    year: number;
    includeFireFestivals: boolean;
    includeSolarFestivals: boolean;
};

export function FestivalTable({ year, includeFireFestivals, includeSolarFestivals }: Props) {
    const { t, i18n } = useTranslation();
    const [selectedFestival, setSelectedFestival] = useState<CelticEvent | null>(null);
    const [longDescription, setLongDescription] = useState<string | null>(null);

    // Prefetch markdown component on mount to avoid first-open delay
    useEffect(() => { void loadMarkdown(); }, []);

    useEffect(() => {
        const controller = new AbortController();
        if (selectedFestival?.longDescriptionFile) {
            const lang = i18n.language || "en";
            const url = `/locales/${lang}/${selectedFestival.longDescriptionFile}`;
            fetchTextCached(url, controller.signal)
                .then(setLongDescription)
                .catch((err) => {
                    if ((err as any)?.name !== 'AbortError') setLongDescription(null);
                });
        } else {
            setLongDescription(null);
        }
        return () => controller.abort();
    }, [selectedFestival, i18n.language]);

    const festivalsToShow = useMemo(
        () => buildFestivalsForYear(year, includeFireFestivals, includeSolarFestivals),
        [year, includeFireFestivals, includeSolarFestivals]
    );

    const dateFmt = useMemo(() => new Intl.DateTimeFormat(i18n.language), [i18n.language]);

    function getRowClass(event: CelticEvent): string {
        return event.category?.[0] ? `${event.category[0]}-row` : "";
    }

    return (
        <>
            <div className="festival-table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>{""}</th>
                            <th>{t("table-columns.festival")}</th>
                            <th>{t("table-columns.date")}</th>
                            <th>{t("table-columns.description")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {festivalsToShow.map(event => (
                            <tr key={event.key}
                                className={getRowClass(event)}
                                tabIndex={0}
                                onClick={() => setSelectedFestival(event)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setSelectedFestival(event);
                                    }
                                }}
                            >
                                <td>{event.category.map(c => categoryToEmoji(c)).join("")}</td>
                                <td>
                                    <span style={{ whiteSpace: "pre-line" }}>{t(event.nameKey)}</span>
                                </td>
                                <td>{dateFmt.format(event.getDate(year))}</td>
                                <td>{t(event.shortDescriptionKey)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div >
            {selectedFestival && (
                <ModalPortal titleId="festival-title" onClose={() => setSelectedFestival(null)}>
                    <h2 id="festival-title">{t(selectedFestival?.nameKey)}</h2>
                    <div className="modal-description">
                        <Suspense fallback={<div>Loading…</div>}>
                            <Markdown>
                                {longDescription ?? t(selectedFestival?.longDescriptionKey)}
                            </Markdown>
                        </Suspense>
                    </div>
                </ModalPortal>
            )}
        </>

    );
}
