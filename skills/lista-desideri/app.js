// L'interfaccia della skill: tre viste (la lista, i risultati di una ricerca, la scheda di
// un gioco) dentro #vista. La lettura del sito e le regole sui prezzi stanno in aks.js, le
// regioni in regioni.js, gli avvisi in avvisi.js, «Conviene l'ufficiale» in occasioni.js, il
// ritmo delle richieste in coda.js, l'aggiornamento dei prezzi in aggiorna.js.

import { creaAggiornatore } from "./aggiorna.js";
import {
  altriPrezzi, chiavi, daAggiornare, daRileggere, documentoDesiderio, edizionePredefinita, evitato, giocoDaDocumento,
  immagineFidata, leggiProdotto, leggiRicerca, linkOfferta, migliorOfferta, paginaDelSito, prezzoUfficiale, riallineata,
  risparmio, urlRicerca,
} from "./aks.js";
import { percorsoAggiunta } from "./avvisi.js";
import { creaCoda } from "./coda.js";
import { euro } from "./formato.js";
import { conviene, sogliaInCentesimi, testoConviene } from "./occasioni.js";
import { etichettaStato, nelPaese, STATI, statoOfferta } from "./regioni.js";

// ---- Piccoli attrezzi -------------------------------------------------------

const $ = (id) => document.getElementById(id);

/** Crea un elemento. I testi che arrivano dal sito passano sempre da `textContent`. */
function el(tag, proprieta = {}, ...figli) {
  const nodo = Object.assign(document.createElement(tag), proprieta);
  nodo.append(...figli);
  return nodo;
}

/** Un bottone. `fuoco` è il nome con cui ritrovarlo dopo un ridisegno (vedi `conIlFuoco`). */
function bottone(classe, testo, alClic, { fuoco = "", etichetta = "" } = {}) {
  const nodo = el("button", { type: "button", className: classe, textContent: testo });
  if (fuoco) nodo.dataset.fuoco = fuoco;
  if (etichetta) nodo.setAttribute("aria-label", etichetta);
  nodo.addEventListener("click", alClic);
  return nodo;
}

// I nomi del sito sono in inglese: qui quelli che mostriamo. Per gli altri resta il nome del sito.
const NOMI = {
  game: "Gioco", dlc: "DLC", account: "Account", software: "Software", prepaids: "Ricarica",
  action: "Azione", adventure: "Avventura", casual: "Casual", rpg: "Gioco di ruolo", racing: "Corse",
  simulation: "Simulazione", sports: "Sport", strategy: "Strategia",
  singleplayer: "Giocatore singolo", multiplayer: "Multigiocatore", co_op: "Cooperativo",
  online_co_op: "Cooperativo online", local_co_op: "Cooperativo in locale", co_op_campaign: "Campagna cooperativa",
  local_multiplayer: "Multigiocatore in locale", massively_multiplayer: "Multigiocatore di massa",
  asynchronous_multiplayer: "Multigiocatore asincrono", "4_player_local": "4 giocatori in locale",
};
const nome = (voce) => (Object.hasOwn(NOMI, voce.id) ? NOMI[voce.id] : voce.nome);

// I filtri del sito, finché una ricerca non porta l'elenco aggiornato.
const voci = (...ids) => ids.map((id) => ({ id, nome: id }));
const FILTRI_INIZIALI = {
  piattaforme: [
    { id: "pc", nome: "PC" }, { id: "playstation-5", nome: "PlayStation 5" }, { id: "playstation-4", nome: "PlayStation 4" },
    { id: "xbox-series-x", nome: "Xbox Series X" }, { id: "xbox-one", nome: "Xbox One" },
    { id: "switch-2", nome: "Switch 2" }, { id: "switch", nome: "Switch" },
  ],
  tipi: voci("game", "dlc", "account", "software", "prepaids"),
  generi: voci("action", "adventure", "casual", "rpg", "racing", "simulation", "sports", "strategy"),
  giocatori: voci("singleplayer", "multiplayer", "co_op", "online_co_op", "local_co_op"),
};

const CAMPI = [
  // [chiave del filtro scelto, elenco da cui pescare, id del <select>, voce «nessun filtro»]
  ["piattaforma", "piattaforme", "f-piattaforma", "Tutte"],
  ["tipo", "tipi", "f-tipo", "Tutti"],
  ["genere", "generi", "f-genere", "Tutti"],
  ["giocatori", "giocatori", "f-giocatori", "Tutti"],
];

const oraBreve = (data) => data.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
/** «oggi alle 21:30» oppure «il 25 nov alle 20:00». */
function quando(iso) {
  const data = new Date(iso);
  const oggi = data.toDateString() === new Date().toDateString();
  return `${oggi ? "oggi" : `il ${data.toLocaleDateString("it-IT", { day: "numeric", month: "short" })}`} alle ${oraBreve(data)}`;
}
const descrizione = (gioco) => `${nome({ id: gioco.tipo, nome: gioco.tipo })} per ${gioco.piattaforma.nome}`;

// ---- Stato e richieste ------------------------------------------------------

const stato = $("stato");
const vista = $("vista");
const coda = creaCoda();

/** Il messaggio sotto la ricerca: ciò che la skill sta facendo per l'utente, o un errore. */
function avvisa(testo, errore = false) {
  stato.textContent = testo;
  stato.classList.toggle("errore", errore);
}

/**
 * Scarica una pagina del sito quando è il suo turno nella coda. Restituisce `undefined` se
 * al suo turno `utile()` dice che non serve più. Una ricerca senza risultati arriva come
 * 404 con la pagina completa: con `anche404` la si legge lo stesso.
 */
async function pagina(url, { priorita = false, anche404 = false, utile = null } = {}) {
  // Gli indirizzi arrivano anche dall'archivio: prima di chiedere al sito si ricontrolla che
  // sia una pagina che la skill può leggere. Un errore che riguarda solo questa pagina non
  // deve fermare gli aggiornamenti delle altre (vedi aggiorna.js).
  const soloQuesta = (messaggio) => Object.assign(new Error(messaggio), { soloQuestaPagina: true });
  if (!paginaDelSito(url)) throw soloQuesta("Questo indirizzo non è una pagina di Allkeyshop che la skill può leggere.");
  const risposta = await coda.accoda(() => personal.net.fetch(url), { priorita, utile });
  if (risposta === undefined) return undefined;
  if (risposta.status === 404 && !anche404) throw soloQuesta("Questa pagina non c'è più su Allkeyshop.");
  if (!risposta.ok && risposta.status !== 404) {
    throw new Error(`Allkeyshop ha risposto con un errore (${risposta.status}). Riprova tra poco.`);
  }
  return risposta.text();
}

let impostazioni;
let desideri;
let elenchi = FILTRI_INIZIALI;
let scelti = {};
// La lista: un documento per gioco ed edizione nella raccolta `desideri` (vedi `documentoDesiderio`).
let lista = [];
// Chi compra: il paese dell'utente (dall'app), i siti che non vuole e la soglia per il negozio
// ufficiale (dalle impostazioni della skill, che l'utente vede nelle Impostazioni dell'app).
// Se il paese cambia l'app ricarica la skill; i siti evitati cambiano anche da qui, con «Evita».
let contesto = { paese: "IT", evitati: [], soglia: 0 };

/** Le impostazioni della skill, come le dà l'app, dentro `contesto`. */
function usaImpostazioni(valori) {
  const evitati = Array.isArray(valori["siti-evitati"]) ? valori["siti-evitati"].filter((nome) => typeof nome === "string") : [];
  contesto = { ...contesto, evitati, soglia: sogliaInCentesimi(valori["soglia-ufficiale"]) };
}

try {
  await personal.ready();
  if (typeof personal.settings?.get !== "function" || typeof personal.app.paese !== "function") {
    throw new Error("serve una versione più recente di Personal. Aggiorna l'app e riapri la Lista desideri.");
  }
  impostazioni = personal.storage.collection("impostazioni");
  desideri = personal.storage.collection("desideri");
  contesto = { ...contesto, paese: await personal.app.paese() };
  usaImpostazioni(await personal.settings.get());
  const salvate = (await impostazioni.get("main"))?.data ?? {};
  elenchi = { ...FILTRI_INIZIALI, ...salvate.elenchi };
  scelti = salvate.filtri ?? {};
  lista = await desideri.list();
} catch (errore) {
  avvisa(`La skill non è riuscita a partire: ${errore.message}`, true);
  throw errore;
}

const inLista = (id) => lista.some((voce) => voce.id === id);
const aggiornatore = creaAggiornatore({
  voci: () => lista,
  scarica: pagina,
  salva: (id, dati) => desideri.put(id, dati),
  contesto: () => contesto,
});

/**
 * Porta la lista al passo con chi compra, dopo l'apertura e dopo ogni cambio dei siti
 * evitati: ciò che dipende solo dalle impostazioni si corregge subito, senza richieste; le
 * voci i cui prezzi non valgono più (e quelle più vecchie di 12 ore) passano dalla coda.
 */
async function allineaLista() {
  const adesso = new Date();
  for (const { id } of lista) {
    try {
      // La lista cambia mentre si scrive: si riparte ogni volta dalla voce com'è adesso, e si
      // lascia stare quella che l'aggiornatore sta già rileggendo dal sito.
      const voce = lista.find((v) => v.id === id);
      if (!voce || aggiornatore.inCorso(voce.data?.pagina)) continue;
      const dati = riallineata(voce.data, contesto, adesso);
      if (dati) await desideri.put(id, dati);
    } catch {
      // Una voce illeggibile o non salvata resta com'è: la lista la mostra comunque.
    }
  }
  try {
    aggiorna(aggiornatore.aggiornaTutte(daAggiornare(lista, adesso, contesto)));
  } catch (errore) {
    avvisa(`I prezzi non si aggiornano da soli: ${errore.message}`, true);
  }
}

/**
 * Una domanda all'utente, in una finestra dentro la pagina (nel riquadro `confirm()` non
 * esiste). `bottoni`: `[testo, valore, classe]`; si risolve con il valore scelto, o `null`
 * se l'utente chiude con Esc. Il fuoco parte dall'ultimo bottone, quello che non cambia nulla.
 */
function chiediConferma(testo, bottoni) {
  return new Promise((risposta) => {
    const finestra = el("dialog", { className: "finestra" }, el("p", { id: "domanda", textContent: testo }));
    // Il testo della domanda è ciò che un lettore di schermo deve dire all'apertura.
    finestra.setAttribute("role", "alertdialog");
    finestra.setAttribute("aria-labelledby", "domanda");
    const chiudi = (valore) => {
      finestra.close();
      finestra.remove();
      risposta(valore);
    };
    const azioni = el("div", { className: "azioni" }, ...bottoni.map(([nome, valore, classe]) => bottone(classe, nome, () => chiudi(valore))));
    finestra.append(azioni);
    finestra.addEventListener("cancel", (evento) => {
      evento.preventDefault();
      chiudi(null);
    });
    document.body.append(finestra);
    finestra.showModal();
    azioni.lastChild.focus();
  });
}

/** L'etichetta che dice se una chiave si attiva nel paese dell'utente. */
function etichettaAttivazione(stato, offerta) {
  // Lo stato arriva anche dall'archivio: ciò che non è uno dei tre vale «da verificare».
  const noto = STATI.includes(stato) ? stato : "da-verificare";
  return el("em", { className: `etichetta attivazione ${noto}`, textContent: etichettaStato(noto, offerta, contesto.paese) });
}

// ---- Viste ------------------------------------------------------------------

// Il numero dell'ultima cosa chiesta dall'utente (una ricerca, una scheda, il ritorno alla
// lista): una risposta che arriva per una richiesta più vecchia si scarta.
let richiesta = 0;
// Come ridisegnare ciò che si sta guardando quando la lista o gli aggiornamenti cambiano.
// Ridisegnare non è navigare: non tocca `richiesta` né il messaggio di stato.
let ridisegna = () => {};

function cambiaVista(nomeVista, comeRidisegnare) {
  document.body.dataset.vista = nomeVista;
  ridisegna = comeRidisegnare;
}

const conFuoco = (chiave) => [...vista.querySelectorAll("[data-fuoco]")].find((nodo) => nodo.dataset.fuoco.startsWith(chiave));

/** Ridisegna senza far perdere il posto a chi usa la tastiera: il fuoco torna sull'elemento con lo stesso nome. */
function conIlFuoco(disegna) {
  const chiave = document.activeElement?.dataset?.fuoco;
  disegna();
  if (chiave) conFuoco(chiave)?.focus();
}

/**
 * Una richiesta fatta dall'utente: mostra l'attesa e gli errori, purché nel frattempo non
 * abbia chiesto altro. `lavoro` riceve `attuale()`, che dice se la richiesta è ancora l'ultima.
 */
async function chiedi(messaggio, lavoro) {
  const questa = ++richiesta;
  const attuale = () => questa === richiesta;
  avvisa(messaggio);
  const lenta = setTimeout(
    () => attuale() && avvisa(`${messaggio} Può volerci qualche secondo: il sito chiede 5 secondi tra una richiesta e l'altra.`),
    1500,
  );
  try {
    await lavoro(attuale);
  } catch (errore) {
    if (attuale()) avvisa(errore.message, true);
  } finally {
    clearTimeout(lenta);
  }
}

// ---- Filtri -----------------------------------------------------------------

function disegnaFiltri() {
  for (const [chiave, elenco, id, tutti] of CAMPI) {
    const scelta = scelti[chiave] ?? "";
    $(id).replaceChildren(
      el("option", { value: "", textContent: tutti }),
      ...elenchi[elenco].map((v) => el("option", { value: v.id, textContent: nome(v), selected: v.id === scelta })),
    );
  }
}

function leggiFiltri() {
  return Object.fromEntries(CAMPI.map(([chiave, , id]) => [chiave, $(id).value]));
}

// ---- Ricerca ----------------------------------------------------------------

function rigaGioco({ titolo, immagine, dettaglio }, alClic, fuoco) {
  const copertina = el("img", { className: "copertina", alt: "", loading: "lazy" });
  // L'indirizzo può venire dall'archivio: si mostra solo un'immagine del sito.
  if (immagineFidata(immagine)) copertina.src = immagineFidata(immagine);
  const testo = el("div", {}, el("strong", { textContent: titolo }), el("span", { textContent: dettaglio }));
  const riga = bottone("gioco", "", alClic, { fuoco });
  riga.append(copertina, testo);
  return riga;
}

let ultimaRicerca = null;

function mostraRisultati() {
  const { testo, risultati, nellaPagina, totale } = ultimaRicerca;
  cambiaVista("risultati", () => {});
  vista.replaceChildren(
    bottone("quieto", "Torna alla tua lista", apriLista),
    el("ul", { className: "giochi" }, ...risultati.map((r) =>
      el("li", {}, rigaGioco({ ...r, dettaglio: descrizione(r) }, () => apriScheda(r, mostraRisultati), `apri:${r.pagina}`)))),
  );
  if (!risultati.length) avvisa(`Nessun risultato per «${testo}». Prova con un titolo più corto o togli un filtro.`);
  else if (totale > nellaPagina) avvisa(`I primi ${risultati.length} risultati di ${totale}. Per restringere, scrivi un titolo più preciso o usa i filtri.`);
  else avvisa(risultati.length === 1 ? "1 risultato." : `${risultati.length} risultati.`);
}

function cerca(testo) {
  scelti = leggiFiltri();
  return chiedi(`Cerco «${testo}»…`, async (attuale) => {
    const html = await pagina(urlRicerca(testo, scelti), { priorita: true, anche404: true, utile: attuale });
    if (html === undefined || !attuale()) return;
    const { filtri, ...ricerca } = leggiRicerca(html);
    // Gli elenchi dei filtri si sostituiscono solo se il sito li ha mandati.
    for (const [, elenco] of CAMPI) if (filtri[elenco].length) elenchi = { ...elenchi, [elenco]: filtri[elenco] };
    disegnaFiltri();
    impostazioni.put("main", { elenchi, filtri: scelti }).catch(() => {});
    ultimaRicerca = { testo, ...ricerca };
    mostraRisultati();
  });
}

// ---- Scheda di un gioco -----------------------------------------------------

/** Apre un indirizzo del sito nel browser: l'app chiede conferma all'utente. */
async function apriNelBrowser(url) {
  if (typeof personal.app.openExternal !== "function") {
    // Versioni dell'app che non sanno aprire i link: mostriamo l'indirizzo da copiare.
    avvisa(`Apri questo indirizzo nel browser: ${url}`);
    return;
  }
  try {
    await personal.app.openExternal(url);
  } catch (errore) {
    if (errore.message !== "Apertura annullata") avvisa(errore.message, true);
  }
}

/** La barra di confronto: intera è il prezzo ufficiale, la parte piena è il prezzo migliore. */
function confronto(migliore, ufficiale) {
  const r = risparmio(migliore, ufficiale);
  if (!r) return el("p", { className: "nota", textContent: `Prezzo ufficiale non disponibile ${nelPaese(contesto.paese)} per questa edizione.` });
  const barra = el("div", { className: "barra" }, el("div", { className: "barra-piena" }));
  barra.firstChild.style.width = `${Math.max(0, Math.min(100, 100 - r.percento))}%`;
  const testo = r.centesimi > 0
    ? `Su ${ufficiale.negozio} costa ${euro(ufficiale.centesimi)}: risparmi ${euro(r.centesimi)} (${r.percento}%).`
    : `Su ${ufficiale.negozio} costa ${euro(ufficiale.centesimi)}: qui non si risparmia.`;
  return el("div", { className: "confronto" }, barra, el("p", { textContent: testo }), occasioneVisibile(migliore, ufficiale));
}

/** «Conviene l'ufficiale», con la differenza: quando il negozio della piattaforma costa poco di più. */
function occasioneVisibile(migliore, ufficiale) {
  if (!conviene(migliore, ufficiale, contesto.soglia)) return "";
  return el("p", { className: "conviene" },
    el("em", { className: "etichetta occasione", textContent: "Conviene l'ufficiale" }),
    el("span", { textContent: testoConviene(migliore, ufficiale) }));
}

function rigaPrezzo(offerta) {
  const tipo = offerta.account ? "Account" : offerta.fisico ? "Disco" : "Chiave";
  const dettagli = [offerta.regione, offerta.coupon && `coupon ${offerta.coupon}`].filter(Boolean).join(", ");
  const negozio = el("div", {},
    el("strong", { textContent: offerta.negozio }),
    el("em", { className: offerta.account || offerta.fisico ? "etichetta account" : "etichetta", textContent: tipo }),
    // Un account e un disco non si attivano con un codice: l'etichetta vale solo per le chiavi.
    offerta.account || offerta.fisico ? "" : etichettaAttivazione(statoOfferta(offerta, contesto.paese), offerta),
    evitato(offerta, contesto.evitati) ? el("em", { className: "etichetta", textContent: "Sito evitato" }) : "",
    el("span", { textContent: dettagli }));
  const apri = bottone("quieto", "Apri", () => apriNelBrowser(linkOfferta(offerta)), {
    etichetta: `Apri l'offerta di ${offerta.negozio}, ${tipo.toLowerCase()} a ${euro(offerta.centesimi)}`,
  });
  return el("li", {}, el("b", { textContent: euro(offerta.centesimi) }), negozio, apri);
}

// Il gioco e l'edizione della scheda che si sta guardando (vedi `ancoraQui` in `mostraScheda`).
let schedaAperta = null;

/** `fuoco`: dove mettere il fuoco dopo il disegno («titolo» all'apertura, «edizione» se si è cambiata quella). */
function mostraScheda(gioco, prodotto, edizione, letto, indietro, fuoco = "titolo") {
  const migliore = migliorOfferta(prodotto, edizione, contesto);
  const ufficiale = prezzoUfficiale(prodotto, edizione, contesto.paese);
  const tutte = altriPrezzi(prodotto, edizione);

  const torna = bottone("quieto", "Indietro", () => {
    indietro();
    conFuoco(`apri:${gioco.pagina}`)?.focus();
  });

  const copertina = el("img", { className: "copertina grande", alt: "" });
  const immagine = immagineFidata(gioco.immagine) ?? prodotto.immagine;
  if (immagine) copertina.src = immagine;
  const titolo = el("h1", { textContent: gioco.titolo, tabIndex: -1 });
  titolo.dataset.fuoco = "titolo";
  const testata = el("header", { className: "testata" }, copertina, el("div", {}, titolo, el("p", { textContent: descrizione(gioco) })));

  const scelta = el("select", {}, ...prodotto.edizioni.map((e) => el("option", { value: e.id, textContent: e.nome, selected: e.id === edizione })));
  scelta.dataset.fuoco = "edizione";
  scelta.addEventListener("change", () => mostraScheda(gioco, prodotto, scelta.value, letto, indietro, "edizione"));
  const edizioni = el("label", { className: "edizione", textContent: "Edizione " }, scelta);

  const azioni = el("div", { className: "azioni" });
  const prezzo = el("section", { className: "prezzo" });
  if (migliore) {
    const da = [`da ${migliore.negozio}`, migliore.regione && `regione ${migliore.regione}`, migliore.coupon && `con il coupon ${migliore.coupon}`].filter(Boolean).join(", ");
    azioni.append(bottone("pieno", "Apri l'offerta", () => apriNelBrowser(linkOfferta(migliore))));
    prezzo.append(
      el("p", { className: "cifra", textContent: euro(migliore.centesimi) }),
      el("p", { className: "da", textContent: da }),
      el("p", { className: "stato-chiave" }, etichettaAttivazione(statoOfferta(migliore, contesto.paese), migliore)),
      confronto(migliore, ufficiale),
    );
  } else {
    const dellEdizione = chiavi(prodotto, edizione);
    // Senza i siti evitati ci sarebbe una chiave utilizzabile? Allora il motivo sono quelli.
    // «Potresti usare», non «si attivano»: tra quelle può essercene una dalla regione non chiara.
    const perISitiEvitati = dellEdizione.some((o) => statoOfferta(o, contesto.paese) !== "no");
    const motivo = !dellEdizione.length
      ? "Nessuna chiave in vendita per questa edizione."
      : perISitiEvitati
        ? `Le chiavi che potresti usare ${nelPaese(contesto.paese)} sono solo di siti che eviti.`
        : `Nessuna chiave di questa edizione si attiva ${nelPaese(contesto.paese)}.`;
    prezzo.append(el("p", { className: "nota", textContent: `${motivo} Guarda gli altri prezzi qui sotto.` }), confronto(migliore, ufficiale));
  }
  prezzo.append(azioni);

  // L'utente può aver cambiato vista mentre una domanda era aperta: la scheda si ridisegna, e
  // il messaggio di stato si tocca, solo se si sta ancora guardando questo gioco in questa edizione.
  const questa = `${gioco.pagina}#${edizione}`;
  schedaAperta = questa;
  const ancoraQui = () => document.body.dataset.vista === "scheda" && schedaAperta === questa;

  // Evitare un sito: lo ricorda l'app, tra le impostazioni della skill. La scheda si
  // ricalcola sui prezzi già letti (e con loro le voci di questa pagina già in lista), il
  // resto della lista si riallinea.
  const evita = async (negozio) => {
    try {
      // Si riparte dall'elenco com'è adesso nell'app, non dalla copia letta all'apertura.
      usaImpostazioni(await personal.settings.get());
      if (!evitato({ negozio }, contesto.evitati)) {
        usaImpostazioni(await personal.settings.set("siti-evitati", [...contesto.evitati, negozio]));
      }
    } catch (errore) {
      throw new Error(`Non sono riuscito a evitare ${negozio}: ${errore.message}`);
    }
    if (ancoraQui()) mostraScheda(gioco, prodotto, edizione, letto, indietro, "lista");
    await aggiornatore.registra(gioco.pagina, prodotto);
    allineaLista();
  };

  /** La domanda di un avviso, con i suoi bottoni. L'ultimo è sempre quello che non cambia nulla. */
  const chiedi = (conferma) =>
    chiediConferma(conferma.testo, conferma.tipo === "nessuna-chiave"
      ? [["Aggiungi lo stesso", "aggiungi", "pieno"], ["Annulla", null, "quieto"]]
      : [[`Evita ${conferma.negozio}`, "evita", "pieno"], ["Tienilo", "tieni", "contorno"], ["Annulla", null, "quieto"]]);

  // Aggiungere alla lista: prima gli avvisi sulla regione (avvisi.js), poi il documento, che
  // porta i prezzi appena letti e vale per chi compra in quel momento.
  const aggiungi = async () => {
    const { aggiungere, nota } = await percorsoAggiunta(prodotto, edizione, { contesto: () => contesto, chiedi, evita });
    if (!aggiungere) return;
    const documento = documentoDesiderio(gioco, prodotto, edizione, letto, contesto);
    await desideri.put(documento.id, documento.dati);
    if (ancoraQui()) avvisa(nota ?? "");
  };

  const idVoce = documentoDesiderio(gioco, prodotto, edizione, letto, contesto).id;
  const perLaLista = bottone("contorno", "", async () => {
    // Un secondo tocco mentre il primo è in corso non deve rifare la stessa cosa.
    perLaLista.disabled = true;
    try {
      if (inLista(idVoce)) await desideri.delete(idVoce);
      else await aggiungi();
    } catch (errore) {
      // «Evita» che non riesce ha già il suo messaggio; il resto sono scritture della lista.
      avvisa(errore.message.startsWith("Non sono riuscito a evitare") ? errore.message : `La lista non è stata salvata: ${errore.message}`, true);
    } finally {
      perLaLista.disabled = false;
    }
  }, { fuoco: "lista" });
  const aggiornaBottone = () => (perLaLista.textContent = inLista(idVoce) ? "Togli dalla lista" : "Aggiungi alla lista");
  aggiornaBottone();
  azioni.append(perLaLista);

  const elenco = el("ul", { className: "prezzi", id: "altri-prezzi", hidden: Boolean(migliore) }, ...tutte.map(rigaPrezzo));
  const etichettaElenco = () => (elenco.hidden ? `Mostra gli altri prezzi (${tutte.length})` : "Nascondi gli altri prezzi");
  const mostra = bottone("quieto", etichettaElenco(), () => {
    elenco.hidden = !elenco.hidden;
    mostra.setAttribute("aria-expanded", String(!elenco.hidden));
    mostra.textContent = etichettaElenco();
  });
  mostra.setAttribute("aria-controls", elenco.id);
  mostra.setAttribute("aria-expanded", String(!elenco.hidden));

  const fotografia = el("p", { className: "nota" },
    `Prezzi letti alle ${oraBreve(letto)}. Sono una fotografia di quel momento: prima di comprare controlla sul sito. `,
    bottone("quieto", "Apri la pagina su Allkeyshop", () => apriNelBrowser(gioco.pagina)));

  cambiaVista("scheda", aggiornaBottone);
  vista.replaceChildren(el("article", { className: "scheda" }, torna, testata, prodotto.edizioni.length > 1 ? edizioni : "", prezzo, mostra, elenco, fotografia));
  conFuoco(fuoco)?.focus();
}

function apriScheda(gioco, indietro, edizioneVoluta = null) {
  return chiedi(`Leggo i prezzi di «${gioco.titolo}»…`, async (attuale) => {
    const html = await pagina(gioco.pagina, { priorita: true, utile: attuale });
    if (html === undefined) return;
    const prodotto = leggiProdotto(html);
    // Se il gioco è già in lista, i prezzi appena letti aggiornano anche la lista.
    aggiornatore.registra(gioco.pagina, prodotto).then(() => ridisegna());
    if (!attuale()) return;
    const edizione = prodotto.edizioni.some((e) => e.id === edizioneVoluta) ? edizioneVoluta : edizionePredefinita(prodotto);
    if (!edizione) throw new Error(`Al momento «${gioco.titolo}» non ha offerte.`);
    mostraScheda(gioco, prodotto, edizione, new Date(), indietro);
    avvisa(edizioneVoluta && edizione !== edizioneVoluta ? "L'edizione che avevi in lista non ha offerte in questo momento: ecco un'altra edizione." : "");
  });
}

// ---- La lista ---------------------------------------------------------------

/** Aggiorna i prezzi e ridisegna quando parte e quando finisce. */
function aggiorna(lavoro) {
  lavoro.then(() => ridisegna());
  ridisegna();
}

function rigaLista(voce) {
  const { data } = voce;
  const gioco = rigaGioco(
    { titolo: data.titolo, immagine: data.immagine, dettaglio: `${data.edizione.nome}, ${data.piattaforma.nome}` },
    () => apriScheda(giocoDaDocumento(data), apriLista, data.edizione.id),
    `apri:${data.pagina}:${voce.id}`,
  );

  const prezzo = el("div", { className: "prezzo-riga" });
  // I prezzi valgono per chi comprava quando sono stati calcolati: finché una voce non è
  // stata riaggiornata per questo paese e questi siti evitati (o viene dalla 1.0.0) non dice
  // nulla sull'attivazione, e avverte che è da riaggiornare.
  const perQuestoPaese = !daRileggere(data, contesto);
  if (data.migliore) {
    prezzo.append(el("b", { textContent: euro(data.migliore.centesimi) }), el("span", { textContent: data.migliore.negozio }));
    const r = risparmio(data.migliore, data.ufficiale);
    if (r && r.centesimi > 0) {
      const barra = el("div", { className: "barra" }, el("div", { className: "barra-piena" }));
      barra.firstChild.style.width = `${100 - r.percento}%`;
      prezzo.append(barra, el("span", { textContent: `${r.percento}% in meno di ${data.ufficiale.negozio}` }));
    }
  } else {
    prezzo.append(el("span", { textContent: perQuestoPaese ? "Nessuna chiave che puoi usare" : "Nessuna chiave in vendita" }));
  }

  const etichette = el("div", { className: "etichette" });
  if (!perQuestoPaese) {
    const perche = data.migliore && evitato(data.migliore, contesto.evitati) ? `Eviti ${data.migliore.negozio}: prezzo da riaggiornare` : "Prezzi da riaggiornare";
    etichette.append(el("span", { textContent: perche }));
  }
  if (perQuestoPaese && data.migliore?.attivabile) etichette.append(etichettaAttivazione(data.migliore.attivabile, data.migliore));
  if (perQuestoPaese && data.occasione && data.migliore && data.ufficiale) {
    etichette.append(
      el("em", { className: "etichetta occasione", textContent: "Conviene l'ufficiale" }),
      el("span", { textContent: testoConviene(data.migliore, data.ufficiale) }));
  }

  const errore = aggiornatore.errore(voce.id);
  const inCorso = aggiornatore.inCorso(data.pagina);
  const situazione = el("span", {
    className: errore && !inCorso ? "errore" : "",
    textContent: inCorso ? "Aggiorno…" : errore ? `Non aggiornato: ${errore}` : `Prezzi di ${quando(data.aggiornato)}`,
  });
  const piede = el("div", { className: "piede" }, situazione,
    bottone("quieto", "Aggiorna", () => aggiorna(aggiornatore.aggiornaPagina(data.pagina, { priorita: true })), {
      fuoco: `aggiorna:${voce.id}`, etichetta: `Aggiorna i prezzi di ${data.titolo}`,
    }),
    bottone("quieto", "Togli", () => togli(voce.id), { fuoco: `togli:${voce.id}`, etichetta: `Togli ${data.titolo} dalla lista` }));
  return el("li", { className: "voce" }, gioco, prezzo, etichette.childNodes.length ? etichette : "", piede);
}

function togli(id) {
  desideri.delete(id).catch((errore) => avvisa(`La lista non è stata salvata: ${errore.message}`, true));
}

// Il filtro in cima alla lista: solo i giochi che conviene comprare dal negozio ufficiale.
let soloOccasioni = false;

function disegnaLista() {
  if (!lista.length) {
    vista.replaceChildren(el("p", { className: "nota", textContent: "La lista è vuota. Cerca un gioco qui sopra e aggiungilo: vedrai dove costa meno." }));
    return;
  }
  const mostrate = soloOccasioni ? lista.filter((voce) => voce.data?.occasione && !daRileggere(voce.data, contesto)) : lista;
  const righe = mostrate.map((voce) => {
    try {
      return rigaLista(voce);
    } catch {
      // Un documento di forma inattesa (scritto da una versione diversa) non deve nascondere gli altri.
      return el("li", { className: "voce" }, el("span", { textContent: "Una voce della lista non è leggibile." }),
        bottone("quieto", "Togli", () => togli(voce.id), { fuoco: `togli:${voce.id}` }));
    }
  });
  const totale = lista.reduce((somma, v) => somma + (v.data?.migliore?.centesimi ?? 0), 0);
  const occupato = aggiornatore.occupato();
  const tutto = bottone("quieto", "Aggiorna tutto", () => aggiorna(aggiornatore.aggiornaTutte()), { fuoco: "tutto" });
  tutto.disabled = occupato;
  vista.replaceChildren(
    el("header", { className: "intestazione" },
      el("div", {},
        el("h1", { textContent: "La tua lista" }),
        el("p", { textContent: `${lista.length === 1 ? "1 gioco" : `${lista.length} giochi`}, ${euro(totale)} ai prezzi migliori` }),
        occupato ? el("p", { className: "nota", textContent: "Aggiorno i prezzi, una pagina ogni 5 secondi…" }) : ""),
      tutto),
    filtroOccasioni(),
    righe.length
      ? el("ul", { className: "giochi" }, ...righe)
      : el("p", { className: "nota", textContent: "In questo momento nessun gioco della lista conviene comprarlo dal negozio ufficiale." }),
  );
}

function filtroOccasioni() {
  const casella = el("input", { type: "checkbox", checked: soloOccasioni });
  casella.dataset.fuoco = "filtro";
  casella.addEventListener("change", () => {
    soloOccasioni = casella.checked;
    ridisegna();
  });
  return el("label", { className: "filtro" }, casella, "Solo quelle che convengono");
}

/** Va alla lista (navigazione): da qui in poi le risposte di ricerche e schede non servono più. */
function apriLista() {
  richiesta++;
  cambiaVista("lista", () => conIlFuoco(disegnaLista));
  avvisa("");
  disegnaLista();
}

// A ogni cambiamento della lista (anche da un altro dispositivo) si rilegge e si ridisegna.
let letture = 0;
desideri.onChange(async () => {
  const questa = ++letture;
  try {
    const nuova = await desideri.list();
    if (questa !== letture) return;
    lista = nuova;
    ridisegna();
  } catch {
    // La lista a schermo resta quella di prima: il prossimo cambiamento la rilegge.
  }
});

$("cerca").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const testo = $("testo").value.trim();
  if (testo) cerca(testo);
});

disegnaFiltri();
apriLista();
// Si riaggiornano da soli i prezzi più vecchi di 12 ore e quelli che non valgono più per
// chi compra (un altro paese, altri siti evitati, voci della 1.0.0). La coda fa passare
// 5 secondi dall'apertura prima della prima richiesta.
allineaLista();
