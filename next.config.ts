import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    // Exclude the SDK package from the build
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push({
        'packages/sdk': 'commonjs packages/sdk'
      });
    }

    // Ignore SDK package files completely
    config.watchOptions = config.watchOptions || {};
    config.watchOptions.ignored = config.watchOptions.ignored || [];
    if (Array.isArray(config.watchOptions.ignored)) {
      config.watchOptions.ignored.push('**/packages/sdk/**');
    }

    return config;
  },
};

export default nextConfig;

