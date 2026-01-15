import * as vscode from 'vscode';
import { PlaygroundPanel } from "./playgroundPanel";

export function activate(context: vscode.ExtensionContext) {

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'pyPlayground.open',
            () => PlaygroundPanel.createOrShow(context)
        ),

        vscode.commands.registerCommand(
            'pyPlayground.runSelection',
            () => {
                if (!vscode.workspace.isTrusted) {
                    vscode.window.showWarningMessage(
                        'Workspace is untrusted. Python execution is disabled.'
                    );
                    return;
                }

                const editor = vscode.window.activeTextEditor;
                if (!editor || editor.selection.isEmpty) {
                    vscode.window.showWarningMessage('No Python code selected');
                    return;
                }

                const code = editor.document.getText(editor.selection);
                PlaygroundPanel.createOrShow(context);
                PlaygroundPanel.currentPanel?.setEditorCode(code);
                PlaygroundPanel.currentPanel?.runCode(code);
            }
        )
    );
}

export function deactivate() {}
