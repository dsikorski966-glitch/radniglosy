/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Bez output: 'standalone' — Vercel ma własny builder, a Docker używa next start.
  images: { unoptimized: true }
}
