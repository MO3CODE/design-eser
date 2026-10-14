import type { NextConfig } from 'next';

const config: NextConfig = {
  // puppeteer-core يشتغل على السيرفر فقط (تصدير بنفس دقة المهارات)
  serverExternalPackages: ['puppeteer-core'],
  // عزل المصدر → WASM متعدد الخيوط لقص الخلفية بالمتصفح (BiRefNet) لما WebGPU ما يكفي
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
      ],
    }];
  },
};

export default config;
