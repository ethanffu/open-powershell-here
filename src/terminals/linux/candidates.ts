import type { LinuxTerminalSpec } from './types';

/**
 * Ordered list of supported Linux terminal emulators.
 *
 * Ghostty is prioritized first as recommended by the author, followed by
 * popular modern and desktop-native terminal emulators.
 */
export const LINUX_TERMINALS: readonly LinuxTerminalSpec[] = [
  {
    id: 'ghostty',
    displayName: 'Ghostty',
    binary: 'ghostty',
    buildArgs: (dir) => [`--working-directory=${dir}`],
  },
  {
    id: 'alacritty',
    displayName: 'Alacritty',
    binary: 'alacritty',
    buildArgs: (dir) => ['--working-directory', dir],
  },
  {
    id: 'kitty',
    displayName: 'Kitty',
    binary: 'kitty',
    buildArgs: (dir) => ['--directory', dir],
  },
  {
    id: 'wezterm',
    displayName: 'WezTerm',
    binary: 'wezterm',
    buildArgs: (dir) => ['start', '--cwd', dir],
  },
  {
    id: 'konsole',
    displayName: 'Konsole',
    binary: 'konsole',
    buildArgs: (dir) => ['--workdir', dir],
  },
  {
    id: 'gnome-terminal',
    displayName: 'GNOME Terminal',
    binary: 'gnome-terminal',
    buildArgs: (dir) => [`--working-directory=${dir}`],
  },
  {
    id: 'xfce4-terminal',
    displayName: 'XFCE4 Terminal',
    binary: 'xfce4-terminal',
    buildArgs: (dir) => [`--working-directory=${dir}`],
  },
  {
    id: 'foot',
    displayName: 'Foot',
    binary: 'foot',
    buildArgs: (dir) => ['-D', dir],
  },
  {
    id: 'x-terminal-emulator',
    displayName: 'Terminal',
    binary: 'x-terminal-emulator',
    buildArgs: () => [],
  },
] as const;
