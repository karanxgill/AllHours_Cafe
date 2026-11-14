const configuredApiOrigin =
  process.env.API_ORIGIN || "https://all-hours-cafe-api.vercel.app";

const parsedApiOrigin = new URL(configuredApiOrigin);

if (
  parsedApiOrigin.protocol !== "https:" ||
  parsedApiOrigin.pathname !== "/" ||
  parsedApiOrigin.search ||
  parsedApiOrigin.hash
) {
  throw new Error("API_ORIGIN must be an HTTPS origin without a path.");
}

const apiOrigin = parsedApiOrigin.origin;

export const config = {
  rewrites: [
    {
      source: "/api/:path*",
      destination: `${apiOrigin}/api/:path*`,
    },
    {
      source: "/(.*)",
      destination: "/index.html",
    },
  ],
};