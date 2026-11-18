/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['lynette-seminasal-superchemically.ngrok-free.dev'],
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
  // These packages run on the server only and should not be bundled.
  serverExternalPackages: ['@electric-sql/pglite', 'pg', 'twilio'],
};

export default nextConfig;
