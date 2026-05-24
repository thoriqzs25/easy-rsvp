import { execSync } from "child_process";

/** @type {import('next').NextConfig} */

function getCommitHash() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  }
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

const nextConfig = {
  env: {
    NEXT_PUBLIC_COMMIT_HASH: getCommitHash(),
  },
};

export default nextConfig;
