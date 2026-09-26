'use strict';
/* The installable app and notifications (plan phase 18). The service worker (/sw.js, build/pwa/sw.js) keeps the page
   and the map data for a start without a connection and shows the server's web push notifications (deploy/api/push.js):
   a war on my Focus state or its fall while I'm away, the end of a Focus game, a league match found.
   Stable hooks for the look (Codex C7): #installBtn (.command-install), #accPush (profile → notifications). */
RA.appSW = null;
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('/sw.js').then((r) => {
    RA.appSW = r;
    // a new build on the server = a new service worker: tell the player (the start screen just reloads)
    r.addEventListener('updatefound', () => {
      if (!navigator.serviceWorker.controller) return; // the first install, not an update
      const w = r.installing;
      if (w) w.addEventListener('statechange', () => w.state === 'activated' && RA.appUpdated());
    });
    setInterval(() => r.update().catch(() => {}), 15 * 60e3); // an app left open for hours still hears of it
  }, (e) => console.warn('sw', e && e.message));
}
RA.appUpdated = () => {
  const app = window.__ra, start = document.getElementById('startScreen');
  const idle = start && !start.hidden && document.getElementById('sheetWrap').hidden && !(app && app.ui && app.ui.editor);
  if (idle) return location.reload();
  if (app && app.ui) app.ui.toast('info', 'Nova verzija igre je spremna — osvježi stranicu kad završiš partiju (online igrači moraju imati istu verziju).', { ms: 20000 });
};
RA.appInstalled = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

Object.assign(RA.UI.prototype, {
  /* "Instaliraj aplikaciju" on the start screen, while the browser offers it */
  installInit() {
    const b = this.$('installBtn');
    if (!b) return;
    const show = () => (b.hidden = !window.__raInstall || RA.appInstalled());
    addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      window.__raInstall = e;
      show();
    });
    addEventListener('appinstalled', () => {
      window.__raInstall = null;
      show();
      this.toast('good', 'Overtake je instaliran — pokreni ga kao aplikaciju.', { ms: 6000 });
    });
    b.onclick = () => {
      const e = window.__raInstall;
      if (!e) return;
      e.prompt();
      (e.userChoice || Promise.resolve({})).then((c) => {
        if (c.outcome === 'accepted') window.__raInstall = null;
        show();
      });
    };
    show();
  },
  /* profile → notifications on/off (this device); needs an account and a browser with web push */
  async pushButton(b) {
    if (!b) return;
    const A = this.account;
    const d = b.querySelector('.d');
    const ok = 'PushManager' in window && 'Notification' in window && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol);
    if (!ok || !A || !A.user) {
      d.textContent = 'Ovaj preglednik ne podržava obavještenja' + (navigator.userAgent.includes('iPhone') ? ' (na iPhoneu: prvo „Dodaj na početni ekran“).' : '.');
      b.disabled = true;
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    const draw = () => (d.textContent = sub ? 'Uključena na ovom uređaju — napad na tvoju Focus državu, kraj igre, meč u ligi' : Notification.permission === 'denied' ? 'Blokirana u pregledniku (dozvoli ih u postavkama stranice)' : 'Isključena — dodirni da uključiš');
    draw();
    b.onclick = async () => {
      try {
        if (sub) {
          await A.api('POST', '/api/push/unsub', { endpoint: sub.endpoint }).catch(() => {});
          await sub.unsubscribe();
          sub = null;
        } else {
          if ((await Notification.requestPermission()) !== 'granted') return draw();
          const { key } = await A.api('GET', '/api/push/key');
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: RA.b64key(key) });
          await A.api('POST', '/api/push/sub', { sub: sub.toJSON() });
          this.toast('good', 'Obavještenja su uključena.');
        }
      } catch (e) {
        this.toast('bad', 'Obavještenja: ' + RA.esc(e.message || String(e)), { ms: 6000 });
      }
      draw();
    };
  },
});
RA.b64key = (s) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
