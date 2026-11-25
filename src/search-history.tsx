import {
  Action, ActionPanel, Form, Icon, List, Toast, type Keyboard,
  closeMainWindow, getPreferenceValues, openExtensionPreferences, showToast,
} from "@raycast/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { CommandOutput } from "./command-output";
import { findFzf, resultLimit, searchHistory } from "./fzf";
import { historyFile, loadHistory } from "./history";
import { readRecent, recentKey, rememberRun } from "./recent";
import { loadSettings, type Settings } from "./settings";
import { openInTerminal } from "./terminal";

const runShortcut: Keyboard.Shortcut = { modifiers: ["cmd"], key: "return" };
const selectHistoryShortcut: Keyboard.Shortcut = { modifiers: ["ctrl"], key: "b" };
const inputId = "input";

function historyId(command: string) {
  return `history:${command}`;
}

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
  recentKey: string;
  shellPath?: string;
  terminalApp: string;
}

function searchInput(commands: string[]) {
  return Buffer.from(commands.length ? commands.join("\0") + "\0" : "");
}

export default function SearchShellHistory() {
  const [history, setHistory] = useState<History>();
  const [recent, setRecent] = useState<string[]>([]);
  const [binary, setBinary] = useState<{ path?: string; error?: string }>();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<string>();
  const [selectedId, setSelectedId] = useState(inputId);
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
        const file = historyFile(settings.historyFormat, settings.historyPath);
        const key = recentKey(settings.historyFormat, file);
        const [commands, previousRuns] = await Promise.all([
          loadHistory(settings.historyFormat, file),
          readRecent(key).catch(() => []),
        ]);
        if (active) {
          setRecent(previousRuns);
          setHistory({
            commands,
            recentKey: key,
            shellPath: settings.shellPath,
            terminalApp: settings.terminalApp,
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
  const inputs = useMemo(() => {
    if (!history) return;
    const previousRuns = new Set(recent);
    const otherCommands = history.commands.filter((command) => !previousRuns.has(command));
    return {
      initial: [...previousRuns, ...otherCommands.slice(0, resultLimit)].slice(0, resultLimit),
      standard: searchInput(otherCommands),
      recent: searchInput([...previousRuns]),
    };
  }, [history, recent]);

  useEffect(() => {
    if (editing || !inputs?.initial.length || !search || !binary?.path) return;
    const controller = new AbortController();
    const { signal } = controller;
    const executable = binary.path;
    void Promise.all([
      inputs.recent.length ? searchHistory(executable, inputs.recent, search, signal, true) : [],
      inputs.standard.length ? searchHistory(executable, inputs.standard, search, signal) : [],
    ]).then(
      ([recentMatches, matches]) => {
        if (!signal.aborted) setResult({ query: search, commands: [...recentMatches, ...matches].slice(0, resultLimit) });
      },
      (error: Error) => {
        if (!controller.signal.aborted) setResult({ query: search, commands: [], error: error.message });
      },
    );
    return () => controller.abort();
  }, [inputs, search, binary?.path, editing]);

  function handleTextChange(text: string) {
    setSelectedId(inputId);
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
  const commands = search ? result?.commands ?? inputs?.initial : inputs?.initial;
  const loading = !error && !editing && (!inputs || Boolean(inputs.initial.length && search && !current));

  function recordRun(command: string) {
    if (!history || command.startsWith(" ")) return;
    return rememberRun(history.recentKey, command).then(setRecent).catch((error: unknown) => {
      console.error("Could not save the recently run command", error);
    });
  }

  async function openCommand(command: string) {
    if (running.current || !command.trim()) return false;
    running.current = true;
    try {
      await openInTerminal(command, history?.shellPath, history?.terminalApp);
    } catch (error) {
      running.current = false;
      await showToast({ style: Toast.Style.Failure, title: "Could Not Open Command", message: (error as Error).message });
      return false;
    }
    try {
      await recordRun(command);
      setDraft(undefined);
      setSelectedId(inputId);
      await closeMainWindow();
      return true;
    } finally {
      running.current = false;
    }
  }

  const rows = useMemo(() => commands?.map((command) => ({
    id: historyId(command),
    command,
    title: command.replace(/\n/g, " ↵ "),
    multiline: /[\r\n]/.test(command),
  })), [commands]);
  const firstHistoryId = rows?.[0]?.id;
  const text = draft ?? query;

  return (
    <List
      searchBarPlaceholder={editing ? "Edit command…" : "Search shell history…"}
      searchText={text}
      onSearchTextChange={handleTextChange}
      selectedItemId={rows?.some(({ id }) => id === selectedId) ? selectedId : inputId}
      onSelectionChange={(id) => setSelectedId(id ?? inputId)}
      filtering={false}
      isLoading={loading}
    >
      <List.Item
        id={inputId}
        icon={error ? Icon.ExclamationMark : Icon.Terminal}
        title={text || "Type a Command"}
        subtitle={error ?? (text ? "Current Input" : undefined)}
        actions={
          <ActionPanel>
            {text.trim() && (
              <>
                <Action.Push title="Run in Raycast" icon={Icon.Play} target={<CommandOutput command={text} shell={history?.shellPath} onStarted={() => { void recordRun(text); }} />} />
                <Action title="Run in Terminal" icon={Icon.Terminal} shortcut={runShortcut} onAction={() => openCommand(text)} />
              </>
            )}
            {firstHistoryId && (
              <Action title="Select First History Result" shortcut={selectHistoryShortcut} onAction={() => setSelectedId(firstHistoryId)} />
            )}
            <Action title="Open Extension Settings" icon={Icon.Gear} onAction={openExtensionPreferences} />
          </ActionPanel>
        }
      />
      {rows?.map(({ id, command, title, multiline }) => (
        <List.Item
          key={id}
          id={id}
          icon={Icon.Terminal}
          title={title}
          actions={
            <ActionPanel>
              {multiline ? (
                <Action.Push title="Edit Multiline Command" icon={Icon.Pencil} target={<EditMultilineCommand command={command} run={openCommand} />} />
              ) : (
                <Action title="Complete Command" icon={Icon.Pencil} onAction={() => {
                  setDraft(command);
                  setSelectedId(inputId);
                }} />
              )}
              <Action title="Run in Terminal" icon={Icon.Terminal} shortcut={runShortcut} onAction={() => openCommand(command)} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
