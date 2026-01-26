# Compliance Review Checklist
## Promptmallar för kommun – Juridisk Granskning

**Status:** ⏳ Väntande juridisk review  
**Datum skapad:** 2026-01-26  
**För granskning av:** IT-säkerhet, Dataskyddssamordnare, Juridisk avdelning

---

## 📋 Granskning av Compliance-dokument

### Dataskyddsamordnare

- [ ] Läst `GDPR-POLICY.md`
- [ ] Bekräftat att ingen personuppgifter lagras av tjänsten
- [ ] Bekräftat att clipboard-API är lokal operation
- [ ] Bekräftat att användaransvaret är tydligt dokumenterat
- [ ] **Signering:** _________________________ **Datum:** ___________
- [ ] **Ev. kommentarer/ändringar:** _____________________________

**Frågor för dataskyddssamordnare:**
1. Behövs Data Protection Impact Assessment (PIA) för denna tjänst?
2. Är hanteringen av användaransvaret tillräckligt tydlig?
3. Rekommenderar du ändringar av säkerhetsvisan eller anonymiserings-instruktionerna?

---

### IT-säkerhet

- [ ] Läst `AI-COMPLIANCE.md`
- [ ] Verifierat att tjänsten inte lagrar känslig data
- [ ] Godkänd HTTPS-kravnivå (production-ready)
- [ ] Godkänd arkiveringshantering (om tillämpligt)
- [ ] **Signering:** _________________________ **Datum:** ___________
- [ ] **Ev. kommentarer/ändringar:** _____________________________

**Frågor för IT-säkerhet:**
1. Är Clipboard-API säkert att använda i kommunens miljö?
2. Behövs autentisering/inloggning, eller är offentlig åtkomst OK?
3. Behövs rate-limiting eller DDoS-skydd?

---

### Juridisk Avdelning

- [ ] Läst `AI-COMPLIANCE.md`
- [ ] Läst `GDPR-POLICY.md`
- [ ] Verifierat LAAF-klassificering enligt EU AI Act
- [ ] Verifierat compliance med Sekretesslagen (SekrL)
- [ ] Godkänd användaransvarsklaring
- [ ] Godkänd disclaimer på hemsidan
- [ ] **Signering:** _________________________ **Datum:** ___________
- [ ] **Ev. kommentarer/ändringar:** _____________________________

**Frågor för juridisk avdelning:**
1. Är LAAF-klassificering korrekt, eller behöver tjänsten högre klassificering?
2. Rekommenderas ytterligare disclaimer eller användaransvarsklaring?
3. Är hemsidans säkerhetsvisa juridiskt tillräcklig?

---

## 🔍 Teknisk Granskning

### Säkerhetsvisa på Hemsidan

**Aktuell text på varje prompt-kort:**

```
🔒 Säkerhet

⚠️ Anonymisera personuppgifter före användning!

Ta INTE med:
- Personnummer
- Namn eller ärendenummer
- Adresser eller telefonnummer
```

**Granskning:**
- [ ] Texten är tydlig och lätt att förstå
- [ ] Varningen är synlig och framträdande (gul/orange)
- [ ] Ingen juridisk term som kan misstolkas
- [ ] Begriplig för handläggare utan juridisk bakgrund

### Disclaimer på Hemsidan

**Föreslaget disclaimer (föreslås läggas i footer):**

```
Dessa prompter är verktyg för mänsklig beslutsfattning. 
AI-generated content kräver alltid mänsklig review före publicering.
Du är ansvarig för att anonymisera data och verifiera resultat.
```

**Granskning:**
- [ ] Juridiskt tillräcklig
- [ ] Tydlig och begriplig
- [ ] Länkad till `GDPR-POLICY.md` och `AI-COMPLIANCE.md`

---

## 📊 Riskanalys - Godkännande

| Risk | Klassificering | Mitigering | Godkänd? |
|---|---|---|---|
| **Datablottning via AI-output** | Medel | Säkerhetsvisa + användaransvarsklaring | ☐ |
| **Bias i AI-output** | Låg | Instruktioner om review | ☐ |
| **Regelöverträdelse (GDPR)** | Låg | Lokal clipboard-hantering | ☐ |
| **Felaktig AI-klassificering** | Låg | LAAF-klassificering + dokumentation | ☐ |
| **Tillgänglighet** | Låg | WCAG AA-compliance | ☐ |

---

## ✅ Final Approval

**Måste godkännas av:**

1. ☐ **Dataskyddssamordnare** – Signering & datum
2. ☐ **IT-säkerhet** – Signering & datum
3. ☐ **Juridisk avdelning** – Signering & datum

**När alla tre är godkända:**
→ Tjänsten kan lanseras med lanseringsanmälan

---

## 📝 Anmärkningar & Ändringsönskemål

(Fylla i av granskningsmyndigheter)

**Dataskyddssamordnare:**
```
_____________________________________________
_____________________________________________
_____________________________________________
```

**IT-säkerhet:**
```
_____________________________________________
_____________________________________________
_____________________________________________
```

**Juridisk avdelning:**
```
_____________________________________________
_____________________________________________
_____________________________________________
```

---

## Nästa Steg Efter Godkännande

1. **Implementera ändringar** (om några)
2. **Uppdatera hemsidan** med disclaimer/varningar
3. **Skicka lanseringsanmälan** till kommunledning
4. **Deploy till production**
5. **Informera handläggare** via intern kommunikation

---

**Dokument skapat:** 2026-01-26  
**Senast uppdaterat:** 2026-01-26  
**Nästa granskning:** 2026-07-26 (halvårsvis)
