---
name: Plan
about: Steg-för-steg plan baserat på design
title: "Plan: [kort beskrivning av arbete att göra]"
labels: ["role:planner", "type:planning"]
---

## Utgå från design

Länka till Architect-issue och sammanfatta designen:
- Issue: #__
- Huvuddesignbeslut: ...
- Scope: ...

## Steg-för-steg plan

Bryt designen ned i 5–10 små, verifierbara steg. För varje steg, specificera:

### Steg 1: [Kort titel]
**Mål:** Vad är målet med detta steg?
**In-data:** Vad behövs innan detta steg?
**Ut-data:** Vad är klart efter detta steg?
**Verifiering:** Hur verifierar vi att detta steg är klart?
**Beroenden:** Vilka andra steg måste vara klara först?

### Steg 2: [Kort titel]
(Upprepa samma format)

### Steg N: ...

## Acceptanskriterier

Planen är godkänd när:

- [ ] 5–10 tydligt avgränsade steg
- [ ] Varje steg har: mål + in/utdata + verifiering + beroenden
- [ ] Beroenden är tydligt dokumenterade
- [ ] Ingen kod eller implementation gjord än
- [ ] Stegen är små nog för Engineer att implementera i ~30 min per steg

## Nästa steg

**Engineer** — Implementera ett steg i taget enligt denna plan.

---

**Se även:**
- [Planner-prompt](.github/prompts/planner.prompt.md)
- [Router](.github/prompts/router.prompt.md) — Hjälp att välja nästa roll
- [ROLES.md](docs/ROLES.md) — Rollen definition
