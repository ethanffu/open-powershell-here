import { describe, expect, it } from 'vitest';
import { LINUX_TERMINALS } from '../src/terminals/linux/candidates';

describe('LINUX_TERMINALS', () => {
  it('places Ghostty as the highest priority terminal', () => {
    expect(LINUX_TERMINALS[0].id).toBe('ghostty');
    expect(LINUX_TERMINALS[0].displayName).toBe('Ghostty');
    expect(LINUX_TERMINALS[0].binary).toBe('ghostty');
  });

  it('builds proper working directory argument for Ghostty', () => {
    const ghostty = LINUX_TERMINALS.find((t) => t.id === 'ghostty');
    expect(ghostty).toBeDefined();
    expect(ghostty?.buildArgs('/home/user/vault')).toEqual([
      '--working-directory=/home/user/vault',
    ]);
  });

  it('builds proper working directory argument for Alacritty', () => {
    const alacritty = LINUX_TERMINALS.find((t) => t.id === 'alacritty');
    expect(alacritty?.buildArgs('/home/user/vault')).toEqual([
      '--working-directory',
      '/home/user/vault',
    ]);
  });

  it('builds proper working directory argument for Kitty', () => {
    const kitty = LINUX_TERMINALS.find((t) => t.id === 'kitty');
    expect(kitty?.buildArgs('/home/user/vault')).toEqual([
      '--directory',
      '/home/user/vault',
    ]);
  });

  it('builds proper working directory argument for WezTerm', () => {
    const wezterm = LINUX_TERMINALS.find((t) => t.id === 'wezterm');
    expect(wezterm?.buildArgs('/home/user/vault')).toEqual([
      'start',
      '--cwd',
      '/home/user/vault',
    ]);
  });

  it('builds proper working directory argument for Konsole', () => {
    const konsole = LINUX_TERMINALS.find((t) => t.id === 'konsole');
    expect(konsole?.buildArgs('/home/user/vault')).toEqual([
      '--workdir',
      '/home/user/vault',
    ]);
  });

  it('builds proper working directory argument for GNOME Terminal', () => {
    const gnome = LINUX_TERMINALS.find((t) => t.id === 'gnome-terminal');
    expect(gnome?.buildArgs('/home/user/vault')).toEqual([
      '--working-directory=/home/user/vault',
    ]);
  });

  it('builds proper working directory argument for Foot', () => {
    const foot = LINUX_TERMINALS.find((t) => t.id === 'foot');
    expect(foot?.buildArgs('/home/user/vault')).toEqual([
      '-D',
      '/home/user/vault',
    ]);
  });
});
