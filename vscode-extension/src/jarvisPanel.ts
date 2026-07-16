import * as vscode from 'vscode';

export class JarvisPanel {

    // Track the single panel instance - only one JARVIS panel open at a time
    public static currentPanel: JarvisPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
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
            }
        );

        JarvisPanel.currentPanel = new JarvisPanel(panel);
    }

    private constructor(panel: vscode.WebviewPanel) {
        this._panel = panel;
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
        )

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
    }

    // Clean up resources
    public dispose() {
        JarvisPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) disposable.dispose();
        }
    }

    // The entire chat UI - HTML/CSS/JS running inside VS Code
    private _getHtmlContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JARVIS</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #0a0a0f;
            color: #e0e0e0;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        #header {
            padding: 16px 20px;
            background: #0d0d1a;
            border-bottom: 1px solid #1a3a5c;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        #header h1 {
            font-size: 18px;
            font-weight: 600;
            color: #4fc3f7;
            letter-spacing: 3px;
        }

        #header .subtitle {
            font-size: 11px;
            color: #546e7a;
            letter-spacing: 1px;
        }

        .arc-reactor {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: radial-gradient(circle, #4fc3f7, #0288d1, #01579b);
            box-shadow: 0 0 15px #4fc3f7, 0 0 30px #0288d1;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { box-shadow: 0 0 15px #4fc3f7, 0 0 30px #0288d1; }
            50% { box-shadow: 0 0 25px #4fc3f7, 0 0 50px #0288d1; }
        }

        #messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .message {
            max-width: 90%;
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 13px;
            line-height: 1.6;
            animation: fadeIn 0.35s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .message.user {
            background: #1a2a3a;
            border: 1px solid #1a3a5c;
            align-self: flex-end;
            color: #90caf9;
            font-family: 'Courier New', monospace; 
            font-size: 12px;
            white-space: pre-wrap;
        }

        .message.assistant {
            background: #0d1a0d;
            border: 1px solid #1a3a1a;
            align-self: flex-start;
            color: #e0e0e0;
        }

        .message.error {
            background: #1a0d0d;
            border: 1px solid #3a1a1a;
            align-self: flex-start;
            color: #ef9a9a;
        }

        .role-label {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 2px;
            margin-bottom: 6px;
            opacity: 0.7;
        }

        .user .role-label { color: #4fc3f7; }
        .assistant .role-label { color: #81c784; }
        .error .role-label { color: #ef9a9a; }

        pre {
            background: #111;
            border: 1px solid #222;
            border-radius: 6px;
            padding: 10px;
            overflow-x: auto;
            margin: 8px 0;
            font-size: 12px;
        }

        code { font-family: 'Courier New', monospace; }

        #thinking {
            display: none;
            align-self: flex-start;
            padding: 12px 16px;
            color: #4fc3f7;
            font-size: 12px;
            letter-spacing: 1px;
            animation: blink 1.5s infinite;
        }

        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }

        #footer {
            padding: 12px 20px;
            background: #0d0d1a;
            border-top: 1px solid #1a3a5c;
            font-size: 10px;
            color: #37474f;
            letter-spacing: 1px;
            text-align: center;
        }

        #input-area {
            padding:12px 20px;
            background: #0d0d1a;
            border-top: 1px solid #1a3a5c;
            display: flex;
            gap: 10px;
            align-items: flex-end;
        }

        #userInput {
            flex: 1;
            background: #111827;
            border: 1px solid #1a3a5c;
            border-radius: 8px;
            color: #e0e0e0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 13px;
            padding: 10px 12px;
            resize: none;
            outline: none;
            line-height: 1.5;
        }

        #userInput: focus {
            border-color: #4fc3f7;
            box-shadow: 0 0 8px rgba(79, 195, 247, 0.2);
        }

        #sendBtn {
            background: #0288d1;
            border: none;
            border-radius: 8px;
            color: white;
            cursor: pointer;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 2px;
            padding: 10px 16px;
            transition: background 0.2s;
        }

        #sendBtn: hover {
            background: #3fc3f7;
            box-shadow: 0 0 12px rgba(79, 195, 247, 0.4);
        }
    </style>
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

    <div id = "input-area">
        <textarea
            id = "userInput"
            placeholder = "Ask JARVIS anything, sir..."
            rows = "3"
        ></textarea>
        <button id="sendBtn">SEND</button>
    </div>

    <div id="footer">
        🔒 100% LOCAL · ZERO DATA TRANSMISSION · METAL GPU ACCELERATED
    </div>

    <script>
        const messagesDiv = document.getElementById('messages');
        const thinkingDiv = document.getElementById('thinking');

        window.addEventListener('message', event => {
            const message = event.data;

            if (message.command === 'addMessage') {
                const div = document.createElement('div');
                div.className = 'message ' + message.role;

                const label = document.createElement('div');
                label.className = 'role-label';
                label.textContent = message.role == 'user' ? 'YOU':
                                    message.role === 'error' ? 'ERROR': 'JARVIS';
                
                const content = document.createElement('div');
                content.textContent = message.content;

                div.appendChild(label);
                div.appendChild(content);
                messagesDiv.appendChild(div);
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }

            if (message.command === 'setThinking') {
                thinkingDiv.style.display = message.value ? 'block' : 'none';
                if (message.value) {
                    messagesDiv.appendChild(thinkingDiv);
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                }
            }
        });

        // Handle send button click
        document.getElementById('sendBtn').addEventListener('click', sendMessage);

        // Handle Enter key (Shift+Enter for new line)
        document.getElementById('userInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        function sendMessage() {
            const input = document.getElementById('userInput');
            const text = input.value.trim();

            if (!text) return;

            console.log('JARVIS: Sending message:', text);

            // Send to TypeScript backend
            vscode.acquireVsCodeApi().postMessage({
                command: 'userMessage',
                text: text
            });

            // Clear input
            input.value = '';
        }
    </script>
</body>
</html>`;
    }
}