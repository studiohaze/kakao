// const { i18n } = require('./next-i18next.config.js');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  i18n: {
    defaultLocale: 'ko',
    locales: ['ko', 'en'],
    localeDetection: false,
  },
  async rewrites() {
    return [
      {
        source: '/debug/:path*',
        destination: '/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
