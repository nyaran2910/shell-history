import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { absolutePath, type HistoryFormat } from "./settings";

export function parseHistory(contents: string, format: HistoryFormat) {
  const lines = contents.split(/\r?\n/);
  const commands: string[] = [];

  if (format === "fish") {
    for (const line of lines) {
      if (line.startsWith("- cmd: ")) {
        commands.push(line.slice(7).replace(/\\([\\n])/g, (_, escaped) => escaped === "n" ? "\n" : "\\"));
      }
    }
  } else if (format === "zsh") {
    let pending = "";
    for (const line of lines) {
      const part = pending ? line : line.replace(/^: \d+:\d+;/, "");
      if (part.endsWith("\\")) {
        pending += part.slice(0, -1) + "\n";
      } else {
        commands.push(pending + part);
        pending = "";
      }
    }
  } else {
    for (const line of lines) commands.push(line);
  }

  return [...new Set(commands.reverse().filter((command) => command.trim() && !command.includes("\0")))];
}

export async function loadHistory(format: HistoryFormat, preference?: string) {
  const dataHome = process.env.XDG_DATA_HOME || join(homedir(), ".local/share");
  const defaults = {
    fish: join(dataHome, "fish/fish_history"),
    zsh: join(homedir(), ".zsh_history"),
    plain: join(homedir(), ".bash_history"),
  };
  const path = preference ? absolutePath(preference, "History File") : defaults[format];
  let contents: string;
  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`History file not found: ${path}`);
    }
    throw new Error(`Could not read history file: ${path}`);
  }
  return parseHistory(contents, format);
}
