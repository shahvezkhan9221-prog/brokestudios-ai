/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['studio', 'ai-agent', 'workflow-builder'],

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            // Allow images from Pollinations, AI Horde, and HuggingFace
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://image.pollinations.ai https://aihorde.net https://*.aihorde.net https://api-inference.huggingface.co",
              "connect-src 'self' https://api.muapi.ai https://image.pollinations.ai https://aihorde.net https://api-inference.huggingface.co",
              "media-src 'self' data: blob: https://aihorde.net https://*.aihorde.net",
            ].join('; '),
          },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: 'https://api.muapi.ai/api/v1/:path*' },
      { source: '/workflow/:path*', destination: 'https://api.muapi.ai/workflow/:path*' },
      { source: '/agents/:path*', destination: 'https://api.muapi.ai/agents/:path*' },
    ];
  },
};

export default nextConfig;
