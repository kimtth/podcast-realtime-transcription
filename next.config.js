/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    // Add support for loading ONNX models
    config.resolve.alias = {
      ...config.resolve.alias,
      'sharp$': false,
      'onnxruntime-node$': false,
    }
    
    // Externals for server-side ONNX runtime
    if (isServer) {
      config.externals = [...(config.externals || []), 'sharp', 'onnxruntime-node']
    }
    
    return config
  },
}

module.exports = nextConfig
