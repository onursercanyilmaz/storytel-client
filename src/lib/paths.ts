import fs from "fs";
import path from "path";

export const DATA_DIR =
  process.env.STORYTEL_DATA_DIR || path.join(process.cwd(), ".data");
export const DOWNLOADS_DIR = path.join(DATA_DIR, "downloads");
export const SSO_PROFILE_DIR = path.join(DATA_DIR, "sso-profile");

export function ensureDataDirs(): void {
  for (const dir of [DATA_DIR, DOWNLOADS_DIR, SSO_PROFILE_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  }
}
