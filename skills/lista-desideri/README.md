# Lista desideri

I giochi che vuoi comprare, con la chiave più conveniente trovata su
[Allkeyshop](https://www.allkeyshop.com) che si attiva nel tuo paese, e il confronto con
il negozio ufficiale.

## Cosa fa

- Cerca un gioco per titolo, con i filtri del sito: piattaforma, tipo, genere, giocatori.
- Per ogni gioco mostra la chiave più economica che puoi usare, da quale negozio arriva e
  quanto risparmi rispetto al negozio della piattaforma (Steam, PS Store…). Un bottone
  mostra tutti gli altri prezzi, account e dischi compresi.
- Accanto a ogni chiave dice se si attiva nel tuo paese: «Si attiva in Italia», «Non si
  attiva in Italia», oppure «Regione non chiara» quando il sito non lo dice. Le chiavi che
  non si attivano non sono mai il prezzo migliore.
- Quando aggiungi un gioco ti avvisa se la chiave migliore ha una regione non chiara, e puoi
  evitare quel sito: le sue offerte non entreranno più nel prezzo migliore.
- Segnala i giochi che **conviene comprare dal negozio ufficiale**, perché costa poco più
  della chiave migliore. Quanto è «poco» lo decidi tu.
- Tiene la tua lista e ne aggiorna i prezzi: da sola quando hanno più di 12 ore, oppure
  quando lo chiedi tu.
- Apre l'offerta nel browser, con il coupon già nel link. L'app ti chiede conferma ogni volta.

I prezzi sono una fotografia del momento in cui sono stati letti: prima di comprare
controlla sempre sulla pagina del sito.

## Il paese e le regioni

Il paese è quello che hai scelto nelle Impostazioni dell'app, o quello del dispositivo. Ogni
offerta del sito ha una regione (per esempio «STEAM EU»), e la skill la confronta con il tuo
paese:

- per le regioni che il sito dichiara senza limiti («STEAM GLOBAL») o legate a una zona o a
  un paese («EUROPE», «USA»), sa dire se la chiave si attiva o no. «Europa» vale per i 27 paesi
  dell'Unione europea; per gli altri paesi europei resta da verificare;
- per le regioni che il sito non spiega («ROW», «PS5», quelle in una sola lingua) e per
  ogni nome che non conosce dice «Regione non chiara»: non dà mai per buona una regione
  sconosciuta;
- i negozi della piattaforma con un paese nel nome (PS Store IT, Xbox DE, Nintendo eShop FR)
  valgono solo per quel paese;
- i dischi («BOX») non sono chiavi: li vedi tra gli altri prezzi, mai come prezzo migliore.

La tabella è in `regioni.js`: è ricavata dalla frase con cui il sito spiega ogni regione
(«for EUROPE Only», «Region Free / Worldwide»), che non elenca mai i paesi.

## Le impostazioni

Le trovi nelle Impostazioni dell'app, alla voce «Lista desideri»:

- **Siti da evitare**: l'elenco dei siti che non vuoi nel prezzo migliore. Si riempie quando
  scegli «Evita» in un avviso; da lì puoi togliere un sito.
- **Soglia per l'ufficiale (€)**: se il negozio ufficiale costa al massimo questa cifra in
  più della chiave migliore, il gioco è segnato «Conviene l'ufficiale». All'inizio 5,99 €.

## Perché chiede la rete

Il permesso serve per due soli siti:

- `www.allkeyshop.com`: le pagine di ricerca e dei prodotti, da cui legge i prezzi, e i
  link delle offerte che apri nel browser;
- `cdn.allkeyshop.com`: le copertine dei giochi.

La skill rispetta le regole che il sito dà ai programmi automatici: una richiesta alla
volta, mai più di una ogni 5 secondi, solo le pagine consentite e i link delle offerte
lasciati intatti. Per questo una ricerca fatta subito dopo un'altra aspetta qualche secondo,
e vedi solo la prima pagina di risultati: per restringere usa un titolo più preciso o i filtri.

## Dove finiscono i dati

La lista resta nell'archivio dell'app, nello spazio riservato a questa skill. Al sito
arrivano il titolo che cerchi con i filtri scelti, le richieste delle pagine dei giochi che
apri o che hai in lista (per aggiornarne i prezzi) e quelle delle copertine.

## Per i connettori

La skill mette a disposizione, in sola lettura, la raccolta `desideri`: un documento per
ogni gioco ed edizione in lista, con id `<prodotto>-<edizione>` (lo stesso gioco in due
edizioni sono due documenti).

| Campo | Tipo | Significato |
| --- | --- | --- |
| `prodotto` | numero intero | Id del prodotto su Allkeyshop (un gioco su una piattaforma). |
| `titolo` | testo | Nome del gioco. |
| `piattaforma` | `{ id, nome }` | Per esempio `{ "id": "pc", "nome": "PC" }`. |
| `tipo` | testo | Come lo chiama il sito: oggi `game`, `dlc`, `account`, `software` o `prepaids`. |
| `edizione` | `{ id, nome }` | L'edizione scelta, per esempio «Standard». |
| `pagina` | indirizzo | La pagina del prodotto sul sito. |
| `immagine` | indirizzo o `null` | La copertina. |
| `valuta` | testo | Sempre `EUR`. |
| `paese` | testo | Il paese per cui valgono i prezzi, come codice di due lettere (`IT`). Manca nelle voci scritte dalla 1.0.0, finché non si riaggiornano. |
| `evitati` | elenco di testi | I siti che l'utente evitava quando i prezzi sono stati calcolati, in minuscolo. Serve alla skill per sapere quando ricalcolare. |
| `migliore` | oggetto o `null` | La chiave più economica **che l'utente può usare**: `centesimi`, `negozio`, `regione`, `coupon` (o `null`), `link`, `attivabile`. Non viene mai da un sito evitato né da una regione che nel suo paese non si attiva. `attivabile` è `"si"` oppure `"da-verificare"` (regione non chiara). `null` se non ci sono chiavi utilizzabili, anche perché l'edizione è esaurita. |
| `ufficiale` | oggetto o `null` | Il prezzo sul negozio della piattaforma che vale per il paese: `centesimi`, `negozio`, `link`. `null` se non c'è. |
| `occasione` | oggetto o `null` | Presente quando conviene il negozio ufficiale: `dal` (data ISO, da quando) e `ufficialeCentesimi` (a quale prezzo ufficiale). Resta uguale finché quel prezzo non cambia. |
| `aggiornato` | data ISO | Quando sono stati letti i prezzi. |
| `aggiunto` | data ISO | Quando il gioco è entrato in lista. |

Gli importi sono **centesimi interi e positivi** (`3088` = 30,88 €), così si sommano senza
errori: le offerte con un prezzo che non si legge vengono scartate prima di arrivare qui.
Il costo della lista è la somma di `migliore.centesimi` delle voci che lo hanno.

Dalla 1.1.0 `migliore` non è più «la chiave più economica» ma «la più economica utilizzabile»:
può costare di più di prima, o mancare. Una voce scritta dalla 1.0.0 e non ancora
riaggiornata si riconosce perché non ha `paese`: le mancano anche `evitati`, `occasione` e
`migliore.attivabile`, e il suo `migliore` ha ancora il vecchio significato.

## Per chi sviluppa

- `aks.js`: lettura delle pagine e regole sui prezzi, solo funzioni pure.
- `regioni.js`: la tabella regione → paesi e lo stato di una chiave nel paese.
- `avvisi.js`: che cosa chiedere prima di aggiungere un gioco.
- `occasioni.js`: «Conviene l'ufficiale».
- `formato.js`: come si scrivono gli importi.
- `coda.js`: la coda che distanzia le richieste.
- `aggiorna.js`: l'aggiornamento dei prezzi della lista, una richiesta per pagina.
- `app.js`: l'interfaccia.

Serve Personal con il paese e le impostazioni delle skill (`personal.app.paese`,
`personal.settings`): su una versione precedente la skill lo dice e si ferma.

Se il sito cambia la forma delle sue pagine, la skill lo dice («La pagina di Allkeyshop è
cambiata») e la lista conserva gli ultimi prezzi letti.

I caratteri in `fonts/` sono Bricolage Grotesque e Figtree, gli stessi dell'app, con
licenza SIL Open Font License 1.1 (`fonts/LICENZA.txt`).
