import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // L'interface appelle le backend via des Route Handlers same-origin :
  // le jeton opérateur ne quitte jamais le serveur Next.
};

export default nextConfig;
