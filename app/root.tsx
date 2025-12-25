import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />

        {/* Preconnect to critical domains */}
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="preconnect"
          href="https://unpkg.com"
          crossOrigin="anonymous"
        />

        {/* Preload critical CSS */}
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

        {/* Critical inline styles */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Critical CSS for initial paint */
              body { 
                margin: 0; 
                font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                background-color: #fafbfb;
              }
              .loading-skeleton {
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: loading 1.5s infinite;
              }
              @keyframes loading {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
              }
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
