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
2. Välj ett prompt-kort
3. Klicka **"Visa exempel"** för att se vad du ska anonymisera
4. Klicka **"Kopiera prompt"** → prompen är i ditt urklipp
5. Klistra in i ditt AI-verktyg (ChatGPT, Claude, etc.)

### Lokal utveckling
```bash
# Klona repo
git clone https://github.com/username/promptbanken.git
cd promptbanken

# Starta lokal webbserver
python -m http.server 8000

# Öppna i webbläsare
http://localhost:8000
```

---

## ✨ Nya funktioner

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
- **Data:** JSON-config + txt-filer (gitbar)
- **Copy-mekanik:** navigator.clipboard API
- **Hosting:** GitHub Pages (static)
- **Design:** CSS Grid/Flexbox, responsiv, WCAG AA

**Filstruktur:**
```
.
├── index.html           # Huvudwebbsida (dynamisk SPA)
├── prompts.json         # Prompt-konfiguration
├── prompts/             # Prompt-filer (.txt)
│   ├── klarsprak.txt
│   ├── mejl.txt
│   └── ... (14 filer totalt)
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

MIT-licens © Peter Wenström. Se licensen på GitHub: https://github.com/BUsavsjo/promptbanken

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

*Skapad för att göra kommunal kommunikation tydligare, snabbare och bättre.* 🚀
