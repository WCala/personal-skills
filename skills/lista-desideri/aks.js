// Lettura delle pagine di Allkeyshop e calcoli sui prezzi: solo funzioni pure,
// senza DOM né SDK, così girano uguali nel riquadro e nei test con Node.
//
// Le pagine del sito incorporano i loro dati in variabili JavaScript
// (`var cataloginitjs = {…}`, `var gamePageTrans = {…}`): leggiamo quelle. Tutto
// ciò che arriva dal sito è testo scritto da altri: indirizzi, numeri e forme si
// controllano qui, prima che finiscano nell'interfaccia o nell'archivio.

import { occasione } from "./occasioni.js";
import { statoOfferta } from "./regioni.js";

export const SITO = "https://www.allkeyshop.com";
const IMMAGINI = "https://cdn.allkeyshop.com";

function cambiata(dettaglio) {
  const errore = new Error(`La pagina di Allkeyshop è cambiata (${dettaglio}): la skill va aggiornata.`);
  errore.paginaCambiata = true;
  return errore;
}

/** Esegue una lettura: una forma inattesa dei dati diventa «pagina cambiata», non un errore tecnico. */
function leggendo(cosa, lettura) {
  try {
    return lettura();
  } catch (errore) {
    throw errore.paginaCambiata ? errore : cambiata(`${cosa} non leggibili`);
  }
}

/** L'oggetto JSON assegnato a `var <nome> = {…}` dentro una pagina. */
export function estraiOggetto(html, nome) {
  const inizio = html.indexOf(`var ${nome} = {`);
  if (inizio < 0) throw cambiata(`manca ${nome}`);
  const da = html.indexOf("{", inizio);
  let livello = 0;
  let inStringa = false;
  for (let i = da; i < html.length; i++) {
    const c = html[i];
    if (inStringa) {
      if (c === "\\") i++;
      else if (c === '"') inStringa = false;
    } else if (c === '"') inStringa = true;
    else if (c === "{") livello++;
    else if (c === "}" && --livello === 0) {
      try {
        return JSON.parse(html.slice(da, i + 1));
      } catch {
        throw cambiata(`${nome} non è leggibile`);
      }
    }
  }
  throw cambiata(`${nome} è incompleto`);
}

// ---- Indirizzi --------------------------------------------------------------

const indirizzo = (testo) => {
  try {
    return new URL(testo);
  } catch {
    return null;
  }
};

/**
 * Una pagina del blog del sito (le uniche che la skill può leggere), o `null`. Vale anche per
 * gli indirizzi che tornano dall'archivio: prima di ogni richiesta si ripassa da qui. Fuori
 * restano `/api/`, le pagine di servizio del blog e i percorsi con barre scritte in codice.
 */
export function paginaDelSito(link) {
  const url = indirizzo(link);
  if (!url || url.origin !== SITO || !url.pathname.startsWith("/blog/")) return null;
  const percorso = url.pathname.toLowerCase();
  if (/%2f|%5c|\\/.test(percorso) || /^\/blog\/(wp-admin|wp-json)(\/|$)/.test(percorso)) return null;
  return url.href;
}

/** Un'immagine dal CDN del sito o dalla cartella delle immagini del blog, o `null`. */
export function immagineFidata(src) {
  const url = indirizzo(src);
  if (!url) return null;
  const delBlog = url.origin === SITO && url.pathname.startsWith("/blog/wp-content/uploads/");
  return url.origin === IMMAGINI || delBlog ? url.href : null;
}

// ---- Ricerca ----------------------------------------------------------------

const voce = (id, nome) => ({ id: String(id), nome: String(nome ?? id) });
/** Un elenco di filtri: se il sito cambia forma resta vuoto, senza far fallire la ricerca. */
const elenco = (lettura) => {
  try {
    return lettura();
  } catch {
    return [];
  }
};
const voci = (mappa) => Object.values(mappa).map((v) => voce(v.slug, v.name));
const gruppo = (tags, slug) => tags.find((g) => g.slug === slug).tags.map((t) => voce(t.slug, t.name));

/** L'indirizzo della pagina di ricerca. `filtri`: { piattaforma, tipo, genere, giocatori }, con gli id del sito. */
export function urlRicerca(testo, filtri = {}) {
  const parametri = new URLSearchParams({ search_name: testo.trim() });
  const aggiungi = (nome, valore) => valore && parametri.set(nome, valore);
  aggiungi("operating_systems", filtri.piattaforma);
  aggiungi("type", filtri.tipo);
  aggiungi("top_level_genres_tags", filtri.genere);
  aggiungi("players_tags", filtri.giocatori);
  return `${SITO}/blog/products/?${parametri}`;
}

/**
 * Dalla pagina di ricerca: i risultati leggibili della prima pagina, quanti ne aveva la
 * pagina (`nellaPagina`), quanti sono in tutto e i filtri del sito.
 */
export function leggiRicerca(html) {
  const dati = estraiOggetto(html, "cataloginitjs").appData;
  return leggendo("i risultati", () => {
    const risposta = Object.values(dati.cachedQueries).find((r) => Array.isArray(r?.products));
    if (!risposta) throw cambiata("mancano i risultati");

    const risultati = risposta.products
      .map((p) => ({
        id: p.id,
        titolo: String(p.name ?? ""),
        pagina: paginaDelSito(p.link),
        tipo: String(p.type ?? ""),
        piattaforma: voce(p.operating_system?.id ?? "", p.operating_system?.name ?? ""),
        immagine: immagineFidata(p.assets?.cover),
      }))
      // L'id finisce nell'id dei documenti della lista: deve essere un numero intero.
      .filter((r) => r.pagina && Number.isSafeInteger(r.id));

    return {
      risultati,
      nellaPagina: risposta.products.length,
      totale: Number(risposta.pagination?.total ?? risposta.products.length),
      filtri: {
        piattaforme: elenco(() => voci(dati.operatingSystems)),
        tipi: elenco(() => voci(dati.productTypes)),
        generi: elenco(() => gruppo(dati.tags, "top_level_genres")),
        giocatori: elenco(() => gruppo(dati.tags, "players")),
      },
    };
  });
}

// ---- Pagina prodotto --------------------------------------------------------

const centesimi = (euro) => (typeof euro === "number" ? Math.round(euro * 100) : NaN);

/**
 * Un nome scritto dal sito (negozio, regione, edizione) come lo mostriamo: senza caratteri
 * di controllo o invisibili, senza virgolette basse (le usano i nostri testi per citarlo),
 * con gli spazi ridotti a uno e al massimo 60 caratteri.
 */
const nomeDelSito = (testo) =>
  [...String(testo ?? "").normalize("NFKC").replace(/[\p{Cc}\p{Cf}«»]/gu, " ").replace(/\s+/g, " ").trim()].slice(0, 60).join("").trim();

function immagineDellaPagina(html) {
  for (const [meta] of html.matchAll(/<meta\b[^>]*>/g)) {
    if (/\bproperty="og:image"/.test(meta)) return immagineFidata(meta.match(/\bcontent="([^"]*)"/)?.[1]);
  }
  return null;
}

/**
 * Dalla pagina prodotto: immagine, edizioni in vendita (`edizioni`), tutte quelle che il
 * sito conosce (`edizioniNote`) e le offerte disponibili, con i prezzi in centesimi.
 */
export function leggiProdotto(html) {
  const dati = estraiOggetto(html, "gamePageTrans");
  return leggendo("le offerte", () => {
    if (!Array.isArray(dati.prices)) throw cambiata("mancano le offerte");

    const disponibili = dati.prices.filter((o) => o.dispo);
    const offerte = disponibili
      // Id e negozio finiscono nel link dell'offerta: devono essere numeri interi.
      .filter((o) => Number.isSafeInteger(o.id) && Number.isSafeInteger(o.merchant))
      .map((o) => ({
        id: o.id,
        centesimi: centesimi(o.price),
        negozio: nomeDelSito(o.merchantName),
        idNegozio: o.merchant,
        edizione: String(o.edition),
        regione: nomeDelSito(dati.regions?.[o.region]?.filter_name),
        // Il coupon resta com'è: finisce nel link dell'offerta, che il sito vuole intatto.
        coupon: typeof o.voucher_code === "string" && o.voucher_code ? o.voucher_code : null,
        account: Boolean(o.account),
        // Solo ciò che il sito segna proprio come negozio della piattaforma: da qui dipende
        // quale paese vale per l'offerta.
        ufficiale: o.isFirstParty === true,
        // Un disco spedito a casa («This is not a downloadable product»), non una chiave.
        fisico: o.activationPlatform === "physical-medium",
      }))
      // Senza il nome del negozio un'offerta non si può né mostrare né evitare.
      .filter((o) => Number.isSafeInteger(o.centesimi) && o.centesimi > 0 && o.negozio);
    if (disponibili.length && !offerte.length) throw cambiata("prezzi non leggibili");

    const inVendita = new Set(offerte.map((o) => o.edizione));
    const edizioniNote = Object.entries(dati.editions ?? {}).map(([id, e]) => voce(id, nomeDelSito(e.name) || id));
    const edizioni = edizioniNote.filter((e) => inVendita.has(e.id));
    if (offerte.length && !edizioni.length) throw cambiata("mancano le edizioni");

    return { immagine: immagineDellaPagina(html), edizioni, edizioniNote, offerte };
  });
}

/** L'edizione proposta all'apertura della scheda: la Standard, altrimenti la prima in vendita. */
export function edizionePredefinita(prodotto) {
  return (prodotto.edizioni.find((e) => e.nome === "Standard") ?? prodotto.edizioni[0])?.id ?? null;
}

// `sort` è stabile: a parità di prezzo resta l'ordine del sito.
const perPrezzo = (offerte) => [...offerte].sort((a, b) => a.centesimi - b.centesimi);

/** Tutte le offerte di un'edizione, dalla più economica. */
export function altriPrezzi(prodotto, edizione) {
  return perPrezzo(prodotto.offerte.filter((o) => o.edizione === edizione));
}

// Chi compra («contesto»): `{ paese, evitati, soglia }`. Il paese è un codice di due lettere,
// `evitati` i nomi dei siti che l'utente non vuole, `soglia` i centesimi entro cui conviene
// il negozio ufficiale. Arrivano dall'app: paese dell'utente e impostazioni della skill.

const normaNegozio = (nome) => (typeof nome === "string" ? nome.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase() : "");
/**
 * I siti evitati come si ricordano nel documento: minuscoli, senza doppioni, in ordine.
 * Ciò che non è un elenco di testi (un documento scritto male) vale come elenco vuoto.
 */
const elencoEvitati = (evitati) => [...new Set((Array.isArray(evitati) ? evitati : []).map(normaNegozio).filter(Boolean))].sort();

/** Vero se l'offerta viene da uno dei siti evitati (il nome si confronta senza badare alle maiuscole). */
export function evitato(offerta, evitati) {
  return elencoEvitati(evitati).includes(normaNegozio(offerta.negozio));
}

/** Le chiavi dell'edizione, dalla più economica: né account né dischi. */
export function chiavi(prodotto, edizione) {
  return altriPrezzi(prodotto, edizione).filter((o) => !o.account && !o.fisico);
}

/**
 * La chiave più economica dell'edizione che l'utente può usare, o `null`: non di un sito
 * evitato, e non di una regione che nel suo paese non si attiva. Una regione non chiara
 * resta in gara («da verificare»): lo dirà l'etichetta.
 */
export function migliorOfferta(prodotto, edizione, { paese, evitati }) {
  return chiavi(prodotto, edizione).find((o) => !evitato(o, evitati) && statoOfferta(o, paese) !== "no") ?? null;
}

/**
 * Il prezzo sul negozio della piattaforma, per chi compra da `paese`: i negozi con un paese
 * nel nome (PS Store IT) solo se è il suo, quelli senza (Steam) sempre; tra questi il più
 * economico. `null` se non ne resta nessuno.
 */
export function prezzoUfficiale(prodotto, edizione, paese) {
  // `statoOfferta` dà «no» al negozio di un altro paese; lo dà anche a un negozio senza
  // paese che vende una chiave di una regione che lì non si attiva.
  return chiavi(prodotto, edizione).find((o) => o.ufficiale && statoOfferta(o, paese) !== "no") ?? null;
}

/**
 * Quanto si risparmia rispetto al negozio ufficiale: `null` se manca uno dei due prezzi,
 * negativo se il negozio ufficiale costa meno.
 */
export function risparmio(migliore, ufficiale) {
  if (!migliore || !ufficiale || ufficiale.centesimi <= 0) return null;
  const differenza = ufficiale.centesimi - migliore.centesimi;
  return { centesimi: differenza, percento: Math.round((differenza / ufficiale.centesimi) * 100) };
}

/** Il link di Allkeyshop che porta all'offerta, con il coupon (va lasciato com'è: lo chiede il sito). */
export function linkOfferta(offerta) {
  const parametri = new URLSearchParams({ locale: "en", merchant: String(offerta.idNegozio) });
  if (offerta.coupon) parametri.set("coupon", offerta.coupon);
  return `${SITO}/redirection/offer/eur/${offerta.id}?${parametri}`;
}

// ---- La lista ---------------------------------------------------------------

/**
 * Il documento che la skill salva per un gioco in lista (raccolta `desideri`), e che i
 * connettori leggeranno: i campi sono descritti nel README. I prezzi valgono per chi compra
 * (`contesto`), e il documento se lo ricorda. `precedente` è il documento che questo
 * sostituisce: se ne conservano `aggiunto` e, finché vale, l'occasione. Un'edizione che il
 * sito conosce ma che non ha offerte resta in lista senza prezzi; una che non esiste più è
 * un errore.
 */
export function documentoDesiderio(gioco, prodotto, edizione, adesso, contesto, precedente = null) {
  const scelta = [...prodotto.edizioni, ...prodotto.edizioniNote].find((e) => e.id === edizione);
  if (!scelta) throw new Error("Questa edizione non c'è più su Allkeyshop.");
  const migliore = migliorOfferta(prodotto, edizione, contesto);
  const ufficiale = prezzoUfficiale(prodotto, edizione, contesto.paese);
  const quando = adesso.toISOString();
  return {
    id: `${gioco.id}-${edizione}`,
    dati: {
      prodotto: gioco.id,
      titolo: gioco.titolo,
      piattaforma: gioco.piattaforma,
      tipo: gioco.tipo,
      edizione: scelta,
      pagina: gioco.pagina,
      immagine: gioco.immagine ?? prodotto.immagine,
      valuta: "EUR",
      paese: contesto.paese,
      evitati: elencoEvitati(contesto.evitati),
      migliore: migliore && {
        centesimi: migliore.centesimi, negozio: migliore.negozio, regione: migliore.regione,
        coupon: migliore.coupon, link: linkOfferta(migliore), attivabile: statoOfferta(migliore, contesto.paese),
      },
      ufficiale: ufficiale && { centesimi: ufficiale.centesimi, negozio: ufficiale.negozio, link: linkOfferta(ufficiale) },
      occasione: occasione(precedente?.occasione, migliore, ufficiale, contesto.soglia, adesso),
      aggiornato: quando,
      aggiunto: precedente?.aggiunto ?? quando,
    },
  };
}

/** Il gioco di una voce della lista, nella forma dei risultati di ricerca. */
export function giocoDaDocumento(dati) {
  return {
    id: dati.prodotto, titolo: dati.titolo, pagina: dati.pagina, tipo: dati.tipo,
    piattaforma: dati.piattaforma, immagine: dati.immagine,
  };
}

const VALIDITA_MS = 12 * 60 * 60 * 1000;

/**
 * Vero se i prezzi di una voce non valgono più per chi compra, e vanno riletti dal sito:
 * calcolati per un altro paese (o dalla 1.0.0, che non lo ricordava), con un sito che nel
 * frattempo non è più evitato, o con il prezzo migliore su un sito che ora lo è. Evitare un
 * altro sito non cambia nulla per questa voce: non serve una richiesta.
 */
export function daRileggere(dati, { paese, evitati }) {
  // Un documento che non si legge va rifatto dal sito, come uno calcolato per un altro paese.
  if (dati?.paese !== paese) return true;
  const adesso = elencoEvitati(evitati);
  const tornati = elencoEvitati(dati.evitati).some((nome) => !adesso.includes(nome));
  return tornati || Boolean(dati.migliore && adesso.includes(normaNegozio(dati.migliore.negozio)));
}

/**
 * Le voci della lista (`{ id, data }`) da riaggiornare: quelle con i prezzi più vecchi di 12
 * ore e quelle che non valgono più per chi compra. Dalla più vecchia.
 */
export function daAggiornare(voci, adesso, contesto) {
  // Una data mancante, illeggibile o nel futuro vale come «mai aggiornata».
  const eta = (v) => {
    const passato = adesso - (Date.parse(v.data?.aggiornato) || 0);
    return passato >= 0 ? passato : Infinity;
  };
  return voci.filter((v) => eta(v) >= VALIDITA_MS || daRileggere(v.data, contesto)).sort((a, b) => eta(b) - eta(a));
}

/**
 * Il documento di una voce riallineato alle impostazioni senza rileggere i prezzi: l'elenco
 * dei siti evitati che ricorda e l'occasione, che dipende dalla soglia. `null` se non c'è
 * nulla da cambiare, o se la voce va riletta dal sito (ci pensa l'aggiornamento).
 */
export function riallineata(dati, contesto, adesso) {
  if (daRileggere(dati, contesto)) return null;
  const evitati = elencoEvitati(contesto.evitati);
  const nuova = occasione(dati.occasione, dati.migliore, dati.ufficiale, contesto.soglia, adesso);
  const uguali = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  if (uguali(evitati, elencoEvitati(dati.evitati)) && uguali(nuova, dati.occasione)) return null;
  return { ...dati, evitati, occasione: nuova };
}
