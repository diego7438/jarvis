// @ts-check
// This file runs INSIDE the webview (a sandboxed browser context), not in Node/VS Code
// It has no access to 'vscode' module APIs directly, only what acquireVsCodeApi() gives us

console.log('SCRIPT is running!');
console.log('sendBtn element:', document.getElementById('sendBtn'));
        
// Aquire once at the top - never call this more than once
const vscode = acquireVsCodeApi();
const messagesDiv = /** @type {HTMLElement} */ (document.getElementById('messages'));
const thinkingDiv = /** @type {HTMLElement} */ (document.getElementById('thinking')); // the next thing is a htmlelement

// Track Cumulative Context Usage
let totalConversationTokens = 0;
const CONTEXT_LIMIT = 4096;
const CONTEXT_WARNING_THRESHOLD = 3000; // warn before we get too close

window.addEventListener('message', event => {
    const message = event.data;

    if (message.command === 'addMessage') {
        const div = document.createElement('div');
        div.className = 'message ' + message.role;

        const label = document.createElement('div');
        label.className = 'role-label';
        label.textContent = message.role === 'user' ? 'YOU'
                            : message.role === 'error' ? 'ERROR'
                            : 'JARVIS';

        const content = document.createElement('div');
        if (message.role === 'assistant') {
            content.innerHTML = marked.parse(message.content);
        } else {
            content.textContent = message.content;
        }

        div.appendChild(label);
        div.appendChild(content);
        messagesDiv.appendChild(div);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    if (message.command === 'addMessage') {
        const div = document.createElement('div');
        div.className = 'message ' + message.role;

        const label = document.createElement('div');
        label.className = 'role-label';
        label.textContent = message.role === 'user' ? 'YOU':
                            message.role === 'error' ? 'ERROR': 'JARVIS';
        
        const content = document.createElement('div');
        if (message.role === 'assistant') {
            content.innerHTML = marked.parse(message.content);
        } else {
            content.textContent = message.content;
        }

        div.appendChild(label);
        div.appendChild(content);

        // NEW: show token count for this message
        const tokenBadge = document.createElement('div');
        const msgTokens = estimateTokens(message.content);
        totalConversationTokens += msgTokens;
        tokenBadge.textContent = msgTokens + ' tokens * ' + totalConversationTokens + '/' + CONTEXT_LIMIT + ' context';

        if (totalConversationTokens > CONTEXT_WARNING_THRESHOLD) {
            tokenBadge.classList.add('warning');
        }

        div.appendChild(tokenBadge);

        messagesDiv.appendChild(div);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    if (message.command === 'setThinking') {
        thinkingDiv.style.display = message.value ? 'block': 'none';
        if (message.value) {
            messagesDiv.appendChild(thinkingDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    }

    document.getElementById('stopBtn')?.addEventListener('click', () => {
        console.log('JARVIS: Stop button clicked');
        vscode.postMessage({ command: 'stopRequest' });
    });
});

// Everything below runs once, when the page first loads

// Simple client-side token estimate (mirrors my tested utils.ts logic)
// Added below a JSDoc @param tag right above function
/**
 * @param {string} text - The text to estimate tokens for.
 */
function estimateTokens(text) {
    if (!text) {return 0;}
    return Math.ceil(text.length / 4);
}

const tokenCounterDiv = /** @type {HTMLElement} */ (document.getElementById('tokenCounter'));
const userInputEl = /** @type {HTMLTextAreaElement} */ (document.getElementById('userInput'));
const sendBtn = /** @type {HTMLElement} */ (document.getElementById('sendBtn'));

userInputEl.addEventListener('input', () => {
    console.log('Input event fired!');
    const tokens = estimateTokens(userInputEl.value);
    console.log('Estimated tokens:', tokens);
    console.log('tokenCounterDiv: ', tokenCounterDiv);
    tokenCounterDiv.textContent = tokens + ' tokens';

    tokenCounterDiv.classList.remove('warning', 'danger');
    if (tokens > 2500) {
        tokenCounterDiv.classList.add('danger');
    } else if (tokens > 1500) {
        tokenCounterDiv.classList.add('warning'); 
    }
});

// Handle send button click
sendBtn.addEventListener('click', sendMessage);

// Handle Enter key (Shift+Enter for new line)
userInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function sendMessage() {
    console.log('sendMessage function called!');
    const text = userInputEl.value.trim();
    console.log('Input text:', text);
    if (!text) {return;}

    console.log('JARVIS: Sending message:', text);

    // Send to TypeScript backend
    vscode.postMessage({
        command: 'userMessage',
        text: text
    });

    // Clear input
    userInputEl.value = '';
}