import { confirm as siyuanConfirm } from "siyuan";

/**
 * Simple toast notification utility
 * Can be enhanced with more sophisticated UI in the future
 */

type ToastType = "success" | "error" | "info" | "warning";

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

/**
 * Show a toast notification
 */
export function showToast(options: ToastOptions): void {
  const { message, type = "info", duration = 3000 } = options;

  // Create toast element
  const toast = document.createElement("div");
  toast.className = `recurring-tasks-toast recurring-tasks-toast--${type}`;
  toast.textContent = message;

  // Add styles
  Object.assign(toast.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    padding: "12px 20px",
    borderRadius: "6px",
    backgroundColor: getBackgroundColor(type),
    color: "white",
    fontSize: "14px",
    fontWeight: "500",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    zIndex: "10000",
    maxWidth: "400px",
    animation: "slideInRight 0.3s ease-out",
  });

  // Add to document
  document.body.appendChild(toast);

  // Remove after duration
  setTimeout(() => {
    toast.style.animation = "slideOutRight 0.3s ease-out";
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, duration);
}

/**
 * Get background color for toast type
 */
function getBackgroundColor(type: ToastType): string {
  switch (type) {
    case "success":
      return "#4caf50";
    case "error":
      return "#f44336";
    case "warning":
      return "#ff9800";
    case "info":
    default:
      return "#2196f3";
  }
}

/**
 * Convenience methods
 */
export const toast = {
  success: (message: string, duration?: number) =>
    showToast({ message, type: "success", duration }),
  error: (message: string, duration?: number) =>
    showToast({ message, type: "error", duration }),
  warning: (message: string, duration?: number) =>
    showToast({ message, type: "warning", duration }),
  info: (message: string, duration?: number) =>
    showToast({ message, type: "info", duration }),
};

/**
 * Confirm dialog replacement
 */
export function confirm(message: string, title = "Confirm"): Promise<boolean> {
  return new Promise((resolve) => {
    siyuanConfirm(
      title,
      message,
      () => resolve(true),
      () => resolve(false)
    );
  });
}

// Add CSS animations if not already present
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}
