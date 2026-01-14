import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />

        {/* Preconnect to critical domains for faster DNS resolution */}
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="preconnect"
          href="https://unpkg.com"
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />

        {/* Preload critical resources */}
        <link
          rel="preload"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
          as="style"
          onLoad={(e) => {
            const target = e.target as HTMLLinkElement;
            target.onload = null;
            target.rel = "stylesheet";
          }}
        />
        <link
          rel="preload"
          href="https://unpkg.com/@shopify/polaris@13.9.5/build/esm/styles.css"
          as="style"
          onLoad={(e) => {
            const target = e.target as HTMLLinkElement;
            target.onload = null;
            target.rel = "stylesheet";
          }}
        />

        {/* Fallback for non-JS */}
        <noscript>
          <link
            rel="stylesheet"
            href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
          />
          <link
            rel="stylesheet"
            href="https://unpkg.com/@shopify/polaris@13.9.5/build/esm/styles.css"
          />
        </noscript>

        {/* Critical inline styles for instant paint */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Critical CSS for LCP optimization */
              body { 
                margin: 0; 
                font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                background-color: #fafbfb;
                font-display: swap;
              }
              
              /* Loading skeletons for better perceived performance */
              .loading-skeleton {
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: loading 1.2s ease-in-out infinite;
                border-radius: 4px;
              }
              
              @keyframes loading {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
              }
              
              /* Critical layout styles to prevent CLS */
              .polaris-page__content {
                opacity: 1;
                transform: translateZ(0); /* Force GPU acceleration */
              }
              
              /* Optimize card rendering */
              .polaris-card {
                contain: layout style;
                will-change: transform;
              }
              
              /* Optimize icon rendering */
              svg {
                shape-rendering: optimizeSpeed;
              }
            `,
          }}
        />

        {/* Performance monitoring script for LCP optimization */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Quick LCP monitoring
                if ('PerformanceObserver' in window) {
                  const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    const lcp = lastEntry.renderTime || lastEntry.loadTime;
                    
                    if (lcp > 2500) {
                      console.warn('LCP: ' + lcp.toFixed(2) + 'ms (above 2.5s threshold)');
                    } else {
                      console.log('LCP: ' + lcp.toFixed(2) + 'ms (✓ under 2.5s)');
                    }
                  });
                  observer.observe({ entryTypes: ['largest-contentful-paint'] });
                }
                
                // Preload critical resources on idle
                function preloadOnIdle() {
                  const link = document.createElement('link');
                  link.rel = 'modulepreload';
                  link.href = '/app/routes/app._index.tsx';
                  document.head.appendChild(link);
                }
                
                if ('requestIdleCallback' in window) {
                  requestIdleCallback(preloadOnIdle);
                } else {
                  setTimeout(preloadOnIdle, 100);
                }
              })();
            `,
          }}
        />

        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
