import UAParser from "ua-parser-js";

export function browserOsFromUserAgent(ua: string | null): {
  browser: string;
  os: string;
} {
  if (!ua) return { browser: "unknown", os: "unknown" };
  const p = new UAParser(ua);
  const browser = [p.getBrowser().name, p.getBrowser().version]
    .filter(Boolean)
    .join(" ");
  const os = [p.getOS().name, p.getOS().version].filter(Boolean).join(" ");
  return {
    browser: browser || "unknown",
    os: os || "unknown",
  };
}
