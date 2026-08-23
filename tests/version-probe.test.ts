import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PROBE_ARGS, PROBE_TIMEOUT_MS } from '../src/terminals/windows/types';

const { execFileMock } = vi.hoisted(() => ({ execFileMock: vi.fn() }));
vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

import { parseMajorVersion, probeMajorVersion } from '../src/terminals/windows/version-probe';

type ExecFileCallback = (
  error: Error | null,
  stdout: string,
  stderr: string,
) => void;

/** Simulate a successful `execFile` callback with the given stdout. */
function resolved(stdout: string) {
  return (
    _file: unknown,
    _args: unknown,
    _options: unknown,
    callback: ExecFileCallback,
  ) => {
    callback(null, stdout, '');
  };
}

/** Simulate a failed `execFile` callback with the given error code. */
function rejectedError(code: string, message = 'boom') {
  return (
    _file: unknown,
    _args: unknown,
    _options: unknown,
    callback: ExecFileCallback,
  ) => {
    const error = new Error(message) as NodeJS.ErrnoException;
    error.code = code;
    callback(error, '', '');
  };
}

describe('parseMajorVersion', () => {
  it('accepts 7', () => expect(parseMajorVersion('7')).toBe(7));
  it('accepts 8', () => expect(parseMajorVersion('8')).toBe(8));
  it('accepts 9 or higher', () => expect(parseMajorVersion('9')).toBe(9));
  it('accepts 7 with trailing CRLF', () => expect(parseMajorVersion('7\r\n')).toBe(7));
  it('accepts surrounding whitespace', () => expect(parseMajorVersion('  7  \r\n')).toBe(7));
  it('rejects PowerShell 6', () => expect(parseMajorVersion('6')).toBeNull());
  it('rejects PowerShell 5.1', () => expect(parseMajorVersion('5')).toBeNull());
  it('rejects non-numeric output', () => expect(parseMajorVersion('abc')).toBeNull());
  it('rejects empty output', () => expect(parseMajorVersion('')).toBeNull());
  it('rejects whitespace-only output', () => expect(parseMajorVersion(' \r\n ')).toBeNull());
  it('rejects partial versions', () => expect(parseMajorVersion('7.4')).toBeNull());
  it('rejects negative numbers', () => expect(parseMajorVersion('-7')).toBeNull());
});

describe('probeMajorVersion', () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it('accepts output "7"', async () => {
    execFileMock.mockImplementation(resolved('7'));
    await expect(probeMajorVersion('C:\\pwsh.exe')).resolves.toBe(7);
  });

  it('accepts output "8"', async () => {
    execFileMock.mockImplementation(resolved('8'));
    await expect(probeMajorVersion('C:\\pwsh.exe')).resolves.toBe(8);
  });

  it('accepts output "7\\r\\n"', async () => {
    execFileMock.mockImplementation(resolved('7\r\n'));
    await expect(probeMajorVersion('C:\\pwsh.exe')).resolves.toBe(7);
  });

  it('rejects PowerShell 6', async () => {
    execFileMock.mockImplementation(resolved('6'));
    await expect(probeMajorVersion('C:\\pwsh.exe')).resolves.toBeNull();
  });

  it('rejects non-numeric output', async () => {
    execFileMock.mockImplementation(resolved('abc'));
    await expect(probeMajorVersion('C:\\pwsh.exe')).resolves.toBeNull();
  });

  it('rejects empty output', async () => {
    execFileMock.mockImplementation(resolved(''));
    await expect(probeMajorVersion('C:\\pwsh.exe')).resolves.toBeNull();
  });

  it('returns null on timeout', async () => {
    execFileMock.mockImplementation(rejectedError('ETIMEDOUT'));
    await expect(probeMajorVersion('C:\\pwsh.exe')).resolves.toBeNull();
  });

  it('returns null on a non-zero exit code', async () => {
    execFileMock.mockImplementation(rejectedError('1'));
    await expect(probeMajorVersion('C:\\pwsh.exe')).resolves.toBeNull();
  });

  it('returns null when the executable does not exist', async () => {
    execFileMock.mockImplementation(rejectedError('ENOENT'));
    await expect(probeMajorVersion('C:\\missing\\pwsh.exe')).resolves.toBeNull();
  });

  it('uses the fixed probe arguments, no shell, hidden window, and a 5s timeout', async () => {
    execFileMock.mockImplementation(resolved('7'));
    await probeMajorVersion('C:\\pwsh.exe');
    expect(execFileMock).toHaveBeenCalledTimes(1);
    const [file, args, options] = execFileMock.mock.calls[0] as [
      string,
      string[],
      Record<string, unknown>,
    ];
    expect(file).toBe('C:\\pwsh.exe');
    expect(args).toEqual([...PROBE_ARGS]);
    expect(options.shell).toBe(false);
    expect(options.windowsHide).toBe(true);
    expect(options.timeout).toBe(PROBE_TIMEOUT_MS);
    expect(options.encoding).toBe('utf8');
  });

  it('honors a custom timeout', async () => {
    execFileMock.mockImplementation(resolved('7'));
    await probeMajorVersion('C:\\pwsh.exe', { timeoutMs: 1234 });
    const [, , options] = execFileMock.mock.calls[0] as [string, string[], Record<string, unknown>];
    expect(options.timeout).toBe(1234);
  });
});
