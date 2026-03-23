const BACKEND_BASE_URL = window.PROMPTBANKEN_API_BASE_URL || window.location.origin.replace(/\/$/, '');

const modelSelect = document.getElementById('direct-chat-model-select');
const statusElement = document.getElementById('direct-chat-status');
const messagesElement = document.getElementById('direct-chat-messages');
const formElement = document.getElementById('direct-chat-form');
const inputElement = document.getElementById('direct-chat-input');
const sendButton = document.getElementById('direct-chat-send');
const stopButton = document.getElementById('direct-chat-stop');
const resetButton = document.getElementById('direct-chat-reset');
const expandButton = document.getElementById('direct-chat-expand');
const chatShellElement = document.querySelector('.local-chat-shell');
const alertElement = document.getElementById('direct-chat-alert');
const alertTextElement = document.getElementById('direct-chat-alert-text');
const sessionModelElement = document.getElementById('direct-chat-session-model');

const conversationMessages = [];
let abortController = null;
let isGenerating = false;
let shouldAutoScroll = true;
const DRAFT_STORAGE_KEY = 'promptbankenDirectChatDraft';

function setStatus(state, text) {
    statusElement.dataset.state = state;
    statusElement.textContent = text;
}

function setConnectionAlert(message = '') {
    if (!alertElement || !alertTextElement) {
        return;
    }

    if (!message) {
        alertElement.classList.remove('is-visible');
        alertTextElement.textContent = 'Kontrollera att backend ar igang och att OpenAI ar konfigurerat.';
        return;
    }

    alertTextElement.textContent = message;
    alertElement.classList.add('is-visible');
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
        bubble.appendChild(createCopyButton(() => text.textContent || ''));
    }

    row.appendChild(bubble);
    messagesElement.appendChild(row);
    scrollToBottom();
    return text;
}

function getSeedData() {
    return window.__PROMPTBANKEN_DIRECT_CHAT_SEED__ || null;
}

function updateSessionModelLabel() {
    if (!sessionModelElement) {
        return;
    }
    sessionModelElement.textContent = modelSelect.value || 'Inte vald';
}

function resizeInput() {
    if (!inputElement) {
        return;
    }
    inputElement.style.height = 'auto';
    const nextHeight = Math.min(Math.max(inputElement.scrollHeight, 84), 220);
    inputElement.style.height = `${nextHeight}px`;
}

function saveDraft() {
    try {
        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ input: inputElement.value || '' }));
    } catch (_error) {
        // Ignore storage failures.
    }
}

function loadDraft() {
    try {
        const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
        if (!raw) {
            return;
        }
        const draft = JSON.parse(raw);
        if (!inputElement.value.trim() && draft?.input) {
            inputElement.value = draft.input;
            resizeInput();
        }
    } catch (_error) {
        // Ignore storage failures.
    }
}

function clearDraft() {
    try {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (_error) {
        // Ignore storage failures.
    }
}

function hasUnsavedDraft() {
    return Boolean(inputElement?.value.trim()) && !isGenerating;
}

function buildRequestMessages() {
    const messages = [];
    const systemInstruction = String(getSeedData()?.prompt || '').trim();
    if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
    }
    return messages.concat(conversationMessages);
}

function setGeneratingState(generating) {
    isGenerating = generating;
    sendButton.disabled = generating;
    modelSelect.disabled = generating;
    stopButton.disabled = !generating;
}

async function fetchOpenAIModels() {
    const response = await fetch(`${BACKEND_BASE_URL}/api/openai/models`);
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail?.message || data.detail || 'Kunde inte hamta modeller.');
    }

    const data = await response.json();
    return data.models || [];
}

async function populateModels() {
    modelSelect.innerHTML = '<option value="">Laddar modeller...</option>';

    try {
        const models = await fetchOpenAIModels();
        setConnectionAlert('');
        if (!models.length) {
            modelSelect.innerHTML = '<option value="">Inga modeller hittades</option>';
            return;
        }

        modelSelect.innerHTML = models
            .map((model) => `<option value="${model.name}">${model.name}</option>`)
            .join('');
        updateSessionModelLabel();
    } catch (error) {
        modelSelect.innerHTML = '<option value="">Kunde inte hamta modeller</option>';
        setStatus('error', `Fel: ${error.message}`);
        setConnectionAlert('Sidan nar inte OpenAI via backend. Kontrollera att backend ar startad och att OpenAI ar aktiverat med API-nyckel.');
    }
}

async function streamAssistantReply() {
    const model = modelSelect.value;
    if (!model) {
        setStatus('error', 'Valj en modell.');
        return;
    }

    const assistantTextNode = appendMessage('assistant', 'Laddar svar fran modellen...');
    setGeneratingState(true);
    setStatus('waiting', 'Vantar pa svar fran modellen...');
    abortController = new AbortController();

    try {
        const response = await fetch(`${BACKEND_BASE_URL}/api/openai/chat/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages: buildRequestMessages() }),
            signal: abortController.signal
        });

        if (!response.ok || !response.body) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail?.message || data.detail || 'Korning misslyckades.');
        }

        setConnectionAlert('');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let responseText = '';
        let hasReceivedChunk = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            if (!chunk) continue;

            if (!hasReceivedChunk) {
                hasReceivedChunk = true;
                setStatus('writing', 'Skriver...');
            }

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
            assistantTextNode.textContent = '(Tomt svar fran modellen)';
        }

        conversationMessages.push({ role: 'assistant', content: assistantTextNode.textContent });
        setStatus('done', 'Klar');
    } catch (error) {
        if (error.name === 'AbortError') {
            setStatus('aborted', 'Avbruten');
            if (!assistantTextNode.textContent.trim() || assistantTextNode.textContent === 'Laddar svar fran modellen...') {
                assistantTextNode.textContent = '(Genereringen avbrots innan svar kom tillbaka)';
            }
        } else {
            setStatus('error', `Fel: ${error.message}`);
            assistantTextNode.textContent = `Fel: ${error.message}`;
            setConnectionAlert('Kunde inte na OpenAI under korning. Kontrollera backend-konfigurationen och forsok igen.');
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
    clearDraft();
    await streamAssistantReply();
    inputElement.focus();
}

function resetChat() {
    if (hasUnsavedDraft() && !window.confirm('Du har ett utkast i meddelandefaltet. Vill du verkligen starta en ny chatt?')) {
        return;
    }
    if (abortController) {
        abortController.abort();
    }
    conversationMessages.length = 0;
    messagesElement.innerHTML = '';
    setGeneratingState(false);
    setStatus('done', 'Klar');
    inputElement.value = '';
    clearDraft();
    resizeInput();
    shouldAutoScroll = true;
}

function toggleMaximizedChat() {
    if (!chatShellElement || !expandButton) {
        return;
    }

    const isMaximized = chatShellElement.classList.toggle('is-maximized');
    expandButton.textContent = isMaximized ? 'Minimera' : 'Maximera';
    expandButton.setAttribute('aria-pressed', String(isMaximized));
    scrollToBottom(true);
}

function applySeedContext() {
    const seed = getSeedData();
    const context = document.getElementById('direct-chat-context');
    const title = document.getElementById('direct-chat-seed-title');
    const prompt = document.getElementById('direct-chat-seed-prompt');

    if (!seed || !seed.prompt || !context || !title || !prompt) {
        return;
    }

    context.hidden = false;
    title.textContent = seed.title || 'Prompt';
    prompt.textContent = seed.prompt;
    if (!inputElement.value.trim() && seed.input) {
        inputElement.value = seed.input;
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
    resizeInput();
    await sendUserMessage(value);
});

inputElement.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey) {
        return;
    }

    event.preventDefault();
    if (typeof formElement.requestSubmit === 'function') {
        formElement.requestSubmit();
        return;
    }

    formElement.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
});

stopButton.addEventListener('click', () => {
    if (abortController) {
        abortController.abort();
    }
});

resetButton.addEventListener('click', resetChat);
expandButton?.addEventListener('click', toggleMaximizedChat);
modelSelect?.addEventListener('change', updateSessionModelLabel);
inputElement?.addEventListener('input', () => {
    resizeInput();
    saveDraft();
});

window.addEventListener('beforeunload', (event) => {
    if (!hasUnsavedDraft()) {
        return;
    }
    event.preventDefault();
    event.returnValue = '';
});

window.addEventListener('DOMContentLoaded', async () => {
    applySeedContext();
    await populateModels();
    setStatus('done', 'Klar');
    updateSessionModelLabel();
    loadDraft();
    resizeInput();
});
