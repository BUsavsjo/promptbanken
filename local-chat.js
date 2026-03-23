const BACKEND_BASE_URL = window.PROMPTBANKEN_API_BASE_URL || window.location.origin.replace(/\/$/, '');

const modelSelect = document.getElementById('local-chat-model-select');
const statusElement = document.getElementById('local-chat-status');
const messagesElement = document.getElementById('local-chat-messages');
const formElement = document.getElementById('local-chat-form');
const inputElement = document.getElementById('local-chat-input');
const sendButton = document.getElementById('local-chat-send');
const stopButton = document.getElementById('local-chat-stop');
const resetButton = document.getElementById('local-chat-reset');
const demoButton = document.getElementById('local-chat-demo');
const expandButton = document.getElementById('local-chat-expand');
const chatShellElement = document.querySelector('.local-chat-shell');
const alertElement = document.getElementById('local-chat-alert');
const alertTextElement = document.getElementById('local-chat-alert-text');
const sessionModelElement = document.getElementById('local-chat-session-model');

const conversationMessages = [];
let abortController = null;
let isGenerating = false;
let shouldAutoScroll = true;
let hasAppliedSeedPrompt = false;
const DRAFT_STORAGE_KEY = 'promptbankenLocalChatDraft';

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
        alertTextElement.textContent = 'Kontrollera att backend och Ollama är igång och försök igen.';
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
        const copyButton = createCopyButton(() => text.textContent || '');
        bubble.appendChild(copyButton);
    }

    row.appendChild(bubble);
    messagesElement.appendChild(row);
    scrollToBottom();

    return text;
}

function getSeedData() {
    return window.__PROMPTBANKEN_LOCAL_CHAT_SEED__ || null;
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

function buildUserMessageForRequest(content) {
    const text = String(content || '').trim();
    if (!text) {
        return '';
    }

    const seed = getSeedData();
    if (!seed?.prompt || hasAppliedSeedPrompt || conversationMessages.length > 0) {
        return text;
    }

    hasAppliedSeedPrompt = true;
    return `${seed.prompt}\n\n---\n\nAnvandarens input:\n${text}`;
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
        throw new Error(data.detail?.message || data.detail || 'Kunde inte hamta modeller.');
    }

    const data = await response.json();
    return data.models || [];
}

async function populateModels() {
    modelSelect.innerHTML = '<option value="">Laddar modeller...</option>';

    try {
        const models = await fetchLocalModels();
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
        setConnectionAlert('Sidan når inte Ollama via backend. Kontrollera att backend är startad, att Ollama körs och att modellservern svarar.');
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
        const response = await fetch(`${BACKEND_BASE_URL}/api/chat/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages: conversationMessages }),
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
            setConnectionAlert('Kunde inte nå Ollama under körning. Kontrollera att backend och Ollama fortfarande är igång och försök igen.');
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
    conversationMessages.push({ role: 'user', content: buildUserMessageForRequest(text) });
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
    hasAppliedSeedPrompt = false;
}

function simulateDemoChat() {
    if (isGenerating) {
        return;
    }

    resetChat();
    setConnectionAlert('');
    setStatus('waiting', 'Simulerar demo...');

    const demoMessages = [
        {
            role: 'user',
            content: 'Kan du skriva om det här till klarspråk så att det blir lättare att förstå för mottagaren?'
        },
        {
            role: 'assistant',
            content: 'Absolut. Jag kan göra texten tydligare, kortare och mer direkt utan att ändra innebörden.'
        },
        {
            role: 'user',
            content: 'Bra. Jag vill också att tonen ska kännas vänlig men professionell.'
        },
        {
            role: 'assistant',
            content: 'Då kan jag fokusera på tre saker:\n\n1. Kortare meningar.\n2. Tydliga nästa steg.\n3. En vänlig och saklig ton.\n\nKlistra in texten här nedanför när du vill fortsätta.'
        }
    ];

    demoMessages.forEach((message) => {
        appendMessage(message.role, message.content);
        conversationMessages.push({ role: message.role, content: message.content });
    });

    inputElement.value = 'Kan du göra texten lite kortare också?';
    saveDraft();
    resizeInput();
    inputElement.focus();
    setStatus('done', 'Klar');
    scrollToBottom(true);
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
demoButton?.addEventListener('click', simulateDemoChat);
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
    await populateModels();
    setStatus('done', 'Klar');
    consumeSeedPrompt();
    updateSessionModelLabel();
    loadDraft();
    resizeInput();
});
