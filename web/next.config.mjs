/** @type {import('next').NextConfig} */
const nextConfig = {
  // The dashboard talks to the API over HTTP only and shares no code with Python
  // (see the dependency rule in ARCHITECTURE.md).
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  },
};

export default nextConfig;
