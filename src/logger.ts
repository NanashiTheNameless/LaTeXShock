import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

type Level = 'info' | 'warn' | 'error' | 'debug';

/** Fixed-width level tags so the on-disk log keeps an aligned left column. */
const FILE_LEVEL: Record<Level, string> = {
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
};

/**
 * The extension's logging surface. Every line goes to both the LaTeXShock
 * output channel and a plain-text log file on disk, so what the extension
 * decided to do - especially what it sent to a real device - is still readable
 * after a reload, a crash, or a closed panel.
 *
 * The channel is a `LogOutputChannel`, which is what makes the output
 * colorized: VS Code renders these with the `log` grammar, tinting the
 * timestamp and the severity of each line, and gives the user a log-level
 * filter in the Output view's gear menu. (Raw ANSI escapes are not reliably
 * rendered in output channels, so severity is the supported route to color.)
 *
 * VS Code gives each window session its own `logUri` directory, so the file
 * rotates naturally per session rather than growing without bound.
 */
export class Logger implements vscode.Disposable {
  private readonly channel: vscode.LogOutputChannel;
  private stream: fs.WriteStream | undefined;

  /** Absolute path of the log file, or undefined if it couldn't be opened. */
  readonly filePath: string | undefined;

  constructor(logDirectory: vscode.Uri) {
    this.channel = vscode.window.createOutputChannel('LaTeXShock', { log: true });

    const target = path.join(logDirectory.fsPath, 'latexshock.log');
    try {
      fs.mkdirSync(logDirectory.fsPath, { recursive: true });
      this.stream = fs.createWriteStream(target, { flags: 'a' });
      // A failed write must never take the extension host down with it.
      this.stream.on('error', (err) => {
        this.stream = undefined;
        this.channel.error(`file logging disabled: ${err.message}`);
      });
      this.filePath = target;
    } catch (err) {
      this.filePath = undefined;
      this.channel.error(
        `could not open log file: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Routine activity: what was evaluated, what was sent. */
  info(message: string): void {
    this.channel.info(message);
    this.write('info', message);
  }

  /** Something was suppressed or is misconfigured, but nothing failed. */
  warn(message: string): void {
    this.channel.warn(message);
    this.write('warn', message);
  }

  /** A request failed, or the extension can't do what was asked. */
  error(message: string): void {
    this.channel.error(message);
    this.write('error', message);
  }

  /** Noise that only matters when diagnosing why nothing happened. */
  debug(message: string): void {
    this.channel.debug(message);
    this.write('debug', message);
  }

  /** Reveal the live output channel. */
  show(): void {
    this.channel.show();
  }

  /** Open the on-disk log file in an editor. */
  async showFile(): Promise<void> {
    if (!this.filePath) {
      void vscode.window.showWarningMessage('LaTeXShock: file logging is unavailable.');
      return;
    }
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(this.filePath));
    await vscode.window.showTextDocument(doc, { preview: false });
  }

  dispose(): void {
    this.stream?.end();
    this.stream = undefined;
    this.channel.dispose();
  }

  private write(level: Level, message: string): void {
    this.stream?.write(`${new Date().toISOString()} ${FILE_LEVEL[level]} ${message}\n`);
  }
}
