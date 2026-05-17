import { randomBytes } from "crypto";

export function generateTokenUrlSafe(): string {
  return randomBytes(32).toString("base64url");
}
