# Shell History

Search your shell history in Raycast with fzf. Open **Search Shell History**, type a fuzzy query, and press **⌘ Return** to run the selected command. Press **Return** first to edit it in the search bar, then press **⌘ Return** to run the edited text. Clear the bar to start another search. Commands containing line breaks open a multiline editor when edited.

Commands launched from the extension are remembered locally in Raycast. Recent commands that match your search appear first, newest first. Commands starting with a space are omitted from this list, following fish's history convention.

## Settings

- **History Format** defaults to fish. Zsh and Bash-style one-command-per-line files are also supported.
- **History File** overrides the default file. The defaults are `$XDG_DATA_HOME/fish/fish_history` (or `~/.local/share/fish/fish_history`), `~/.zsh_history`, and `~/.bash_history`.
- **Terminal App** selects macOS Default, Terminal, Ghostty, or iTerm2. macOS Default follows the system's association for executable `.command` files.
- **Execution Shell** defaults to your macOS login shell. Set an executable path if you want to run commands in a different shell. Commands start in your home directory.
- **FZF Executable** can override the fzf binary detected on PATH or in standard Homebrew and Nix locations. Install fzf to enable fuzzy search.

You can also set `historyPath`, `shellPath`, and `fzfPath` in `~/.config/raycast/shell-history.json`. Raycast field values take precedence.
