export type ToastKind = "success" | "error" | "info" | "warning";

type ToastPayload = {
  kind?: ToastKind;
  title: string;
  message?: string;
  durationMs?: number;
};

type ToastHandler = (payload: Required<ToastPayload>) => void;

let handler: ToastHandler | null = null;

const normalize = (payload: ToastPayload): Required<ToastPayload> => ({
  kind: payload.kind ?? "info",
  title: payload.title,
  message: payload.message ?? "",
  durationMs: payload.durationMs ?? 2200,
});

export const toastService = {
  register(nextHandler: ToastHandler) {
    handler = nextHandler;
    return () => {
      if (handler === nextHandler) {
        handler = null;
      }
    };
  },

  show(payload: ToastPayload) {
    if (!handler) return;
    handler(normalize(payload));
  },

  success(title: string, message?: string) {
    this.show({ kind: "success", title, message });
  },

  error(title: string, message?: string) {
    this.show({ kind: "error", title, message });
  },

  info(title: string, message?: string) {
    this.show({ kind: "info", title, message });
  },

  warning(title: string, message?: string) {
    this.show({ kind: "warning", title, message });
  },
};
