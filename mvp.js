(function () {
    const BACKEND_BASE_URL = window.location.hostname === "localhost" ? "http://localhost:8001" : "";
    const PROMPT_FILES = {
        klarsprak: "prompts/klarsprak.txt",
        sammanfattning: "prompts/sammanfattning.txt",
        beslutsunderlag: "prompts/beslutsunderlag.txt",
        reflektion: "prompts/reflektion.txt",
        informationsutskick: "prompts/informationsutskick.txt",
        anteckningar: "prompts/anteckningar.txt"
    };

    const MODE_CONFIG = {
        reason: {
            label: "Resonera kring en fråga",
            description: "Sortera frågan, se alternativ och få stöd fram mot rekommendation.",
            sourceHelper: "Skriv frågan, situationen eller underlaget du vill förstå bättre.",
            placeholder: "Beskriv frågan, nuläget och vad som känns oklart...",
            focuses: [
                { id: "clarify", label: "Sortera frågan", promptKey: "reflektion" },
                { id: "alternatives", label: "Belys alternativ", promptKey: "reflektion" },
                { id: "recommendation", label: "Landa i rekommendation", promptKey: "beslutsunderlag" }
            ],
            refineActions: [
                { id: "shorter", label: "Gör kortare", instruction: "Förfina föregående svar. Behåll innehållet men gör det kortare och mer koncentrerat." },
                { id: "clearer", label: "Gör tydligare", instruction: "Förfina föregående svar. Gör resonemanget tydligare och enklare att följa." },
                { id: "action", label: "Gör mer handlingsinriktat", instruction: "Förfina föregående svar. Lyft fram beslutspunkter, nästa steg och ansvar." }
            ]
        },
        draft: {
            label: "Skriv något direkt",
            description: "Bygg ett första utkast från råtext eller stödord utan att gå via fri chatt.",
            sourceHelper: "Klistra in stödord, anteckningar eller ett halvfärdigt underlag.",
            placeholder: "Klistra in anteckningar, huvudpunkter eller råtext...",
            focuses: [
                { id: "decision", label: "Beslutsunderlag", promptKey: "beslutsunderlag" },
                { id: "notice", label: "Informationsutskick", promptKey: "informationsutskick" },
                { id: "meeting", label: "Strukturera anteckningar", promptKey: "anteckningar" }
            ],
            refineActions: [
                { id: "formal", label: "Mer formellt", instruction: "Förfina föregående svar. Gör tonen mer formell och saklig." },
                { id: "plain", label: "Mer begripligt", instruction: "Förfina föregående svar. Gör texten enklare att förstå utan att tappa precision." },
                { id: "sharper", label: "Tydligare slutsats", instruction: "Förfina föregående svar. Gör rekommendation, beslut eller nästa steg tydligare." }
            ]
        },
        improve: {
            label: "Förbättra en text",
            description: "För dig som redan har text och vill få den tydligare, kortare eller mer användbar.",
            sourceHelper: "Klistra in den text du vill förbättra. Originalet används som grund för första versionen.",
            placeholder: "Klistra in din befintliga text här...",
            focuses: [
                { id: "plain_language", label: "Klarspråk", promptKey: "klarsprak" },
                { id: "summary", label: "Sammanfatta", promptKey: "sammanfattning" },
                { id: "structure", label: "Strukturera om", promptKey: "anteckningar" }
            ],
            refineActions: [
                { id: "shorter", label: "Kortare", instruction: "Förfina föregående svar. Gör texten kortare men behåll kärnan." },
                { id: "clearer", label: "Tydligare", instruction: "Förfina föregående svar. Använd enklare språk och tydligare struktur." },
                { id: "plain", label: "Mer klarspråk", instruction: "Förfina föregående svar. Skriv för läsare utan fackkunskap." }
            ]
        }
    };

    const SECTION_ORDER = [
        { key: "UTKAST", title: "Utkast" },
        { key: "SAMMANFATTNING", title: "Sammanfattning" },
        { key: "KLARSPRAK", title: "Klarspråk" }
    ];

    const DOCX_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const DOCX_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
    const SELECTION_HIGHLIGHT_NAME = "promptbanken-selection";
    const WORKSPACE_STORAGE_KEY = "promptbanken-mvp-workspace-v3";
    const DEFAULT_DOCUMENT_TITLE = "Nytt arbetsutkast";
    const AUTOSAVE_DELAY_MS = 900;
    const SELECTION_COMMANDS = [
        { id: "shorten", label: "Förkorta", instruction: "Gör texten kortare men behåll innebörden." },
        { id: "clarify", label: "Förtydliga", instruction: "Gör texten tydligare och lättare att förstå." },
        { id: "plain", label: "Klarspråk", instruction: "Skriv om texten i klarspråk för läsare utan fackkunskap." },
        { id: "formal", label: "Mer formellt", instruction: "Gör texten mer formell och saklig." },
        { id: "summary", label: "Sammanfatta", instruction: "Sammanfatta texten kort och kärnfullt." },
        { id: "bullets", label: "Punktlista", instruction: "Skriv om texten till en tydlig punktlista." }
    ];

    const state = {
        mode: "reason",
        focusId: "",
        promptLibrary: {},
        providerPreference: "auto",
        isCopyMode: false,
        modelProvider: "",
        modelName: "",
        modelLabel: "",
        conversation: [],
        latestResult: "",
        latestSections: [],
        versions: [],
        activeVersionId: "",
        refineHistory: [],
        hasDocument: false,
        documentTitle: DEFAULT_DOCUMENT_TITLE,
        autosaveTimer: null,
        isRestoringWorkspace: false,
        selectedDraftText: "",
        selectedDraftOffsets: null,
        selectedDraftAnchorRect: null,
        pendingSelectionReplacement: "",
        currentStreamAbortController: null,
        currentStreamRunId: 0
    };

    const els = {
        startModeGrid: document.getElementById("start-mode-grid"),
        workflowTitle: document.getElementById("workflow-title"),
        workflowDescription: document.getElementById("workflow-description"),
        sourceText: document.getElementById("source-text"),
        sourceHelper: document.getElementById("source-helper"),
        sourceCounter: document.getElementById("source-counter"),
        focusOptions: document.getElementById("focus-options"),
        audienceInput: document.getElementById("audience-input"),
        goalInput: document.getElementById("goal-input"),
        providerSelect: document.getElementById("provider-select"),
        modelSelect: document.getElementById("model-select"),
        resetWorkflowBtn: document.getElementById("reset-workflow-btn"),
        generateBtn: document.getElementById("generate-btn"),
        activeModeLabel: document.getElementById("active-mode-label"),
        activeFocusLabel: document.getElementById("active-focus-label"),
        statusText: document.getElementById("status-text"),
        resultTitle: document.getElementById("result-title"),
        resultSubtitle: document.getElementById("result-subtitle"),
        resultGrid: document.getElementById("result-grid"),
        streamIndicator: document.getElementById("stream-indicator"),
        streamIndicatorTitle: document.getElementById("stream-indicator-title"),
        streamIndicatorText: document.getElementById("stream-indicator-text"),
        documentHistoryList: document.getElementById("document-history-list"),
        documentShell: document.getElementById("document-shell"),
        documentPage: document.getElementById("document-page"),
        documentContent: document.getElementById("document-content"),
        documentTitleInput: document.getElementById("document-title-input"),
        saveStatusText: document.getElementById("save-status-text"),
        saveDocumentBtn: document.getElementById("save-document-btn"),
        undoAiBtn: document.getElementById("undo-ai-btn"),
        selectionToolbar: document.getElementById("selection-toolbar"),
        selectionToolbarText: document.getElementById("selection-toolbar-text"),
        selectionOpenEditorBtn: document.getElementById("selection-open-editor-btn"),
        selectionEditor: document.getElementById("selection-editor"),
        selectionSourceInput: document.getElementById("selection-source-input"),
        selectionInstructionInput: document.getElementById("selection-instruction-input"),
        selectionQuickActions: document.getElementById("selection-quick-actions"),
        selectionProcessBtn: document.getElementById("selection-process-btn"),
        selectionResultBlock: document.getElementById("selection-result-block"),
        selectionResultPreview: document.getElementById("selection-result-preview"),
        selectionApplyBtn: document.getElementById("selection-apply-btn"),
        selectionCancelBtn: document.getElementById("selection-cancel-btn"),
        copyDraftBtn: document.getElementById("copy-draft-btn"),
        copyResultBtn: document.getElementById("copy-result-btn"),
        exportDocxBtn: document.getElementById("export-docx-btn"),
        exportPdfBtn: document.getElementById("export-pdf-btn"),
        stopStreamBtn: document.getElementById("stop-stream-btn"),
        refineActions: document.getElementById("refine-actions"),
        refineChatMessages: document.getElementById("refine-chat-messages"),
        refineChatEmpty: document.getElementById("refine-chat-empty"),
        refineInput: document.getElementById("refine-input"),
        refineBtn: document.getElementById("refine-btn"),
        newDocumentBtn: document.getElementById("new-document-btn"),
        privacyWarning: document.getElementById("privacy-warning")
    };

    function setStatus(message, isError = false) {
        els.statusText.textContent = message;
        els.statusText.classList.toggle("is-error", Boolean(isError));
    }

    function escapeHtml(text) {
        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function escapeXml(text) {
        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    async function loadPromptLibrary() {
        const entries = Object.entries(PROMPT_FILES);
        await Promise.all(entries.map(async ([key, path]) => {
            try {
                const response = await fetch(path);
                if (!response.ok) {
                    throw new Error(path);
                }
                state.promptLibrary[key] = await response.text();
            } catch (_error) {
                state.promptLibrary[key] = "";
            }
        }));
    }

    function getFocusConfig() {
        const modeConfig = MODE_CONFIG[state.mode];
        return modeConfig.focuses.find((item) => item.id === state.focusId) || modeConfig.focuses[0];
    }

    function renderStartModes() {
        els.startModeGrid.querySelectorAll("[data-mode]").forEach((button) => {
            button.classList.toggle("is-selected", button.dataset.mode === state.mode);
        });
    }

    function renderFocusOptions() {
        const modeConfig = MODE_CONFIG[state.mode];
        if (!state.focusId || !modeConfig.focuses.some((item) => item.id === state.focusId)) {
            state.focusId = modeConfig.focuses[0].id;
        }

        els.focusOptions.innerHTML = "";
        modeConfig.focuses.forEach((focus) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "chip";
            button.textContent = focus.label;
            button.classList.toggle("is-selected", focus.id === state.focusId);
            button.addEventListener("click", () => {
                state.focusId = focus.id;
                renderFocusOptions();
                renderSummary();
            });
            els.focusOptions.appendChild(button);
        });
    }

    function renderRefineActions() {
        const modeConfig = MODE_CONFIG[state.mode];
        els.refineActions.innerHTML = "";
        modeConfig.refineActions.forEach((action) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "chip";
            button.textContent = action.label;
            button.disabled = !state.latestResult || Boolean(state.currentStreamAbortController);
            button.addEventListener("click", () => runRefinement(action.instruction, action.label));
            els.refineActions.appendChild(button);
        });
    }

    function renderSummary() {
        const modeConfig = MODE_CONFIG[state.mode];
        const focus = getFocusConfig();
        els.workflowTitle.textContent = modeConfig.label;
        els.workflowDescription.textContent = modeConfig.description;
        els.sourceHelper.textContent = modeConfig.sourceHelper;
        els.sourceText.placeholder = modeConfig.placeholder;
        els.activeModeLabel.textContent = modeConfig.label;
        els.activeFocusLabel.textContent = `Fokus nu: ${focus.label}`;
    }

    function updateSourceCounter() {
        els.sourceCounter.textContent = `${els.sourceText.value.length} / 10 000`;
    }

    function setSaveStatus(text) {
        els.saveStatusText.textContent = text;
    }

    function markWorkspaceDirty(message = "Ändringar väntar på sparning") {
        if (state.isRestoringWorkspace) {
            return;
        }
        setSaveStatus(message);
        els.saveDocumentBtn.disabled = !state.hasDocument;
        scheduleAutosave();
    }

    function clearAutosaveTimer() {
        if (state.autosaveTimer) {
            window.clearTimeout(state.autosaveTimer);
            state.autosaveTimer = null;
        }
    }

    function normalizeTextContent(text) {
        return String(text || "")
            .replace(/\r\n/g, "\n")
            .replace(/\u00a0/g, " ")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    }

    function resetResults() {
        state.latestResult = "";
        state.latestSections = [];
        state.conversation = [];
        state.versions = [];
        state.activeVersionId = "";
        state.refineHistory = [];
        state.hasDocument = false;
        state.documentTitle = DEFAULT_DOCUMENT_TITLE;
        clearAutosaveTimer();
        state.selectedDraftText = "";
        state.selectedDraftOffsets = null;
        state.selectedDraftAnchorRect = null;
        state.pendingSelectionReplacement = "";
        els.resultTitle.textContent = "Ingen version skapad ännu";
        els.resultSubtitle.textContent = "När du kör arbetsytan visas resultatet här.";
        els.resultGrid.innerHTML = `
            <article class="result-card empty-card">
                <h3>Väntar på underlag</h3>
                <p>Välj startläge, klistra in text och skapa första version.</p>
            </article>
        `;
        els.documentShell.hidden = true;
        els.documentContent.innerHTML = "";
        els.documentContent.classList.remove("is-empty");
        els.documentHistoryList.innerHTML = `<div class="document-history-empty">Ingen historik ännu.</div>`;
        els.documentTitleInput.value = state.documentTitle;
        els.selectionToolbar.hidden = true;
        els.selectionOpenEditorBtn.disabled = true;
        els.selectionEditor.hidden = true;
        els.selectionResultBlock.hidden = true;
        els.selectionSourceInput.value = "";
        els.selectionInstructionInput.value = "";
        els.selectionResultPreview.textContent = "";
        els.streamIndicator.hidden = true;
        els.copyDraftBtn.disabled = true;
        els.copyResultBtn.disabled = true;
        els.exportDocxBtn.disabled = true;
        els.exportPdfBtn.disabled = true;
        els.refineBtn.disabled = true;
        els.saveDocumentBtn.disabled = true;
        els.undoAiBtn.disabled = true;
        els.refineChatMessages.innerHTML = "";
        els.refineChatMessages.appendChild(els.refineChatEmpty);
        els.refineChatEmpty.hidden = false;
        clearPersistentSelectionHighlight();
        setSaveStatus("Inte sparat ännu");
        renderRefineActions();
        updatePrivacyWarning();
    }

    function parseSections(text) {
        const raw = String(text || "");
        const sections = [];
        const structureStart = raw.indexOf("[[STRUKTUR]]");

        if (structureStart !== -1) {
            const structureEndCandidates = [
                raw.indexOf("[[UTKAST]]", structureStart + 12),
                raw.indexOf("[[SAMMANFATTNING]]", structureStart + 12),
                raw.indexOf("[[KLARSPRAK]]", structureStart + 12)
            ].filter((index) => index !== -1);
            const structureEnd = structureEndCandidates.length ? Math.min(...structureEndCandidates) : raw.length;
            const structureContent = raw.slice(structureStart + 12, structureEnd).trim();

            if (structureContent) {
                sections.push({
                    key: "STRUKTUR",
                    title: "Struktur",
                    content: structureContent
                });
            }
        }

        SECTION_ORDER.forEach((section, index) => {
            const startMarker = `[[${section.key}]]`;
            const startIndex = raw.indexOf(startMarker);
            if (startIndex === -1) {
                return;
            }

            let endIndex = raw.length;
            for (let nextIndex = index + 1; nextIndex < SECTION_ORDER.length; nextIndex += 1) {
                const candidate = raw.indexOf(`[[${SECTION_ORDER[nextIndex].key}]]`, startIndex + startMarker.length);
                if (candidate !== -1) {
                    endIndex = candidate;
                    break;
                }
            }

            const content = raw.slice(startIndex + startMarker.length, endIndex).trim();
            sections.push({
                key: section.key,
                title: section.title,
                content
            });
        });

        if (!sections.length && raw.trim()) {
            sections.push({
                key: "SVAR",
                title: "Svar",
                content: raw.trim()
            });
        }

        return sections;
    }

    function firstSentences(text, maxSentences = 3) {
        const matches = String(text || "").trim().match(/[^.!?]+[.!?]?/g) || [];
        return matches.slice(0, maxSentences).join(" ").trim() || String(text || "").trim();
    }

    function buildStructureFallback(mapped, raw) {
        const structureSource = mapped.get("UTKAST")?.content
            || mapped.get("SAMMANFATTNING")?.content
            || mapped.get("KLARSPRAK")?.content
            || raw;
        const lines = String(structureSource || "")
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 6);

        if (!lines.length) {
            return "";
        }

        return lines
            .map((line) => line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""))
            .map((line) => `- ${line}`)
            .join("\n");
    }

    function normalizeSections(rawText, parsedSections, options = {}) {
        const { allowRawFallback = true } = options;
        const raw = String(rawText || "").trim();
        const mapped = new Map(parsedSections.map((section) => [section.key, section]));
        const structureFallback = buildStructureFallback(mapped, raw);
        const draftFallback = (allowRawFallback ? raw : "")
            || mapped.get("KLARSPRAK")?.content
            || mapped.get("SAMMANFATTNING")?.content
            || "";
        const summaryFallback = firstSentences(
            mapped.get("SAMMANFATTNING")?.content
            || mapped.get("KLARSPRAK")?.content
            || (allowRawFallback ? raw : ""),
            3
        );
        const plainFallback = mapped.get("KLARSPRAK")?.content || draftFallback;

        return [
            {
                key: "STRUKTUR",
                title: "Struktur",
                content: mapped.get("STRUKTUR")?.content || structureFallback
            },
            {
                key: "UTKAST",
                title: "Utkast",
                content: mapped.get("UTKAST")?.content || draftFallback
            },
            {
                key: "SAMMANFATTNING",
                title: "Sammanfattning",
                content: mapped.get("SAMMANFATTNING")?.content || summaryFallback || draftFallback
            },
            {
                key: "KLARSPRAK",
                title: "Klarspråk",
                content: mapped.get("KLARSPRAK")?.content || plainFallback
            }
        ].filter((section) => section.content && section.content.trim());
    }

    function formatInline(text) {
        let output = escapeHtml(text);
        output = output.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        output = output.replace(/_(.+?)_/g, "<em>$1</em>");
        return output;
    }

    function renderDocumentMarkup(text) {
        const lines = String(text || "").split(/\r?\n/);
        const parts = [];
        let inList = false;

        const closeList = () => {
            if (inList) {
                parts.push("</ul>");
                inList = false;
            }
        };

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (!trimmed) {
                closeList();
                if (index < lines.length - 1) {
                    parts.push("<p>&nbsp;</p>");
                }
                return;
            }

            if (trimmed.startsWith("### ")) {
                closeList();
                parts.push(`<h3>${formatInline(trimmed.slice(4))}</h3>`);
                return;
            }

            if (trimmed.startsWith("## ")) {
                closeList();
                parts.push(`<h2>${formatInline(trimmed.slice(3))}</h2>`);
                return;
            }

            if (trimmed.startsWith("# ")) {
                closeList();
                parts.push(`<h1>${formatInline(trimmed.slice(2))}</h1>`);
                return;
            }

            if (/^[A-ZÅÄÖ][A-ZÅÄÖ\s]{2,60}$/.test(trimmed) && trimmed.length <= 60) {
                closeList();
                parts.push(`<h2>${formatInline(trimmed)}</h2>`);
                return;
            }

            if (/^.{1,80}:$/.test(trimmed)) {
                closeList();
                parts.push(`<h2>${formatInline(trimmed.replace(/:$/, ""))}</h2>`);
                return;
            }

            if (/^\d+\.\s+[A-ZÅÄÖ]/.test(trimmed)) {
                closeList();
                parts.push(`<h2>${formatInline(trimmed)}</h2>`);
                return;
            }

            if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
                if (!inList) {
                    parts.push("<ul>");
                    inList = true;
                }
                parts.push(`<li>${formatInline(trimmed.replace(/^([-*]|\d+\.)\s+/, ""))}</li>`);
                return;
            }

            if (/^---+$/.test(trimmed)) {
                closeList();
                parts.push("<hr>");
                return;
            }

            closeList();
            parts.push(`<p>${formatInline(trimmed)}</p>`);
        });

        closeList();
        return parts.join("");
    }

    function getDraftSection() {
        return state.latestSections.find((section) => section.key === "UTKAST") || null;
    }

    function ensureDraftSection() {
        let draftSection = getDraftSection();
        if (!draftSection) {
            draftSection = { key: "UTKAST", title: "Utkast", content: "" };
            state.latestSections = [{ key: "STRUKTUR", title: "Struktur", content: "" }, draftSection];
        }
        return draftSection;
    }

    function getActiveVersion() {
        return state.versions.find((version) => version.id === state.activeVersionId) || null;
    }

    function syncCurrentSectionsToActiveVersion() {
        const activeVersion = getActiveVersion();
        if (!activeVersion) {
            return;
        }
        activeVersion.sections = state.latestSections.map((section) => ({ ...section }));
        activeVersion.rawResult = state.latestResult;
        activeVersion.documentTitle = state.documentTitle;
        activeVersion.hasDocument = state.hasDocument;
    }

    function updateUndoAvailability() {
        const activeIndex = state.versions.findIndex((version) => version.id === state.activeVersionId);
        els.undoAiBtn.disabled = activeIndex < 0 || activeIndex >= state.versions.length - 1;
    }

    function renderVersionHistory() {
        if (!state.versions.length) {
            els.documentHistoryList.innerHTML = `<div class="document-history-empty">Ingen historik ännu.</div>`;
            updateUndoAvailability();
            return;
        }

        els.documentHistoryList.innerHTML = "";
        state.versions.forEach((version) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "document-history-item";
            button.classList.toggle("is-active", version.id === state.activeVersionId);
            button.innerHTML = `<strong>${escapeHtml(version.label)}</strong><span>${escapeHtml(version.subtitle)}</span>`;
            button.addEventListener("click", () => restoreVersion(version.id));
            els.documentHistoryList.appendChild(button);
        });
        updateUndoAvailability();
    }

    function createVersionSnapshot(label, subtitle, meta = {}) {
        const versionId = `version-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        state.versions.unshift({
            id: versionId,
            label,
            subtitle,
            sections: state.latestSections.map((section) => ({ ...section })),
            rawResult: state.latestResult,
            documentTitle: state.documentTitle,
            hasDocument: state.hasDocument,
            kind: meta.kind || "snapshot"
        });
        state.activeVersionId = versionId;
        renderVersionHistory();
    }

    function restoreVersion(versionId) {
        const version = state.versions.find((item) => item.id === versionId);
        if (!version) {
            return;
        }
        state.activeVersionId = versionId;
        state.latestResult = version.rawResult;
        state.latestSections = version.sections.map((section) => ({ ...section }));
        state.documentTitle = version.documentTitle || DEFAULT_DOCUMENT_TITLE;
        state.hasDocument = version.hasDocument !== false;
        els.documentTitleInput.value = state.documentTitle;
        els.resultTitle.textContent = version.label;
        els.resultSubtitle.textContent = version.subtitle;
        renderResultCardsOnly();
        renderDocumentDraft();
        renderVersionHistory();
        setSaveStatus("Tidigare version återställd");
        persistWorkspace("Tidigare version sparad");
    }

    function renderResultCardsOnly() {
        els.resultGrid.innerHTML = "";
        state.latestSections
            .filter((section) => section.key !== "UTKAST")
            .forEach((section) => {
                const card = document.createElement("article");
                card.className = "result-card";
                card.innerHTML = `<h3>${escapeHtml(section.title)}</h3><pre>${escapeHtml(section.content || "(Tom sektion)")}</pre>`;
                els.resultGrid.appendChild(card);
            });
    }

    function renderDocumentDraft() {
        const draft = getDraftSection();
        if (!state.hasDocument && (!draft || !draft.content.trim())) {
            els.documentShell.hidden = true;
            els.documentContent.innerHTML = "";
            els.copyDraftBtn.disabled = true;
            els.selectionToolbar.hidden = true;
            els.selectionOpenEditorBtn.disabled = true;
            els.selectionEditor.hidden = true;
            state.selectedDraftAnchorRect = null;
            clearPersistentSelectionHighlight();
            return;
        }

        const draftContent = draft?.content || "";
        els.documentShell.hidden = false;
        els.documentTitleInput.value = state.documentTitle;
        els.documentContent.classList.toggle("is-empty", !draftContent.trim());
        els.documentContent.innerHTML = draftContent.trim()
            ? renderDocumentMarkup(draftContent)
            : "";
        els.selectionToolbar.hidden = true;
        els.selectionOpenEditorBtn.disabled = true;
        els.selectionEditor.hidden = true;
        state.selectedDraftAnchorRect = null;
        clearPersistentSelectionHighlight();
        els.copyDraftBtn.disabled = false;
        els.saveDocumentBtn.disabled = false;
    }

    function renderRefineHistory() {
        els.refineChatMessages.innerHTML = "";
        if (!state.refineHistory.length) {
            els.refineChatMessages.appendChild(els.refineChatEmpty);
            els.refineChatEmpty.hidden = false;
            return;
        }

        els.refineChatEmpty.hidden = true;
        state.refineHistory.forEach((item) => {
            const row = document.createElement("div");
            row.className = `refine-chat-message is-${item.role}`;
            const bubble = document.createElement("div");
            bubble.className = "refine-chat-bubble";
            bubble.innerHTML = `<span class="refine-chat-label">${item.role === "user" ? "Du" : "Arbetsytan"}</span>${escapeHtml(item.text)}`;
            row.appendChild(bubble);
            els.refineChatMessages.appendChild(row);
        });

        els.refineChatMessages.scrollTop = els.refineChatMessages.scrollHeight;
    }

    function renderResult(text, subtitle) {
        const sections = normalizeSections(text, parseSections(text));
        state.latestResult = text;
        state.latestSections = sections;

        els.resultTitle.textContent = "Version klar";
        els.resultSubtitle.textContent = subtitle;
        renderResultCardsOnly();
        renderDocumentDraft();
        const hasResult = Boolean(text.trim());
        els.copyResultBtn.disabled = !hasResult;
        els.exportDocxBtn.disabled = !hasResult;
        els.exportPdfBtn.disabled = !hasResult;
        els.refineBtn.disabled = !hasResult || Boolean(state.currentStreamAbortController);
        state.hasDocument = true;
        els.saveDocumentBtn.disabled = false;
        renderRefineActions();
        updateUndoAvailability();
    }

    function renderStreamingResult(text, subtitle) {
        const parsedSections = parseSections(text).filter((section) => section.key !== "SVAR");
        const sections = normalizeSections("", parsedSections, { allowRawFallback: false });
        state.latestResult = text;
        state.latestSections = sections;

        els.resultTitle.textContent = "Modellen arbetar";
        els.resultSubtitle.textContent = subtitle;
        renderResultCardsOnly();
        renderDocumentDraft();
        const hasStructuredContent = sections.some((section) => section.content && section.content.trim());
        els.copyResultBtn.disabled = !hasStructuredContent;
        els.exportDocxBtn.disabled = !hasStructuredContent;
        els.exportPdfBtn.disabled = !hasStructuredContent;
        els.refineBtn.disabled = true;
        renderRefineActions();
    }

    function clearPersistentSelectionHighlight() {
        if (typeof CSS !== "undefined" && CSS.highlights) {
            CSS.highlights.delete(SELECTION_HIGHLIGHT_NAME);
        }
    }

    function setPersistentSelectionHighlight(range) {
        clearPersistentSelectionHighlight();
        if (typeof CSS === "undefined" || !CSS.highlights || typeof Highlight !== "function") {
            return;
        }
        CSS.highlights.set(SELECTION_HIGHLIGHT_NAME, new Highlight(range.cloneRange()));
    }

    function getRangeVisualRect(range) {
        const rects = Array.from(range.getClientRects()).filter((rect) => rect.width || rect.height);
        const rect = rects[0] || range.getBoundingClientRect();
        if (!rect || (!rect.width && !rect.height)) {
            return null;
        }
        return {
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
        };
    }

    function positionFloatingPanel(element, anchorRect, options = {}) {
        if (!anchorRect) {
            return;
        }

        const pageRect = els.documentPage.getBoundingClientRect();
        const margin = options.margin || 18;
        const preferredWidth = options.width || 440;
        const maxWidth = Math.max(260, pageRect.width - margin * 2);
        const width = Math.min(preferredWidth, maxWidth);
        element.style.width = `${width}px`;

        const elementHeight = element.offsetHeight || 0;
        const pageTop = pageRect.top;
        const pageLeft = pageRect.left;
        const maxLeft = Math.max(margin, pageRect.width - width - margin);
        const desiredLeft = anchorRect.left - pageLeft;
        const left = Math.min(Math.max(desiredLeft, margin), maxLeft);

        let top;
        if (options.placement === "above") {
            top = anchorRect.top - pageTop - elementHeight - 12;
            if (top < margin) {
                top = anchorRect.bottom - pageTop + 12;
            }
        } else {
            top = anchorRect.bottom - pageTop + 12;
            if (top + elementHeight > pageRect.height - margin) {
                top = Math.max(margin, anchorRect.top - pageTop - elementHeight - 12);
            }
        }

        element.style.left = `${left}px`;
        element.style.top = `${top}px`;
    }

    function positionSelectionToolbar() {
        if (els.selectionToolbar.hidden || !state.selectedDraftAnchorRect) {
            return;
        }
        positionFloatingPanel(els.selectionToolbar, state.selectedDraftAnchorRect, {
            placement: "above",
            width: 320
        });
    }

    function positionSelectionEditor() {
        if (els.selectionEditor.hidden || !state.selectedDraftAnchorRect) {
            return;
        }
        positionFloatingPanel(els.selectionEditor, state.selectedDraftAnchorRect, {
            placement: "below",
            width: 520
        });
    }

    function scheduleSelectionUiPosition() {
        window.requestAnimationFrame(() => {
            positionSelectionToolbar();
            positionSelectionEditor();
        });
    }

    function updateSelectionState() {
        if (!els.selectionEditor.hidden) {
            return;
        }

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            state.selectedDraftText = "";
            state.selectedDraftOffsets = null;
            state.selectedDraftAnchorRect = null;
            els.selectionToolbar.hidden = true;
            els.selectionOpenEditorBtn.disabled = true;
            clearPersistentSelectionHighlight();
            return;
        }

        const range = selection.getRangeAt(0);
        if (!els.documentContent.contains(range.commonAncestorContainer)) {
            state.selectedDraftText = "";
            state.selectedDraftOffsets = null;
            state.selectedDraftAnchorRect = null;
            els.selectionToolbar.hidden = true;
            els.selectionOpenEditorBtn.disabled = true;
            clearPersistentSelectionHighlight();
            return;
        }

        const selectedText = selection.toString().trim();
        if (!selectedText) {
            state.selectedDraftText = "";
            state.selectedDraftOffsets = null;
            state.selectedDraftAnchorRect = null;
            els.selectionToolbar.hidden = true;
            els.selectionOpenEditorBtn.disabled = true;
            clearPersistentSelectionHighlight();
            return;
        }

        const offsets = getSelectionOffsetsWithin(els.documentContent, range);
        if (!offsets) {
            state.selectedDraftText = "";
            state.selectedDraftOffsets = null;
            state.selectedDraftAnchorRect = null;
            els.selectionToolbar.hidden = true;
            els.selectionOpenEditorBtn.disabled = true;
            clearPersistentSelectionHighlight();
            return;
        }

        const anchorRect = getRangeVisualRect(range);
        state.selectedDraftText = selectedText;
        state.selectedDraftOffsets = offsets;
        state.selectedDraftAnchorRect = anchorRect;
        setPersistentSelectionHighlight(range);
        els.selectionToolbarText.textContent = selectedText.length > 80
            ? `Text vald i utkastet: ${selectedText.slice(0, 80)}...`
            : `Text vald i utkastet: ${selectedText}`;
        els.selectionToolbar.hidden = false;
        els.selectionOpenEditorBtn.disabled = Boolean(state.currentStreamAbortController);
        scheduleSelectionUiPosition();
    }

    function getSelectionOffsetsWithin(container, range) {
        try {
            const startRange = range.cloneRange();
            startRange.selectNodeContents(container);
            startRange.setEnd(range.startContainer, range.startOffset);

            const endRange = range.cloneRange();
            endRange.selectNodeContents(container);
            endRange.setEnd(range.endContainer, range.endOffset);

            const start = startRange.toString().length;
            const end = endRange.toString().length;

            if (end <= start) {
                return null;
            }

            return { start, end };
        } catch (_error) {
            return null;
        }
    }

    function resolveDraftReplacementOffsets(draftText) {
        const originalSelection = state.selectedDraftText;
        const preferredOffsets = state.selectedDraftOffsets;

        if (
            preferredOffsets
            && preferredOffsets.end <= draftText.length
            && draftText.slice(preferredOffsets.start, preferredOffsets.end) === originalSelection
        ) {
            return preferredOffsets;
        }

        if (!originalSelection) {
            return null;
        }

        const occurrences = [];
        let fromIndex = 0;

        while (fromIndex < draftText.length) {
            const foundIndex = draftText.indexOf(originalSelection, fromIndex);
            if (foundIndex === -1) {
                break;
            }
            occurrences.push(foundIndex);
            fromIndex = foundIndex + Math.max(originalSelection.length, 1);
        }

        if (!occurrences.length) {
            return null;
        }

        const start = preferredOffsets
            ? occurrences.reduce((closest, current) => (
                Math.abs(current - preferredOffsets.start) < Math.abs(closest - preferredOffsets.start)
                    ? current
                    : closest
            ), occurrences[0])
            : occurrences[0];

        return {
            start,
            end: start + originalSelection.length
        };
    }

    function buildSystemInstruction() {
        const focus = getFocusConfig();
        const basePrompt = state.promptLibrary[focus.promptKey] || "";

        return [
            "Du arbetar i en produktiserad MVP for kommunal textbearbetning.",
            "Svara verksamhetsnara, tydligt och utan att agera som generell AI-assistent.",
            "Utga alltid fran anvandarens underlag och det valda fokusomradet.",
            "Ateranvand denna grundinstruktion nar den ar relevant:",
            basePrompt.trim(),
            "",
            "Returnera alltid exakt fyra sektioner med dessa markorer i denna ordning:",
            "[[STRUKTUR]]",
            "[[UTKAST]]",
            "[[SAMMANFATTNING]]",
            "[[KLARSPRAK]]",
            "",
            "Riktlinjer for sektionerna:",
            "- STRUKTUR: ge en enkel disposition eller huvudpunkter.",
            "- UTKAST: skriv ett anvandbart forsta utkast.",
            "- SAMMANFATTNING: 3-5 meningar med det viktigaste.",
            "- KLARSPRAK: skriv om i enkelt, tydligt och verksamhetsnara sprak.",
            "- Skriv pa svenska.",
            "- Hall MVP-smal omfattning och undvik extra roller eller overbyggnad."
        ].join("\n");
    }

    function buildInitialUserMessage() {
        const focus = getFocusConfig();
        const sourceText = els.sourceText.value.trim();
        return [
            `Startlage: ${MODE_CONFIG[state.mode].label}`,
            `Fokus: ${focus.label}`,
            `Dokumentnamn: ${els.documentTitleInput.value.trim() || state.documentTitle || DEFAULT_DOCUMENT_TITLE}`,
            `Mottagare: ${els.audienceInput.value.trim() || "Inte angiven"}`,
            `Onskat resultat: ${els.goalInput.value.trim() || "Inte angivet"}`,
            "",
            "Underlag:",
            sourceText || "Inget underlag inklistrat. Skapa ett första utkast utifrån fokus, mottagare och önskat resultat."
        ].join("\n");
    }

    function buildCopyPayload(userMessage) {
        return [
            "Instruktion:",
            buildSystemInstruction(),
            "",
            "Anvandarens underlag:",
            userMessage
        ].join("\n");
    }

    async function populateModels() {
        const providerPreference = els.providerSelect.value;
        state.providerPreference = providerPreference;
        state.isCopyMode = false;
        state.modelProvider = "";
        state.modelName = "";
        state.modelLabel = "";
        els.modelSelect.innerHTML = `<option value="">Laddar...</option>`;

        if (providerPreference === "copy") {
            state.isCopyMode = true;
            state.modelProvider = "copy";
            els.modelSelect.innerHTML = `<option value="">Kopiera till valfri LLM</option>`;
            setStatus("Kopiera-läge");
            return;
        }

        const openAiLevels = async () => {
            const response = await fetch(`${BACKEND_BASE_URL}/api/openai/models`);
            const payload = await response.json().catch(() => ({}));
            const available = new Set((payload.models || []).map((model) => model.name));
            const options = [
                { value: "gpt-5-mini", label: "Standard", model: "gpt-5-mini", provider: "openai" },
                { value: "gpt-5", label: "Hög kvalitet", model: "gpt-5", provider: "openai" },
                { value: "gpt-5-nano", label: "Snabbt", model: "gpt-5-nano", provider: "openai" }
            ].filter((option) => available.has(option.model));

            if (!response.ok || !options.length) {
                throw new Error("openai_unavailable");
            }
            return options;
        };

        const ollamaModels = async () => {
            const response = await fetch(`${BACKEND_BASE_URL}/api/models`);
            const payload = await response.json().catch(() => ({}));
            const options = (payload.models || []).map((model) => ({
                value: model.name,
                label: `Lokal modell · ${model.name}`,
                model: model.name,
                provider: "ollama"
            }));

            if (!response.ok || !options.length) {
                throw new Error("ollama_unavailable");
            }
            return options;
        };

        try {
            let options = [];

            if (providerPreference === "openai") {
                options = await openAiLevels();
            } else if (providerPreference === "ollama") {
                options = await ollamaModels();
            } else {
                try {
                    options = await openAiLevels();
                } catch (_error) {
                    options = await ollamaModels();
                }
            }

            const first = options[0];
            state.modelProvider = first.provider;
            state.modelName = first.model;
            state.modelLabel = first.label;
            els.modelSelect.innerHTML = options
                .map((option) => `<option value="${escapeHtml(option.value)}" data-provider="${escapeHtml(option.provider)}" data-model="${escapeHtml(option.model)}">${escapeHtml(option.label)}</option>`)
                .join("");
            els.modelSelect.value = first.value;
            setStatus("Klar");
        } catch (_error) {
            state.isCopyMode = true;
            state.modelProvider = "copy";
            els.modelSelect.innerHTML = `<option value="">Kopiera till valfri LLM</option>`;
            setStatus("Kopiera-läge");
        }
    }

    function setStreamingState(isStreaming) {
        els.stopStreamBtn.disabled = !isStreaming;
        els.generateBtn.disabled = isStreaming;
        els.providerSelect.disabled = isStreaming;
        els.modelSelect.disabled = isStreaming || state.isCopyMode;
        els.refineBtn.disabled = isStreaming || !state.latestResult;
        els.saveDocumentBtn.disabled = isStreaming || !state.hasDocument;
        els.undoAiBtn.disabled = isStreaming || els.undoAiBtn.disabled;
        els.selectionOpenEditorBtn.disabled = isStreaming || !state.selectedDraftText;
        els.selectionProcessBtn.disabled = isStreaming;
        els.selectionApplyBtn.disabled = isStreaming || !state.pendingSelectionReplacement;
        els.streamIndicator.hidden = !isStreaming;
        if (isStreaming) {
            els.streamIndicatorTitle.textContent = "Modellen arbetar";
            els.streamIndicatorText.textContent = state.modelProvider === "ollama"
                ? "Lokal modell skriver svar och bygger upp arbetsytan..."
                : "Svar byggs upp steg för steg i arbetsytan...";
            setSaveStatus("AI arbetar...");
        } else {
            els.streamIndicator.hidden = true;
            updateUndoAvailability();
        }
        renderRefineActions();
    }

    function stopActiveStream() {
        if (state.currentStreamAbortController) {
            state.currentStreamAbortController.abort();
        }
    }

    function mergeStreamingChunk(aggregated, chunk) {
        if (!chunk) {
            return aggregated;
        }

        if (!aggregated) {
            return chunk;
        }

        if (aggregated.endsWith(chunk)) {
            return aggregated;
        }

        if (chunk.startsWith(aggregated)) {
            return chunk;
        }

        const maxOverlap = Math.min(aggregated.length, chunk.length);
        for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
            if (aggregated.slice(-overlap) === chunk.slice(0, overlap)) {
                return aggregated + chunk.slice(overlap);
            }
        }

        return aggregated + chunk;
    }

    async function streamTextResponse(messages, options = {}) {
        const { onChunk } = options;
        const endpoint = state.modelProvider === "ollama"
            ? `${BACKEND_BASE_URL}/api/chat/stream`
            : `${BACKEND_BASE_URL}/api/openai/chat/stream`;
        const abortController = new AbortController();
        const runId = state.currentStreamRunId + 1;
        state.currentStreamRunId = runId;
        state.currentStreamAbortController = abortController;
        setStreamingState(true);

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: state.modelName,
                    messages
                }),
                signal: abortController.signal
            });

            if (!response.ok || !response.body) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.detail?.message || payload.detail || "Kunde inte generera svar.");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aggregated = "";

            while (true) {
                if (runId !== state.currentStreamRunId) {
                    throw new DOMException("Avbruten", "AbortError");
                }

                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                const chunk = decoder.decode(value, { stream: true });
                if (!chunk) {
                    continue;
                }
                aggregated = mergeStreamingChunk(aggregated, chunk);
                if (typeof onChunk === "function") {
                    onChunk(aggregated);
                }
            }

            aggregated = mergeStreamingChunk(aggregated, decoder.decode());
            if (typeof onChunk === "function") {
                onChunk(aggregated);
            }
            return aggregated;
        } finally {
            if (state.currentStreamAbortController === abortController) {
                state.currentStreamAbortController = null;
            }
            setStreamingState(false);
        }
    }

    async function runGeneration() {
        const source = els.sourceText.value.trim();
        const hasSetup = source || els.goalInput.value.trim() || els.audienceInput.value.trim();
        if (!hasSetup) {
            setStatus("Skriv underlag eller fyll i målbild först.", true);
            return;
        }

        const userMessage = buildInitialUserMessage();
        const systemInstruction = buildSystemInstruction();

        if (state.isCopyMode) {
            try {
                await navigator.clipboard.writeText(buildCopyPayload(userMessage));
                setStatus("Instruktion och underlag kopierat");
            } catch (_error) {
                setStatus("Kunde inte kopiera underlaget.", true);
            }
            return;
        }

        if (!state.modelName) {
            setStatus("Välj nivå eller modell först.", true);
            return;
        }

        state.conversation = [{ role: "user", content: userMessage }];
        state.refineHistory = [];
        state.hasDocument = true;
        renderRefineHistory();
        setStatus("Skapar första version...");

        try {
            const responseText = await streamTextResponse([
                { role: "system", content: systemInstruction },
                ...state.conversation
            ], {
                onChunk: (aggregated) => renderStreamingResult(aggregated, "Svar byggs upp steg för steg...")
            });
            state.conversation.push({ role: "assistant", content: responseText });
            renderResult(responseText, `${MODE_CONFIG[state.mode].label} · ${getFocusConfig().label}`);
            createVersionSnapshot("Första version", `${MODE_CONFIG[state.mode].label} · ${getFocusConfig().label}`, { kind: "ai" });
            persistWorkspace("Första version sparad");
            setStatus("Första version klar");
        } catch (error) {
            if (error?.name === "AbortError") {
                setStatus("Genereringen stoppades");
            } else {
                setStatus(error.message || "Generering misslyckades.", true);
            }
        }
    }

    async function runRefinement(instruction, label) {
        if (!state.latestResult) {
            return;
        }

        if (state.isCopyMode) {
            const payload = [
                buildCopyPayload(buildInitialUserMessage()),
                "",
                "Forfining:",
                instruction
            ].join("\n");
            try {
                await navigator.clipboard.writeText(payload);
                setStatus("Förfining kopierad");
            } catch (_error) {
                setStatus("Kunde inte kopiera förfining.", true);
            }
            return;
        }

        state.refineHistory.push({ role: "user", text: instruction });
        state.refineHistory.push({ role: "assistant", text: `Jobbar med: ${label}` });
        renderRefineHistory();
        setStatus(`Förfinar: ${label}...`);

        try {
            state.conversation.push({ role: "user", content: instruction });
            const responseText = await streamTextResponse([
                { role: "system", content: buildSystemInstruction() },
                ...state.conversation
            ], {
                onChunk: (aggregated) => renderStreamingResult(aggregated, "Svar byggs upp steg för steg...")
            });
            state.conversation.push({ role: "assistant", content: responseText });
            state.refineHistory[state.refineHistory.length - 1] = {
                role: "assistant",
                text: `Ny version skapad: ${label}`
            };
            renderResult(responseText, `Förfinat resultat · ${label}`);
            createVersionSnapshot(label, `Förfinat resultat · ${label}`, { kind: "ai" });
            persistWorkspace("Förfinad version sparad");
            renderRefineHistory();
            setStatus("Förfining klar");
        } catch (error) {
            state.refineHistory[state.refineHistory.length - 1] = {
                role: "assistant",
                text: error?.name === "AbortError" ? "Förfiningen stoppades." : `Förfining misslyckades: ${error.message || "okänt fel"}`
            };
            renderRefineHistory();
            if (error?.name === "AbortError") {
                setStatus("Förfiningen stoppades");
            } else {
                setStatus(error.message || "Förfining misslyckades.", true);
            }
        }
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function getPrintableSections() {
        return state.latestSections.map((section) => ({
            key: section.key,
            title: section.title,
            content: section.content
        }));
    }

    function buildPrintableHtml() {
        const sectionsHtml = getPrintableSections()
            .map((section) => {
                const content = section.key === "UTKAST"
                    ? renderDocumentMarkup(section.content)
                    : `<pre>${escapeHtml(section.content)}</pre>`;
                return `<section><h2>${escapeHtml(section.title)}</h2>${content}</section>`;
            })
            .join("");

        return `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(state.documentTitle || DEFAULT_DOCUMENT_TITLE)}</title>
<style>
body { font-family: Cambria, Georgia, serif; margin: 0; background: #f3f3f3; }
.page { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; padding: 20mm 18mm; box-sizing: border-box; }
h1, h2 { color: #1f2937; }
h1 { margin-top: 0; }
h2 { margin-top: 18px; }
p, li, pre { font-size: 12pt; line-height: 1.6; color: #1f2937; white-space: pre-wrap; }
ul { padding-left: 20px; }
@media print { body { background: white; } .page { margin: 0; width: auto; min-height: auto; box-shadow: none; } }
</style>
</head>
<body>
<div class="page">
<h1>${escapeHtml(state.documentTitle || DEFAULT_DOCUMENT_TITLE)}</h1>
${sectionsHtml}
</div>
</body>
</html>`;
    }

    async function exportPdf() {
        if (!state.latestResult) {
            return;
        }
        const exportWindow = window.open("", "_blank", "noopener,noreferrer,width=1024,height=768");
        if (!exportWindow) {
            setStatus("Kunde inte öppna exportfönster.", true);
            return;
        }
        exportWindow.document.open();
        exportWindow.document.write(buildPrintableHtml());
        exportWindow.document.close();
        exportWindow.focus();
        exportWindow.print();
        setStatus("PDF-export öppnad");
    }

    function sectionToDocxXml(section) {
        const lines = String(section.content || "").split(/\r?\n/);
        const paragraphs = [`<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(section.title)}</w:t></w:r></w:p>`];

        lines.forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) {
                paragraphs.push("<w:p/>");
                return;
            }
            const content = trimmed.replace(/^[-*]\s+/, "");
            paragraphs.push(`<w:p><w:r><w:t xml:space="preserve">${escapeXml(content)}</w:t></w:r></w:p>`);
        });

        return paragraphs.join("");
    }

    function buildDocxDocumentXml() {
        const body = state.latestSections.map(sectionToDocxXml).join("");
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
 xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
 xmlns:v="urn:schemas-microsoft-com:vml"
 xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:w10="urn:schemas-microsoft-com:office:word"
 xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
 xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
 xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
 xmlns:wne="http://schemas.microsoft.com/office/2006/wordml"
 xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
 mc:Ignorable="w14 wp14">
<w:body>
${body}
<w:sectPr>
<w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
</w:sectPr>
</w:body>
</w:document>`;
    }

    function crc32(bytes) {
        let crc = 0 ^ (-1);
        for (let i = 0; i < bytes.length; i += 1) {
            crc ^= bytes[i];
            for (let j = 0; j < 8; j += 1) {
                crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
            }
        }
        return (crc ^ (-1)) >>> 0;
    }

    function concatUint8Arrays(chunks) {
        const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(total);
        let offset = 0;
        chunks.forEach((chunk) => {
            result.set(chunk, offset);
            offset += chunk.length;
        });
        return result;
    }

    function createStoredZip(entries) {
        const encoder = new TextEncoder();
        const localFiles = [];
        const centralDirectory = [];
        let offset = 0;

        entries.forEach((entry) => {
            const nameBytes = encoder.encode(entry.name);
            const dataBytes = encoder.encode(entry.content);
            const crc = crc32(dataBytes);

            const localHeader = new Uint8Array(30 + nameBytes.length);
            const localView = new DataView(localHeader.buffer);
            localView.setUint32(0, 0x04034b50, true);
            localView.setUint16(4, 20, true);
            localView.setUint16(6, 0, true);
            localView.setUint16(8, 0, true);
            localView.setUint16(10, 0, true);
            localView.setUint16(12, 0, true);
            localView.setUint32(14, crc, true);
            localView.setUint32(18, dataBytes.length, true);
            localView.setUint32(22, dataBytes.length, true);
            localView.setUint16(26, nameBytes.length, true);
            localView.setUint16(28, 0, true);
            localHeader.set(nameBytes, 30);
            localFiles.push(localHeader, dataBytes);

            const centralHeader = new Uint8Array(46 + nameBytes.length);
            const centralView = new DataView(centralHeader.buffer);
            centralView.setUint32(0, 0x02014b50, true);
            centralView.setUint16(4, 20, true);
            centralView.setUint16(6, 20, true);
            centralView.setUint16(8, 0, true);
            centralView.setUint16(10, 0, true);
            centralView.setUint16(12, 0, true);
            centralView.setUint16(14, 0, true);
            centralView.setUint32(16, crc, true);
            centralView.setUint32(20, dataBytes.length, true);
            centralView.setUint32(24, dataBytes.length, true);
            centralView.setUint16(28, nameBytes.length, true);
            centralView.setUint16(30, 0, true);
            centralView.setUint16(32, 0, true);
            centralView.setUint16(34, 0, true);
            centralView.setUint16(36, 0, true);
            centralView.setUint32(38, 0, true);
            centralView.setUint32(42, offset, true);
            centralHeader.set(nameBytes, 46);
            centralDirectory.push(centralHeader);

            offset += localHeader.length + dataBytes.length;
        });

        const centralSize = centralDirectory.reduce((sum, chunk) => sum + chunk.length, 0);
        const endRecord = new Uint8Array(22);
        const endView = new DataView(endRecord.buffer);
        endView.setUint32(0, 0x06054b50, true);
        endView.setUint16(4, 0, true);
        endView.setUint16(6, 0, true);
        endView.setUint16(8, entries.length, true);
        endView.setUint16(10, entries.length, true);
        endView.setUint32(12, centralSize, true);
        endView.setUint32(16, offset, true);
        endView.setUint16(20, 0, true);

        return concatUint8Arrays([...localFiles, ...centralDirectory, endRecord]);
    }

    function exportDocx() {
        if (!state.latestResult) {
            return;
        }
        const zipBytes = createStoredZip([
            { name: "[Content_Types].xml", content: DOCX_CONTENT_TYPES },
            { name: "_rels/.rels", content: DOCX_RELS },
            { name: "word/document.xml", content: buildDocxDocumentXml() }
        ]);
        downloadBlob(
            new Blob([zipBytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
            `${(state.documentTitle || DEFAULT_DOCUMENT_TITLE).replace(/[\\/:*?"<>|]/g, "-")}.docx`
        );
        setStatus("DOCX exporterat");
    }

    async function copyText(text, successMessage) {
        try {
            await navigator.clipboard.writeText(text);
            setStatus(successMessage);
        } catch (_error) {
            setStatus("Kunde inte kopiera.", true);
        }
    }

    function rebuildRawResultFromSections() {
        state.latestResult = state.latestSections
            .filter((section) => section.content && section.content.trim())
            .map((section) => `[[${section.key}]]\n${section.content}`)
            .join("\n\n");
    }

    function syncDraftFromEditor() {
        const draftSection = ensureDraftSection();
        draftSection.content = normalizeTextContent(els.documentContent.innerText);
        state.hasDocument = true;
        rebuildRawResultFromSections();
        syncCurrentSectionsToActiveVersion();
        updatePrivacyWarning();
    }

    function persistWorkspace(statusMessage = "Sparat lokalt") {
        if (state.isRestoringWorkspace) {
            return;
        }
        clearAutosaveTimer();
        const payload = {
            mode: state.mode,
            focusId: state.focusId,
            sourceText: els.sourceText.value,
            audience: els.audienceInput.value,
            goal: els.goalInput.value,
            documentTitle: state.documentTitle,
            latestResult: state.latestResult,
            latestSections: state.latestSections,
            versions: state.versions,
            activeVersionId: state.activeVersionId,
            refineHistory: state.refineHistory,
            hasDocument: state.hasDocument
        };

        try {
            window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(payload));
            setSaveStatus(`${statusMessage} ${new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}`);
        } catch (_error) {
            setSaveStatus("Kunde inte spara lokalt");
        }
    }

    function scheduleAutosave() {
        clearAutosaveTimer();
        state.autosaveTimer = window.setTimeout(() => {
            persistWorkspace("Autosparat");
        }, AUTOSAVE_DELAY_MS);
    }

    function restoreWorkspaceFromStorage() {
        const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
        if (!raw) {
            return;
        }

        try {
            const workspace = JSON.parse(raw);
            state.isRestoringWorkspace = true;
            state.mode = workspace.mode || state.mode;
            state.focusId = workspace.focusId || state.focusId;
            state.documentTitle = workspace.documentTitle || DEFAULT_DOCUMENT_TITLE;
            state.latestResult = workspace.latestResult || "";
            state.latestSections = Array.isArray(workspace.latestSections) ? workspace.latestSections : [];
            state.versions = Array.isArray(workspace.versions) ? workspace.versions : [];
            state.activeVersionId = workspace.activeVersionId || "";
            state.refineHistory = Array.isArray(workspace.refineHistory) ? workspace.refineHistory : [];
            state.hasDocument = Boolean(workspace.hasDocument || state.latestSections.length);
            els.sourceText.value = workspace.sourceText || "";
            els.audienceInput.value = workspace.audience || "";
            els.goalInput.value = workspace.goal || "";
            els.documentTitleInput.value = state.documentTitle;
            renderStartModes();
            renderFocusOptions();
            renderRefineActions();
            renderSummary();
            updateSourceCounter();
            renderRefineHistory();

            if (state.latestSections.length || state.hasDocument) {
                els.resultTitle.textContent = "Tidigare utkast återställt";
                els.resultSubtitle.textContent = "Fortsätt där du slutade.";
                renderResultCardsOnly();
                renderDocumentDraft();
                renderVersionHistory();
                els.copyResultBtn.disabled = !state.latestResult;
                els.exportDocxBtn.disabled = !state.latestResult;
                els.exportPdfBtn.disabled = !state.latestResult;
                els.refineBtn.disabled = !state.latestResult;
                els.saveDocumentBtn.disabled = !state.hasDocument;
                setSaveStatus("Tidigare utkast återställt");
            }
        } catch (_error) {
            window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
        } finally {
            state.isRestoringWorkspace = false;
            updatePrivacyWarning();
            updateUndoAvailability();
        }
    }

    function detectSensitiveContent(text) {
        const value = String(text || "");
        const patterns = [
            /\b\d{6}[- ]?\d{4}\b/,
            /\b\d{8}[- ]?\d{4}\b/,
            /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
            /\b(?:\+46|0)\d[\d\s-]{7,}\b/,
            /\b(?:sekretess|hälsa|diagnos|personnummer|adress)\b/i
        ];

        return patterns.some((pattern) => pattern.test(value));
    }

    function updatePrivacyWarning() {
        const draftText = getDraftSection()?.content || "";
        const hasRisk = detectSensitiveContent(els.sourceText.value) || detectSensitiveContent(draftText);
        els.privacyWarning.hidden = !hasRisk;
    }

    function setDocumentTitle(title, syncInput = true) {
        state.documentTitle = title.trim() || DEFAULT_DOCUMENT_TITLE;
        if (syncInput && els.documentTitleInput.value !== state.documentTitle) {
            els.documentTitleInput.value = state.documentTitle;
        }
    }

    function createEmptyDocument() {
        state.hasDocument = true;
        state.latestSections = [
            { key: "STRUKTUR", title: "Struktur", content: "" },
            { key: "UTKAST", title: "Utkast", content: "" },
            { key: "SAMMANFATTNING", title: "Sammanfattning", content: "" },
            { key: "KLARSPRAK", title: "Klarspråk", content: "" }
        ];
        state.latestResult = "";
        if (!els.documentTitleInput.value.trim()) {
            els.documentTitleInput.value = DEFAULT_DOCUMENT_TITLE;
        }
        setDocumentTitle(els.documentTitleInput.value);
        els.resultTitle.textContent = "Tomt dokument";
        els.resultSubtitle.textContent = "Börja skriva själv eller skapa ett första utkast med AI.";
        renderResultCardsOnly();
        renderDocumentDraft();
        createVersionSnapshot("Tomt dokument", "Manuell start", { kind: "manual" });
        persistWorkspace("Tomt dokument sparat");
        setStatus("Tomt dokument öppnat");
    }

    function undoLatestAiChange() {
        const activeIndex = state.versions.findIndex((version) => version.id === state.activeVersionId);
        if (activeIndex === -1 || activeIndex >= state.versions.length - 1) {
            setStatus("Det finns ingen tidigare version att återgå till.", true);
            return;
        }
        restoreVersion(state.versions[activeIndex + 1].id);
        setStatus("Senaste AI-åtgärden ångrades");
    }

    function renderSelectionQuickActions() {
        els.selectionQuickActions.innerHTML = "";
        SELECTION_COMMANDS.forEach((command) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "chip";
            button.textContent = command.label;
            button.disabled = Boolean(state.currentStreamAbortController);
            button.addEventListener("click", () => {
                els.selectionInstructionInput.value = command.instruction;
                processSelectedDraftText();
            });
            els.selectionQuickActions.appendChild(button);
        });
    }

    function openSelectionEditor() {
        if (!state.selectedDraftText) {
            return;
        }
        state.pendingSelectionReplacement = "";
        els.selectionApplyBtn.disabled = true;
        els.selectionSourceInput.value = state.selectedDraftText;
        els.selectionResultPreview.textContent = "";
        els.selectionInstructionInput.value = "";
        els.selectionResultBlock.hidden = true;
        els.selectionToolbar.hidden = true;
        els.selectionEditor.hidden = false;
        renderSelectionQuickActions();
        scheduleSelectionUiPosition();
        els.selectionInstructionInput.focus();
    }

    function closeSelectionEditor(clearSelection = false) {
        state.pendingSelectionReplacement = "";
        els.selectionEditor.hidden = true;
        els.selectionResultBlock.hidden = true;
        els.selectionApplyBtn.disabled = true;
        els.selectionSourceInput.value = "";
        els.selectionInstructionInput.value = "";
        els.selectionResultPreview.textContent = "";
        if (clearSelection) {
            window.getSelection()?.removeAllRanges();
            state.selectedDraftText = "";
            state.selectedDraftOffsets = null;
            state.selectedDraftAnchorRect = null;
            els.selectionToolbar.hidden = true;
            els.selectionOpenEditorBtn.disabled = true;
            clearPersistentSelectionHighlight();
        } else if (state.selectedDraftText && state.selectedDraftAnchorRect) {
            els.selectionToolbar.hidden = false;
            els.selectionOpenEditorBtn.disabled = Boolean(state.currentStreamAbortController);
            scheduleSelectionUiPosition();
        }
    }

    async function processSelectedDraftText() {
        if (state.isCopyMode) {
            return;
        }
        if (!state.modelName) {
            setStatus("Välj nivå eller modell först.", true);
            return;
        }

        const instruction = els.selectionInstructionInput.value.trim();
        const sourceText = els.selectionSourceInput.value.trim();
        if (!instruction) {
            setStatus("Skriv vad du vill justera först.", true);
            return;
        }
        if (!sourceText) {
            setStatus("Den markerade texten saknas.", true);
            return;
        }
        if (!state.selectedDraftOffsets) {
            setStatus("Markeringen kunde inte sparas. Markera texten igen.", true);
            return;
        }
        setStatus("Bearbetar markerad text...");
        state.pendingSelectionReplacement = "";
        els.selectionApplyBtn.disabled = true;
        els.selectionResultPreview.textContent = "";
        els.selectionResultBlock.hidden = false;

        try {
            const responseText = await streamTextResponse([
                {
                    role: "system",
                    content: [
                        "Du ska bara skriva om den markerade texten.",
                        "Returnera endast den nya texten utan förklaringar, rubriker eller extra markup.",
                        "Bevara syfte och fakta men förbättra språk, ton och tydlighet."
                    ].join("\n")
                },
                {
                    role: "user",
                    content: `Instruktion:\n${instruction}\n\nText att bearbeta:\n${sourceText}`
                }
            ], {
                onChunk: (aggregated) => {
                    els.selectionResultPreview.textContent = aggregated;
                }
            });

            const replacement = responseText.trim();
            if (!replacement) {
                throw new Error("Tomt svar för markerad text.");
            }

            state.pendingSelectionReplacement = replacement;
            els.selectionResultPreview.textContent = replacement;
            els.selectionResultBlock.hidden = false;
            els.selectionApplyBtn.disabled = false;
            setStatus("Bearbetning klar");
        } catch (error) {
            if (error?.name === "AbortError") {
                setStatus("Bearbetningen stoppades");
            } else {
                els.selectionResultBlock.hidden = true;
                els.selectionApplyBtn.disabled = true;
                setStatus(error.message || "Kunde inte bearbeta markerad text.", true);
            }
        }
    }

    function applySelectedDraftReplacement() {
        const draftSection = getDraftSection();
        const replacement = state.pendingSelectionReplacement;
        if (!draftSection || !replacement) {
            setStatus("Det finns ingen bearbetad text att infoga.", true);
            return;
        }

        const originalDraftText = draftSection.content;
        const offsets = resolveDraftReplacementOffsets(originalDraftText);
        if (!offsets || offsets.end > originalDraftText.length) {
            setStatus("Kunde inte infoga på rätt ställe i originaltexten.", true);
            return;
        }

        draftSection.content = [
            originalDraftText.slice(0, offsets.start),
            replacement,
            originalDraftText.slice(offsets.end)
        ].join("");

        rebuildRawResultFromSections();
        syncCurrentSectionsToActiveVersion();
        renderResultCardsOnly();
        renderDocumentDraft();
        createVersionSnapshot("Markerad text infogad", "Bearbetad text infogad i originalutkastet", { kind: "ai" });
        state.refineHistory.push({ role: "user", text: `Markerad text bearbetad: ${els.selectionInstructionInput.value.trim()}` });
        state.refineHistory.push({ role: "assistant", text: "Bearbetad text infogades i originalutkastet. Övriga delar behölls." });
        renderRefineHistory();
        persistWorkspace("Markerad text sparad");
        closeSelectionEditor(true);
        setStatus("Bearbetad text infogad");
    }

    function bindEvents() {
        els.startModeGrid.addEventListener("click", (event) => {
            const button = event.target.closest("[data-mode]");
            if (!button) {
                return;
            }
            stopActiveStream();
            state.mode = button.dataset.mode;
            state.focusId = "";
            renderStartModes();
            renderFocusOptions();
            renderRefineActions();
            renderSummary();
            resetResults();
        });

        els.sourceText.addEventListener("input", updateSourceCounter);
        els.sourceText.addEventListener("input", () => {
            updatePrivacyWarning();
            markWorkspaceDirty();
        });
        els.audienceInput.addEventListener("input", () => markWorkspaceDirty());
        els.goalInput.addEventListener("input", () => markWorkspaceDirty());
        els.providerSelect.addEventListener("change", populateModels);
        els.modelSelect.addEventListener("change", () => {
            const selected = els.modelSelect.selectedOptions[0];
            state.modelProvider = selected?.dataset.provider || state.modelProvider;
            state.modelName = selected?.dataset.model || state.modelName;
            state.modelLabel = selected?.textContent?.trim() || state.modelLabel;
        });
        els.documentTitleInput.addEventListener("input", () => {
            setDocumentTitle(els.documentTitleInput.value, false);
            markWorkspaceDirty();
        });
        els.documentContent.addEventListener("input", () => {
            syncDraftFromEditor();
            els.documentContent.classList.toggle("is-empty", !normalizeTextContent(els.documentContent.innerText));
            markWorkspaceDirty();
        });

        els.generateBtn.addEventListener("click", runGeneration);
        els.newDocumentBtn.addEventListener("click", createEmptyDocument);
        els.stopStreamBtn.addEventListener("click", () => {
            stopActiveStream();
            setStatus("Stoppar generering...");
        });
        els.resetWorkflowBtn.addEventListener("click", () => {
            stopActiveStream();
            clearAutosaveTimer();
            window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
            els.sourceText.value = "";
            els.audienceInput.value = "";
            els.goalInput.value = "";
            els.refineInput.value = "";
            updateSourceCounter();
            resetResults();
            setStatus("Klar");
        });
        els.copyResultBtn.addEventListener("click", () => copyText(state.latestResult, "Resultatet kopierades"));
        els.copyDraftBtn.addEventListener("click", () => {
            const draft = getDraftSection();
            copyText(draft?.content || "", "Utkastet kopierades");
        });
        els.saveDocumentBtn.addEventListener("click", () => {
            syncDraftFromEditor();
            persistWorkspace("Sparat lokalt");
        });
        els.undoAiBtn.addEventListener("click", undoLatestAiChange);
        els.exportDocxBtn.addEventListener("click", exportDocx);
        els.exportPdfBtn.addEventListener("click", exportPdf);
        document.addEventListener("selectionchange", updateSelectionState);
        window.addEventListener("resize", scheduleSelectionUiPosition);
        window.addEventListener("scroll", scheduleSelectionUiPosition, true);
        els.selectionOpenEditorBtn.addEventListener("click", openSelectionEditor);
        els.selectionProcessBtn.addEventListener("click", processSelectedDraftText);
        els.selectionApplyBtn.addEventListener("click", applySelectedDraftReplacement);
        els.selectionCancelBtn.addEventListener("click", () => closeSelectionEditor(false));
        els.refineBtn.addEventListener("click", () => {
            const value = els.refineInput.value.trim();
            if (!value) {
                setStatus("Skriv en förfining först.", true);
                return;
            }
            runRefinement(`Förfina föregående svar. ${value}`, "Egen förfining");
            els.refineInput.value = "";
        });
    }

    async function init() {
        renderStartModes();
        renderFocusOptions();
        renderRefineActions();
        renderSummary();
        updateSourceCounter();
        renderSelectionQuickActions();
        bindEvents();
        resetResults();
        restoreWorkspaceFromStorage();
        setStatus("Laddar modeller...");
        await loadPromptLibrary();
        await populateModels();
    }

    init();
})();
