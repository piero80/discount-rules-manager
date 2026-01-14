// Performance monitoring and optimization utilities

// Extend PerformanceEntry for Layout Shift API
interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

export class LCPMonitor {
  private static instance: LCPMonitor;
  private observer: PerformanceObserver | null = null;
  private lcpValue: number = 0;

  static getInstance(): LCPMonitor {
    if (!LCPMonitor.instance) {
      LCPMonitor.instance = new LCPMonitor();
    }
    return LCPMonitor.instance;
  }

  startMonitoring(): void {
    if (typeof window === "undefined" || this.observer) return;

    try {
      this.observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
          renderTime?: number;
          loadTime?: number;
        };

        // Get LCP value (renderTime if available, otherwise loadTime)
        this.lcpValue = lastEntry.renderTime || lastEntry.loadTime || 0;

        // Log LCP for debugging
        console.log(`LCP: ${this.lcpValue.toFixed(2)}ms`);

        // Warn if LCP is above threshold
        if (this.lcpValue > 2500) {
          console.warn(
            `⚠️ LCP above threshold: ${this.lcpValue.toFixed(2)}ms (target: <2500ms)`,
          );
        } else {
          console.log(`✅ LCP within target: ${this.lcpValue.toFixed(2)}ms`);
        }
      });

      this.observer.observe({ entryTypes: ["largest-contentful-paint"] });
    } catch (error) {
      console.warn("LCP monitoring not supported in this browser");
    }
  }

  stopMonitoring(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  getLCP(): number {
    return this.lcpValue;
  }

  // Report Core Web Vitals
  reportWebVitals(): void {
    if (typeof window === "undefined") return;

    // LCP
    this.startMonitoring();

    // FID (First Input Delay)
    new PerformanceObserver((list) => {
      const fidEntry = list.getEntries()[0] as PerformanceEventTiming;
      const fid = fidEntry.processingStart - fidEntry.startTime;
      console.log(`FID: ${fid.toFixed(2)}ms`);

      if (fid > 100) {
        console.warn(
          `⚠️ FID above threshold: ${fid.toFixed(2)}ms (target: <100ms)`,
        );
      } else {
        console.log(`✅ FID within target: ${fid.toFixed(2)}ms`);
      }
    }).observe({ entryTypes: ["first-input"] });

    // CLS (Cumulative Layout Shift)
    let clsValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Only count layout shifts without recent user input
        const layoutShift = entry as LayoutShiftEntry;
        if (!layoutShift.hadRecentInput) {
          clsValue += layoutShift.value;
        }
      }

      console.log(`CLS: ${clsValue.toFixed(4)}`);

      if (clsValue > 0.1) {
        console.warn(
          `⚠️ CLS above threshold: ${clsValue.toFixed(4)} (target: <0.1)`,
        );
      } else {
        console.log(`✅ CLS within target: ${clsValue.toFixed(4)}`);
      }
    }).observe({ entryTypes: ["layout-shift"] });

    // TTI approximation using Long Tasks
    let longTaskCount = 0;
    new PerformanceObserver((list) => {
      longTaskCount += list.getEntries().length;
      console.log(`Long Tasks: ${longTaskCount}`);
    }).observe({ entryTypes: ["longtask"] });
  }
}

// Initialize performance monitoring
export const initPerformanceMonitoring = (): void => {
  if (typeof window !== "undefined") {
    const monitor = LCPMonitor.getInstance();
    monitor.reportWebVitals();

    // Log performance metrics after load
    window.addEventListener("load", () => {
      setTimeout(() => {
        console.log("=== Performance Report ===");
        console.log(`LCP: ${monitor.getLCP().toFixed(2)}ms`);

        // Navigation timing
        const navigation = performance.getEntriesByType(
          "navigation",
        )[0] as PerformanceNavigationTiming;
        if (navigation) {
          console.log(
            `DNS Lookup: ${(navigation.domainLookupEnd - navigation.domainLookupStart).toFixed(2)}ms`,
          );
          console.log(
            `TCP Connection: ${(navigation.connectEnd - navigation.connectStart).toFixed(2)}ms`,
          );
          console.log(
            `Request: ${(navigation.responseEnd - navigation.requestStart).toFixed(2)}ms`,
          );
          console.log(
            `DOM Loading: ${(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart).toFixed(2)}ms`,
          );
          console.log(
            `Total Load Time: ${(navigation.loadEventEnd - navigation.fetchStart).toFixed(2)}ms`,
          );
        }
      }, 1000);
    });
  }
};

// Custom hook for performance monitoring in React components
export const usePerformanceMonitor = () => {
  return {
    startTimer: (label: string) => {
      const start = performance.now();
      return () => {
        const duration = performance.now() - start;
        console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
        return duration;
      };
    },
    markLCP: (elementName: string) => {
      console.log(
        `🎯 LCP candidate: ${elementName} rendered at ${performance.now().toFixed(2)}ms`,
      );
    },
  };
};
