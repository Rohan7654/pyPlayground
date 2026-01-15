import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

const TIMEOUT_MS = 5000;
const MAX_OUTPUT = 20000;


function indent(code: string, spaces = 4): string {
    const pad = ' '.repeat(spaces);
    return code
        .trimEnd()
        .split('\n')
        .map(line => (line.trim() ? pad + line : line))
        .join('\n');
}


export async function getPythonPath(): Promise<string> {
    const ext = vscode.extensions.getExtension('ms-python.python');
    if (!ext) {
        vscode.window.showErrorMessage(
            'Python extension is required to run pyPlayground.'
        );
        throw new Error('Python extension not found');
    }

    const api = ext.isActive ? ext.exports : await ext.activate();
    const env = await api.environments.getActiveEnvironmentPath();
    return env.path;
}


export async function runPython(code: string): Promise<{
    out: string;
    warn: string | null;
    err: string | null;
    version: string;
}> {
    const python = await getPythonPath();
    const tmpFile = path.join(os.tmpdir(), `pyPlayground_${Date.now()}.py`);
    const safeCode = indent(code);

    fs.writeFileSync(
        tmpFile,
        `
import sys
import traceback
import warnings

print("VERSION::", sys.version)

_collected_warnings = []

def _capture_warning(message, category, filename, lineno, **kwargs):
    _collected_warnings.append(
        f"{filename}:{lineno} {category.__name__}: {message}" if message else None
    )

warnings.showwarning = _capture_warning

try:
${safeCode}
except Exception:
    print("ERROR::")
    traceback.print_exc()
finally:
    if _collected_warnings:
        print("WARN::")
        for w in _collected_warnings:
            print(w)
`
    );

    return new Promise(resolve => {
        let stdout = '';
        let stderr = '';

        const proc = spawn(python, [tmpFile], {
            windowsHide: true
        });

        const timeout = setTimeout(() => {
            proc.kill();
        }, TIMEOUT_MS);

        proc.stdout.on('data', d => (stdout += d.toString()));
        proc.stderr.on('data', d => (stderr += d.toString()));

        proc.on('close', () => {
            clearTimeout(timeout);
            fs.unlinkSync(tmpFile);

            let version = '';
            let out = '';
            let warn = '';
            let err = '';

            let mode: 'out' | 'warn' | 'err' = 'out';

            for (const line of stdout.split('\n')) {
                if (line.startsWith('VERSION::')) {
                    version = line.replace('VERSION::', '').trim();
                } else if (line.startsWith('ERROR::')) {
                    mode = 'err';
                } else if (line.startsWith('WARN::')) {
                    mode = 'warn';
                } else {
                    if (mode === 'out') out += line + '\n';
                    if (mode === 'warn') warn += line + '\n';
                    if (mode === 'err') err += line + '\n';
                }
            }

            if (stderr.trim()) {
                err += stderr;
            }

            if (out.length > MAX_OUTPUT) {
                out = out.slice(0, MAX_OUTPUT) + '\n…output truncated';
            }

            resolve({
                out: out.trim(),
                warn: warn.trim() || null,
                err: err.trim() || null,
                version
            });
        });
    });
}
