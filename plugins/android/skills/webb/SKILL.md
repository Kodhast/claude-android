---
name: webb
description: "Webbapparnas ramar i Mats projekt (Husjakt, VeckansMat, web-ui): bara Chrome på dator och Chrome på Android, mest telefonen; ingen iOS, Safari eller Firefox; ingen hänsyn till skärmläsare; vanlig användbarhet gäller (tryckytor, kontrast, små skärmar). Ladda när gränssnitt, CSS, HTML eller webbprov skrivs eller granskas, och när det är oklart om en webbläsarfunktion får användas. Trigger-ord: webbläsare, Chrome, Safari, iOS, Firefox, stöd, reserv, fallback, polyfill, CSS, :has, text-box, skärmläsare, uppläsning, aria, tillgänglighet, tryckyta, mobil, telefon, liten skärm, PWA."
---

# Webbapparna (Husjakt, VeckansMat, web-ui)

Beslutat av Mats 2026-11-19. Gäller alla webbappar och webbibliotek; repots CLAUDE.md går före där
de krockar.

## Webbläsare

- **Bara Chrome på dator och Chrome på Android.** Mest telefonen. Ingen iOS, Safari eller Firefox
  att ta hänsyn till – inte i kod, prov, granskning eller dokumentation.
- **Chrome-funktioner får användas utan reserv** (`:has()`, `text-box`, `@property`, container
  queries, `<dialog>`, popover). Inga prefix, polyfills eller fallbacks för andra webbläsare.
- Prov och skärmdumpar körs i Chromium (Playwright). Andra motorer provas inte.

## Användarna

- **Ingen hänsyn till skärmläsare** (uppläsning). Etiketter, `aria-label`, live-regioner och
  annonserade texter skrivs inte för uppläsningens skull, och granskning letar inte efter dem.
- **aria-attribut som bär tillstånd stannar** när CSS eller beteendet läser dem
  (`aria-pressed`, `aria-checked`, `aria-selected`, `aria-invalid`, `aria-busy`): de är
  tillståndet, inte tillgänglighet.
- **Vanlig användbarhet gäller fortfarande:**
  - tryckytor på minst 48 px för tummen,
  - läsbar kontrast i ljust och mörkt,
  - små telefonskärmar: inget horisontellt rullande, inget som klipps vid 360 px bredd,
  - valt läge syns i mer än färg när det går lätt.
