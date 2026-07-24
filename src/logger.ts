import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * The extension's logging surface. Every line goes to both the LaTeXShock
 * output channel (live view) and a plain-text log file on disk, so what the
 * extension decided to do - especially what it sent to a real device - is
 * still readable after a reload, a crash, or a closed panel.
 *
 * VS Code gives each window session its own `logUri` directory, so the file
 * rotates naturally per session rather than growing without bound.
 */
export class Logger implements vscode.Disposable {
  private readonly channel: vscode.OutputChannel;
  private stream: fs.WriteStream | undefined;

  /** Absolute path of the log file, or undefined if it couldn't be opened. */
  readonly filePath: string | undefined;

  constructor(logDirectory: vscode.Uri) {
    this.channel = vscode.window.createOutputChannel('LaTeXShock');

    const target = path.join(logDirectory.fsPath, 'latexshock.log');
    try {
      fs.mkdirSync(logDirectory.fsPath, { recursive: true });
      this.stream = fs.createWriteStream(target, { flags: 'a' });
      // A failed write must never take the extension host down with it.
      this.stream.on('error', (err) => {
        this.stream = undefined;
        this.channel.appendLine(`[log] file logging disabled: ${err.message}`);
      });
      this.filePath = target;
    } catch (err) {
      this.filePath = undefined;
      this.channel.appendLine(
        `[log] could not open log file: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  appendLine(message: string): void {
    this.channel.appendLine(message);
    this.stream?.write(`${new Date().toISOString()} ${message}\n`);
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
}
