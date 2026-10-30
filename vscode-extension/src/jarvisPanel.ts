import * as vscode from 'vscode';
import * as fs from 'fs';

export class JarvisPanel {

    // Track the single panel instance - only one JARVIS panel open at a time
    public static currentPanel: JarvisPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _conversationHistory: { role: string; content: string }[] = [];
    private _disposables: vscode.Disposable[] = [];
    private _abortController: AbortController | undefined;

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

                if (message.command === 'stopRequest') {
                    this.cancelRequest();
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

        this._abortController = new AbortController();
        try {
            const response = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: this._abortController.signal,
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
            // Check if this was a user-initiated cancellation vs a real error
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('JARVIS: Request was cancelled by user');
                this._panel.webview.postMessage({
                    command: 'addMessage',
                    role: 'error',
                    content: 'Request cancelled, sir.'
                });
            } else {
                console.error('JARVIS fetch error:', error);
                this._panel.webview.postMessage({
                    command: 'addMessage',
                    role: 'error',
                    content: 'Cannot reach local server. Is llama-server running on port 8080?'
                });
            }
        } finally {
            this._panel.webview.postMessage({
                command: 'setThinking',
                value: false
            });
            this._abortController = undefined;
        }
    }

    public async askAboutFile(fileContent: string, fileName: string) {
        // 1. reveal the panel (same call as in ask())
        
        // Reveal the panel
        this._panel.reveal(vscode.ViewColumn.Beside);

        // 2. build userPrompt as a BACKTICK string containing fileName and fileContent
        const userPrompt = `Here is the fulle contents of ${fileName}:\n\n${fileContent}\n\nWhat can you tell me about this file?`;
        
        // 3. push { role: 'user', content: userPrompt } to history
        // Add user message to history
        this._conversationHistory.push({
            role: 'user',
            content: userPrompt
        });
        
        // 4. postMessage addMessage / role 'user' / content: `[Sent entire file: ${fileName}]`
        this._panel.webview.postMessage({
            command: 'addMessage',
            role: 'user',
            content: `[Sent entire file: ${fileName}]`
        });
        
        // 5. postMessage setThinking true
        this._panel.webview.postMessage({
            command: 'setThinking',
            value: true
        });

        // 6. this._abortController = new AbortController();
        this._abortController = new AbortController();

        // 7. try / catch / finally, identical to askFreeform's
        try {
            const response = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: this._abortController.signal,
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
            // Check if this was a user-initiated cancellation vs a real error
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('JARVIS: Request was cancelled by user');
                this._panel.webview.postMessage({
                    command: 'addMessage',
                    role: 'error',
                    content: 'Request cancelled, sir.'
                });
            } else {
                console.error('JARVIS fetch error:', error);
                this._panel.webview.postMessage({
                    command: 'addMessage',
                    role: 'error',
                    content: 'Cannot reach local server. Is llama-server running on port 8080?'
                });
            }
        } finally {
            this._panel.webview.postMessage({
                command: 'setThinking',
                value: false
            });
            this._abortController = undefined;
        }
    }

    // Clean up resources
    public dispose() {
        JarvisPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) { disposable.dispose(); }
        }
    }

    public cancelRequest() {
        if (this._abortController) {
            this._abortController.abort();
        }
    }

    // The entire chat UI
    private _getHtmlContent(): string {
        const webview = this._panel.webview;
        const webviewDir = vscode.Uri.joinPath(this._extensionUri, 'src', 'webview');

        const values: Record<string, string> = {
            CSP_SOURCE: webview.cspSource,
            STYLES_URI: webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, 'styles.css')).toString(),
            MARKED_URI: webview.asWebviewUri(
                vscode.Uri.joinPath(this._extensionUri, 'node_modules', 'marked', 'lib', 'marked.umd.js')
            ).toString(),
            MAIN_URI: webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, 'main.js')).toString(),
        };

        const templatePath = vscode.Uri.joinPath(webviewDir, 'template.html').fsPath;
        const template = fs.readFileSync(templatePath, 'utf8');

        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] ?? match);

    }
}



/* Fix later:
*/