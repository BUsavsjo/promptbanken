---
name: Design/Arkitektur
about: Arkitekturförslag baserat på analys
title: "Design: [kort beskrivning av föreslagna ändringar]"
labels: ["role:architect", "type:design"]
---

## Utgå från analys

Länka till Analyst-issue eller sammanfatta huvudpunkterna från analysen:
- Issue: #__
- Huvudrisker från analysen: ...
- Oklarheter som behöver lösas: ...

## Föreslagen riktning

Beskriv den minsta hållbara förändring som löser problemet:

### Alternativ 1 (rekommenderat)
- **Vad:** ...
- **Varför:** ...
- **Scope:** ...

### Alternativ 2
- **Vad:** ...
- **Varför:** ...
- **Trade-offs:** ...

## Avgränsningar och motivering

- Vad omfattar denna design? (scope)
- Vad är uteslutit? (scope-begränsningar)
- Varför är detta val hållbart på lång sikt?
- Vilka arkitekturella beslut måste vi göra?

## Acceptanskriterier

Designen är godkänd när:

- [ ] Minsta möjliga förändring som ger tydlig vinst
- [ ] Scope är tydligt avgränsat
- [ ] Motivering för varje arkitekturellt val
- [ ] Alternativ och trade-offs dokumenterade
- [ ] Ingen implementation gjord än

## Nästa steg

**Planner** — Bryt denna design ned i 5–10 små, verifierbara steg.

---

**Se även:**
- [Architect-prompt](.github/prompts/architect.prompt.md)
- [Router](.github/prompts/router.prompt.md) — Hjälp att välja nästa roll
- [ROLES.md](docs/ROLES.md) — Rollen definition
