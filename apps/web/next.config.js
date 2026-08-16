/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/',
        destination: '/discover',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
