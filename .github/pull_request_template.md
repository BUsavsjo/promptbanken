## Beskrivning

Vad gör denna PR? Länka relevanta issue(s) eller använd detta format:

```
Closes #123
Related to #456
```

## Vilken roll är detta?

Markera vilken roll som utförde denna PR:

- [ ] Analyst — Nulägesanalys och riskinventering
- [ ] Architect — Arkitekturförslag och design
- [ ] Planner — Nedbrytning i steg och plan
- [ ] Engineer — Implementation av ett steg
- [ ] QA — Verifiering och testning
- [ ] Reviewer — Kodgranskning innan merge
- [ ] Writer — Dokumentationsuppdateringar
- [ ] Data Analyst — Effektanalys och mätning

## Hur testad?

Beskriv kort vilka tester/verifieringar du utförde. Använd denna checklist som guide: [docs/QA_CHECKLIST.md](../docs/QA_CHECKLIST.md)

```
Checklist:
- [ ] Lokal test genomförd: _____ (beskriv stegen)
- [ ] Relevanta tester körda: _____ (npm test, npm run lint, etc.)
- [ ] Ingen regression: _____ (verifierad mot befintlig funktionalitet)
- [ ] Antaganden testade: _____ (vilka antaganden i planen har bekräftats?)
```

## Risker identifierade

Vilka risker eller biverkningar kan denna ändring ha?

```
- Risk 1: _____ (sannolikhet: låg/medel/högt, påverkan: låg/medel/högt)
- Risk 2: _____
- Mitigering: _____
```

Om inga risker identifierades, skriv: `Inga kända risker.`

## Gate-checklist

Före merge måste följande grindar vara godkända. Markera X för godkänd:

### Gate D — Engineer Implementation
- [ ] Endast ett steg från planen är implementerat
- [ ] Ändringar följer befintlig kodstil
- [ ] Ingen arkitekturell extrafel
- [ ] Branch är pushad och PR är öppen
- [ ] Lokalt verifierat enligt steg-checklist

### Gate E — QA Verifiering
- [ ] Acceptanskriterier från steg är uppfyllda
- [ ] Ingen regression i befintlig funktionalitet
- [ ] Tester/lint körda och godkända
- [ ] Risker identifierade och dokumenterade
- [ ] QA-rekommendation: `Go` / `No-go` (se Testning-sektion ovan)

### Gate F — Code Review
- [ ] Kod följer projektets stil och konventioner
- [ ] Inga säkerhetsproblem identifierade
- [ ] Arkitektur överensstämmer med Architect-planen
- [ ] PR-mallen är ifylld korrekt
- [ ] Godkännande från minst en Reviewer

### Gate G — Documentation
- [ ] README eller relevant docs uppdaterad (om tillämpligt)
- [ ] Inline-kommentarer är tydliga och uppdaterade
- [ ] Release Notes eller CHANGELOG uppdaterade (om tillämpligt)
- [ ] Externa beroenden eller setup-ändringar dokumenterade
- [ ] Länkar är funktionella och uppdaterade

## Arbetflöde

1. **Analyst** läser denna PR och sammanfattar nuläget
2. **Architect** validerar att designen överensstämmer med planen
3. **Planner** verifierar att steg-nedbrytningen följdes
4. **Engineer** implementerar ändringar enligt grindar D
5. **QA** testar och verifierar (Gate E)
6. **Reviewer** granskar kod och design (Gate F)
7. **Writer** uppdaterar dokumentation (Gate G)
8. **Merge** när alla grindar är godkända

Se [CONTRIBUTING.md](../CONTRIBUTING.md) för detaljer om rollerna.

## Checklist för PR-skapar

Innan du submittar denna PR, bekräfta:

- [ ] Jag har läst [CONTRIBUTING.md](../CONTRIBUTING.md)
- [ ] Jag har följt den roll jag utförde (se Vilken roll-sektionen ovan)
- [ ] Mina ändringar följer befintlig kodstil
- [ ] Jag har testat mina ändringar lokalt
- [ ] Jag har uppdaterat relevant dokumentation
- [ ] Jag har fyllt i alla relevanta sektioner i denna template
- [ ] Branch-namn följer konvention: `feature/step-N` eller `docs/XXX`

---

**Se även:**
- [ROLES.md](../docs/ROLES.md) — Rolldefinitioner
- [WORKFLOW.md](../docs/WORKFLOW.md) — Arbetsflöde och grindar
- [03-agents.md](../docs/03-agents.md) — Agent-referensdokumenation
- [.github/prompts/](../.github/prompts/) — Prompt-filer för varje roll
