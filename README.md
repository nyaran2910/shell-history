# Shell History

Search your shell history in Raycast with fzf. Open **Search Shell History**, type a fuzzy query, and press **Return** to complete the selected command in the search bar. Edit it or append arguments, then press **⌘ Return** to run it. Clear the bar to start another search. Commands containing line breaks open a multiline editor to preserve their syntax.

## Settings

- **History Format** defaults to fish. Zsh and Bash-style one-command-per-line files are also supported.
- **History File** overrides the default file. The defaults are `$XDG_DATA_HOME/fish/fish_history` (or `~/.local/share/fish/fish_history`), `~/.zsh_history`, and `~/.bash_history`.
- **Execution Shell** defaults to your macOS login shell. Set an executable path if you want to run commands in a different shell. Commands start in your home directory.
- **FZF Executable** can override the fzf binary detected on PATH or in standard Homebrew and Nix locations. Install fzf to enable fuzzy search.

You can also set `historyPath`, `shellPath`, and `fzfPath` in `~/.config/raycast/shell-history.json`. Raycast field values take precedence.

Commands open through the macOS default application for executable `.command` files (Terminal.app on a standard macOS setup).
