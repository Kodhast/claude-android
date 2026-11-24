---
name: designregler
description: "Kompositionsreglerna för alla Mats appar, Android och webb (ReseApoteket, Dagboken, Fonder, android-ui, Husjakt, VeckansMat, web-ui): luft som grupperar, en primär handling per vy, en fokuspunkt, hierarki, få val, förval och huvudknappen vid tummen – numrerade D-1 till D-10 med källa och kontroll. Enda källan; mockup, ux-granskning och granskarna hänvisar hit. Ladda när en vy, skärm, mockup eller komponent skapas, ändras eller granskas. Trigger-ord: design, layout, luft, avstånd, spacing, whitespace, primär knapp, huvudknapp, FAB, fokus, blickfång, hierarki, betoning, för många val, alternativ, meny, chips, segment, förval, Hicks lag, närhet, Gestalt, Refactoring UI, Nielsen, Material 3."
---

# Designregler (komposition)

Katalogen och temat ser till att varje element ser likadant ut (regel 4 i apparna, regel 1–2 i android-ui,
regel 1–4 i web-ui). Den här skillen säger hur en vy byggs av elementen. Reglerna gäller både Android och
webb: utseendet är detsamma, bara färger och typsnitt skiljer. Beslutade av Mats 2026-11-24
(plan: projektfilen `ui-designregler/plan.md`). D-4, D-6 och D-9 justerade efter provgranskningen
(projektfilen `ui-designregler/provgranskning.md`, Mats 2026-11-24).

Tryckytor och kontrast står i `android:accessibility-compose` och `android:webb`, och enhetlighet i
repots regel 4. De upprepas inte här.

## Hur reglerna används

- **Mockup** (`android:mockup`, även i Claude Design för webbapparna): gå igenom D-1–D-9 innan mockupen
  visas, och skriv i svaret vilken som är vyns primära handling (D-3) och fokuspunkt (D-4).
- **Granskning** (`android:ux-granskning`, `android:granskare`, repots granskare): varje fynd om
  komposition anger regelns ID. En iakttagelse som inte är ett brott mot en regel är 🟢 eller inget.
- **Prov:** D-3 kontrolleras av ett prov när android-ui och web-ui har det (plan steg 4). Tills dess, och
  för de andra reglerna, kontrolleras de i mockup och granskning.
- Ett medvetet avsteg skrivs i PR:en med regelns ID och skäl.

## Reglerna

| ID | Regel | Android | Webb | Kontroll |
|---|---|---|---|---|
| D-1 | **Avstånd betyder något.** Inuti en grupp eller ett kort `s`–`m` (8–12), mellan kort `l` (16), mellan sektioner `xl` (24), sidmarginal `l`. Avståndet inom en grupp är alltid mindre än mellan grupper. | `Spacing` | `--kh-space-*` | Skalan tvingas redan (`ui-forbidden.txt`, tokens). Nivån: ramarna bär den; annars granskning |
| D-2 | **Luft grupperar, inte linjer.** Avdelare bara mellan rader i en lista, inte mellan kort eller sektioner. Ingen ram runt något som redan är grupperat av luft. | `AppDivider` | `kh-divider` | Granskning |
| D-3 | **En primär handling per vy.** Högst en fylld knapp synlig. En FAB är vyns primära handling, så med FAB finns ingen annan fylld knapp. Övriga är sekundära (tonade), kontur eller text. En destruktiv handling är aldrig vyns primära; den bekräftas i en dialog där den får vara det. | `ButtonVariant` (standard blir `Secondary`, android-ui major) | `kh-button` | **Prov** (steg 4), annars granskning |
| D-4 | **En fokuspunkt.** Det blicken fastnar på först är det användaren kom för. Kisa på vyn (eller titta på en tumnagel): bara en sak ska sticka ut. Bara en sak per vy har både störst storlek och starkast färg. Appens starkaste färg (accent, röd) används bara på vyns primära handling, inte på status, etiketter eller navigering (som tillbakaknappen). | – | – | Mockup och granskning |
| D-5 | **Hierarki med vikt och färg före storlek.** Högst tre textnivåer i ett kort (rubrik, brödtext, sekundärtext). Sekundärt tonas med temats färg för sekundärtext, inte med mindre text. | `AppTheme.typography` | temats typografi | Granskning |
| D-6 | **Få val åt gången.** Högst 5 jämbördiga val synliga i ett val (chips, segment, meny, flikar); fler grupperas eller göms bakom "Fler". Ordnade skalor (perioder, dagar, tider) får ha fler om de ryms på en rad utan att någon etikett kapas, annars rullgardin. Flikraden har 3–5 flikar. | `ChoiceChips`, `AppSegmentedChoice`, `AppMenu` | motsvarande `kh-*` | Granskning |
| D-7 | **Förval i stället för fråga.** Har ett fält ett vanligt svar är det förvalt. | – | – | Granskning |
| D-8 | **Det ovanliga göms.** Sällan använda handlingar och inställningar ligger i menyn, under "Fler" eller i inställningar, inte bredvid huvudhandlingen. | – | – | Granskning |
| D-9 | **Huvudhandlingen vid tummen.** Spara och vyns primära handling står nere (fast knapprad i ark och dialoger, FAB), inte i toppraden. Undantag: redigering i helskärm (`EntityEditScreen`) har Spara i toppraden, som Material 3:s helskärmsdialog. | ramarna | `kh-dialog`, knapprad | Granskning |
| D-10 | **Varje handling syns.** Ett tryck ger synligt svar: ändrat tillstånd, snackbar eller ångra. | ramarna | `kh-snackbar` | Ramarna; granskning |

## Exempel

| Före | Efter | Regel |
|---|---|---|
| Två fyllda knappar "Spara" och "Spara och lägg till ny" | "Spara" fylld, den andra text | D-3 |
| Kort med 12 dp mellan sig och 16 dp inuti | 16 mellan korten, 12 inuti | D-1 |
| Sju chips för typ i rad | De fyra vanligaste och "Fler typer" | D-6 |
| Fyra bevakningstider i ett segment där etiketterna kapas ("3…") | Kortare etiketter ("14 d") eller rullgardin | D-6 |
| Visningsetikett och plusknapp i samma röda färg | Etiketten tonad; rött bara på plusknappen | D-4 |
| "Radera" som fylld röd knapp på detaljvyn | I menyn; röd bara i bekräftelsedialogen | D-3, D-8 |
| Rubrik, underrubrik, brödtext, fotnot och etikett i samma kort, i fem storlekar | Rubrik, brödtext och sekundärtext | D-5 |

## Källor

| Regel | Källa |
|---|---|
| D-1, D-2 | Gestalt: närhet – https://lawsofux.com/law-of-proximity/ · Material 3, spacing – https://m3.material.io/foundations/layout/understanding-layout/spacing · Refactoring UI (Wathan & Schoger), "Layout and spacing" |
| D-3 | Isoleringseffekten (Von Restorff) – https://lawsofux.com/von-restorff-effect/ · Android: FAB för handlingen av högst vikt, en handling i taget på layoutnivå – https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns · GOV.UK: standardknappen för sidans huvudhandling – https://design-system.service.gov.uk/components/button/ (Scottish Government, Parliament och ONS säger uttryckligen en primär per sida) |
| D-4, D-5 | NN/g, visuell hierarki – https://www.nngroup.com/articles/visual-hierarchy-ux-definition/ · Nielsens heuristik 8 – https://www.nngroup.com/articles/ten-usability-heuristics/ · Refactoring UI, "Hierarchy is everything" |
| D-6, D-8 | Hicks lag – https://lawsofux.com/hicks-law/ · NN/g, progressiv visning – https://www.nngroup.com/articles/progressive-disclosure/ · Android, navigation bar 3–5 mål – samma Android-sida som D-3 |
| D-7 | Nielsens heuristik 7 (flexibilitet och effektivitet) – samma NN/g-sida |
| D-9 | Fitts lag – https://lawsofux.com/fittss-law/ · Material 3, helskärmsdialog (undantaget) – https://m3.material.io/components/dialogs/guidelines |
| D-10 | Nielsens heuristik 1 (systemets status syns) – samma NN/g-sida |

Millers "7±2" gäller arbetsminne, inte menylängd, och används inte som gräns. Tips från sociala medier
används bara när de går att föra tillbaka till en källa ovan.
