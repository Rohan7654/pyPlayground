import * as vscode from 'vscode';

export interface SessionData {
    code: string;
    lastRun?: {
        out: string;
        warn: string | null;
        err: string | null;
        version: string;
        timestamp: number;
    };
}

export class SessionStore {
    constructor(private ctx: vscode.ExtensionContext) {}

    private key(file: string) {
        return `pyPlayground.session.${file}`;
    }

    save(file: string, data: SessionData) {
        this.ctx.workspaceState.update(this.key(file), data);
    }

    load(file: string): SessionData | undefined {
        return this.ctx.workspaceState.get(this.key(file));
    }

    clear(file: string) {
        this.ctx.workspaceState.update(this.key(file), undefined);
    }
}
