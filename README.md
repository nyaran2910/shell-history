# Shell History

Search your shell history in Raycast with fzf. The **Current Input** row starts selected and represents the text in the search bar. **Return** opens that text in an editable fish prompt. **⌘ Return** runs it.

Press **Ctrl+B** to select the first history result. From a history result, **Return** completes it into the search bar and **⌘ Return** runs it directly. Commands containing line breaks open a multiline editor when completed. Clear the bar to start another search.

With fish as the execution shell, commands run through the interactive prompt and follow fish's regular history settings. Preloading an editable prompt requires fish. Ghostty 1.3 or newer uses its built-in AppleScript API. macOS may ask you to allow Raycast to control Ghostty on the first launch.

Commands launched from the extension are remembered locally in Raycast. Recent commands that match your search appear first, newest first. Commands starting with a space are omitted from this list, following fish's history convention.

## Settings

- **History Format** defaults to fish. Zsh and Bash-style one-command-per-line files are also supported.
- **History File** overrides the default file. The defaults are `$XDG_DATA_HOME/fish/fish_history` (or `~/.local/share/fish/fish_history`), `~/.zsh_history`, and `~/.bash_history`.
- **Terminal App** selects macOS Default, Terminal, Ghostty, or iTerm2. macOS Default follows the system's association for executable `.command` files.
- **Execution Shell** defaults to your macOS login shell. Set an executable path if you want to run commands in a different shell. Commands start in your home directory.
- **FZF Executable** can override the fzf binary detected on PATH or in standard Homebrew and Nix locations. Install fzf to enable fuzzy search.

You can also set `historyPath`, `shellPath`, and `fzfPath` in `~/.config/raycast/shell-history.json`. Raycast field values take precedence.
