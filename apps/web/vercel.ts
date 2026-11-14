const apiOrigin = process.env.API_ORIGIN;

if (!apiOrigin) {
  throw new Error("Set API_ORIGIN to the deployed API project origin.");
}

const parsedApiOrigin = new URL(apiOrigin);

if (parsedApiOrigin.protocol !== "https:" || parsedApiOrigin.pathname !== "/") {
  throw new Error("API_ORIGIN must be an HTTPS origin without a path.");
}

export const config = {
  rewrites: [
    {
      source: "/api/:path*",
      destination: `${parsedApiOrigin.origin}/api/:path*`,
    },
    {
      source: "/:path((?!api/).*)",
      destination: "/index.html",
    },
  ],
};
