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

  return {
    app,
    showResourcePicker,
    showToast,
  };
}
