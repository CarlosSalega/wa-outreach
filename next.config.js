/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    'whatsapp-web.js',
    'puppeteer',
    'qrcode-terminal',
    'node-cron',
    'qrcode',
    './src/lib/whatsapp/**',
    './src/lib/scheduler/**',
  ],
};

export default nextConfig;
