import { toast, type ExternalToast } from 'sonner';

// DESIGN_SYSTEM "Toast": 4s by default, 8s when there is an action, errors never auto-dismiss.
const base = (opts?: ExternalToast): ExternalToast => ({
  duration: opts?.action ? 8000 : 4000,
  ...opts
});

export const notify = {
  success: (message: string, opts?: ExternalToast) => toast.success(message, base(opts)),
  info: (message: string, opts?: ExternalToast) => toast.info(message, base(opts)),
  warning: (message: string, opts?: ExternalToast) => toast.warning(message, base(opts)),
  error: (message: string, opts?: ExternalToast) =>
    toast.error(message, { ...opts, duration: Number.POSITIVE_INFINITY, closeButton: true })
};
