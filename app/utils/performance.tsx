// Performance optimizations per Core Web Vitals
// Aggiungi al tuo app/root.tsx o layout

import { useEffect } from "react";

export function PerformanceOptimizations() {
  useEffect(() => {
    // Preload critical resources
    const link = document.createElement("link");
    link.rel = "preload";
    link.href = "https://cdn.shopify.com/static/fonts/inter/v4/styles.css";
    link.as = "style";
    document.head.appendChild(link);

    // Preconnect to external domains
    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = "https://cdn.shopify.com";
    document.head.appendChild(preconnect);

    // Lazy load non-critical components
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Load component when visible
        }
      });
    });

    return () => observer.disconnect();
  }, []);

  return null;
}

// Image optimization
export function OptimizedImage({
  src,
  alt,
  width,
  height,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
}) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      style={{ aspectRatio: `${width}/${height}` }}
    />
  );
}
