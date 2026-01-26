---
name: Analys
about: Analys av nuläget, risker och oklarheter
title: "Analys: [kort beskrivning av vad som ska analyseras]"
labels: ["role:analyst", "type:analysis"]
---

## Vad ska analyseras?

Beskriv kort vad som behöver förstås eller analyseras:
- Är det en ny funktion eller ett befintligt system?
- Vilka filer eller områden är relevanta?
- Finns det specifika risker eller oklarheter?

## Kontext/bakgrund

Lägg till relevant kontext:
- Länka till relaterade issues eller PRs
- Beskriv målgruppen eller användningsfall
- Nämn några antaganden

## Acceptanskriterier

Analysen är klar när:

- [ ] Rapporten är 5–10 meningar (kort sammanfattning av nuläget)
- [ ] Minst 3 risker eller oklarheter identifierade
- [ ] Teknisk skuld eller begränsningar dokumenterade
- [ ] Ingen kod eller förändringsförslag (endast analys)
- [ ] Länk till relevanta filer eller dokumentation

## Nästa steg

Använd denna analys som grund för:
- **Architect** — Föreslå minimal riktning
- **Planner** — Bryt ned i små steg
- **Engineer** — Implementera enligt plan

---

**Se även:**
- [Analyst-prompt](.github/prompts/analyst.prompt.md)
- [Router](.github/prompts/router.prompt.md) — Hjälp att välja nästa roll
- [ROLES.md](docs/ROLES.md) — Rollen definition
