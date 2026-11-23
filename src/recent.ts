import { LocalStorage } from "@raycast/api";
import { createHash } from "node:crypto";
import type { HistoryFormat } from "./settings";

const recentLimit = 30;
let pendingWrite: Promise<unknown> = Promise.resolve();

export function recentKey(format: HistoryFormat, file: string) {
  const scope = createHash("sha256").update(format + "\0" + file).digest("hex");
  return `recent-commands-${scope}`;
}

export async function readRecent(key: string): Promise<string[]> {
  const saved = await LocalStorage.getItem<string>(key);
  if (!saved) return [];
  try {
    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string" && !!entry.trim() && !entry.includes("\0")).slice(0, recentLimit)
      : [];
  } catch {
    return [];
  }
}

export function rememberRun(key: string, command: string) {
  const write = pendingWrite.then(async () => {
    const recent = [command, ...(await readRecent(key)).filter((entry) => entry !== command)].slice(0, recentLimit);
    await LocalStorage.setItem(key, JSON.stringify(recent));
    return recent;
  });
  pendingWrite = write.catch(() => {});
  return write;
}
