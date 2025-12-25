// Lazy loaded components for better performance
import { Suspense, useState, useEffect } from "react";
import { Spinner } from "@shopify/polaris";

// NOTE: Route components are handled by React Router automatically
// Only use lazy loading for heavy non-route components

// Performance optimized wrapper
export function LazyWrapper({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        fallback || (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "200px",
            }}
          >
            <Spinner accessibilityLabel="Loading..." size="large" />
          </div>
        )
      }
    >
      {children}
    </Suspense>
  );
}

// Optimized image component
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
}) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      style={{
        aspectRatio: `${width}/${height}`,
        maxWidth: "100%",
        height: "auto",
      }}
    />
  );
}

// Debounced search for better performance
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
