// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { JarvisPanel } from './jarvisPanel';

import { exceedsTokenLimit, estimateTokenCount } from './utils';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('JARVIS is now online.');
	console.log('I await your command sir.');


	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('jarvis.ask', async () => {

		// Step 1: Grab the active text editor
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('JARVIS: No active editor found.');
			return;
		}

		// Grab the ENTIRE file content, not just a selection
		const fullFileText = editor.document.getText();
		const fileName = editor.document.fileName.split('/').pop();

		if (!fullFileText) {
			vscode.window.showErrorMessage('JARVIS: File appears to be empty, sir');
			return;
		}

		// Safety check: block oversized files before sending anything
		if (exceedsTokenLimit(fullFileText, 3000)) {
			const tokenCount = estimateTokenCount(fullFileText);
			vscode.window.showErrorMessage(
				'JARVIS: File too large (~${tokenCount} tokens, limit 3000). ' +
				'This file exceeds what I can safely and securely process, sir.'
			);
			return;
		}

		JarvisPanel.createOrShow(context.extensionUri);

		if (JarvisPanel.currentPanel) {
			await JarvisPanel.currentPanel.askAboutFile(fullFileText, fileName || 'unknown file');
		}

		// Step 2: Grab the highlighted text
		const selection = editor.selection;
		const selectedText = editor.document.getText(selection);
		if (!selectedText) {
			vscode.window.showErrorMessage('JARVIS: Please highlight some code first.');
			return;
		}

		// Safety check: block oversized selections before sending anything
		if (exceedsTokenLimit(selectedText, 3000)) {
			const tokenCount = estimateTokenCount(selectedText);
			vscode.window.showErrorMessage(
				'JARVIS: Selection too large (~${tokenCount} tokens, limit 3000).' +
				'Please select a smaller portion of code, sir.'
			);
			return;
		}

		// Step 3: Open or reveal the JARVIS panel
		JarvisPanel.createOrShow(context.extensionUri);


		// Step 4: Send selected text to panel
		if (JarvisPanel.currentPanel) {
			await JarvisPanel.currentPanel.ask(selectedText);
		}
	});

	// Command to just open JARVIS panel directly
	const openJarvis = vscode.commands.registerCommand('jarvis.open', () => {
		JarvisPanel.createOrShow(context.extensionUri);
	});

	// The code you place here will be executed every time your command is executed
	// Display a message box to the user
	context.subscriptions.push(disposable, openJarvis);
}

// This method is called when your extension is deactivated
export function deactivate() { }

/*
Come back to this:
context.subscriptions.push(disposable, openJarvis, askAboutFile);
*/
