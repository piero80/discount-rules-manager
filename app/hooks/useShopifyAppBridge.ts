import { useAppBridge } from "@shopify/app-bridge-react";
import { useCallback } from "react";

export function useShopifyAppBridge() {
  const app = useAppBridge();

  const showResourcePicker = useCallback(
    async (resourceType: "Product" | "Collection", options = {}) => {
      if (!app) return null;

      try {
        // Map resourceType to valid ResourceTypes keys
        const typeMap = {
          Product: "product",
          Collection: "collection",
        } as const;
        const type = typeMap[resourceType];
        return await app.resourcePicker({
          type,
          ...options,
        });
      } catch (error) {
        console.error("Resource picker error:", error);
        return null;
      }
    },
    [app],
  );

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      if (!app) return;

      try {
        app.toast.show(message, {
          duration: 4000,
          isError: type === "error",
        });
      } catch (error) {
        console.error("Toast error:", error);
        // Fallback to console
        console.log(`Toast: ${message}`);
      }
    },
    [app],
  );

  const openExternalUrl = useCallback(
    (url: string) => {
      if (!app) {
        console.log("No app bridge, opening in current window");
        window.open(url, "_top");
        return;
      }

      try {
        // For embedded apps, we need to navigate the parent window
        console.log("Using App Bridge to open external URL:", url);
        if (window.top) {
          window.top.location.href = url;
        } else {
          window.open(url, "_top");
        }
      } catch (error) {
        console.error("Navigation error:", error);
        window.location.href = url;
      }
    },
    [app],
  );

  return {
    app,
    showResourcePicker,
    showToast,
    openExternalUrl,
  };
}
