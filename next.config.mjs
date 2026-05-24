/** @type {import('next').NextConfig} */

const nextConfig = {
  env: {
    NEXT_PUBLIC_COMMIT_HASH:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
  },
};

export default nextConfig;
