# BRONCO // 1200

En mobiltilpasset Bronco-testapp for Samnanger G14.

## Dette er bygget inn

- 3–2–1-nedtelling og én felles starttid for alle.
- Stor live-klokke og store målgangsknapper som er enkle å treffe på banen.
- Ett trykk på spilleren registrerer tiden og lagrer testen fortløpende i Firestore.
- «Angre siste» dersom treneren treffer feil navn.
- «Stopp test» markerer alle som fortsatt løper som **Ikke fullført (DNF)**.
- Aktiv test lagres også i `localStorage`, slik at en refresh ikke ødelegger testen.
- Screen Wake Lock brukes når nettleseren støtter det.
- Resultatside med nivåfarger, testhistorikk, personlig rekord og avstand til PB.
- Spillerside med dagens G14-tropp og mulighet til å legge til/fjerne ekstra spillere.
- PWA-manifest slik at appen kan legges på hjemskjermen.
- Firebase Auth + Firestore bruker samme Firebase-prosjekt som `coachtool1`.

## Standardtropp

Ask, Martin, Brage, Gabriel, Sondre, Nico, Lars, Snorre, Sverre, Liam, Noah, Lukas, Oliver, Nytveit, Theodor og Thage.

## Nivåfarger

Disse er lagt inn som **interne lagreferanser**, ikke som offisielle medisinske eller nasjonale normverdier:

- `< 5:00` – Ekstremt
- `5:00–5:19.9` – Svært bra
- `5:20–5:44.9` – Bra
- `5:45–6:09.9` – Greit
- `6:10–6:39.9` – Forbedringsrom
- `>= 6:40` – Bygg kapasitet

## Firestore

Appen bruker:

- `broncoTests/{testId}` for hver testøkt
- `broncoConfig/team` for spillerlisten

Filen `firestore-rules-snippet.txt` er **kun et utdrag som skal flettes inn i eksisterende regler**. Ikke deploy den alene, siden Firebase-prosjektet også brukes av andre apper.

## Kjøring / deploy

Dette er en statisk app uten build-steg. `index.html` kan serveres direkte, og repoet kan kobles til Vercel som et vanlig statisk prosjekt.
