import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { homedir, userInfo } from "node:os";
import { delimiter, isAbsolute, join } from "node:path";
import { absolutePath } from "./settings";

export const resultLimit = 100;

export async function findFzf(preference?: string) {
  const folders = [
    ...(process.env.PATH ?? "").split(delimiter),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    join(homedir(), ".nix-profile/bin"),
    `/etc/profiles/per-user/${userInfo().username}/bin`,
    "/run/current-system/sw/bin",
  ];
  const paths = preference
    ? [absolutePath(preference, "FZF Executable")]
    : folders.filter(isAbsolute).map((folder) => join(folder, "fzf"));

  for (const path of new Set(paths)) {
    try {
      await access(path, constants.X_OK);
      return path;
    } catch {
      // Continue through the known installation paths.
    }
  }
  throw new Error(preference ? "Cannot run the configured fzf executable." : "Install fzf or set FZF Executable in preferences.");
}

export function searchHistory(executable: string, input: Buffer, query: string, signal: AbortSignal, newestFirst = false) {
  const env = { ...process.env };
  delete env.FZF_DEFAULT_OPTS;
  delete env.FZF_DEFAULT_OPTS_FILE;

  return new Promise<string[]>((resolve, reject) => {
    const args = ["--read0", "--print0", "--scheme=history", `--filter=${query}`];
    if (newestFirst) args.push("--no-sort");
    const child = spawn(executable, args, { env, signal });
    const matches: string[] = [];
    let partial = "";
    let failed = false;

    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      if (matches.length >= resultLimit) return;
      const records = (partial + chunk).split("\0");
      partial = records.pop() ?? "";
      matches.push(...records.slice(0, resultLimit - matches.length));
      if (matches.length === resultLimit) child.kill();
    });
    child.stderr.resume();
    child.stdin.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code !== "EPIPE") failed = true;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (!failed && (code === 0 || code === 1 || matches.length === resultLimit)) resolve(matches);
      else reject(new Error("fzf could not search the history."));
    });
    child.stdin.end(input);
  });
}
