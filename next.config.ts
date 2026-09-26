import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Ignorar errores del plugin react-compiler que dan falsos positivos
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: "/login",
        destination: "/auth/login",
        permanent: true,
      },
      {
        source: "/register",
        destination: "/auth/registro",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
