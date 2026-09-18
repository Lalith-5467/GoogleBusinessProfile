import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  title?: string;
  duration?: number;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
  createdAt: number;
  isExiting?: boolean;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, options?: ToastOptions) => string;
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/**
 * Intelligently parse raw status/error messages into clean, SaaS-grade
 * title + message pairs while strictly preserving underlying data and context.
 */
export function parseToastContent(
  type: ToastType,
  rawMessage: string,
  customTitle?: string
): { title: string; message?: string } {
  if (customTitle) {
    return { title: customTitle, message: rawMessage };
  }

  const trimmed = (rawMessage || '').trim();

  // Pattern if message already contains newline
  if (trimmed.includes('\n')) {
    const [first, ...rest] = trimmed.split('\n');
    return {
      title: first.trim(),
      message: rest.join(' ').trim(),
    };
  }

  // Pattern: "Search completed successfully. Found X matching businesses for 'Y' in 'Z'."
  const searchMatch = trimmed.match(/^Search completed(?: successfully)?\.\s*(.+)$/i);
  if (searchMatch) {
    // Format single quotes to clean typographic quotes
    const formattedMsg = searchMatch[1].replace(/'([^']+)'/g, '"$1"');
    return {
      title: 'Search completed',
      message: formattedMsg,
    };
  }

  // Pattern: "Scrape completed successfully. X businesses collected."
  const scrapeMatch = trimmed.match(/^Scrape completed(?: successfully)?\.\s*(.+)$/i);
  if (scrapeMatch) {
    return {
      title: 'Scrape completed',
      message: scrapeMatch[1],
    };
  }

  // Pattern: "Bulk scrape complete: X succeeded, Y businesses extracted."
  const bulkMatch = trimmed.match(/^Bulk scrape complete:\s*(.+)$/i);
  if (bulkMatch) {
    return {
      title: 'Bulk scrape completed',
      message: bulkMatch[1],
    };
  }

  // Pattern: "Export complete. Exported X current search businesses to CSV."
  const exportMatch = trimmed.match(/^Export complete\.\s*(.+)$/i);
  if (exportMatch) {
    return {
      title: 'Export completed',
      message: exportMatch[1],
    };
  }

  // Download / export success
  if (/downloaded successfully|export.*downloaded/i.test(trimmed)) {
    return {
      title: 'Export completed',
      message: trimmed,
    };
  }

  // Pattern: "Business record 'X' saved successfully."
  if (/saved successfully/i.test(trimmed)) {
    return {
      title: 'Business saved',
      message: trimmed,
    };
  }

  // Pattern: "Business record 'X' was deleted."
  if (/was deleted/i.test(trimmed) || /record.*deleted/i.test(trimmed)) {
    return {
      title: 'Record deleted',
      message: trimmed,
    };
  }

  // Pattern: "Successfully synced X business locations..."
  if (/Successfully synced/i.test(trimmed)) {
    return {
      title: 'Sync completed',
      message: trimmed,
    };
  }

  // Validation / required input errors
  if (/is required|please enter/i.test(trimmed)) {
    return {
      title: 'Input required',
      message: trimmed,
    };
  }

  // Fallback defaults by toast type
  const defaultTitles: Record<ToastType, string> = {
    success: 'Success',
    error: 'Action failed',
    warning: 'Attention',
    info: 'Information',
  };

  return {
    title: defaultTitles[type] || 'Notification',
    message: trimmed || undefined,
  };
}

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4000, // 4.0 seconds
  info: 4000,    // 4.0 seconds
  warning: 4500, // 4.5 seconds
  error: 5000,   // 5.0 seconds
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const recentToastsRef = useRef<Map<string, number>>(new Map());

  // Dismiss toast with smooth exit animation
  const dismiss = useCallback((id: string) => {
    setToasts(prev =>
      prev.map(t => (t.id === id ? { ...t, isExiting: true } : t))
    );

    // Remove from state after animation completes (220ms)
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 220);
  }, []);

  const clearAll = useCallback(() => {
    setToasts(prev => prev.map(t => ({ ...t, isExiting: true })));
    setTimeout(() => {
      setToasts([]);
    }, 220);
  }, []);

  const showToast = useCallback(
    (type: ToastType, rawMessage: string, options?: ToastOptions): string => {
      const messageText = (rawMessage || '').trim();
      if (!messageText && !options?.title) return '';

      // Deduplication: prevent stacking identical messages fired rapidly (within 2500ms)
      const dedupeKey = `${type}:${options?.title || ''}:${messageText}`;
      const now = Date.now();
      const lastShown = recentToastsRef.current.get(dedupeKey);
      if (lastShown && now - lastShown < 2500) {
        return '';
      }
      recentToastsRef.current.set(dedupeKey, now);

      // Clean old entries from recent map
      for (const [key, timestamp] of recentToastsRef.current.entries()) {
        if (now - timestamp > 6000) {
          recentToastsRef.current.delete(key);
        }
      }

      const parsed = parseToastContent(type, messageText, options?.title);
      const duration = options?.duration ?? DEFAULT_DURATIONS[type];
      const id = `toast-${now}-${Math.random().toString(36).substr(2, 6)}`;

      const newToast: ToastItem = {
        id,
        type,
        title: parsed.title,
        message: parsed.message,
        duration,
        createdAt: now,
        isExiting: false,
      };

      setToasts(prev => {
        // Cap max concurrent toasts to 3 so view remains compact and never obscures controls
        const active = prev.filter(t => !t.isExiting);
        const trimmed = active.length >= 3 ? active.slice(active.length - 2) : active;
        return [...trimmed, newToast];
      });

      return id;
    },
    []
  );

  const success = useCallback(
    (msg: string, opt?: ToastOptions) => showToast('success', msg, opt),
    [showToast]
  );
  const error = useCallback(
    (msg: string, opt?: ToastOptions) => showToast('error', msg, opt),
    [showToast]
  );
  const warning = useCallback(
    (msg: string, opt?: ToastOptions) => showToast('warning', msg, opt),
    [showToast]
  );
  const info = useCallback(
    (msg: string, opt?: ToastOptions) => showToast('info', msg, opt),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info, dismiss, clearAll }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};

/**
 * Toast Container positioned at TOP-CENTER of viewport, clearly below the sticky header.
 * Uses pointer-events-none on wrapper, pointer-events-auto on toasts.
 */
interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      role="region"
      aria-label="Notifications"
      className="fixed top-20 sm:top-[82px] left-1/2 -translate-x-1/2 z-[9999] pointer-events-none flex flex-col items-center gap-3 w-full max-w-[94vw] sm:w-[470px] sm:max-w-[490px] px-3"
    >
      {toasts.map(toast => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

/**
 * Single Toast Notification Card with high visibility SaaS styling:
 * Solid white background, clearly visible border, strong elegant shadow,
 * smooth hover-to-pause countdown progress indicator, and manual close button.
 */
interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const ToastCard: React.FC<ToastCardProps> = ({ toast, onDismiss }) => {
  const [isPaused, setIsPaused] = useState(false);
  const remainingTimeRef = useRef(toast.duration);
  const lastTickRef = useRef(Date.now());

  // Handle auto-dismissal countdown with pause-on-hover capability
  useEffect(() => {
    if (toast.isExiting) return;

    lastTickRef.current = Date.now();
    const interval = setInterval(() => {
      if (!isPaused) {
        const now = Date.now();
        const delta = now - lastTickRef.current;
        lastTickRef.current = now;

        remainingTimeRef.current = Math.max(0, remainingTimeRef.current - delta);

        if (remainingTimeRef.current <= 0) {
          clearInterval(interval);
          onDismiss(toast.id);
        }
      } else {
        lastTickRef.current = Date.now();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isPaused, toast.id, toast.duration, toast.isExiting, onDismiss]);

  const handleMouseEnter = () => setIsPaused(true);
  const handleMouseLeave = () => setIsPaused(false);

  // Type-specific styles and badges
  const getTypeConfig = () => {
    switch (toast.type) {
      case 'success':
        return {
          cardBorder: 'border-[#A3D1B0] ring-1 ring-[#2F7D4A]/15',
          iconBadge: (
            <div className="w-8 h-8 rounded-full bg-[#EAF5EE] border border-[#86C99B] text-[#2F7D4A] flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <CheckCircle2 className="w-5 h-5 text-[#2F7D4A] stroke-[2.2]" />
            </div>
          ),
        };
      case 'error':
        return {
          cardBorder: 'border-[#FCA5A5] ring-1 ring-[#DC2626]/15',
          iconBadge: (
            <div className="w-8 h-8 rounded-full bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <AlertCircle className="w-5 h-5 text-[#DC2626] stroke-[2.2]" />
            </div>
          ),
        };
      case 'warning':
        return {
          cardBorder: 'border-[#FCD34D] ring-1 ring-[#D97706]/15',
          iconBadge: (
            <div className="w-8 h-8 rounded-full bg-[#FFFBEB] border border-[#FCD34D] text-[#D97706] flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <AlertTriangle className="w-5 h-5 text-[#D97706] stroke-[2.2]" />
            </div>
          ),
        };
      case 'info':
      default:
        return {
          cardBorder: 'border-[#93C5FD] ring-1 ring-[#2563EB]/15',
          iconBadge: (
            <div className="w-8 h-8 rounded-full bg-[#EFF6FF] border border-[#93C5FD] text-[#2563EB] flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <Info className="w-5 h-5 text-[#2563EB] stroke-[2.2]" />
            </div>
          ),
        };
    }
  };

  const config = getTypeConfig();

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`pointer-events-auto relative overflow-hidden w-full sm:w-[460px] max-w-full sm:max-w-[480px] bg-white rounded-[14px] ${
        config.cardBorder
      } shadow-[0_16px_36px_-4px_rgba(15,23,42,0.18),0_6px_16px_-2px_rgba(15,23,42,0.08),0_0_0_1px_rgba(0,0,0,0.02)] px-4 py-3.5 sm:py-4 flex items-start gap-3.5 transition-all ${
        toast.isExiting ? 'animate-toast-out' : 'animate-toast-in'
      }`}
    >
      {/* Icon Badge */}
      {config.iconBadge}

      {/* Text Content */}
      <div className="min-w-0 flex-1 pr-2">
        <div className="font-heading font-bold text-sm sm:text-[15px] text-[#111827] tracking-tight leading-snug">
          {toast.title}
        </div>
        {toast.message && (
          <div className="text-xs sm:text-[13px] text-[#374151] font-medium leading-relaxed mt-0.5 break-words">
            {toast.message}
          </div>
        )}
      </div>

      {/* Manual Dismiss Button */}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors -mr-1.5 -mt-1 shrink-0 focus:outline-none focus:ring-2 focus:ring-[#2F7D4A]/20"
      >
        <X className="w-4 h-4 stroke-[2.2]" />
      </button>
    </div>
  );
};
