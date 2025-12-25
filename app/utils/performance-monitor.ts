// API Response optimization utility
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTimer(label: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.addMetric(label, duration);

      // Log slow operations (> 1000ms)
      if (duration > 1000) {
        console.warn(
          `Slow operation detected: ${label} took ${duration.toFixed(2)}ms`,
        );
      }
    };
  }

  private addMetric(label: string, duration: number) {
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    const metrics = this.metrics.get(label)!;
    metrics.push(duration);

    // Keep only last 10 measurements
    if (metrics.length > 10) {
      metrics.shift();
    }
  }

  getAverageTime(label: string): number {
    const metrics = this.metrics.get(label);
    if (!metrics || metrics.length === 0) return 0;

    return metrics.reduce((a, b) => a + b, 0) / metrics.length;
  }

  getAllMetrics(): Record<string, number> {
    const result: Record<string, number> = {};
    this.metrics.forEach((values, label) => {
      result[label] = this.getAverageTime(label);
    });
    return result;
  }
}

// Optimized GraphQL query builder
export function buildOptimizedQuery(
  fields: string[],
  options?: {
    limit?: number;
    includeCount?: boolean;
  },
) {
  const { limit = 250, includeCount = false } = options || {};

  const baseFields = fields.join("\n        ");
  const countField = includeCount ? "\n      pageInfo { hasNextPage }" : "";

  return `
    query OptimizedQuery {
      collections(first: ${limit}) {
        edges {
          node {
            ${baseFields}
          }
        }${countField}
      }
    }
  `.trim();
}

// Response compression helper
export function compressResponse<T>(data: T): T {
  if (typeof data !== "object" || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(compressResponse) as T;
  }

  const compressed = {} as T;
  for (const [key, value] of Object.entries(data)) {
    // Skip null/undefined values to reduce payload
    if (value != null) {
      (compressed as Record<string, unknown>)[key] = compressResponse(value);
    }
  }

  return compressed;
}

// Cache utility for expensive operations
class SimpleCache {
  private cache = new Map<string, { data: unknown; expiry: number }>();

  set(key: string, data: unknown, ttlMs = 60000) {
    // 1 minute default
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
    });
  }

  get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  clear() {
    this.cache.clear();
  }
}

export const cache = new SimpleCache();
