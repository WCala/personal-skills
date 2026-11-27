# Blocco note

Un posto per gli appunti veloci: scrivi, premi Invio, fatto.

## Cosa fa

- Aggiunge una nota con un tocco e la mette in cima all'elenco.
- Segna una nota come fatta, oppure la elimina.
- Usa il colore che hai scelto nelle Impostazioni dell'app.

## Dove finiscono i dati

Le note restano nell'archivio dell'app, in uno spazio riservato a questa skill.
Nessun'altra skill può leggerle e non viene inviato nulla in rete.

## Per chi sviluppa

Questa skill è anche l'esempio minimo di come si usa l'archivio:

```js
const note = personal.storage.collection("note");
await note.add({ testo: "Comprare il latte", fatta: false });
const tutte = await note.list();
```
