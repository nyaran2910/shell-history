import { Action, ActionPanel, Detail, Icon } from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { stripVTControlCharacters } from "node:util";
import { runInRaycast } from "./command";

const outputLimit = 64 * 1024;

export function CommandOutput({ command, shell, onStarted }: {
  command: string;
  shell?: string;
  onStarted: () => void;
}) {
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<string>();
  const [truncated, setTruncated] = useState(false);
  const controller = useRef<AbortController>(null);
  const request = useRef({ command, shell, onStarted });

  useEffect(() => {
    const { command, shell, onStarted } = request.current;
    const session = new AbortController();
    controller.current = session;
    let active = true;
    let captured = "";
    let capped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function flush() {
      clearTimeout(timer);
      timer = undefined;
      if (active) {
        setOutput(stripVTControlCharacters(captured));
        setTruncated(capped);
      }
    }

    void runInRaycast(command, shell, session.signal, (chunk) => {
      if (capped) return;
      const remaining = outputLimit - captured.length;
      captured += chunk.slice(0, remaining);
      capped = chunk.length > remaining;
      timer ??= setTimeout(flush, 80);
    }, onStarted).then(({ code, stopped }) => {
      flush();
      if (active) setStatus(stopped ? "Stopped" : code === 0 ? "Completed" : code === null ? "Terminated" : `Exited with status ${code}`);
    }, (error: Error) => {
      flush();
      if (active) setStatus(session.signal.aborted ? "Stopped" : error.message);
    });
    return () => {
      active = false;
      clearTimeout(timer);
      session.abort();
    };
  }, []);

  const codeBlock = output ? output.split("\n").map((line) => `    ${line}`).join("\n") : "";
  const markdown = [status ?? "Running…", codeBlock, truncated ? "Output truncated." : ""].filter(Boolean).join("\n\n");

  return (
    <Detail
      navigationTitle="Command Output"
      isLoading={!status}
      markdown={markdown}
      actions={
        <ActionPanel>
          {!status && <Action title="Stop Command" icon={Icon.Stop} onAction={() => controller.current?.abort()} />}
          {output && <Action.CopyToClipboard title="Copy Output" content={output} />}
        </ActionPanel>
      }
    />
  );
}
