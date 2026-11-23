import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { absolutePath } from "./settings";

const exec = promisify(execFile);

function quoteForSh(value: string) {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

export async function runInTerminal(command: string, shellPreference?: string, terminalApp = "system") {
  if (!command.trim() || command.includes("\0")) throw new Error("Enter a valid shell command.");
  const shell = shellPreference ? absolutePath(shellPreference, "Execution Shell") : userInfo().shell;
  if (!shell) throw new Error("Set an Execution Shell in preferences.");
  await access(shell, constants.X_OK).catch(() => {
    throw new Error("The execution shell is not executable.");
  });

  const directory = await mkdtemp(join(tmpdir(), "raycast-shell-history-"));
  const script = join(directory, "Run Shell History.command");
  try {
    await writeFile(script, [
      "#!/bin/sh",
      `/bin/rm -f ${quoteForSh(script)}`,
      `/bin/rmdir ${quoteForSh(directory)}`,
      'cd "$HOME" || exit 1',
      `exec ${quoteForSh(shell)} -ilc ${quoteForSh(command)}`,
      "",
    ].join("\n"), { mode: 0o700, flag: "wx" });
    const args = terminalApp === "system" ? [script] : ["-b", terminalApp, script];
    await exec("/usr/bin/open", args);
  } catch {
    await rm(directory, { recursive: true, force: true });
    throw new Error(terminalApp === "system"
      ? "Could not open the command with the macOS default app for .command files."
      : "Could not open the command in the selected terminal. Check Terminal App in preferences.");
  }
}
