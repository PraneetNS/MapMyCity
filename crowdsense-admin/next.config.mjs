/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disable React Strict Mode for Leaflet marker initialization
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
