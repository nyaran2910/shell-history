import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

export type HistoryFormat = "fish" | "zsh" | "plain";

export interface Settings {
  historyPath?: string;
  historyFormat?: HistoryFormat;
  terminalApp?: string;
  shellPath?: string;
  fzfPath?: string;
}

export function absolutePath(value: string, label: string) {
  const path = value.startsWith("~/") ? join(homedir(), value.slice(2)) : value;
  if (!isAbsolute(path)) throw new Error(`${label} must be an absolute path or start with ~/.`);
  return path;
}

export async function loadSettings(preferences: Settings) {
  let local: Settings = {};
  const path = join(homedir(), ".config/raycast/shell-history.json");
  try {
    local = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error("Could not read ~/.config/raycast/shell-history.json.");
    }
  }
  if (!local || typeof local !== "object" || Array.isArray(local) ||
      Object.values(local).some((value) => typeof value !== "string")) {
    throw new Error("Shell History settings must be a JSON object with string values.");
  }
  // Raycast supplies the manifest defaults for the dropdowns.
  return {
    historyPath: preferences.historyPath?.trim() || local.historyPath?.trim(),
    historyFormat: preferences.historyFormat ?? "fish",
    terminalApp: preferences.terminalApp ?? "system",
    shellPath: preferences.shellPath?.trim() || local.shellPath?.trim(),
    fzfPath: preferences.fzfPath?.trim() || local.fzfPath?.trim(),
  };
}
