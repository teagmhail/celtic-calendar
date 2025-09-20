import i18n from "i18next";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

// initial language based on user preference and browser settings
const supported = ["en", "ga", "ru"] as const;
type Supported = typeof supported[number];

function detectInitialLanguage(): Supported {
    try {
        const saved = (typeof window !== "undefined")
            ? (window.localStorage?.getItem("lang") || "").toLowerCase()
            : "";
        if (supported.includes(saved as Supported)) return saved as Supported;
    } catch { /* ignore */ }

    const nav = (typeof navigator !== "undefined") ? navigator : undefined;
    const lang = (nav?.languages?.[0] || nav?.language || "en").toLowerCase();
    if (lang.startsWith("ga")) return "ga";
    if (lang.startsWith("ru")) return "ru";
    return "en";
}

const initialLng = detectInitialLanguage();

i18n
    .use(initReactI18next)
    .use(HttpBackend)
    .init({
        lng: initialLng,
        fallbackLng: "en",
        debug: false,
        interpolation: {
            escapeValue: false,
        },
        ns: ["translation"],
        defaultNS: "translation",
        backend: {
            loadPath: `${import.meta.env.BASE_URL}locales/{{lng}}/{{ns}}.json`,
        },
        load: "languageOnly",
    });

// Persist language changes to localStorage (best-effort)
try {
    i18n.on("languageChanged", (lng) => {
        window.localStorage?.setItem("lang", lng);
    });
} catch { /* ignore */ }

export default i18n;
