const BACKEND_BASE_URL = window.PROMPTBANKEN_API_BASE_URL || window.location.origin.replace(/\/$/, '');

const modelSelect = document.getElementById('local-chat-model-select');
const statusElement = document.getElementById('local-chat-status');
const messagesElement = document.getElementById('local-chat-messages');
const formElement = document.getElementById('local-chat-form');
const inputElement = document.getElementById('local-chat-input');
const sendButton = document.getElementById('local-chat-send');
const stopButton = document.getElementById('local-chat-stop');
const resetButton = document.getElementById('local-chat-reset');

const conversationMessages = [];
let abortController = null;
let isGenerating = false;
let shouldAutoScroll = true;

function setStatus(state, text) {
    statusElement.dataset.state = state;
    statusElement.textContent = text;
}

function scrollToBottom(force = false) {
    if (!force && !shouldAutoScroll) {
        return;
    }
    requestAnimationFrame(() => {
        messagesElement.scrollTop = messagesElement.scrollHeight;
    });
}

function createCopyButton(contentGetter) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'assistant-copy-btn';
    button.textContent = 'Kopiera';

    button.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(contentGetter());
            const originalText = button.textContent;
            button.textContent = 'Kopierat';
            setTimeout(() => {
                button.textContent = originalText;
            }, 1200);
        } catch (_error) {
            button.textContent = 'Fel';
            setTimeout(() => {
                button.textContent = 'Kopiera';
            }, 1200);
        }
    });

    return button;
}

function appendMessage(role, content) {
    const row = document.createElement('article');
    row.className = `chat-message chat-message-${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    const text = document.createElement('div');
    text.className = 'chat-text';
    text.textContent = content;
    bubble.appendChild(text);

    if (role === 'assistant') {
        const copyButton = createCopyButton(() => text.textContent || '');
        bubble.appendChild(copyButton);
    }

    row.appendChild(bubble);
    messagesElement.appendChild(row);
    scrollToBottom();

    return text;
}

function setGeneratingState(generating) {
    isGenerating = generating;
    sendButton.disabled = generating;
    modelSelect.disabled = generating;
    stopButton.disabled = !generating;
}

async function fetchLocalModels() {
    const response = await fetch(`${BACKEND_BASE_URL}/api/models`);
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail?.message || data.detail || 'Kunde inte hämta modeller.');
    }

    const data = await response.json();
    return data.models || [];
}

async function populateModels() {
    modelSelect.innerHTML = '<option value="">Laddar modeller...</option>';

    try {
        const models = await fetchLocalModels();
        if (!models.length) {
            modelSelect.innerHTML = '<option value="">Inga modeller hittades</option>';
            return;
        }

        modelSelect.innerHTML = models
            .map((model) => `<option value="${model.name}">${model.name}</option>`)
            .join('');
    } catch (error) {
        modelSelect.innerHTML = '<option value="">Kunde inte hämta modeller</option>';
        setStatus('error', `Fel: ${error.message}`);
    }
}

async function streamAssistantReply() {
    const model = modelSelect.value;
    if (!model) {
        setStatus('error', 'Välj en modell.');
        return;
    }

    const assistantTextNode = appendMessage('assistant', '');
    setGeneratingState(true);
    setStatus('writing', 'Skriver…');
    abortController = new AbortController();

    try {
        const response = await fetch(`${BACKEND_BASE_URL}/api/chat/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages: conversationMessages }),
            signal: abortController.signal
        });

        if (!response.ok || !response.body) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail?.message || data.detail || 'Körning misslyckades.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let responseText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            if (!chunk) continue;

            responseText += chunk;
            assistantTextNode.textContent = responseText;
            scrollToBottom();
        }

        const trailing = decoder.decode();
        if (trailing) {
            responseText += trailing;
            assistantTextNode.textContent = responseText;
            scrollToBottom();
        }

        if (!responseText.trim()) {
            assistantTextNode.textContent = '(Tomt svar från modellen)';
        }

        conversationMessages.push({ role: 'assistant', content: assistantTextNode.textContent });
        setStatus('done', 'Klar');
    } catch (error) {
        if (error.name === 'AbortError') {
            setStatus('aborted', 'Avbruten');
        } else {
            setStatus('error', `Fel: ${error.message}`);
            assistantTextNode.textContent = `⚠️ ${error.message}`;
        }
    } finally {
        abortController = null;
        setGeneratingState(false);
    }
}

async function sendUserMessage(content) {
    const text = content.trim();
    if (!text || isGenerating) {
        return;
    }

    appendMessage('user', text);
    conversationMessages.push({ role: 'user', content: text });
    await streamAssistantReply();
}

function resetChat() {
    if (abortController) {
        abortController.abort();
    }
    conversationMessages.length = 0;
    messagesElement.innerHTML = '';
    setGeneratingState(false);
    setStatus('done', 'Klar');
    inputElement.value = '';
    shouldAutoScroll = true;
}

function consumeSeedPrompt() {
    try {
        const rawSeed = sessionStorage.getItem('promptbankenLocalChatSeed');
        if (!rawSeed) {
            return null;
        }

        sessionStorage.removeItem('promptbankenLocalChatSeed');
        const seed = JSON.parse(rawSeed);
        return seed?.prompt?.trim() ? seed.prompt : null;
    } catch (_error) {
        return null;
    }
}

messagesElement.addEventListener('scroll', () => {
    const distanceFromBottom = messagesElement.scrollHeight - messagesElement.scrollTop - messagesElement.clientHeight;
    shouldAutoScroll = distanceFromBottom < 40;
});

formElement.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = inputElement.value;
    inputElement.value = '';
    await sendUserMessage(value);
});

stopButton.addEventListener('click', () => {
    if (abortController) {
        abortController.abort();
    }
});

resetButton.addEventListener('click', resetChat);

window.addEventListener('DOMContentLoaded', async () => {
    await populateModels();
    setStatus('done', 'Klar');

    const seedPrompt = consumeSeedPrompt();
    if (seedPrompt) {
        await sendUserMessage(seedPrompt);
    }
});
