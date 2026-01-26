# EU AI Act Compliance Report
## Promptmallar för kommun – LAAF Klassificering

**Dokument-ID:** AI-COMPLIANCE-001  
**Version:** 1.0  
**Datum:** 2026-01-26  
**Klassificering:** Low-Risk AI Application (LAAF) enligt EU AI Act Annex III

---

## 1. Introduktion

Promptmallssajten för kommun är en webbtjänst som tillhandahåller standardiserade prompter för ChatGPT och liknande LLM-modeller. Tjänsten är designad för att assistera kommunala handläggare i rutinmässiga skrivuppgifter (klarspråk-omskrivning, mejlsvar, FAQ-skapande, etc.).

---

## 2. Klassificering enligt EU AI Act

### 2.1 Risk Assessment

**Tjänstens klassificering:** **Low-Risk AI Application (LAAF)**

**Motivering:**
- ✅ **Ingen automatiserad beslutsfattning** – Prompts assisterar endast; all slutlig beslutskraft är hos handläggare
- ✅ **Mänsklig review obligatorisk** – Output från LLM måste alltid granskas innan publicering
- ✅ **Ingen känslig data lagras** – Tjänsten lagrar ej personuppgifter; användare ansvarar för anonymisering
- ✅ **Transparent process** – Användare vet att de använder AI-assisterade verktyg
- ✅ **Låg påverkan** – Prompterna är verktyg för effektivitet, inte ersättning för mänsklig bedömning

### 2.2 Riskmitigering

| Risk | Mitigering | Ansvar |
|---|---|---|
| Oavsiktlig datablottning | Säkerhetsvisa + anonymiserings-instruktioner på varje prompt | Handläggare |
| Bias i AI-output | Instruktioner att granska för partiskhet innan användning | Handläggare + reviewer |
| Regelöverträdelse | Juridisk review av prompts före lansering | Juridisk avdelning |
| Tillgänglighet | WCAG AA-kompatibilitet | Utvecklare |

---

## 3. Compliance-krav

### 3.1 Transparans & Märkning

✅ **Implementerat på hemsidan:**
- Tydlig varning: *"Dessa prompter är verktyg för mänsklig beslutsfattning. AI-generated content kräver alltid mänsklig review före publicering."*
- Säkerhetsvisa på varje prompt om anonymisering
- Footer: *"Denna tjänst använder AI-stödda promptmallar"*

### 3.2 Användaransvarsklarhet

✅ **Dokumenterat:**
- Användare ansvarar för att anonymisera personuppgifter före kopiering
- Användarens ansvar att verifiera AI-output för korrekthet
- Juridisk ansvarsfriskrivning i terms of use

### 3.3 Dokumentation & Loggning

⏳ **Framtida:** (Release 2)
- Analytics (vilka prompts används mest)
- Audit-logg för administratörer
- Versionering av prompt-mallar

---

## 4. GDPR-compliance

*Se separat dokument: `GDPR-POLICY.md`*

Sammanfattning:
- Ingen personuppgifter lagras av tjänsten
- Clipboard-API är lokal (ingen server-överföring)
- Användare ansvarar för dataskydd i eget arbetsflöde

---

## 5. Offentligrättsliga krav

### 5.1 Sekretess
- Prompterna lagras på säker kommun-server med åtkomststöld
- Endast behöriga handläggare får åtkomst

### 5.2 Transparens
- Prompt-mallar är offentliga (ingen dolda algoritmer)
- Användare vet exakt vad de får

### 5.3 Arkivering
- Prompt-versioner sparas för granskning
- CHANGELOG.md dokumenterar uppdateringar

---

## 6. Godkännande & Review-status

| Instans | Status | Datum | Signering |
|---|---|---|---|
| **IT-säkerhet** | ⏳ Väntande | — | — |
| **Dataskyddssamordnare** | ⏳ Väntande | — | — |
| **Juridisk avdelning** | ⏳ Väntande | — | — |

*Denna rapport måste godkännas av alla tre innan lansering.*

---

## 7. Rekommendationer

1. **Framtida versioner:** Implementera analytics för att mäta effekt och identifiera bias
2. **Användareducering:** Regelbundna workshops för handläggare om ansvarsfull AI-användning
3. **Kontinuerlig granskning:** Återvärdera risker varje halvår

---

## Dokumenthistorik

| Version | Datum | Ändringar |
|---|---|---|
| 1.0 | 2026-01-26 | Initial klassificering & compliance-rapport |
