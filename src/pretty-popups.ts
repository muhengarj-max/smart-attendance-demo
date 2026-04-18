type PopupTone = "info" | "success" | "warning" | "danger";

declare global {
  interface Window {
    showPrettyMessage?: (message: string, tone?: PopupTone) => void;
  }
}

const STYLE_ID = "pretty-popups-styles";
const TOAST_HOST_ID = "pretty-popups-toast-host";
const MODAL_HOST_ID = "pretty-popups-modal-host";

let installed = false;
let lastActionTarget: HTMLElement | null = null;
let lastActionAt = 0;
let allowNextConfirm = false;

const toneLabel: Record<PopupTone, string> = {
  info: "Info",
  success: "Done",
  warning: "Check",
  danger: "Confirm",
};

const toneIcon: Record<PopupTone, string> = {
  info: "i",
  success: "✓",
  warning: "!",
  danger: "!",
};

const getTone = (message: string): PopupTone => {
  const text = message.toLowerCase();
  if (text.includes("delete") || text.includes("remove") || text.includes("fail") || text.includes("error")) {
    return "danger";
  }
  if (text.includes("success") || text.includes("saved") || text.includes("created")) {
    return "success";
  }
  if (text.includes("wait") || text.includes("warning") || text.includes("required")) {
    return "warning";
  }
  return "info";
};

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .pretty-toast-host {
      position: fixed;
      top: 18px;
      right: 18px;
      z-index: 2147483647;
      display: grid;
      gap: 10px;
      width: min(390px, calc(100vw - 28px));
      pointer-events: none;
    }

    .pretty-toast {
      display: grid;
      grid-template-columns: 38px 1fr;
      gap: 12px;
      align-items: center;
      padding: 13px 14px;
      color: #f8fafc;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.96));
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 8px;
      box-shadow: 0 18px 40px rgba(2, 6, 23, 0.32);
      pointer-events: auto;
      animation: pretty-pop-in 180ms ease-out both;
    }

    .pretty-toast[data-tone="success"] {
      background: linear-gradient(135deg, rgba(6, 78, 59, 0.97), rgba(20, 184, 166, 0.9));
    }

    .pretty-toast[data-tone="warning"] {
      background: linear-gradient(135deg, rgba(113, 63, 18, 0.97), rgba(234, 179, 8, 0.88));
    }

    .pretty-toast[data-tone="danger"] {
      background: linear-gradient(135deg, rgba(127, 29, 29, 0.97), rgba(225, 29, 72, 0.88));
    }

    .pretty-icon {
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.16);
      color: #ffffff;
      font-weight: 900;
      border: 1px solid rgba(255, 255, 255, 0.18);
    }

    .pretty-title {
      font-size: 13px;
      font-weight: 800;
      line-height: 1.1;
      margin-bottom: 3px;
    }

    .pretty-message {
      font-size: 14px;
      line-height: 1.35;
      color: rgba(255, 255, 255, 0.88);
      overflow-wrap: anywhere;
    }

    .pretty-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      display: grid;
      place-items: center;
      padding: 20px;
      background: rgba(2, 6, 23, 0.64);
      backdrop-filter: blur(10px);
      animation: pretty-fade-in 160ms ease-out both;
    }

    .pretty-modal {
      width: min(430px, 100%);
      padding: 20px;
      color: #f8fafc;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(51, 65, 85, 0.98));
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 8px;
      box-shadow: 0 28px 70px rgba(2, 6, 23, 0.44);
      animation: pretty-pop-in 180ms ease-out both;
    }

    .pretty-modal-head {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 14px;
    }

    .pretty-modal h2 {
      margin: 0;
      font-size: 19px;
      line-height: 1.2;
      font-weight: 900;
      color: #ffffff;
    }

    .pretty-modal p {
      margin: 0 0 18px;
      color: rgba(255, 255, 255, 0.82);
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .pretty-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .pretty-actions button {
      min-height: 44px;
      border: 0;
      border-radius: 8px;
      font-weight: 900;
      cursor: pointer;
    }

    .pretty-cancel {
      color: #e2e8f0;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.14) !important;
    }

    .pretty-confirm {
      color: #ffffff;
      background: linear-gradient(135deg, #ef4444, #f97316);
      box-shadow: 0 12px 28px rgba(239, 68, 68, 0.28);
    }

    @keyframes pretty-pop-in {
      from { opacity: 0; transform: translateY(8px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    @keyframes pretty-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @media (max-width: 520px) {
      .pretty-toast-host {
        top: 12px;
        right: 14px;
        left: 14px;
        width: auto;
      }

      .pretty-actions {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);
};

const getToastHost = () => {
  let host = document.getElementById(TOAST_HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = TOAST_HOST_ID;
    host.className = "pretty-toast-host";
    document.body.appendChild(host);
  }
  return host;
};

const showToast = (message: string, tone: PopupTone = getTone(message)) => {
  ensureStyles();
  const toast = document.createElement("div");
  toast.className = "pretty-toast";
  toast.dataset.tone = tone;
  toast.innerHTML = `
    <div class="pretty-icon">${toneIcon[tone]}</div>
    <div>
      <div class="pretty-title">${toneLabel[tone]}</div>
      <div class="pretty-message"></div>
    </div>
  `;
  toast.querySelector(".pretty-message")!.textContent = message;
  getToastHost().appendChild(toast);
  window.setTimeout(() => toast.remove(), 4200);
};

const showConfirmModal = (message: string, onConfirm: () => void) => {
  ensureStyles();
  document.getElementById(MODAL_HOST_ID)?.remove();

  const overlay = document.createElement("div");
  overlay.id = MODAL_HOST_ID;
  overlay.className = "pretty-overlay";
  overlay.innerHTML = `
    <div class="pretty-modal" role="dialog" aria-modal="true" aria-labelledby="pretty-confirm-title">
      <div class="pretty-modal-head">
        <div class="pretty-icon">!</div>
        <h2 id="pretty-confirm-title">Confirm action</h2>
      </div>
      <p></p>
      <div class="pretty-actions">
        <button type="button" class="pretty-cancel">Cancel</button>
        <button type="button" class="pretty-confirm">Yes, continue</button>
      </div>
    </div>
  `;
  overlay.querySelector("p")!.textContent = message;
  overlay.querySelector(".pretty-cancel")!.addEventListener("click", () => overlay.remove());
  overlay.querySelector(".pretty-confirm")!.addEventListener("click", () => {
    overlay.remove();
    onConfirm();
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
};

export const installPrettyPopups = () => {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const nativeAlert = window.alert.bind(window);
  const nativeConfirm = window.confirm.bind(window);

  window.showPrettyMessage = showToast;

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        lastActionTarget = target.closest("button, a, [role='button'], input[type='submit']") as HTMLElement | null;
        lastActionAt = Date.now();
      }
    },
    true,
  );

  window.alert = (message?: unknown) => {
    const text = String(message ?? "");
    if (!document.body) {
      nativeAlert(text);
      return;
    }
    showToast(text);
  };

  window.confirm = (message?: string) => {
    const text = String(message ?? "");
    if (allowNextConfirm) {
      allowNextConfirm = false;
      return true;
    }

    const target = lastActionTarget;
    const canReplayAction = target && Date.now() - lastActionAt < 1200 && document.body.contains(target);
    if (!canReplayAction) {
      return nativeConfirm(text);
    }

    showConfirmModal(text, () => {
      allowNextConfirm = true;
      target.click();
    });
    return false;
  };
};

installPrettyPopups();

