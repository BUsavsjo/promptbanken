# MVP-arkitektur

## Nuläge

Nuvarande lösning har fungerande motor men för bred produktform:

- frontend är en stor monolit med flera överlappande flöden
- fri chatt är primär start
- promptbank, direktchatt och lokala varianter blandas i samma upplevelse
- backend är däremot användbar och bör återanvändas

## Målbild

En smal arbetsyta där användaren går från:

- oklar fråga
- råtext
- halvfärdigt underlag

till:

- struktur
- utkast
- sammanfattning
- klarspråk

## Enkel målarkitektur

### P1

- `index.html`
  - ren produktiserad startsida
  - tre startlägen
  - ett styrt arbetsflöde
  - en resultatvy med förfiningsknappar
- `mvp.js`
  - enkel state-maskin för startläge, fokus, modell och resultat
  - återanvänder backendens streaming-endpoints
  - återanvänder befintliga promptfiler som systeminstruktioner
- `mvp.css`
  - separat MVP-styling utan beroende till äldre layout
- `backend/app/main.py`
  - oförändrad motor för OpenAI/Ollama

### P2

- sparade arbetsytor
- filimport
- fler texttyper
- versionsjämförelse
- bättre strukturering av promptbibliotek till domänspecifika arbetsflöden

## Varför denna riktning

- minimerar ombyggnad i backend
- minskar frontend-komplexitet direkt
- gör produkten tydligare för icke-tekniska användare
- ger en enkel väg från prototyp till MVP utan enterprise-funktioner
