import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pdf-parse / mammoth 含原生与大体积依赖，交给 Node 运行时加载，避免打包踩坑
  serverExternalPackages: ['pdf-parse', 'mammoth'],
};

export default nextConfig;
