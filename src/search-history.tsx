import {
  Action, ActionPanel, Form, Icon, List, Toast,
  getPreferenceValues, openExtensionPreferences, showToast,
} from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { findFzf, resultLimit, searchHistory } from "./fzf";
import { loadHistory } from "./history";
import { loadSettings, type Settings } from "./settings";
import { runInTerminal } from "./terminal";

function EditCommand({ command, shell }: { command: string; shell?: string }) {
  const running = useRef(false);

  async function submit({ command }: { command: string }) {
    if (running.current || !command.trim()) return false;
    running.current = true;
    try {
      await runInTerminal(command, shell);
    } catch (error) {
      await showToast({ style: Toast.Style.Failure, title: "Could Not Run Command", message: (error as Error).message });
      return false;
    } finally {
      running.current = false;
    }
  }

  return (
    <Form
      navigationTitle="Edit Command"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Run in Terminal"
            icon={Icon.Terminal}
            shortcut={{ modifiers: ["cmd"], key: "return" }}
            onSubmit={submit}
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
  input: string;
  fzfPath?: string;
  shellPath?: string;
}

export default function SearchShellHistory() {
  const [history, setHistory] = useState<History>();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ query: string; commands: string[]; error?: string }>();
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const settings = await loadSettings(getPreferenceValues<Settings>());
        const commands = await loadHistory(settings.historyFormat, settings.historyPath);
        if (active) {
          setHistory({
            commands: commands.slice(0, resultLimit),
            input: commands.length ? commands.join("\0") + "\0" : "",
            fzfPath: settings.fzfPath,
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

  useEffect(() => {
    if (!history?.input || !search) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const executable = await findFzf(history.fzfPath);
        controller.signal.throwIfAborted();
        const commands = await searchHistory(executable, history.input, search, controller.signal);
        if (!controller.signal.aborted) setResult({ query: search, commands });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ query: search, commands: [], error: (error as Error).message });
      }
    }, 80);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [history, search]);

  const current = result?.query === search ? result : undefined;
  const error = loadError ?? current?.error;
  const commands = search ? current?.commands ?? [] : history?.commands ?? [];
  const loading = !error && (!history || Boolean(history.input && search && !current));

  return (
    <List
      searchBarPlaceholder="Search shell history…"
      searchText={query}
      onSearchTextChange={setQuery}
      filtering={false}
      isLoading={loading}
    >
      {!loading && !commands.length && (
        <List.EmptyView
          icon={error ? Icon.ExclamationMark : Icon.Terminal}
          title={error ? "Could Not Load Shell History" : search && history?.input ? "No Matching Commands" : "History Is Empty"}
          description={error}
          actions={
            <ActionPanel>
              <Action title="Open Extension Settings" icon={Icon.Gear} onAction={openExtensionPreferences} />
            </ActionPanel>
          }
        />
      )}
      {commands.map((command) => (
        <List.Item
          key={command}
          icon={Icon.Terminal}
          title={command.replace(/\n/g, " ↵ ")}
          actions={
            <ActionPanel>
              <Action.Push title="Edit Command" icon={Icon.Pencil} target={<EditCommand command={command} shell={history?.shellPath} />} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
