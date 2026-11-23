import {
  Action, ActionPanel, Form, Icon, List, Toast, type Keyboard,
  closeMainWindow, getPreferenceValues, openExtensionPreferences, showToast,
} from "@raycast/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { findFzf, resultLimit, searchHistory } from "./fzf";
import { loadHistory } from "./history";
import { loadSettings, type Settings } from "./settings";
import { runInTerminal } from "./terminal";

const runShortcut: Keyboard.Shortcut = { modifiers: ["cmd"], key: "return" };

function EditMultilineCommand({ command, run }: { command: string; run: (text: string) => Promise<boolean> }) {
  return (
    <Form
      navigationTitle="Edit Command"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Run in Terminal"
            icon={Icon.Terminal}
            shortcut={runShortcut}
            onSubmit={({ command }: { command: string }) => run(command)}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea id="command" title="Command" defaultValue={command} autoFocus />
    </Form>
  );
}

interface History {
  commands: string[];
  input: Buffer;
  shellPath?: string;
}

export default function SearchShellHistory() {
  const [history, setHistory] = useState<History>();
  const [binary, setBinary] = useState<{ path?: string; error?: string }>();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<string>();
  const [result, setResult] = useState<{ query: string; commands: string[]; error?: string }>();
  const [loadError, setLoadError] = useState<string>();
  const running = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const settings = await loadSettings(getPreferenceValues<Settings>());
        if (!active) return;
        void findFzf(settings.fzfPath).then(
          (path) => { if (active) setBinary({ path }); },
          (error: Error) => { if (active) setBinary({ error: error.message }); },
        );
        const commands = await loadHistory(settings.historyFormat, settings.historyPath);
        if (active) {
          setHistory({
            commands: commands.slice(0, resultLimit),
            input: Buffer.from(commands.length ? commands.join("\0") + "\0" : ""),
            shellPath: settings.shellPath,
          });
        }
      } catch (error) {
        if (active) setLoadError((error as Error).message);
      }
    })();
    return () => { active = false; };
  }, []);

  const search = query.trim();
  const editing = draft !== undefined;

  useEffect(() => {
    if (editing || !history?.input.length || !search || !binary?.path) return;
    const controller = new AbortController();
    void searchHistory(binary.path, history.input, search, controller.signal).then(
      (commands) => { if (!controller.signal.aborted) setResult({ query: search, commands }); },
      (error: Error) => {
        if (!controller.signal.aborted) setResult({ query: search, commands: [], error: error.message });
      },
    );
    return () => controller.abort();
  }, [history, search, binary?.path, editing]);

  function handleTextChange(text: string) {
    if (!editing) {
      setQuery(text);
    } else if (text) {
      setDraft(text);
    } else {
      setDraft(undefined);
      setQuery("");
    }
  }

  const current = result?.query === search ? result : undefined;
  const error = loadError ?? (search ? binary?.error ?? current?.error : undefined);
  const commands = search ? result?.commands ?? history?.commands : history?.commands;
  const loading = !error && !editing && (!history || Boolean(history.input.length && search && !current));

  async function run(command: string) {
    if (running.current || !command.trim()) return false;
    running.current = true;
    try {
      await runInTerminal(command, history?.shellPath);
    } catch (error) {
      await showToast({ style: Toast.Style.Failure, title: "Could Not Run Command", message: (error as Error).message });
      return false;
    } finally {
      running.current = false;
    }
    await closeMainWindow();
    return true;
  }

  const rows = useMemo(() => commands?.map((command) => ({
    command,
    title: command.replace(/\n/g, " ↵ "),
    multiline: /[\r\n]/.test(command),
  })), [commands]);

  return (
    <List
      searchBarPlaceholder={editing ? "Edit command…" : "Search shell history…"}
      searchText={draft ?? query}
      onSearchTextChange={handleTextChange}
      filtering={false}
      isLoading={loading}
    >
      {!rows?.length && (
        <List.EmptyView
          icon={error ? Icon.ExclamationMark : Icon.Terminal}
          title={error ? "Could Not Search Shell History" : loading ? "Searching…" : search && history?.input.length ? "No Matching Commands" : "History Is Empty"}
          description={error}
          actions={
            <ActionPanel>
              <Action title="Open Extension Settings" icon={Icon.Gear} onAction={openExtensionPreferences} />
            </ActionPanel>
          }
        />
      )}
      {rows?.map(({ command, title, multiline }) => (
        <List.Item
          key={command}
          icon={Icon.Terminal}
          title={title}
          actions={
            <ActionPanel>
              {multiline ? (
                <Action.Push title="Edit Multiline Command" icon={Icon.Pencil} target={<EditMultilineCommand command={command} run={run} />} />
              ) : (
                <Action title="Complete Command" icon={Icon.Pencil} onAction={() => setDraft(command)} />
              )}
              {draft !== undefined && (
                <Action title="Run in Terminal" icon={Icon.Terminal} shortcut={runShortcut} onAction={() => run(draft)} />
              )}
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
