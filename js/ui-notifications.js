(function () {
    "use strict";

    const styles = document.createElement("style");
    styles.textContent = `
        .kx-notifications {
            position: fixed;
            z-index: 10000;
            top: 20px;
            right: 20px;
            display: flex;
            width: min(390px, calc(100vw - 32px));
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        }
        .kx-toast {
            display: grid;
            grid-template-columns: 38px 1fr 24px;
            align-items: center;
            gap: 12px;
            min-height: 72px;
            padding: 12px 14px;
            border: 1px solid rgba(23, 24, 43, .12);
            border-left: 4px solid #0a8f65;
            background: #fff;
            box-shadow: 0 14px 38px rgba(23, 24, 43, .16);
            color: #17182b;
            font-family: "Space Grotesk", sans-serif;
            pointer-events: auto;
            animation: kx-toast-in .22s ease-out;
        }
        .kx-toast.is-error { border-left-color: #c44747; }
        .kx-toast.is-info { border-left-color: #ef7d32; }
        .kx-toast-icon {
            display: grid;
            width: 38px;
            height: 38px;
            place-items: center;
            border-radius: 50%;
            background: rgba(10, 143, 101, .10);
            color: #0a8f65;
            font-size: 17px;
            font-weight: 700;
        }
        .kx-toast.is-error .kx-toast-icon { background: rgba(196, 71, 71, .10); color: #c44747; }
        .kx-toast.is-info .kx-toast-icon { background: rgba(239, 125, 50, .12); color: #ef7d32; }
        .kx-toast-copy strong { display: block; margin-bottom: 2px; font-size: 13px; }
        .kx-toast-copy span { display: block; color: #686873; font-size: 12px; line-height: 1.45; }
        .kx-toast-close {
            border: 0;
            background: transparent;
            color: #777780;
            cursor: pointer;
            font-size: 19px;
        }
        .kx-confirm-backdrop {
            position: fixed;
            z-index: 10001;
            inset: 0;
            display: grid;
            place-items: center;
            padding: 16px;
            background: rgba(23, 24, 43, .48);
            backdrop-filter: blur(4px);
        }
        .kx-confirm {
            width: min(430px, 100%);
            border: 1px solid rgba(23, 24, 43, .12);
            background: #f8f7f1;
            box-shadow: 0 24px 70px rgba(23, 24, 43, .28);
            color: #17182b;
            font-family: "Space Grotesk", sans-serif;
            animation: kx-modal-in .18s ease-out;
        }
        .kx-confirm-head { display: flex; align-items: center; gap: 10px; padding: 20px 22px 12px; }
        .kx-confirm-mark {
            display: grid;
            width: 34px;
            height: 34px;
            flex: 0 0 34px;
            place-items: center;
            border-radius: 50%;
            background: rgba(239, 125, 50, .14);
            color: #ef7d32;
            font-weight: 700;
        }
        .kx-confirm h2 { margin: 0; font-size: 18px; }
        .kx-confirm p { margin: 0; padding: 4px 22px 22px 66px; color: #686873; font-size: 13px; line-height: 1.55; }
        .kx-confirm-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 22px; border-top: 1px solid #e2e0d8; }
        .kx-confirm-actions button {
            min-height: 40px;
            padding: 0 16px;
            border: 1px solid #17182b;
            background: transparent;
            color: #17182b;
            font: 700 12px "DM Mono", monospace;
            cursor: pointer;
        }
        .kx-confirm-actions .is-primary { background: #17182b; color: #fff; }
        @keyframes kx-toast-in { from { opacity: 0; transform: translateX(18px); } }
        @keyframes kx-modal-in { from { opacity: 0; transform: translateY(8px) scale(.98); } }
        @media (max-width: 520px) {
            .kx-notifications { top: 12px; right: 16px; }
            .kx-confirm p { padding-left: 22px; }
        }
    `;
    document.head.appendChild(styles);

    let container = null;
    function getContainer() {
        if (!container) {
            container = document.createElement("div");
            container.className = "kx-notifications";
            container.setAttribute("aria-live", "polite");
            container.setAttribute("aria-atomic", "false");
            document.body.appendChild(container);
        }
        return container;
    }

    function toast(message, type) {
        const text = String(message || "").trim();
        if (!text) return;
        const kind = type || "info";
        const toastElement = document.createElement("div");
        toastElement.className = `kx-toast is-${kind}`;
        toastElement.setAttribute("role", kind === "error" ? "alert" : "status");
        const icon = kind === "error" ? "!" : kind === "success" ? "✓" : "i";
        const title = kind === "error" ? "Revisa este dato" : kind === "success" ? "Acción completada" : "Información";
        toastElement.innerHTML =
            `<span class="kx-toast-icon" aria-hidden="true">${icon}</span>` +
            `<div class="kx-toast-copy"><strong>${title}</strong><span></span></div>` +
            `<button type="button" class="kx-toast-close" aria-label="Cerrar">&times;</button>`;
        toastElement.querySelector(".kx-toast-copy span").textContent = text;
        const close = () => toastElement.remove();
        toastElement.querySelector(".kx-toast-close").addEventListener("click", close);
        getContainer().appendChild(toastElement);
        window.setTimeout(close, kind === "error" ? 6500 : 4200);
    }

    function inferType(message) {
        const text = String(message || "").toLowerCase();
        if (/error|no pudo|no se pudo|inválid|valido|selecciona|ingresa|primero|no hay|supera|tienes|disponible|requiere/.test(text)) {
            return "error";
        }
        return "success";
    }

    function confirmDialog(message) {
        return new Promise((resolve) => {
            const backdrop = document.createElement("div");
            backdrop.className = "kx-confirm-backdrop";
            backdrop.innerHTML =
                `<div class="kx-confirm" role="dialog" aria-modal="true" aria-labelledby="kx-confirm-title">` +
                `<div class="kx-confirm-head"><span class="kx-confirm-mark">?</span><h2 id="kx-confirm-title">Confirmar acción</h2></div>` +
                `<p></p><div class="kx-confirm-actions">` +
                `<button type="button" data-kx-confirm="cancel">Cancelar</button>` +
                `<button type="button" class="is-primary" data-kx-confirm="accept">Confirmar</button>` +
                `</div></div>`;
            backdrop.querySelector("p").textContent = String(message || "¿Deseas continuar?");
            document.body.appendChild(backdrop);
            const cancelButton = backdrop.querySelector('[data-kx-confirm="cancel"]');
            const acceptButton = backdrop.querySelector('[data-kx-confirm="accept"]');
            const finish = (accepted) => {
                backdrop.remove();
                resolve(accepted);
            };
            cancelButton.addEventListener("click", () => finish(false));
            acceptButton.addEventListener("click", () => finish(true));
            backdrop.addEventListener("click", (event) => {
                if (event.target === backdrop) finish(false);
            });
            const onKey = (event) => {
                if (event.key === "Escape") finish(false);
            };
            document.addEventListener("keydown", onKey, { once: true });
            cancelButton.focus();
        });
    }

    window.KreditmxNotifications = { toast, confirm: confirmDialog };
    window.alert = function (message) {
        toast(message, inferType(message));
    };
})();
