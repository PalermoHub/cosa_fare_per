// Consenso cookie/statistiche (GDPR + linee guida del Garante italiano).
// Google Analytics NON viene caricato all'avvio: parte solo dopo un consenso esplicito.
// La scelta sta in localStorage (nessun cookie), quindi si può revocare in ogni momento.

const ID_ANALYTICS = 'G-KHR1GHDRQS';
const CHIAVE = 'pinuzza-consenso'; // 'accettato' | 'rifiutato'
const GIORNI_COOKIE_GA = 13 * 30; // 13 mesi

let finestraPreferenze = null;

export function leggiScelta() {
  try {
    return localStorage.getItem(CHIAVE);
  } catch {
    return null;
  }
}

function salvaScelta(valore) {
  try {
    localStorage.setItem(CHIAVE, valore);
  } catch {
    /* modalità privata: la scelta vale solo per questa visita */
  }
}

export function caricaAnalytics() {
  if (document.querySelector('script[data-analytics]')) return;
  const script = document.createElement('script');
  script.async = true;
  script.dataset.analytics = '1';
  script.src = `https://www.googletagmanager.com/gtag/js?id=${ID_ANALYTICS}`;
  document.head.append(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', ID_ANALYTICS, {
    anonymize_ip: true,
    cookie_expires: GIORNI_COOKIE_GA * 24 * 60 * 60,
    cookie_flags: 'SameSite=Lax;Secure',
  });
}

function eliminaCookieAnalytics() {
  for (const pezzo of document.cookie.split(';')) {
    const nome = pezzo.split('=')[0].trim();
    if (nome === '_ga' || nome.startsWith('_ga_') || nome.startsWith('_gid')) {
      for (const dominio of [location.hostname, `.${location.hostname}`]) {
        document.cookie = `${nome}=; Max-Age=0; path=/; domain=${dominio}`;
      }
      document.cookie = `${nome}=; Max-Age=0; path=/`;
    }
  }
}

// ---------- interfaccia: avviso in fondo alla pagina ----------

function testo(contenuto) {
  const p = document.createElement('p');
  p.className = 'consenso-testo';
  p.append(...contenuto);
  return p;
}

function link(titolo, href) {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = titolo;
  return a;
}

export function mostraPreferenze({ subito = false } = {}) {
  if (finestraPreferenze) return finestraPreferenze;

  const riquadro = document.createElement('section');
  riquadro.className = 'consenso';
  riquadro.setAttribute('role', 'dialog');
  riquadro.setAttribute('aria-modal', 'false');
  riquadro.setAttribute('aria-labelledby', 'consenso-titolo');
  riquadro.setAttribute('aria-describedby', 'consenso-descrizione');

  const titolo = document.createElement('h2');
  titolo.id = 'consenso-titolo';
  titolo.className = 'consenso-titolo';
  titolo.textContent = 'Statistiche di uso: decidi tu';

  const descrizione = testo([
    'Chiedilo a Pinuzza funziona senza cookie. Se accetti, uso ',
    link('Google Analytics', 'https://policies.google.com/privacy'),
    ' in forma anonima (IP abbreviato) per capire quali domande servono e quali no. ',
    'Nessun dato della tua domanda viene inviato. Puoi cambiare idea quando vuoi: ',
    link('informativa privacy', 'privacy.html'),
    '.',
  ]);
  descrizione.id = 'consenso-descrizione';

  const azioni = document.createElement('div');
  azioni.className = 'consenso-azioni';

  const accetta = document.createElement('button');
  accetta.type = 'button';
  accetta.className = 'consenso-accetta';
  accetta.textContent = 'Accetto le statistiche';

  const rifiuta = document.createElement('button');
  rifiuta.type = 'button';
  rifiuta.className = 'consenso-rifiuta';
  rifiuta.textContent = 'Solo necessario';

  const chiudi = () => {
    riquadro.remove();
    finestraPreferenze = null;
  };

  accetta.addEventListener('click', () => {
    salvaScelta('accettato');
    caricaAnalytics();
    chiudi();
  });

  rifiuta.addEventListener('click', () => {
    salvaScelta('rifiutato');
    eliminaCookieAnalytics();
    chiudi();
  });

  azioni.append(accetta, rifiuta);
  riquadro.append(titolo, descrizione, azioni);
  document.body.append(riquadro);
  finestraPreferenze = riquadro;

  if (subito) accetta.focus();
  return riquadro;
}

export function avviaConsenso() {
  // altezza del piede: ci si appoggiano il banner del consenso e il pulsante «torna in cima»
  const piede = document.querySelector('.piede');
  if (piede) {
    const misura = () => document.documentElement.style.setProperty('--piede-h', `${piede.offsetHeight}px`);
    misura();
    if ('ResizeObserver' in window) new ResizeObserver(misura).observe(piede);
    else window.addEventListener('resize', misura);
  }

  const scelta = leggiScelta();
  if (scelta === 'accettato') caricaAnalytics();
  else if (scelta !== 'rifiutato') mostraPreferenze();

  // il collegamento «Preferenze cookie» nel piede riapre l'avviso
  for (const bottone of document.querySelectorAll('[data-preferenze-cookie]')) {
    bottone.addEventListener('click', evento => {
      evento.preventDefault();
      mostraPreferenze({ subito: true });
    });
  }
}

// la pagina carica questo file come modulo: l'avviso parte da solo
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avviaConsenso);
else avviaConsenso();
