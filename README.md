# 🏛️ Promptmallar för kommun

Centraliserad webbplattform med AI-assisterade kommunikationsmallar för svenska kommuner. Dessa prompter hjälper handläggare skriva tydligare, kortare och mer invånarvänlig kommunikation.

**Status:** ✅ Live på GitHub Pages | **Version:** 1.0.0

---

## 🎯 Vad är detta?

Promptmallar är färdiga instruktioner för AI-verktyg (ChatGPT, Claude, etc.) som hjälper till att:
- Skriva om texter till **klarspråk** för invånare
- Svara på **medborgarmejl** på ett vänligt sätt
- Skapa **FAQ:or**, **checklistor**, **rutiner**
- Strukturera **mötes-anteckningar** och **diskussioner**

Alla prompter är utformade med **GDPR** och **EU AI Act** i åtanke. Du ansvarar alltid för att anonymisera personuppgifter innan du kopierar.

---

## 🚀 Snabbstart

### Online (GitHub Pages)
1. Öppna: [username.github.io/promptbanken](https://username.github.io/promptbanken)
2. **Inställningar (⚙️)**: Klicka på kugghjulet i övre högra hörnet för att:
   - Aktivera **Avancerat läge** för exportinstruktioner till GPT/agent
   - Aktivera **Favoritläge** för att spara och visa favoriter
3. Välj ett prompt-kort
4. Klicka **"Visa exempel"** för att se vad du ska anonymisera
5. Klicka **"Kopiera prompt"** → prompen är i ditt urklipp
6. Klistra in i ditt AI-verktyg (ChatGPT, Claude, etc.)

### Lokal utveckling (frontend + backend för lokal Ollama)
```bash
# Klona repo
git clone https://github.com/username/promptbanken.git
cd promptbanken

# 1) Starta backend (gateway mot Ollama)
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Vid långsamma lokala modeller: höj timeout (sekunder)
export OLLAMA_LOCAL_TIMEOUT_SECONDS=300
uvicorn app.main:app --reload --port 8001

# 2) I ett nytt terminalfönster: starta frontend
cd ..
python -m http.server 8000

# 3) Öppna i webbläsare
# Frontend: http://localhost:8000
# Backend health via docs: http://localhost:8001/docs
```

---

## 🌐 Deploy (GitHub Pages via Actions)

- Workflow: .github/workflows/pages.yml (triggas på push till main eller manuellt via Actions → pages).
- Första körning sätter Pages-källa till GitHub Actions och publicerar hela root-katalogen.
- Så verifierar du efter deploy:
  1. Öppna senaste körningen under Actions → pages → Deploy to GitHub Pages och kontrollera att den är grön.
  2. Följ `page_url` i körloggarna (ex. https://username.github.io/promptbanken).
  3. Ladda sidan: säkerställ att prompts renderas, copy/ℹ️-modal/favoriter fungerar, samt att footer-länkar (GDPR, AI-compliance, MIT-licens) öppnas.

---

## ✨ Nya funktioner

- **Inställningsmeny (⚙️)**: Kugghjulsmeny i övre högra hörnet för att aktivera avancerat läge och favoritläge
  - Responsiv design som anpassar sig för mobila enheter
  - Dropdown-meny som stannar inom viewport-gränser
  - Placerad i dedikerad container för att undvika överlappning med kort
- Kopiera utan anonymiserings-checkbox (snabbare flöde)
- Favoriter med stjärna + localStorage-cache
- Snabbmeny "⭐ Mina Favoriter" och knapp för att rensa alla
- ℹ️ "Se hela prompt"-modal för full text
- Ny prompt #15: 📣 Skapa informationsutskick

---

## 📋 Tillgängliga prompter (15 st.)

| # | Prompt | Syfte |
|---|--------|-------|
| 1 | 📝 Skriv om till klarspråk | Gör text kortare och lättare att förstå |
| 2 | 📧 Svar på medborgarmejl | Skriv vänligt och sakligt svar |
| 3 | ❓ Gör en FAQ | Skapa 8–12 Q&A från dokument |
| 4 | ✓ Skapa checklista | Omvandla instruktioner till checklista |
| 5 | 📋 Skriva kallelse | Skriv formell men vänlig kallelse |
| 6 | 🎯 Beslutsunderlag | Sammanfatta för beslutande organ |
| 7 | ⚙️ Rutiner & anvisningar | Gör instruktioner tydliga |
| 8 | 🔀 Två versioner | Omvandla mellan formell/vardaglig |
| 9 | 💭 Reflektionsfrågor | Skapa frågor för djupare tänkande |
| 10 | 🧭 Samtalskompas | Strukturera möte/workshop |
| 11 | 📌 Sammanfattning | Förkorta längre text |
| 12 | 📝 Strukturera anteckningar | Organisera mötes-anteckningar |
| 13 | 💬 Diskussionsfrågor | Driva diskussion framåt |
| 14 | 🔑 Extrahera nyckelord | Identifiera centrala termer |
| 15 | 📣 Skapa informationsutskick | Skriv tydligt utskick med rubrik, sammanfattning och nästa steg |

---

## 🔒 Säkerhet & Compliance

Denna plattform följer:
- **EU AI Act** – klassificerad som "Low-Risk AI Application" (LAAF)
- **GDPR** – ingen data lagras lokalt; du är ansvarig för anonymisering
- **Offentligrättslig** – granskat av dataskyddssamordnare och juridik

**Viktigt:** Du är ansvarig för att anonymisera personuppgifter innan du kopierar prompen. Klicka **"Visa exempel"** på varje kort för att se vad du ska ta bort.

**Läs mer:**
- [EU AI Act Compliance](AI-COMPLIANCE.md)
- [GDPR Policy](GDPR-POLICY.md)
- [Compliance Review Checklista](COMPLIANCE-REVIEW-CHECKLIST.md)

---

## 📝 Hur man lägger till ny prompt

### 1. Skapa prompt-fil
Skapa ny fil `prompts/ny-prompt.txt`:
```
Titel på prompt
Kort beskrivning av vad prompen gör

Här börjar själva prompt-instruktionen för AI-verktyget.
Du kan skriva flera stycken. Instruktionen avslutas med:

Input:
[klistra in här]
```

**Format:**
- **Rad 1:** Titel (samma som i prompts.json)
- **Rad 2:** Tom rad
- **Rad 3:** Kort beskrivning
- **Rad 4:** Tom rad
- **Rad 5+:** Full prompt-instruktion

### 2. Registrera i prompts.json
Öppna `prompts.json` och lägg till ett nytt objekt i `prompts`-arrayen:

```json
{
  "id": "ny-prompt",
  "title": "🆕 Titel på prompt",
  "description": "Kort beskrivning av vad prompen gör",
  "file": "prompts/ny-prompt.txt",
  "security_examples": ["Vad du ska anonymisera", "Exempel 2", "Exempel 3"]
}
```

### 3. Test lokalt
```bash
python -m http.server 8000
# Öppna http://localhost:8000 och verifiera att ny prompt visas
```

### 4. Commit och push
```bash
git add prompts/ny-prompt.txt prompts.json
git commit -m "feat: Lägg till ny prompt: Titel på prompt"
git push origin main
```

---

## 🛠️ Teknisk arkitektur

- **Frontend:** Vanilla JavaScript (ingen ramverk)
- **Backend:** FastAPI-gateway (`/api/providers`, `/api/models`, `/api/run`) för flera providers (lokal Ollama, Ollama Cloud, OpenAI)
- **Providers:** Lokal Ollama + valfria molnproviders via backend-proxy (frontend anropar aldrig leverantörer direkt)
- **Data:** JSON-config + txt-filer (gitbar)
- **Copy-mekanik:** navigator.clipboard API
- **Hosting:** Frontend statiskt + lokal backend-tjänst
- **Design:** CSS Grid/Flexbox, responsiv, WCAG AA

### GDPR och fritextruta (egen roll)

- **Ingen data lagras:** Allt du skriver i fritextrutan för "Annan/Egen roll" hanteras endast lokalt i din webbläsare och sparas inte.
- **Personuppgifter:** Ange aldrig personuppgifter i fritextrutan. Du ansvarar för att all text är anonymiserad.
- **Privacy by design:** Ingen information skickas till server eller tredje part.

### Inställningsmeny (Settings Menu)
- **Positionering:** `.settings-container` med flexbox (justify-content: flex-end) för högerjustering
- **Responsiv:** Media query (@768px) anpassar dropdown-bredd för mobila enheter
- **Z-index:** 1001 för att ligga över annat innehåll
- **Viewport-säker:** `max-width: calc(100vw - 2rem)` förhåller overflow
- **Design-motivering:** Placerad i separat container utanför `<main>` för att undvika överlappning med prompt-kort i dokumentflödet

**Filstruktur:**
```
.
├── index.html           # Huvudwebbsida (dynamisk SPA)
├── prompts.json         # Prompt-konfiguration
├── prompts/             # Prompt-filer (.txt)
│   ├── klarsprak.txt
│   ├── mejl.txt
│   └── ... (14 filer totalt)
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI gateway mot flera LLM-providers
│   │   ├── llm_clients.py    # Provider-klienter (Ollama/OpenAI)
│   │   ├── prompt_repository.py
│   │   └── schemas.py
│   └── requirements.txt
├── LICENSE              # MIT-licensfil
├── README.md            # Detta dokument
├── AI-COMPLIANCE.md     # EU AI Act dokumentation
├── GDPR-POLICY.md       # GDPR policy
└── COMPLIANCE-REVIEW-CHECKLIST.md
```

---

## 🤝 Bidra

Vi välkomnar feedback och förbättringar!

**Rapportera bug:** Öppna ett GitHub Issue
**Föreslå ny prompt:** Gör en Pull Request med ny prompt-fil + uppdaterad prompts.json

**Contribution workflow:**
1. Fork repo
2. Skapa feature-branch (`git checkout -b feature/ny-prompt`)
3. Lägg till prompt (se "Hur man lägger till ny prompt" ovan)
4. Test lokalt
5. Push och öppna Pull Request

---

## 📜 Licens

MIT-licens © Peter Wenström. Se detaljer i [LICENSE](LICENSE)-filen i projektroten eller på GitHub: [promptbanken](https://github.com/BUsavsjo/promptbanken).

---

## ❓ FAQ

**F: Var lagras mina data när jag kopierar en prompt?**
A: Ingenstans! Clipboard API är lokal – data lämnar aldrig din webbläsare.

**F: Kan jag använda detta för hemlig/klassificerad information?**
A: Nej. Du måste se till att all data är anonymiserad före kopia. Se "Visa exempel" på varje prompt.

**F: Vilka AI-verktyg fungerar?**
A: Alla! ChatGPT, Claude, Gemini, etc. Kopiera bara prompen och klistra in i ditt verktyg.

**F: Kan jag redigera prompterna?**
A: Ja! Du kan redigera .txt-filerna och skapa pull requests. Eller använd dem som utgångspunkt för dina egna.

---

## 📞 Kontakt

**Frågor eller feedback?** Öppna ett GitHub Issue eller kontakta Peter Wenström via repo-sidan: https://github.com/BUsavsjo/promptbanken

---

## Exportfunktionalitet

### Funktioner
- **LocalStorage**: Exportinställningar sparas lokalt i webbläsaren.
- **Exportmodul**: Användare kan öppna, kopiera och ladda ner instruktioner.
- **Knappsynlighet**: "Kopiera prompt"-knappen döljs automatiskt när "Anpassa prompt" (avancerat läge) är aktivt, och visas annars. Detta minskar risken för felkopiering och gör flödet tydligare.

### Testning
1. Kontrollera att LocalStorage sparar och hämtar data korrekt.
2. Verifiera att exportmodulen fungerar utan fel:
   - Öppna och stäng modalen.
   - Använd kopieringsknappen.
   - Ladda ner filen.

### Kända Begränsningar
- LocalStorage är begränsat till webbläsaren och kan rensas av användaren.
- Exportmodulen kräver JavaScript aktiverat.

---

## Deploy-Ready Version

### Compliance Information
- **EU AI Act**: Marked as a low-risk AI application.
- **GDPR**: Privacy notice and no data tracking.

### Deployment Steps
1. Ensure all prompts are visible and functional.
2. Verify AI Act disclaimer is displayed.
3. Deploy to the municipality's server.

### Version
- Current version: 1.0.0

*Skapad för att göra kommunal kommunikation tydligare, snabbare och bättre.* 🚀

## 🆕 Senaste ändringar (jan 2026)

- Snabbinmatningstexten ("quick input") injiceras nu automatiskt i alla promptflöden:
  - "Kopiera prompt" ersätter både `[klistra in här]` och `[TEXT]`-markörer med din snabbinmatning.
  - "Se hela prompt"-modal visar prompten med din snabbinmatning på rätt plats.
  - "Anpassa prompt" (export) inkluderar snabbinmatning i förhandsvisning och export.
- Gäller även prompten "📣 Skapa informationsutskick" och framtida prompts med `[TEXT]`-markör.
- Ingen snabbinmatning lagras eller skickas – allt sker lokalt i webbläsaren.

---

## 🔒 Integritet och lokal hantering

- Ingen snabbinmatning eller promptdata lagras på servern eller skickas till tredje part.
- All bearbetning sker lokalt i din webbläsare.
- Endast favoriter och exportinställningar sparas i din webbläsares localStorage (kan rensas när som helst).
- Du ansvarar alltid för att anonymisera personuppgifter innan du kopierar eller exporterar en prompt.

### Export och kopiera prompt

- **Knappbeteende:**
  - När "Anpassa prompt" är aktivt, döljs knappen "Kopiera prompt" för att undvika förvirring.
  - När "Anpassa prompt" är inaktiv, visas knappen "Kopiera prompt" som vanligt.
- **Tillgänglighet:**
  - Fokus och tabbning fungerar korrekt oavsett knappens synlighet.
- **Användning:**
  - Aktivera "Anpassa prompt" via inställningsmenyn för att justera struktur och ton innan export.
  - Kopiera prompten direkt när "Anpassa prompt" är avstängd.
