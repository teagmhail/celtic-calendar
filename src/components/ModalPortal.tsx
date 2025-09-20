import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export function ModalPortal({
    titleId,
    onClose,
    children,
    openerRef,                 // who opened the modal
    initialFocusSelector,      // CSS selector to focus on open
}: {
    titleId: string;
    onClose: () => void;
    children: ReactNode;
    openerRef?: RefObject<HTMLElement | null>;
    initialFocusSelector?: string;
}) {
    const [el] = useState(() => document.createElement("div"));
    const contentRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        document.body.appendChild(el);

        // lock scroll
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        // ESC closes
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);

        // try to focus something inside the modal after mount
        // priority: initialFocusSelector > first focusable > content itself
        const focusInside = () => {
            const root = contentRef.current;
            if (!root) return;
            if (initialFocusSelector) {
                const target = root.querySelector<HTMLElement>(initialFocusSelector);
                if (target) { target.focus(); return; }
            }
            const focusable = root.querySelector<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            (focusable ?? root).focus();
        };
        // next microtask to ensure elements exist
        queueMicrotask(focusInside);

        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
            document.body.removeChild(el);

            // return focus to the opener
            if (openerRef?.current) {
                openerRef.current.focus();
            }
        };
    }, [el, onClose, openerRef, initialFocusSelector]);

    return createPortal(
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onClose}>
            <div
                ref={contentRef}
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
                tabIndex={-1}                      // fallback focus target
            >
                {children}
            </div>
        </div>,
        el
    );
}
