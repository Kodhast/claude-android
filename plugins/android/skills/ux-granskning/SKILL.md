---
name: ux-granskning
description: "Granskar en Android-skärm eller webbvy, mockup eller skärmdump för användbarhet, visuell hierarki, enhetlighet och UX-texter på svenska (knappar, felmeddelanden, tomma tillstånd, bekräftelser, statusord), och svarar i en kort tabell. Laddas vid granskning, inte när något ska skapas. Trigger-ord: granska skärmen, granska vyn, vad tycker du om, designkritik, UX, användbarhet, texten på knappen, knapptext, felmeddelandet, tomt tillstånd, bekräftelse, ordval, skärmdump, mockupen är klar, Roborazzi-skärmdumpar i PR:en."
---

# UX-granskning

Granskar en skärm eller vy som den upplevs: vad syns först, når användaren målet och säger texterna
det de ska. Bygger på Anthropics `design-critique` och `ux-copy` (anthropics/knowledge-work-plugins,
plugin Design), anpassad till Android, webbapparna, svenska och komponentkatalogen (android-ui,
web-ui). Kompositionsreglerna D-1–D-10 står i `android:designregler`. Repots regler går före.

## När

- Någon ber om kritik: "granska skärmen", "vad tycker du om …", "UX", "texten på knappen",
  "felmeddelandet", "tomt tillstånd".
- En mockup är klar och ska visas (skill `android:mockup`, före användarens ok).
- Roborazzi-skärmdumpar ska visas i en PR.

Den här skillen laddas **inte** när något ska skapas: ny skärm och mockup är `android:mockup`.

## Underlag

Läs det som finns. Gissa inte på ett utseende du inte sett.

1. **Skärmdumpar** (Roborazzi, ljust och mörkt) eller mockupens artboards.
2. **Koden** för skärmen och dess `strings.xml`, för texter och tillstånd som inte syns på bilden.
3. **Katalogen**: repots skill för delade komponenter och designspråket (se repots CLAUDE.md).
4. Sammanhanget: vad användaren vill göra på skärmen och var i flödet den ligger.

## Kritik i fem steg

1. **Första intryck.** Vad drar blicken till sig, och är det rätt sak (D-4)? Syns skärmens syfte
   direkt? Vilken är vyns primära handling, och är den ensam (D-3)?
2. **Användbarhet.** Når användaren målet? Finns onödiga steg? Syns det vad som är klickbart?
   Försvinner information när ett tillstånd ändras?
3. **Komposition.** Gå igenom `android:designregler` D-1–D-10: luft (D-1, D-2), en primär (D-3),
   fokuspunkt och hierarki (D-4, D-5), få val, förval och det ovanliga gömt (D-6–D-8), huvudhandlingen
   vid tummen (D-9). Ange regelns ID i fyndet.
4. **Enhetlighet mot katalogen** (regel 4). Samma element ser lika ut och betyder samma sak
   överallt. Ett statuspiller får inte se ut som ett informationspiller, och en avvikelse från
   katalogen är ett fynd, inte en designfråga.
5. **Tillgänglighet.** Hänvisa till `android:accessibility-compose` (Android) och `android:webb`
   (webb) och upprepa inte deras regler. Nämn bara det du faktiskt ser, till exempel svag kontrast i
   mörkt tema. Skärmläsare granskas inte.

## UX-texter på svenska

- **Knappar** börjar med ett verb och säger vad som händer: "Lägg till 2 saker", inte "OK" eller
  "Klar".
- **Felmeddelanden** säger vad som hände och vad användaren kan göra. De går via repots
  felmappning (`DataError.toMessage()` eller motsvarande), aldrig en rå undantagstext.
- **Tomma tillstånd** säger vad som finns här, varför det är tomt och hur man börjar.
- **Bekräftelser** beskriver handlingen ("Radera resan?") och knapparna heter efter den
  ("Radera" / "Behåll"), inte "Är du säker?" med "OK" / "Avbryt".
- **Samma sak heter samma sak** överallt. Återkommande texter står en gång i `strings.xml`.
- **Statusord** säger vad som ändrats, inte bara att något ändrats: "14 → 20 st" i stället för
  "ändrad".
- Kort och vardagligt, utan tekniska ord. Belopp, procent och datum i svenskt format.

## Utdata

Kort och läsbar på telefonen. Högst cirka 15 rader, en rad per fynd. Varje fynd pekar på en
skärmdump eller en fil:rad.

| Fynd | Var | Allvar | Förslag |
|---|---|---|---|
| … | `PackingListScreen_dark.png` / `fil.kt:42` | 🔴 / 🟡 / 🟢 | … |

🔴 = användaren missar något eller gör fel, 🟡 = otydligt eller inkonsekvent, 🟢 = putsning.

**Det här fungerar:** en eller två punkter.

**Viktigast:** de tre åtgärder som gör störst skillnad, mest allvarligt först.

Pröva varje fynd mot bilden eller koden innan det rapporteras. Smak är 🟢 eller inget alls.

## Exempel (ReseApoteket, packlistan)

| Fynd | Var | Allvar | Förslag |
|---|---|---|---|
| Pillret "ändrad" ersätter doseringspillret "2/dag", så doseringen försvinner | `PackingListScreen_*` | 🔴 | Visa båda, eller låt ändringen stå på raden |
| "ändrad" säger inte vad som ändrats | samma | 🟡 | "14 → 20 st" |
| "finns redan" i sheeten "Lägg till i packlistan" har svag kontrast i mörkt tema | sheeten, mörkt | 🟡 | Tema-token för sekundär text (se `accessibility-compose`) |

## Webbapparna (Husjakt, VeckansMat, web-ui)

Samma steg och samma utdata. Skillnaderna:

- **Underlag:** skärmdumpar från Playwright (repots skärmdumpskommando, t.ex. Husjakts `/visa`) eller
  mockupen i Claude Design, och vyns kod (`.svelte`, `public/`) för texter och tillstånd.
- **Katalogen** är web-ui:s klasser och element (`kh-*`), som följer android-ui. En avvikelse från
  web-ui eller från android-ui:s utseende är ett fynd (regel 4 här, web-ui regel 1).
- **Felmeddelanden** går via appens egen felhantering, aldrig en rå undantagstext.
- **Ramarna** i `android:webb`: bara Chrome, mest telefonen, inget som klipps vid 360 px.
- Var-kolumnen pekar på bilden eller `fil.svelte:42`.

## Utanför

Användarundersökningar, research och överlämning till utvecklare. Tangentbordsnavigering, ARIA för
uppläsning och Figma.
