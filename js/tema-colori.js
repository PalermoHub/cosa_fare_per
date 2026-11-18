// Tema personalizzato: da quattro colori scelti dall'utente ai ~25 «ruoli» di css/pinuzza.css.
//
// Funzioni pure, senza DOM: le usa js/tema.js nel browser e tests/test_tema_colori.mjs in Node.
// Il punto non è lasciare libertà assoluta, è lasciarla senza poter rompere l'app: qualunque
// colore scelga l'utente, ogni coppia testo/sfondo che l'interfaccia usa resta ≥ 4,5:1 (WCAG AA).
// Per riuscirci:
//  - lo sfondo non può stare nella fascia media di luminosità, dove né il nero né il bianco
//    garantiscono una buona lettura: viene spostato al bordo più vicino;
//  - testo, accento e «caldo» si avvicinano al bianco o al nero (secondo lo sfondo) finché
//    superano la soglia su tutte le superfici su cui compaiono.

export const SOGLIA_TESTO = 4.5;
export const SOGLIA_CORPO = 7;

const limita = (n, a = 0, b = 255) => Math.min(b, Math.max(a, n));
const hex2 = n => Math.round(limita(n)).toString(16).padStart(2, '0');

export const valido = colore => /^#[0-9a-f]{6}$/i.test(colore ?? '');

export function rgb(colore) {
  const n = parseInt(colore.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const daRgb = ([r, g, b]) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

const canale = c => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

export function luminanza(colore) {
  const [r, g, b] = rgb(colore);
  return 0.2126 * canale(r) + 0.7152 * canale(g) + 0.0722 * canale(b);
}

export function contrasto(a, b) {
  const [chiaro, scuro] = [luminanza(a), luminanza(b)].sort((x, y) => y - x);
  return (chiaro + 0.05) / (scuro + 0.05);
}

/** Mescola `a` con `b`: quota = 0 → a, 1 → b. */
export function mescola(a, b, quota) {
  const [ra, rb] = [rgb(a), rgb(b)];
  return daRgb(ra.map((v, i) => v + (rb[i] - v) * quota));
}

const BIANCO = '#ffffff';
const NERO = '#000000';

// Sotto questa luminanza lo sfondo è «scuro» (il bianco dà ≥ 7:1), sopra quest'altra
// è «chiaro» (il nero dà ≥ 7:1). In mezzo nessuno dei due estremi legge bene.
const L_SCURO_MAX = 1.05 / 7 - 0.05;   // ≈ 0,100
const L_CHIARO_MIN = 7 * 0.05 - 0.05;  // = 0,300

/** Porta lo sfondo fuori dalla fascia media. Restituisce il colore e se è stato cambiato. */
export function normalizzaSfondo(sfondo) {
  const l = luminanza(sfondo);
  if (l <= L_SCURO_MAX || l >= L_CHIARO_MIN) return { colore: sfondo, corretto: false };
  const verso = l - L_SCURO_MAX < L_CHIARO_MIN - l ? NERO : BIANCO;
  for (let t = 0.02; t <= 1.0001; t += 0.02) {
    const prova = mescola(sfondo, verso, t);
    const lp = luminanza(prova);
    if (lp <= L_SCURO_MAX || lp >= L_CHIARO_MIN) return { colore: prova, corretto: true };
  }
  return { colore: verso, corretto: true };
}

/**
 * Una tinta di `colore` sullo sfondo, riducendo la quota finché la luminanza resta fuori
 * dalla fascia media: sopra una tinta troppo carica nemmeno il nero o il bianco leggono bene.
 */
function tinta(carta, colore, quota) {
  for (let q = quota; q > 0.005; q -= 0.01) {
    const prova = mescola(carta, colore, q);
    const l = luminanza(prova);
    if (l <= L_SCURO_MAX || l >= L_CHIARO_MIN) return prova;
  }
  return carta;
}

export const eScuro = sfondo => luminanza(sfondo) < 0.18;

const minimo = (colore, sfondi) => Math.min(...sfondi.map(s => contrasto(colore, s)));

/** Avvicina `colore` al bianco o al nero finché supera `soglia` su tutti gli `sfondi`. */
export function garantisci(colore, sfondi, soglia, scuro) {
  if (minimo(colore, sfondi) >= soglia) return colore;
  const verso = scuro ? BIANCO : NERO;
  for (let t = 0.02; t <= 1.0001; t += 0.02) {
    const prova = mescola(colore, verso, t);
    if (minimo(prova, sfondi) >= soglia) return prova;
  }
  return verso;
}

/** Il testo da mettere sopra `fondo`: nero o bianco, quello che legge meglio (sempre ≥ 4,58:1). */
const suFondo = fondo => (contrasto(BIANCO, fondo) >= contrasto(NERO, fondo) ? BIANCO : NERO);

/**
 * Da quattro colori scelti a tutte le variabili del tema.
 * @param {{sfondo:string, testo:string, accento:string, caldo:string}} scelte
 * @returns {{vars: Record<string,string>, corretti: string[]}} `corretti` elenca quali colori
 *   sono stati ritoccati per tenere la leggibilità (per dirlo all'utente).
 */
export function derivaTema(scelte) {
  const corretti = [];
  const normale = (nome, valore) => (valido(valore) ? valore.toLowerCase() : null);
  const [s0, t0, a0, c0] = ['sfondo', 'testo', 'accento', 'caldo'].map(n => normale(n, scelte[n]));
  if (!s0 || !t0 || !a0 || !c0) throw new Error('servono quattro colori esadecimali a sei cifre');

  const sf = normalizzaSfondo(s0);
  if (sf.corretto) corretti.push('sfondo');
  const carta = sf.colore;
  const scuro = eScuro(carta);

  // superfici: il verso del rilievo cambia col tema, come nei due temi fatti a mano
  const cartaAlt = mescola(carta, scuro ? BIANCO : NERO, scuro ? 0.05 : 0.045);
  const superficie = scuro ? mescola(carta, BIANCO, 0.09) : mescola(carta, BIANCO, 0.7);
  const accentoChiaro = tinta(carta, a0, scuro ? 0.22 : 0.12);
  const caldoChiaro = tinta(carta, c0, scuro ? 0.22 : 0.12);
  const superfici = [carta, cartaAlt, superficie];

  const inchiostro = garantisci(t0, superfici, SOGLIA_CORPO, scuro);
  if (inchiostro !== t0) corretti.push('testo');
  const tenue = garantisci(mescola(inchiostro, carta, 0.22), [...superfici], SOGLIA_TESTO + 0.3, scuro);
  const fio = garantisci(mescola(inchiostro, carta, 0.38), [...superfici], SOGLIA_TESTO + 0.1, scuro);

  const accento = garantisci(a0, [...superfici, accentoChiaro], SOGLIA_TESTO, scuro);
  if (accento !== a0) corretti.push('accento');
  const caldo = garantisci(c0, [...superfici, caldoChiaro], SOGLIA_TESTO, scuro);
  if (caldo !== c0) corretti.push('evidenza');

  // pulsanti: il colore scelto resta com'è, cambia il testo sopra (nero o bianco)
  const suAccento = suFondo(a0);
  const suCaldo = suFondo(c0);
  const passoHover = suAccento === BIANCO ? NERO : BIANCO;
  const accentoFondoHover = mescola(a0, passoHover, 0.18);

  const avvisoTesto = garantisci(mescola(c0, inchiostro, 0.7), [caldoChiaro], SOGLIA_CORPO, scuro);
  const avvisoTenue = garantisci(mescola(c0, inchiostro, 0.45), [caldoChiaro], SOGLIA_TESTO + 0.2, scuro);

  const [ir, ig, ib] = rgb(scuro ? NERO : inchiostro);
  const tintaOmbra = `${ir}, ${ig}, ${ib}`;

  const vars = {
    '--carta': carta,
    '--carta-alt': cartaAlt,
    '--superficie': superficie,
    '--inchiostro': inchiostro,
    '--inchiostro-tenue': tenue,
    '--inchiostro-fio': fio,
    '--linea': mescola(carta, inchiostro, 0.14),
    '--linea-forte': mescola(carta, inchiostro, 0.28),
    '--accento': accento,
    '--accento-chiaro': accentoChiaro,
    '--accento-fondo': a0,
    '--accento-fondo-hover': accentoFondoHover,
    '--su-accento': suAccento,
    '--caldo': caldo,
    '--caldo-chiaro': caldoChiaro,
    '--caldo-fondo': c0,
    '--su-caldo': suCaldo,
    '--avviso-testo': avvisoTesto,
    '--avviso-tenue': avvisoTenue,
    '--tinta-ombra': tintaOmbra,
    '--schema': scuro ? 'dark' : 'light',
  };
  return { vars, corretti };
}

/** Le coppie testo/sfondo che l'interfaccia usa davvero (le stesse di tests/test_contrasto.mjs). */
export const COPPIE = [
  ['inchiostro', 'carta'], ['inchiostro', 'carta-alt'], ['inchiostro', 'superficie'],
  ['inchiostro-tenue', 'carta'], ['inchiostro-tenue', 'carta-alt'], ['inchiostro-tenue', 'superficie'],
  ['inchiostro-fio', 'carta'], ['inchiostro-fio', 'carta-alt'], ['inchiostro-fio', 'superficie'],
  ['accento', 'carta'], ['accento', 'carta-alt'], ['accento', 'superficie'], ['accento', 'accento-chiaro'],
  ['su-accento', 'accento-fondo'], ['su-accento', 'accento-fondo-hover'],
  ['su-caldo', 'caldo-fondo'],
  ['avviso-tenue', 'caldo-chiaro'], ['avviso-testo', 'caldo-chiaro'],
  ['caldo', 'carta'], ['caldo', 'superficie'],
  ['carta', 'inchiostro'],
];

/** Il rapporto peggiore tra le coppie di un tema: serve alla riga di stato del pannello. */
export function peggiorContrasto(vars) {
  return Math.min(...COPPIE.map(([a, b]) => contrasto(vars[`--${a}`], vars[`--${b}`])));
}
