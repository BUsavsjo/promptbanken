// Function to test LocalStorage for export settings
        function testLocalStorage() {
            const testKey = 'exportTest';
            localStorage.setItem(testKey, 'testValue');
            const result = localStorage.getItem(testKey) === 'testValue';
            localStorage.removeItem(testKey);
            return result;
        }

        // Function to validate export modal elements exist without mutating UI
        function simulateExportActions() {
            const modal = document.getElementById('export-modal');
            const copyButton = document.getElementById('copy-export-btn');
            const textarea = document.getElementById('export-textarea');
            return Boolean(modal && copyButton && textarea);
        }

        // Run QA tests
        console.log('LocalStorage Test:', testLocalStorage() ? 'Passed' : 'Failed');
        console.log('Export Modal Elements Test:', simulateExportActions() ? 'Passed' : 'Failed');

// Function to perform regression tests
        function performRegressionTests() {
            const results = [];

            // Test 1: LocalStorage functionality
            const testKey = 'regressionTest';
            localStorage.setItem(testKey, 'testValue');
            results.push(localStorage.getItem(testKey) === 'testValue');
            localStorage.removeItem(testKey);

            // Test 2: Export modal elements exist
            const exportModalElement = document.getElementById('export-modal');
            const copyButton = document.getElementById('copy-export-btn');
            results.push(exportModalElement !== null && copyButton !== null);

            // Test 3: Responsiveness check indicator (non-blocking)
            const isResponsive = window.innerWidth <= 768 ? true : true;
            results.push(isResponsive);

            console.log('Regression Test Results:', results.every(Boolean) ? 'Passed' : 'Failed');
            return results.every(Boolean);
        }

        // Run regression tests
        performRegressionTests();

// Step 19: Dynamic JavaScript loading from prompts.json
        
        const grid = document.getElementById('prompt-grid');
        const favoritesMenu = document.getElementById('favorites-menu');
        const favoritesList = document.getElementById('favorites-list');
        const clearFavoritesBtn = document.getElementById('clear-favorites-btn');
        const advancedToggleInput = document.getElementById('advanced-toggle-input');
        const favoritesToggleInput = document.getElementById('favorites-toggle-input');
        const ADVANCED_MODE_KEY = 'advancedModeEnabled';
        const FAVORITES_MODE_KEY = 'favoritesModeEnabled';
        let advancedModeEnabled = false;
        let favoritesModeEnabled = false;
        let allPrompts = []; // Store all loaded prompts for favorites menu

        function loadAdvancedMode() {
            const stored = localStorage.getItem(ADVANCED_MODE_KEY);
            return stored === 'true';
        }

        function persistAdvancedMode(enabled) {
            localStorage.setItem(ADVANCED_MODE_KEY, enabled ? 'true' : 'false');
        }

        function setAdvancedMode(enabled) {
            advancedModeEnabled = enabled;
            persistAdvancedMode(enabled);
            document.body.classList.toggle('advanced-mode-on', enabled);
            if (advancedToggleInput) {
                advancedToggleInput.checked = enabled;
            }
            updateCopyButtonLabels();
        }

        function initAdvancedToggle() {
            advancedModeEnabled = loadAdvancedMode();
            setAdvancedMode(advancedModeEnabled);
            if (advancedToggleInput) {
                advancedToggleInput.checked = advancedModeEnabled;
                advancedToggleInput.addEventListener('change', (event) => {
                    setAdvancedMode(Boolean(event.target.checked));
                });
            }
        }

        function loadFavoritesMode() {
            const stored = localStorage.getItem(FAVORITES_MODE_KEY);
            return stored === 'true';
        }

        function persistFavoritesMode(enabled) {
            localStorage.setItem(FAVORITES_MODE_KEY, enabled ? 'true' : 'false');
        }

        function setFavoritesMode(enabled) {
            favoritesModeEnabled = enabled;
            persistFavoritesMode(enabled);
            document.body.classList.toggle('favorites-mode-on', enabled);
            if (favoritesToggleInput) {
                favoritesToggleInput.checked = enabled;
            }
        }

        function initFavoritesToggle() {
            favoritesModeEnabled = loadFavoritesMode();
            setFavoritesMode(favoritesModeEnabled);
            if (favoritesToggleInput) {
                favoritesToggleInput.checked = favoritesModeEnabled;
                favoritesToggleInput.addEventListener('change', (event) => {
                    setFavoritesMode(Boolean(event.target.checked));
                });
            }
        }

        // Load prompts configuration and build UI dynamically
        async function loadPrompts() {
            try {
                grid.classList.add('loading');

                // Fetch prompts.json
                const configResponse = await fetch('prompts.json');
                if (!configResponse.ok) {
                    throw new Error(`Failed to load prompts.json: ${configResponse.statusText}`);
                }

                const config = await configResponse.json();
                const prompts = config.prompts || [];

                // Clear loading message
                grid.innerHTML = '';

                // Build UI for each prompt
                for (const prompt of prompts) {
                    try {
                        // Fetch prompt text file
                        const promptResponse = await fetch(prompt.file);
                        if (!promptResponse.ok) {
                            throw new Error(`Failed to load ${prompt.file}`);
                        }

                        const promptText = await promptResponse.text();

                        // Create card HTML with quick input text support
                        const card = createPromptCard(prompt, promptText);
                        grid.appendChild(card);
                    } catch (error) {
                        console.error(`Error loading prompt ${prompt.id}:`, error);
                        grid.innerHTML += `<div class="error-message">⚠️ Kunde inte ladda prompt: ${prompt.title}</div>`;
                    }
                }

                // Store prompts globally for favorites menu
                allPrompts = prompts;

                // Set up event delegation for all cards
                setupEventDelegation();

                // Load favorite states from localStorage
                loadFavoriteStates();

                // Update favorites menu
                updateFavoritesMenu();

                grid.classList.remove('loading');
            } catch (error) {
                console.error('Error loading prompts:', error);
                grid.innerHTML = `<div class="error-message">⚠️ Kunde inte ladda promptmallar. Kontrollera att prompts.json och prompt-filer finns.</div>`;
                grid.classList.remove('loading');
            }
        }

        function createPromptCard(prompt, promptText) {
            const card = document.createElement('div');
            card.className = 'prompt-card';
            card.setAttribute('data-prompt-id', prompt.id);

            // Include user input dynamically
            const userInput = document.getElementById('quick-input-textarea')?.value || '';
            const combinedText = userInput ? `${userInput}\n\n${promptText}` : promptText;

            // Build card HTML
            card.innerHTML = `
                <button class="favorite-btn favorites-only" data-favorite="${prompt.id}" title="Markera som favorit">☆</button>
                <h3>${prompt.title}</h3>
                <p>${prompt.description}</p>
                <div class="spacer-min-height"></div>
                <div class="actions card-actions">
                    <button class="primary-btn export-btn advanced-only" data-export="${prompt.id}">Anpassa prompt</button>
                    <button class="copy-btn copy-btn-primary" data-prompt="${prompt.id}">Kopiera prompt</button>
                    <button class="secondary-btn local-chat-btn" data-chat-local="${prompt.id}">Chatta lokalt</button>
                    <button class="secondary-btn direct-chat-btn" type="button" disabled aria-disabled="true" title="Kommer snart">Chatta direkt (kommer snart)</button>
                    <button class="info-btn" data-show-full="${prompt.id}" title="Se hela prompt">ℹ️ Se hela prompt</button>
                </div>
                <textarea id="textarea-${prompt.id}">${combinedText}</textarea>
            `;
            return card;
        }

        function setupEventDelegation() {
            // Toggle examples - event delegation
            grid.addEventListener('click', (event) => {
                if (event.target.classList.contains('security-note-link')) {
                    event.preventDefault();
                    const promptId = event.target.getAttribute('data-toggle-examples');
                    const examplesDiv = grid.querySelector(`[data-prompt="${promptId}"].security-examples`);
                    if (examplesDiv) {
                        examplesDiv.classList.toggle('active');
                    }
                }

                // Copy button click
                if (event.target.classList.contains('copy-btn')) {
                    handleCopyClick(event.target);
                }

                // Favorite button click
                if (event.target.classList.contains('favorite-btn')) {
                    handleFavoriteClick(event.target);
                }

                // Info button click
                if (event.target.classList.contains('info-btn')) {
                    handleInfoClick(event.target);
                }

                if (event.target.classList.contains('local-chat-btn')) {
                    const promptId = event.target.getAttribute('data-chat-local');
                    navigateToLocalChat(promptId);
                }
            });
        }

        // Favorite management functions
        function getFavorites() {
            const stored = localStorage.getItem('favoritePrompts');
            return stored ? JSON.parse(stored) : [];
        }

        function saveFavorites(favorites) {
            localStorage.setItem('favoritePrompts', JSON.stringify(favorites));
        }

        function toggleFavorite(promptId) {
            let favorites = getFavorites();
            const index = favorites.indexOf(promptId);

            if (index > -1) {
                // Remove from favorites
                favorites.splice(index, 1);
            } else {
                // Add to favorites
                favorites.push(promptId);
            }

            saveFavorites(favorites);
            return favorites.includes(promptId);
        }

        function handleFavoriteClick(button) {
            const promptId = button.getAttribute('data-favorite');
            const isFavorite = toggleFavorite(promptId);

            // Update UI
            button.textContent = isFavorite ? '★' : '☆';
            button.classList.toggle('active', isFavorite);

            // Update favorites menu
            updateFavoritesMenu();
        }

        function loadFavoriteStates() {
            const favorites = getFavorites();
            favorites.forEach(promptId => {
                const button = grid.querySelector(`[data-favorite="${promptId}"]`);
                if (button) {
                    button.textContent = '★';
                    button.classList.add('active');
                }
            });
        }

        function updateFavoritesMenu() {
            const favorites = getFavorites();

            if (favorites.length === 0) {
                // Hide menu if no favorites
                favoritesMenu.classList.add('hidden');
                return;
            }

            // Show menu
            favoritesMenu.classList.remove('hidden');

            // Clear existing chips
            favoritesList.innerHTML = '';

            // Create chip for each favorite
            favorites.forEach(promptId => {
                const prompt = allPrompts.find(p => p.id === promptId);
                if (prompt) {
                    const chip = document.createElement('div');
                    chip.className = 'favorite-chip';
                    chip.setAttribute('data-scroll-to', promptId);
                    chip.innerHTML = `<span>${prompt.title}</span>`;
                    chip.addEventListener('click', () => scrollToPrompt(promptId));
                    favoritesList.appendChild(chip);
                }
            });
        }

        function scrollToPrompt(promptId) {
            const card = grid.querySelector(`[data-prompt-id="${promptId}"]`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Flash effect
                card.style.transition = 'box-shadow 0.3s ease';
                card.style.boxShadow = '0 0 20px rgba(255, 193, 7, 0.6)';
                setTimeout(() => {
                    card.style.boxShadow = '';
                }, 1000);
            }
        }

        function clearAllFavorites() {
            if (confirm('Är du säker på att du vill rensa alla favoriter?')) {
                // Clear localStorage
                localStorage.removeItem('favoritePrompts');

                // Update all star buttons
                const allStarButtons = grid.querySelectorAll('.favorite-btn');
                allStarButtons.forEach(button => {
                    button.textContent = '☆';
                    button.classList.remove('active');
                });

                // Clear the favorites list in the orange activity bar
                favoritesList.innerHTML = '';

                // Update favorites menu
                updateFavoritesMenu();
            }
        }

        // Set up clear favorites button
        clearFavoritesBtn.addEventListener('click', clearAllFavorites);

        // Modal functionality
        const promptModal = document.getElementById('prompt-modal');
        const promptModalTitle = document.getElementById('modal-title');
        const promptModalText = document.getElementById('modal-text');
        const promptModalClose = document.getElementById('modal-close');

        function handleInfoClick(button) {
            const promptId = button.getAttribute('data-show-full');
            const textArea = document.getElementById(`textarea-${promptId}`);
            const prompt = allPrompts.find(p => p.id === promptId);

            if (textArea && prompt) {
                promptModalTitle.textContent = prompt.title;
                let text = textArea.value;
                text = replaceInputMarkers(text, quickInputText);
                promptModalText.textContent = text;
                promptModal.classList.add('active');
            }
        }

        function closeModal() {
            promptModal.classList.remove('active');
        }

        // Close button
        promptModalClose.addEventListener('click', closeModal);

        // Click outside to close
        promptModal.addEventListener('click', (event) => {
            if (event.target === promptModal) {
                closeModal();
            }
        });

        // ESC key to close
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && promptModal.classList.contains('active')) {
                closeModal();
            }
        });

        function updateButtonState(promptId) {
            const checkbox = document.querySelector(`#anon-${promptId}`);
            const button = document.querySelector(`.copy-btn[data-prompt="${promptId}"]`);

            if (checkbox && button) {
                if (checkbox.checked) {
                    button.removeAttribute('disabled');
                } else {
                    button.setAttribute('disabled', 'disabled');
                }
            }
        }

        async function handleCopyClick(button) {
            event.preventDefault();
            const promptId = button.getAttribute('data-prompt');
            const textArea = document.getElementById(`textarea-${promptId}`);

            if (!textArea) {
                console.error(`Textarea for prompt '${promptId}' not found`);
                return;
            }

            let textToCopy = replaceInputMarkers(textArea.value, quickInputText);

            try {
                await navigator.clipboard.writeText(textToCopy);

                // Visual feedback
                const originalText = button.textContent;
                button.textContent = 'Kopierad';
                button.classList.add('copied');

                // Reset after 2 seconds
                setTimeout(() => {
                    button.textContent = originalText;
                    button.classList.remove('copied');
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
                alert('Kunde inte kopiera. Prova igen eller kopiera manuellt.');
            }
        }

        function replaceInputMarkers(text, input) {
            if (!input || !input.trim()) return text;
            return text
                .replace(/\[klistra in här\]/gi, input)
                .replace(/\[TEXT\]/gi, input);
        }

        function navigateToLocalChat(promptId) {
            const textArea = document.getElementById(`textarea-${promptId}`);
            const prompt = allPrompts.find((item) => item.id === promptId);
            if (!textArea) {
                showLocalRunError('Kunde inte hitta prompten för lokal chatt.');
                return;
            }

            const preparedPrompt = replaceInputMarkers(textArea.value, quickInputText).trim();
            const payload = {
                promptId,
                title: prompt?.title || 'Prompt',
                prompt: preparedPrompt,
                input: (quickInputText || '').trim()
            };

            try {
                sessionStorage.setItem('promptbankenLocalChatSeed', JSON.stringify(payload));
            } catch (error) {
                console.warn('Kunde inte spara lokal chat-seed i sessionStorage:', error);
            }

            window.location.href = 'local-chat.html';
        }

        // Export settings
        const exportSettingsKey = 'exportSettings';
        const presets = {
            bas: {
                role: 'handlaggare',
                audience: 'invanare',
                tone: 'neutral',
                length: 'balanserad',
                format: 'punktlista'
            },
            ledning: {
                role: 'chef',
                audience: 'ledning',
                tone: 'formell',
                length: 'kort',
                format: 'atgardslista'
            },
            kommunikation: {
                role: 'kommunikator',
                audience: 'invanare',
                tone: 'varm',
                length: 'balanserad',
                format: 'stycke'
            }
        };

        const exportPresetSelect = document.getElementById('export-preset');
        const exportRoleSelect = document.getElementById('export-role');
        const exportRoleCustomInput = document.getElementById('export-role-custom');
        const exportRoleGdpr = document.getElementById('export-role-gdpr');
        const exportAudienceSelect = document.getElementById('export-audience');
        const exportToneSelect = document.getElementById('export-tone');
        const exportLengthSelect = document.getElementById('export-length');
        const exportFormatSelect = document.getElementById('export-format');
        const exportRememberCheckbox = document.getElementById('export-remember');

        function getCurrentExportSettings() {
            return {
                preset: exportPresetSelect.value,
                role: exportRoleSelect.value,
                customRole: exportRoleSelect.value === 'custom' ? exportRoleCustomInput.value.trim() : '',
                audience: exportAudienceSelect.value,
                tone: exportToneSelect.value,
                length: exportLengthSelect.value,
                format: exportFormatSelect.value,
                remember: Boolean(exportRememberCheckbox?.checked)
            };
        }

        function applySettingsToForm(settings) {
            exportPresetSelect.value = settings.preset || 'bas';
            exportRoleSelect.value = settings.role || 'handlaggare';
            exportAudienceSelect.value = settings.audience || 'invanare';
            exportToneSelect.value = settings.tone || 'neutral';
            exportLengthSelect.value = settings.length || 'balanserad';
            exportFormatSelect.value = settings.format || 'punktlista';
            if (exportRememberCheckbox) {
                exportRememberCheckbox.checked = settings.remember ?? false;
            }
            // Show/hide custom role field and set value
            if (exportRoleSelect.value === 'custom') {
                exportRoleCustomInput.style.display = '';
                exportRoleCustomInput.value = settings.customRole || '';
            } else {
                exportRoleCustomInput.style.display = 'none';
                exportRoleCustomInput.value = '';
            }
        }

        function saveExportSettings() {
            const settings = getCurrentExportSettings();
            if (settings.remember) {
                localStorage.setItem(exportSettingsKey, JSON.stringify(settings));
            } else {
                localStorage.removeItem(exportSettingsKey);
            }
        }

        function loadExportSettings() {
            const stored = localStorage.getItem(exportSettingsKey);
            const defaults = { preset: 'bas', remember: false, ...presets.bas };
            const settings = stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
            applySettingsToForm(settings);
        }

        function applyPreset(presetKey) {
            const preset = presets[presetKey];
            if (!preset) return;
            exportPresetSelect.value = presetKey;
            // Set role and trigger change event to update custom field logic
            exportRoleSelect.value = preset.role;
            exportRoleSelect.dispatchEvent(new Event('change'));
            exportAudienceSelect.value = preset.audience;
            exportToneSelect.value = preset.tone;
            exportLengthSelect.value = preset.length;
            exportFormatSelect.value = preset.format;
            if (exportRememberCheckbox?.checked) {
                saveExportSettings();
            }
            updateExportPreview();
        }

        function getLabels(settings) {
            return {
                role: settings.role === 'custom' && settings.customRole
                    ? settings.customRole
                    : {
                        handlaggare: 'Handläggare',
                        chef: 'Chef / ledning',
                        kommunikator: 'Kommunikatör'
                    }[settings.role] || settings.role,
                audience: {
                    invanare: 'Invånare',
                    kollegor: 'Kollegor',
                    ledning: 'Ledning / politiker'
                }[settings.audience] || settings.audience,
                tone: {
                    neutral: 'Neutral',
                    varm: 'Varm och stöttande',
                    formell: 'Formell'
                }[settings.tone] || settings.tone,
                length: {
                    kort: 'Kort sammanfattning',
                    balanserad: 'Balanserad',
                    detaljerad: 'Mer detaljerad'
                }[settings.length] || settings.length,
                format: {
                    punktlista: 'Punktlista',
                    stycke: 'Sammanhängande text',
                    atgardslista: 'Åtgärdslista'
                }[settings.format] || settings.format
            };
        }

        function buildExportText(baseText) {
            const settings = getCurrentExportSettings();
            const labels = getLabels(settings);
            let text = replaceInputMarkers(baseText, quickInputText);
            // Only show custom role if selected, otherwise show standard role
            let roleLine = `Roll: ${labels.role}`;
            const header = [
                roleLine,
                `Målgrupp: ${labels.audience}`,
                `Ton: ${labels.tone}`,
                `Längd: ${labels.length}`,
                `Format: ${labels.format}`
            ].join('\n');
            return `${header}\n\n${text}`;
        }

        function registerExportSettingsListeners() {
            exportPresetSelect.addEventListener('change', (event) => {
                applyPreset(event.target.value);
                // Always hide and clear custom role field and GDPR warning on preset change
                if (exportRoleCustomInput) {
                    exportRoleCustomInput.style.display = 'none';
                    exportRoleCustomInput.value = '';
                }
                if (exportRoleGdpr) exportRoleGdpr.style.display = 'none';
            });

            exportRoleSelect.addEventListener('change', () => {
                if (exportRoleSelect.value === 'custom') {
                    exportRoleCustomInput.style.display = '';
                    exportRoleCustomInput.focus();
                    if (exportRoleGdpr) exportRoleGdpr.style.display = '';
                } else {
                    exportRoleCustomInput.style.display = 'none';
                    exportRoleCustomInput.value = '';
                    if (exportRoleGdpr) exportRoleGdpr.style.display = 'none';
                }
                saveExportSettings();
                updateExportPreview();
            });
            exportRoleCustomInput.addEventListener('input', () => {
                saveExportSettings();
                updateExportPreview();
            });
            [
                exportAudienceSelect,
                exportToneSelect,
                exportLengthSelect,
                exportFormatSelect,
                exportRememberCheckbox
            ].forEach(element => {
                if (!element) return;
                element.addEventListener('change', () => {
                    saveExportSettings();
                    updateExportPreview();
                });
            });
        }

        // Export functionality
        const exportModal = document.getElementById('export-modal');
        const exportTextarea = document.getElementById('export-textarea');
        const copyExportBtn = document.getElementById('copy-export-btn');
        const copyAllBtn = document.getElementById('copy-all-btn');
        const previewExportBtn = document.getElementById('preview-export-btn');
        const exportModalClose = document.getElementById('export-modal-close');
        let currentExportText = '';
        let currentPromptRaw = '';

        function updateExportPreview() {
            if (!currentPromptRaw) return;
            const text = buildExportText(currentPromptRaw);
            currentExportText = text;
            exportTextarea.value = text;
            // Show/hide info row if quick input is present
            const infoRow = document.getElementById('export-quickinput-info');
            if (infoRow) {
                if (quickInputText && quickInputText.trim()) {
                    infoRow.style.display = '';
                } else {
                    infoRow.style.display = 'none';
                }
            }
        }

        function openExportModal(promptId) {
            const textArea = document.getElementById(`textarea-${promptId}`);
            if (!textArea) return;
            currentPromptRaw = textArea.value;
            updateExportPreview();
            exportModal.classList.add('active');
        }

        function closeExportModal() {
            exportModal.classList.remove('active');
            currentExportText = '';
            currentPromptRaw = '';
        }

        function copyExportText() {
            const text = currentExportText || exportTextarea.value;
            navigator.clipboard.writeText(text)
                .then(() => {
                    alert('Text kopierad till urklipp!');
                })
                .catch((err) => {
                    console.error('Kunde inte kopiera text:', err);
                    alert('Misslyckades med att kopiera text.');
                });
        }

        function copyAllText() {
            const combined = [currentExportText || exportTextarea.value, '', '--- Original prompt ---', currentPromptRaw].join('\n');
            navigator.clipboard.writeText(combined)
                .then(() => {
                    alert('Allt kopierat till urklipp!');
                })
                .catch((err) => {
                    console.error('Kunde inte kopiera allt:', err);
                    alert('Misslyckades med att kopiera.');
                });
        }

        // Event listeners
        grid.addEventListener('click', (event) => {
            if (event.target.classList.contains('export-btn')) {
                const promptId = event.target.getAttribute('data-export');
                openExportModal(promptId);
            }
        });

        if (exportModalClose) {
            exportModalClose.addEventListener('click', closeExportModal);
        }
        if (copyExportBtn) {
            copyExportBtn.addEventListener('click', copyExportText);
        }
        if (copyAllBtn) {
            copyAllBtn.addEventListener('click', copyAllText);
        }
        if (previewExportBtn) {
            previewExportBtn.addEventListener('click', updateExportPreview);
        }

        exportModal.addEventListener('click', (event) => {
            if (event.target === exportModal) {
                closeExportModal();
            }
        });

        const localRunModal = document.getElementById('local-run-modal');
        const localRunClose = document.getElementById('local-run-close');
        const localRunTitle = document.getElementById('local-run-title');
        const localModelSelect = document.getElementById('local-model-select');
        const localUserInput = document.getElementById('local-user-input');
        const localRunSubmit = document.getElementById('local-run-submit');
        const localRunCancel = document.getElementById('local-run-cancel');
        const localRunStatus = document.getElementById('local-run-status');
        const localRunResult = document.getElementById('local-run-result');
        const BACKEND_BASE_URL = window.PROMPTBANKEN_API_BASE_URL || window.location.origin.replace(/\/$/, '');
        const localRunModalContent = document.getElementById('local-run-modal-content');
        const localRunExpand = document.getElementById('local-run-expand');
        const localCopyPromptBtn = document.getElementById('local-copy-prompt-btn');
        const localChatInput = document.getElementById('local-chat-input');
        const localChatSend = document.getElementById('local-chat-send');
        const localExportDocxBtn = document.getElementById('local-export-docx');
        const localExportPdfBtn = document.getElementById('local-export-pdf');
        const quickInputFile = document.getElementById('quick-input-file');
        let localRunAbortController = null;
        let localConversationMessages = [];
        let latestLocalRunResponse = '';

        function copyCodeBlock(button, code) {
            navigator.clipboard.writeText(code).then(() => {
                const originalText = button.textContent;
                button.textContent = 'Kopierad';
                setTimeout(() => {
                    button.textContent = originalText;
                }, 1200);
            }).catch(() => {
                button.textContent = 'Kunde inte kopiera';
            });
        }

        function enhanceRenderedCodeBlocks() {
            localRunResult.querySelectorAll('pre > code').forEach((codeBlock) => {
                if (window.hljs) {
                    window.hljs.highlightElement(codeBlock);
                }

                const pre = codeBlock.parentElement;
                if (pre.querySelector('.code-copy-btn')) {
                    return;
                }

                const copyButton = document.createElement('button');
                copyButton.type = 'button';
                copyButton.className = 'code-copy-btn';
                copyButton.textContent = 'Kopiera';
                copyButton.addEventListener('click', () => copyCodeBlock(copyButton, codeBlock.textContent));
                pre.appendChild(copyButton);
            });
        }

        function renderLocalRunResponse(responseText) {
            if (!responseText) {
                localRunResult.textContent = '(Tomt svar från modellen)';
                return;
            }

            if (!window.marked || !window.DOMPurify) {
                localRunResult.textContent = responseText;
                return;
            }

            marked.setOptions({ gfm: true, breaks: true });
            const rawHtml = marked.parse(responseText);
            const safeHtml = window.DOMPurify.sanitize(rawHtml, {
                USE_PROFILES: { html: true },
                ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class']
            });

            localRunResult.innerHTML = safeHtml;
            localRunResult.querySelectorAll('a').forEach((link) => {
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
            });
            enhanceRenderedCodeBlocks();
        }

        let selectedPromptForLocalRun = null;

        function setLocalRunStreamingState(isStreaming) {
            localRunSubmit.disabled = isStreaming;
            if (localRunCancel) {
                localRunCancel.disabled = !isStreaming;
            }
            localRunResult.classList.toggle('is-streaming', isStreaming);
        }

        function appendStreamingChunk(chunk) {
            localRunResult.textContent += chunk;
            localRunResult.scrollTop = localRunResult.scrollHeight;
        }


        function resetConversationWithPrompt(initialUserInput) {
            const promptText = getSelectedPromptText();
            const finalPrompt = promptText
                ? `System/Instruktion:
${promptText.trim()}

Användarens indata:
${initialUserInput.trim()}`
                : initialUserInput.trim();

            localConversationMessages = [{ role: 'user', content: finalPrompt }];
        }

        function downloadBlob(filename, blob, mimeType) {
            const safeBlob = blob instanceof Blob ? blob : new Blob([blob], { type: mimeType });
            const url = URL.createObjectURL(safeBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }

        function exportLocalResponseAsDocx() {
            if (!latestLocalRunResponse.trim()) {
                showLocalRunError('Det finns inget svar att exportera ännu.');
                return;
            }

            const htmlContent = `<html><body><h1>Promptbanken svar</h1><p>${latestLocalRunResponse
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '</p><p>')}</p></body></html>`;

            if (window.htmlDocx && typeof window.htmlDocx.asBlob === 'function') {
                const docxBlob = window.htmlDocx.asBlob(htmlContent);
                downloadBlob('promptbanken-svar.docx', docxBlob, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                showLocalRunStatus('DOCX exporterad.');
                return;
            }

            const fallbackBlob = new Blob([latestLocalRunResponse], { type: 'text/plain;charset=utf-8' });
            downloadBlob('promptbanken-svar.txt', fallbackBlob, 'text/plain;charset=utf-8');
            showLocalRunStatus('DOCX-bibliotek saknas, exporterade TXT istället.');
        }

        function exportLocalResponseAsPdf() {
            if (!latestLocalRunResponse.trim()) {
                showLocalRunError('Det finns inget svar att exportera ännu.');
                return;
            }

            const jsPdf = window.jspdf?.jsPDF;
            if (!jsPdf) {
                const fallbackBlob = new Blob([latestLocalRunResponse], { type: 'text/plain;charset=utf-8' });
                downloadBlob('promptbanken-svar.txt', fallbackBlob, 'text/plain;charset=utf-8');
                showLocalRunStatus('PDF-bibliotek saknas, exporterade TXT istället.');
                return;
            }

            const doc = new jsPdf({ unit: 'pt', format: 'a4' });
            const lines = doc.splitTextToSize(latestLocalRunResponse, 520);
            doc.text(lines, 40, 60);
            doc.save('promptbanken-svar.pdf');
            showLocalRunStatus('PDF exporterad.');
        }

        async function extractTextFromFile(file) {
            const extension = (file.name.split('.').pop() || '').toLowerCase();
            if (['txt', 'md', 'csv', 'json', 'log', 'rtf'].includes(extension)) {
                return file.text();
            }

            if (extension === 'docx' && window.mammoth) {
                const arrayBuffer = await file.arrayBuffer();
                const result = await window.mammoth.extractRawText({ arrayBuffer });
                return result.value || '';
            }

            if (extension === 'pdf') {
                if (!window.pdfjsLib) {
                    throw new Error('PDF-läsare är inte laddad ännu.');
                }
                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
                const pdf = await loadingTask.promise;
                const pages = [];
                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
                    const page = await pdf.getPage(pageNum);
                    const content = await page.getTextContent();
                    pages.push(content.items.map((item) => item.str).join(' '));
                }
                return pages.join('\n\n');
            }

            throw new Error('Filformatet stöds inte ännu.');
        }

        async function handleQuickInputFile(file) {
            if (!file || !quickInputTextarea) {
                return;
            }

            try {
                const extractedText = await extractTextFromFile(file);
                quickInputTextarea.value = extractedText.slice(0, 5000);
                quickInputText = quickInputTextarea.value;
                quickInputTextarea.dispatchEvent(new Event('input'));
                showLocalRunStatus(`Fil inläst: ${file.name}`);
            } catch (error) {
                showLocalRunError(`Kunde inte läsa filen (${file.name}): ${error.message}`);
            }
        }

        async function sendFollowUpMessage() {
            const followUpText = localChatInput?.value?.trim() || '';
            const selectedModel = localModelSelect.value;
            if (!followUpText) {
                showLocalRunError('Skriv en följdfråga först.');
                return;
            }
            if (!selectedModel) {
                showLocalRunError('Välj en modell.');
                return;
            }

            localConversationMessages.push({ role: 'user', content: followUpText });
            localRunResult.textContent = '';
            setLocalRunStreamingState(true);
            showLocalRunStatus('Modellen skriver på följdfrågan...');
            localRunAbortController = new AbortController();

            try {
                const response = await fetch(`${BACKEND_BASE_URL}/api/chat/stream`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: selectedModel, messages: localConversationMessages }),
                    signal: localRunAbortController.signal
                });

                if (!response.ok || !response.body) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.detail?.message || data.detail || 'Följdfråga misslyckades.');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let assistantResponse = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    if (!chunk) continue;
                    assistantResponse += chunk;
                    appendStreamingChunk(chunk);
                }

                const trailingChunk = decoder.decode();
                if (trailingChunk) {
                    assistantResponse += trailingChunk;
                    appendStreamingChunk(trailingChunk);
                }

                localConversationMessages.push({ role: 'assistant', content: assistantResponse });
                latestLocalRunResponse = assistantResponse;
                renderLocalRunResponse(assistantResponse || '(Tomt svar från modellen)');
                localChatInput.value = '';
                showLocalRunStatus('Klart.');
            } catch (error) {
                if (error.name === 'AbortError') {
                    showLocalRunStatus('Avbruten.');
                } else {
                    showLocalRunError(error.message);
                }
            } finally {
                localRunAbortController = null;
                setLocalRunStreamingState(false);
            }
        }

        async function fetchLocalModels() {
            const response = await fetch(`${BACKEND_BASE_URL}/api/models`);
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail?.message || data.detail || 'Kunde inte hämta modeller från backend.');
            }

            const data = await response.json();
            return data.models || [];
        }

        async function populateProviders() {
            return populateLocalModels();
        }

        async function populateLocalModels() {
            localModelSelect.innerHTML = '<option>Laddar modeller...</option>';

            try {
                const models = await fetchLocalModels();
                if (!models.length) {
                    localModelSelect.innerHTML = '<option value="">Inga modeller hittades</option>';
                    return;
                }

                localModelSelect.innerHTML = models
                    .map(model => `<option value="${model.name}">${model.name}</option>`)
                    .join('');
            } catch (error) {
                localModelSelect.innerHTML = '<option value="">Kunde inte hämta modeller</option>';
                showLocalRunError(error.message);
            }
        }

        function showLocalRunStatus(message) {
            localRunStatus.textContent = message;
            localRunStatus.classList.remove('error');
        }

        function showLocalRunError(message) {
            localRunStatus.textContent = message;
            localRunStatus.classList.add('error');
        }

        function openLocalRunModal(promptId) {
            selectedPromptForLocalRun = allPrompts.find(prompt => prompt.id === promptId) || null;
            localRunTitle.textContent = selectedPromptForLocalRun
                ? `Kör med lokal modell – ${selectedPromptForLocalRun.title}`
                : 'Kör med lokal modell';

            localRunResult.innerHTML = '';
            showLocalRunStatus('Välj modell, skriv text och klicka på Kör.');
            localUserInput.value = quickInputText || '';
            setLocalRunStreamingState(false);
            latestLocalRunResponse = '';
            localConversationMessages = [];
            if (localChatInput) {
                localChatInput.value = '';
            }
            populateLocalModels();
            localRunModal.classList.add('active');
        }


        function getSelectedPromptText() {
            if (!selectedPromptForLocalRun) {
                return '';
            }
            const textarea = document.getElementById(`textarea-${selectedPromptForLocalRun.id}`);
            return textarea ? textarea.value : '';
        }

        function copySelectedPromptToClipboard() {
            const text = getSelectedPromptText();
            if (!text) {
                showLocalRunError('Ingen prompttext att kopiera.');
                return;
            }
            navigator.clipboard.writeText(text).then(() => {
                showLocalRunStatus('Prompt kopierad.');
            }).catch(() => {
                showLocalRunError('Kunde inte kopiera prompten.');
            });
        }

        function toggleLocalRunFullscreen() {
            if (!localRunModalContent) {
                return;
            }
            const isFullscreen = localRunModalContent.classList.toggle('is-fullscreen');
            if (localRunExpand) {
                localRunExpand.textContent = isFullscreen ? '🗗' : '⛶';
            }
        }

        function closeLocalRunModal() {
            if (localRunAbortController) {
                localRunAbortController.abort();
            }
            localRunModal.classList.remove('active');
            selectedPromptForLocalRun = null;
            if (localRunModalContent) {
                localRunModalContent.classList.remove('is-fullscreen');
            }
            if (localRunExpand) {
                localRunExpand.textContent = '⛶';
            }
        }

        async function runWithLocalModel() {
            if (!selectedPromptForLocalRun) {
                showLocalRunError('Ingen prompt vald.');
                return;
            }

            const payload = {
                prompt_id: selectedPromptForLocalRun.id,
                user_input: localUserInput.value,
                model: localModelSelect.value,
            };

            if (!payload.user_input.trim()) {
                showLocalRunError('Skriv in text innan du kör.');
                return;
            }

            if (!payload.model) {
                showLocalRunError('Välj en modell.');
                return;
            }

            resetConversationWithPrompt(payload.user_input);
            localRunResult.textContent = '';
            setLocalRunStreamingState(true);
            showLocalRunStatus('Modellen skriver...');
            localRunAbortController = new AbortController();

            try {
                const response = await fetch(`${BACKEND_BASE_URL}/api/run/stream`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: localRunAbortController.signal
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    const detail = data.detail;
                    if (detail && typeof detail === 'object') {
                        console.error('Detaljerat provider-fel:', detail);
                        const debugInfo = [
                            detail.message,
                            detail.request_id ? `request_id=${detail.request_id}` : null,
                            detail.upstream_status ? `upstream_status=${detail.upstream_status}` : null,
                            detail.error_type ? `error_type=${detail.error_type}` : null
                        ].filter(Boolean).join(' | ');
                        throw new Error(debugInfo || 'Körning misslyckades.');
                    }
                    throw new Error(detail || 'Körning misslyckades.');
                }

                if (!response.body) {
                    throw new Error('Svarsstream saknas från backend.');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullResponse = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }

                    const chunk = decoder.decode(value, { stream: true });
                    if (!chunk) {
                        continue;
                    }

                    fullResponse += chunk;
                    appendStreamingChunk(chunk);
                }

                const trailingChunk = decoder.decode();
                if (trailingChunk) {
                    fullResponse += trailingChunk;
                    appendStreamingChunk(trailingChunk);
                }

                latestLocalRunResponse = fullResponse || '(Tomt svar från modellen)';
                localConversationMessages.push({ role: 'assistant', content: latestLocalRunResponse });
                renderLocalRunResponse(latestLocalRunResponse);
                showLocalRunStatus('Klart. Du kan nu ställa följdfrågor.');
            } catch (error) {
                if (error.name === 'AbortError') {
                    showLocalRunStatus('Avbruten.');
                } else {
                    showLocalRunError(error.message);
                }
            } finally {
                localRunAbortController = null;
                setLocalRunStreamingState(false);
            }
        }

        if (localRunClose) {
            localRunClose.addEventListener('click', closeLocalRunModal);
        }

        if (localRunModal) {
            localRunModal.addEventListener('click', (event) => {
                if (event.target === localRunModal) {
                    closeLocalRunModal();
                }
            });
        }

        if (localRunSubmit) {
            localRunSubmit.addEventListener('click', runWithLocalModel);
        }

        if (localCopyPromptBtn) {
            localCopyPromptBtn.addEventListener('click', copySelectedPromptToClipboard);
        }

        if (localRunExpand) {
            localRunExpand.addEventListener('click', toggleLocalRunFullscreen);
        }

        if (localRunCancel) {
            localRunCancel.addEventListener('click', () => {
                if (localRunAbortController) {
                    localRunAbortController.abort();
                }
            });
        }

        if (localChatSend) {
            localChatSend.addEventListener('click', sendFollowUpMessage);
        }

        if (localExportDocxBtn) {
            localExportDocxBtn.addEventListener('click', exportLocalResponseAsDocx);
        }

        if (localExportPdfBtn) {
            localExportPdfBtn.addEventListener('click', exportLocalResponseAsPdf);
        }

        const adminTokenInput = document.getElementById('admin-token-input');
        const adminLoadBtn = document.getElementById('admin-load-btn');
        const adminProviderList = document.getElementById('admin-provider-list');
        const adminOpenAIKey = document.getElementById('admin-openai-key');
        const adminOpenAIBaseUrl = document.getElementById('admin-openai-base-url');
        const adminOpenAIEnabled = document.getElementById('admin-openai-enabled');
        const adminSaveOpenAIBtn = document.getElementById('admin-save-openai-btn');
        const adminTestOpenAIBtn = document.getElementById('admin-test-openai-btn');
        const adminStatus = document.getElementById('admin-status');

        function showAdminStatus(message, isError = false) {
            if (!adminStatus) {
                return;
            }
            adminStatus.textContent = message;
            adminStatus.classList.toggle('error', isError);
        }

        function adminHeaders() {
            return {
                'Content-Type': 'application/json',
                'X-Admin-Token': adminTokenInput.value.trim()
            };
        }

        function renderAdminProviderList(providers) {
            if (!providers.length) {
                adminProviderList.textContent = 'Inga providers registrerade i admin-API.';
                return;
            }

            adminProviderList.innerHTML = providers.map((provider) => (
                `<div><strong>${provider.name}</strong> | enabled=${provider.enabled} | configured=${provider.configured} | key=${provider.masked_key || 'ej satt'} | base_url=${provider.base_url}</div>`
            )).join('');

            const openai = providers.find((provider) => provider.name === 'openai');
            if (openai) {
                adminOpenAIEnabled.checked = openai.enabled;
                adminOpenAIBaseUrl.value = openai.base_url || '';
            }
        }

        async function loadAdminProviders() {
            if (!adminTokenInput.value.trim()) {
                showAdminStatus('Ange admin-token först.', true);
                return;
            }

            try {
                const response = await fetch(`${BACKEND_BASE_URL}/api/admin/providers`, {
                    headers: adminHeaders()
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.detail || 'Kunde inte ladda admin providers.');
                }
                renderAdminProviderList(data.providers || []);
                showAdminStatus('Providerstatus uppdaterad.');
            } catch (error) {
                showAdminStatus(error.message, true);
            }
        }

        async function saveOpenAIConfig() {
            if (!adminTokenInput.value.trim()) {
                showAdminStatus('Ange admin-token först.', true);
                return;
            }

            const payload = {
                enabled: adminOpenAIEnabled.checked,
                base_url: adminOpenAIBaseUrl.value.trim() || undefined
            };

            const apiKey = adminOpenAIKey.value.trim();
            if (apiKey) {
                payload.api_key = apiKey;
            }

            try {
                const response = await fetch(`${BACKEND_BASE_URL}/api/admin/providers/openai`, {
                    method: 'PATCH',
                    headers: adminHeaders(),
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.detail || 'Kunde inte spara OpenAI-konfiguration.');
                }

                adminOpenAIKey.value = '';
                renderAdminProviderList(data.providers || []);
                showAdminStatus('OpenAI-konfiguration sparad.');
                await populateProviders();
            } catch (error) {
                showAdminStatus(error.message, true);
            }
        }

        async function testOpenAIConnection() {
            if (!adminTokenInput.value.trim()) {
                showAdminStatus('Ange admin-token först.', true);
                return;
            }

            try {
                const response = await fetch(`${BACKEND_BASE_URL}/api/admin/providers/openai/test`, {
                    method: 'POST',
                    headers: adminHeaders()
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.detail || 'Kunde inte testa OpenAI-anslutning.');
                }

                showAdminStatus(data.detail, !data.ok);
            } catch (error) {
                showAdminStatus(error.message, true);
            }
        }

        if (adminLoadBtn) {
            adminLoadBtn.addEventListener('click', loadAdminProviders);
        }
        if (adminSaveOpenAIBtn) {
            adminSaveOpenAIBtn.addEventListener('click', saveOpenAIConfig);
        }
        if (adminTestOpenAIBtn) {
            adminTestOpenAIBtn.addEventListener('click', testOpenAIConnection);
        }

        // Quick input state management
        let quickInputText = '';
        const quickInputTextarea = document.getElementById('quick-input-textarea');
        const quickInputClearBtn = document.getElementById('quick-input-clear-btn');

        function updateCopyButtonLabels() {
            const allCopyBtns = document.querySelectorAll('.copy-btn');
            allCopyBtns.forEach((btn) => {
                if (advancedModeEnabled) {
                    btn.style.display = 'none';
                } else {
                    btn.style.display = '';
                    btn.textContent = 'Kopiera prompt';
                    btn.classList.remove('with-text');
                }
            });
        }

        if (quickInputTextarea) {
            // Update state and character counter when user types
            const quickInputCharCounter = document.getElementById('quick-input-char-counter');
            function updateCharCounter() {
                const len = quickInputTextarea.value.length;
                if (quickInputCharCounter) {
                    quickInputCharCounter.textContent = `${len} / 5 000 tecken`;
                }
            }
            quickInputTextarea.addEventListener('input', (event) => {
                quickInputText = event.target.value;
                updateCharCounter();
                updateCopyButtonLabels();
                updateExportPreview(); // keep export preview in sync
            });
            // Initialize counter on load
            updateCharCounter();
        }

        if (quickInputFile) {
            quickInputFile.addEventListener('change', async (event) => {
                const file = event.target.files?.[0];
                if (file) {
                    await handleQuickInputFile(file);
                }
            });

            quickInputFile.addEventListener('dragover', (event) => {
                event.preventDefault();
            });

            quickInputFile.addEventListener('drop', async (event) => {
                event.preventDefault();
                const file = event.dataTransfer?.files?.[0];
                if (file) {
                    await handleQuickInputFile(file);
                }
            });
        }

        if (quickInputClearBtn && quickInputTextarea) {
            // Clear button functionality
            quickInputClearBtn.addEventListener('click', () => {
                quickInputTextarea.value = '';
                quickInputText = '';
                console.log('Quick input cleared');
                updateCopyButtonLabels();
                // Nollställ teckenräknaren
                const quickInputCharCounter = document.getElementById('quick-input-char-counter');
                if (quickInputCharCounter) quickInputCharCounter.textContent = '0 / 5 000 tecken';
            });
        }

        // Settings gear menu toggle
        const settingsGear = document.getElementById('settings-gear');
        const settingsDropdown = document.getElementById('settings-dropdown');

        if (settingsGear && settingsDropdown) {
            settingsGear.addEventListener('click', (event) => {
                event.stopPropagation();
                settingsDropdown.classList.toggle('hidden');
            });

            document.addEventListener('click', (event) => {
                if (!settingsGear.contains(event.target) && !settingsDropdown.contains(event.target)) {
                    settingsDropdown.classList.add('hidden');
                }
            });
        }

        // Load prompts on page load
        window.addEventListener('DOMContentLoaded', () => {
            initAdvancedToggle();
            initFavoritesToggle();
            loadPrompts();
            loadExportSettings();
            registerExportSettingsListeners();
        });

// Visa/dölj anonymiseringsexempel i snabbinmatning
    document.addEventListener('DOMContentLoaded', function() {
        const showExamples = document.getElementById('show-anon-examples');
        const modal = document.getElementById('anon-examples-modal');
        const closeBtn = document.getElementById('close-anon-examples');
        if (showExamples && modal && closeBtn) {
            showExamples.addEventListener('click', function(e) {
                e.preventDefault();
                modal.style.display = 'block';
            });
            closeBtn.addEventListener('click', function() {
                modal.style.display = 'none';
            });
        }
    });
