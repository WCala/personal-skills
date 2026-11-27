# Skill di WCala

Il catalogo di skill per Personal.
L'app lo usa già come repository predefinito. Se lo hai tolto, riaggiungilo dalle Impostazioni:
`WCala/personal-skills`.

## Le skill

| Skill | Cosa fa | Permessi |
| --- | --- | --- |
| [Blocco note](skills/blocco-note) | Appunti veloci, salvati nell'app. | Nessuno |
| [Lista desideri](skills/lista-desideri) | I giochi che vuoi comprare, con la chiave più conveniente su Allkeyshop che si attiva nel tuo paese. Impostazioni: siti da evitare, soglia per il negozio ufficiale. | Rete: `www.allkeyshop.com`, `cdn.allkeyshop.com` |

## Com'è organizzato

```
catalog.json        nome del catalogo e di chi lo cura
index.json          l'elenco che l'app legge (generato, non modificarlo a mano)
skills/<id>/        una cartella per skill: manifest.json, README.md, icona, pagina
scripts/            lo script che genera index.json
```

## Aggiungere una skill

1. Crea `skills/<id>/` con `manifest.json`, `README.md`, l'icona e la pagina: la via più
   semplice è partire da una copia di `skills/blocco-note/`. L'id è in minuscolo, con cifre
   e trattini, e deve coincidere con `id` nel manifest.
2. Scrivi la skill con l'SDK che l'app le offre (`window.personal`): le sue funzioni sono
   descritte in `public/__sdk__/sdk.js` del repository dell'app.
3. Aggiungi una riga alla tabella qui sopra.
4. Rigenera l'elenco con `node scripts/build-index.mjs` e metti `index.json` nello stesso
   commit. L'app legge da lì versione, manifest e impronte dei file: se non lo rigeneri non
   vede la novità e rifiuta i file modificati.
5. Controlla con `git status --short --ignored skills/` che nella cartella non ci siano
   file fuori dal commit: lo script legge la cartella, e un file che non arriva su GitHub
   blocca l'installazione della skill.
6. Apri una pull request. Dopo il merge su `main` l'app vede la skill entro qualche minuto.

Il catalogo non usa i workflow di GitHub: `node scripts/build-index.mjs --check` si lancia
a mano (serve Node 22 o successivo) prima di ogni commit e di nuovo dopo un merge, prima
di spingere `main`. Se due rami hanno rigenerato `index.json`, dopo il merge va
rigenerato ancora, non scelto tra le due versioni.

## Aggiornare una skill

Modifica i file, **aumenta `version`** nel manifest (è così che l'app propone
l'aggiornamento) e rigenera `index.json` come sopra.

## Regole del catalogo

- Una skill chiede solo i permessi che usa, e nel README spiega perché.
- Con il permesso `net`, in `net.allow` vanno solo gli host davvero necessari.
- Ogni file può pesare al massimo 20 MB, una skill 60 MB.
- `index.json` contiene l'impronta sha256 di ogni file: l'app rifiuta i file che non coincidono.
