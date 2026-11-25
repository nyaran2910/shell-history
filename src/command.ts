import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { homedir, userInfo } from "node:os";
import { absolutePath } from "./settings";

export async function executionShell(command: string, preference?: string) {
  if (!command.trim() || command.includes("\0")) throw new Error("Enter a valid shell command.");
  const shell = preference ? absolutePath(preference, "Execution Shell") : userInfo().shell;
  if (!shell) throw new Error("Set an Execution Shell in preferences.");
  await access(shell, constants.X_OK).catch(() => {
    throw new Error("The execution shell is not executable.");
  });
  return shell;
}

export async function runInRaycast(
  command: string,
  shellPreference: string | undefined,
  signal: AbortSignal,
  onOutput: (text: string) => void,
  onStarted: () => void,
) {
  const shell = await executionShell(command, shellPreference);
  signal.throwIfAborted();

  return new Promise<{ code: number | null; stopped: boolean }>((resolve, reject) => {
    const child = spawn(shell, ["-ilc", command], {
      cwd: homedir(),
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    function stop() {
      try {
        if (child.pid) process.kill(-child.pid, "SIGTERM");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") child.kill();
      }
    }

    signal.addEventListener("abort", stop, { once: true });
    child.stdout.setEncoding("utf8").on("data", onOutput);
    child.stderr.setEncoding("utf8").on("data", onOutput);
    child.once("spawn", onStarted);
    child.once("error", () => {
      signal.removeEventListener("abort", stop);
      reject(new Error("Could not start the execution shell."));
    });
    child.once("close", (code) => {
      signal.removeEventListener("abort", stop);
      resolve({ code, stopped: signal.aborted });
    });
  });
}
