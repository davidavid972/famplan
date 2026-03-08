import { useState, useEffect, useRef } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { Globe } from "lucide-react";
import type { Lang } from "../i18n";

const LANGUAGES: Array<{ code: Lang; labelKey: string }> = [
  { code: "he", labelKey: "lang_he" },
  { code: "en", labelKey: "lang_en" },
];

export default function LanguagePicker() {
  const { language, setLanguage, t, registerOpenLanguagePicker } = useLanguage();
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerOpenLanguagePicker(() => setOpen(true));
  }, [registerOpenLanguagePicker]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  const pick = (code: Lang) => {
    setLanguage(code);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lang-picker-btn"
        aria-label={t("lang_picker_title")}
      >
        <Globe style={{ width: 16, height: 16, flexShrink: 0 }} strokeWidth={2} />
        <span>{language === "he" ? "עב" : "EN"}</span>
      </button>

      {open && (
        <div
          ref={overlayRef}
          onClick={(e) => {
            if (e.target === overlayRef.current) setOpen(false);
          }}
          className="lang-picker-overlay"
        >
          <div className="lang-picker-modal" style={{ direction: "ltr", textAlign: "center" }}>
            <div className="lang-picker-title">{t("lang_picker_title")}</div>
            <div className="lang-picker-options">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => pick(l.code)}
                  className={`lang-picker-option ${language === l.code ? "lang-picker-option-active" : ""}`}
                >
                  {t(l.labelKey)}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setOpen(false)} className="lang-picker-close">
              {t("close")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
