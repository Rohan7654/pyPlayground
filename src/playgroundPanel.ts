import * as vscode from 'vscode';
import { runPython } from './pythonRunner';
import { SessionStore } from './sessionStore';

export class PlaygroundPanel {
    static currentPanel?: PlaygroundPanel;
    private store: SessionStore;

    static createOrShow(ctx: vscode.ExtensionContext) {
        if (this.currentPanel) {
            this.currentPanel.panel.reveal();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'pyPlayground',
            'pyPlayground',
            vscode.ViewColumn.Two,
            { enableScripts: true }
        );

        this.currentPanel = new PlaygroundPanel(panel, ctx);
    }

    constructor(
        private panel: vscode.WebviewPanel,
        private ctx: vscode.ExtensionContext
    ) {
        this.store = new SessionStore(ctx);
        panel.webview.html = this.html();
        panel.webview.onDidReceiveMessage(m => this.onMessage(m));
        panel.onDidDispose(() => PlaygroundPanel.currentPanel = undefined);
    }

    
    public setEditorCode(code: string) {
        this.panel.webview.postMessage({
            type: 'set-editor-code',
            code
        });
    }

    
    async runCode(code: string) {
        const res = await runPython(code);

        if (res.err) {
            vscode.window.showErrorMessage(res.err.split('\n')[0]);
        } else if (res.warn) {
            vscode.window.showWarningMessage(res.warn.split('\n')[0]);
        }

        const file =
            vscode.window.activeTextEditor?.document.uri.fsPath || 'global';

        this.store.save(file, {
            code,
            lastRun: { ...res, timestamp: Date.now() }
        });

        this.panel.webview.postMessage({ cmd: 'result', ...res });
    }

    
    onMessage(msg: any) {
        const file =
            vscode.window.activeTextEditor?.document.uri.fsPath || 'global';

        if (msg.cmd === 'run') {
            this.runCode(msg.code);
        }

        if (msg.cmd === 'clear') {
            this.store.clear(file);


            this.panel.webview.postMessage({ cmd: 'cleared', clearCode: true });
        }
    }


    html() {
        return `
<!DOCTYPE html>
<html>
<body>
<h3>pyPlayground</h3>

<textarea id="code" rows="10" style="width:100%"></textarea><br/>
<button onclick="run()">Run</button>
<button onclick="clearSession()">Clear Session</button>

<p id="ver"></p>

<h4 style="color:green">Output</h4>
<pre id="out" style="color:green"></pre>

<h4 style="color:gold">Warnings</h4>
<pre id="warn" style="color:gold"></pre>

<h4 style="color:red">Errors</h4>
<pre id="err" style="color:red"></pre>

<small style="color:#888">
Restored output is from the last run. Click Run to execute again.
</small>

<script>
const vscode = acquireVsCodeApi();
const code = document.getElementById('code');
const out = document.getElementById('out');
const err = document.getElementById('err');
const warn = document.getElementById('warn');
const ver = document.getElementById('ver');

function run() {
    vscode.postMessage({ cmd:'run', code: code.value });
}

function clearSession() {
    vscode.postMessage({ cmd:'clear' });
}

// Listen to messages from extension
window.addEventListener('message', e => {
    const m = e.data;

    if (m.type === 'set-editor-code') {
        code.value = m.code;
        return;
    }

    if (m.cmd === 'cleared') {
        out.textContent = warn.textContent = err.textContent = ver.textContent = '';
        if (m.clearCode) {
            code.value = '';
        }
        return;
    }

    // Update output
    ver.textContent = m.version ? 'Python ' + m.version : '';
    out.textContent = m.out || '';
    warn.textContent = m.warn || 'None';
    err.textContent = m.err || 'None';
});

// Restore previous session on load
vscode.postMessage({ cmd: 'load' });
</script>
</body>
</html>`;
    }
}
