/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
<<<<<<< HEAD
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: 'canvas' }]
    return config
  },
  async rewrites() {
    return {
      fallback: [
        {
          source: '/image/:path*',
          destination: '/:path*',
        },
      ],
    }
  },
  experimental: {
    optimizePackageImports: ['@radix-ui/react-*'],
  },
=======
>>>>>>> bbc8bab (Initial commit)
}

export default nextConfig
