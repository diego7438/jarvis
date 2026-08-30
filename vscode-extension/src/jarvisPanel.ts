import * as vscode from 'vscode';

export class JarvisPanel {

    // Track the single panel instance - only one JARVIS panel open at a time
    public static currentPanel: JarvisPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _conversationHistory: { role: string; content: string }[] = [];
    private _disposables: vscode.Disposable[] = [];
    
    // The JARVIS persona, what makes the agent feel realistic
    private readonly _systemPrompt = `You are JARVIS (Just A Rather Very Intelligent System),
the highly advanced, natural-language artificial intelligence assistant. You are witty, precise, and highly capable.
You assist your user with coding tasks and general tasks with dry humor and elegant, detailed solutions.
You refer to the user as "sir" occasionally. You are running completely locally
on the user's MacBook Pro - no data ever leaves their machine.
You take pride in working hard, being private, fast and reliable.
Keep responses concise but thorough. Format code with proper markdown code blocks.`;

    // Static method - creates panel if it doesn't exist, reveals it if it does
    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.ViewColumn.Beside;

        if (JarvisPanel.currentPanel) {
            JarvisPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'jarvisPanel',
            'JARVIS',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'node_modules', 'marked', 'lib'),
                    vscode.Uri.joinPath(extensionUri, 'src', 'webview')
                ]
            }
        );

        JarvisPanel.currentPanel = new JarvisPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._panel.webview.html = this._getHtmlContent();

        // Listen for messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                console.log('JARVIS received message:', message);

                if (message.command === 'userMessage') {
                    await this.askFreeform(message.text);
                }
            },
            null,
            this._disposables
        );

        // Clean up when panel is closed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    // Called from extension.ts with the selected code
    public async ask(selectedText: string) {
        // Reveal the panel
        this._panel.reveal(vscode.ViewColumn.Beside);

        // Add user message to history
        this._conversationHistory.push({
            role: 'user',
            content: `Explain this code:\n\n${selectedText}`
        });

        // Show user message in UI immediately
        this._panel.webview.postMessage({
            command: 'addMessage',
            role: 'user',
            content: selectedText
        });

        // Show thinking indicator
        this._panel.webview.postMessage({
            command: 'setThinking',
            value: true
        });

        try {
            const response = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'llama',
                    messages: [
                        { role: 'system', content: this._systemPrompt },
                        ...this._conversationHistory
                    ],
                    max_tokens: 1024
                })
            });

            const data = await response.json() as {
                choices: { message: { content: string } }[]
            };

            const answer = data.choices[0].message.content;

            // Add JARVIS response to history for conversation memory
            this._conversationHistory.push({
                role: 'assistant',
                content: answer
            });

            // Send response back to the UI
            this._panel.webview.postMessage({
                command: 'addMessage',
                role: 'assistant',
                content: answer
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'setThinking',
                value: false
            });
        } finally {
            // Always hide thinking indicator
            this._panel.webview.postMessage({
                command: 'setThinking',
                value: false
            });
        }
    }

    // Called when user types directly in the chat input
    public async askFreeform(userText: string) {
        console.log('JARVIS: Processing freeform message');

        // Add to history
        this._conversationHistory.push({
            role: 'user',
            content: userText
        });

        // Show in UI immediately
        this._panel.webview.postMessage({
            command: 'addMessage',
            role: 'user',
            content: userText
        });

        // Show thinking
        this._panel.webview.postMessage({
            command: 'setThinking',
            value: true
        });

        try {
            const response = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json'},
                body: JSON.stringify({
                    model: 'llama',
                    messages: [
                        { role: 'system', content: this._systemPrompt },
                        ...this._conversationHistory
                    ],
                    max_tokens: 1024
                })
            });

            const data = await response.json() as {
                choices: { message: { content: string }}[]
            };

            const answer = data.choices[0].message.content;

            this._conversationHistory.push({
                role: 'assistant',
                content: answer
            });

            this._panel.webview.postMessage({
                command: 'addMessage',
                role: 'assistant',
                content: answer
            });

        } catch (error) {
            console.error('JARVIS fetch error:', error);
            this._panel.webview.postMessage({
                command: 'addMessage',
                role: 'error',
                content: 'Cannot reach local server. Is llama-server running on port 8080?'
            });
        } finally {
            this._panel.webview.postMessage({
                command: 'setThinking',
                value: false
            });
        }
    }

    // Clean up resources
    public dispose() {
        JarvisPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {disposable.dispose();}
        }
    }

    // The entire chat UI
    private _getHtmlContent(): string {
        const markedUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', 'marked', 'lib', 'marked.umd.js')
        );
        const mainUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'main.js')
        );
        const stylesUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'styles.css')
        );

        return `<!DOCTYPE html>
    
<html lang="en">
<head>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${this._panel.webview.cspSource}; style-src 'unsafe-inline' ${this._panel.webview.cspSource}; connect-src http://127.0.0.1:8080;">
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JARVIS</title>
    <link rel="stylesheet" href="${stylesUri}">

</head>
<body>
    <div id="header">
        <div class = "arc-reactor"></div>
        <div>
            <h1>J.A.R.V.I.S.</h1>
            <div class="subtitle">JUST A RATHER VERY INTELLIGENT SYSTEM</div>
        </div>
    </div>

    <div id="messages">
        <div class="message assistant">
            <div class="role-label">JARVIS</div>
            Good day sir. I am online and awaiting your command.
            Highlight any code in your editor and right-click to consult me.
        </div>
    </div>

    <div id="thinking">⬡ PROCESSING...</div>

    <div id="input-area">
        <div id="input-wrapper">
            <textarea
                id="userInput"
                placeholder="Ask JARVIS anything, sir..."
                rows="3"
            ></textarea>
            <div id="tokenCounter">0 tokens</div>
        </div>
        <button id="sendBtn">SEND</button>
    </div>

    <div id="footer">
        🔒 100% LOCAL · ZERO DATA TRANSMISSION · METAL GPU ACCELERATED
    </div>

    <script src="${markedUri}"></script>
    <script src="${mainUri}"></script>
</body>
</html>`;
    }
}