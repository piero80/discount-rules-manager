export function loader() {
  return Response.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    service: "discount-rules-manager",
  });
}
