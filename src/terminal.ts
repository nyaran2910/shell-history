import { getDefaultApplication } from "@raycast/api";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { absolutePath } from "./settings";

const exec = promisify(execFile);
const ghosttyBundleId = "com.mitchellh.ghostty";
const ghosttyScript = `
on run argv
  tell application id "${ghosttyBundleId}"
    set cfg to new surface configuration from {command:(item 1 of argv)}
    activate
    new window with configuration cfg
  end tell
end run
`;

function quoteForSh(value: string) {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

async function openGhostty(script: string) {
  try {
    // Pass the path separately from the AppleScript source.
    await exec("/usr/bin/osascript", ["-e", ghosttyScript, `/bin/sh ${quoteForSh(script)}`]);
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? "";
    if (/\(-174[34]\)/.test(stderr)) {
      throw new Error("Allow Raycast to control Ghostty in System Settings → Privacy & Security → Automation.");
    }
    throw new Error("Could not open a Ghostty window. Ghostty 1.3 or newer with AppleScript enabled is required.");
  }
}

export async function openInTerminal(
  command: string,
  execute: boolean,
  shellPreference?: string,
  terminalApp = "system",
) {
  if (!command.trim() || command.includes("\0")) throw new Error("Enter a valid shell command.");
  const shell = shellPreference ? absolutePath(shellPreference, "Execution Shell") : userInfo().shell;
  if (!shell) throw new Error("Set an Execution Shell in preferences.");
  await access(shell, constants.X_OK).catch(() => {
    throw new Error("The execution shell is not executable.");
  });

  const fish = await exec(shell, ["-c", "builtin status fish-path"], { timeout: 3000 })
    .then(() => true, () => false);
  if (!fish && !execute) {
    throw new Error("Set Execution Shell to fish to open a command for editing.");
  }

  // Let fish's interactive reader handle the command, including its normal history rules.
  const init = [
    "function __raycast_shell_history_prefill --on-event fish_prompt",
    "  functions --erase __raycast_shell_history_prefill",
    '  commandline --replace -- "$RAYCAST_SHELL_HISTORY_COMMAND"',
    "  set --erase RAYCAST_SHELL_HISTORY_COMMAND",
    execute ? "  commandline --function execute" : "",
    "end",
  ].join("\n");
  const launch = fish
    ? `export RAYCAST_SHELL_HISTORY_COMMAND=${quoteForSh(command)}\nexec ${quoteForSh(shell)} -il -C ${quoteForSh(init)}`
    : `exec ${quoteForSh(shell)} -ilc ${quoteForSh(command)}`;

  const directory = await mkdtemp(join(tmpdir(), "raycast-shell-history-"));
  const script = join(directory, "Run Shell History.command");
  try {
    await writeFile(script, [
      "#!/bin/sh",
      `/bin/rm -f ${quoteForSh(script)}`,
      `/bin/rmdir ${quoteForSh(directory)}`,
      'cd "$HOME" || exit 1',
      launch,
      "",
    ].join("\n"), { mode: 0o700, flag: "wx" });
    const target = terminalApp === "system"
      ? (await getDefaultApplication(script).catch(() => undefined))?.bundleId
      : terminalApp;
    if (target === ghosttyBundleId) {
      await openGhostty(script);
    } else {
      const args = terminalApp === "system" ? [script] : ["-b", terminalApp, script];
      await exec("/usr/bin/open", args).catch(() => {
        throw new Error(terminalApp === "system"
          ? "Could not open the command with the macOS default app for .command files."
          : "Could not open the command in the selected terminal. Check Terminal App in preferences.");
      });
    }
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
