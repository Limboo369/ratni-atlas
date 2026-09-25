'use strict';
/* Overtake account: Google sign-in through the accounts API (deploy/api, /api/ on our own server).
   Only on our server: on file:// or a host without /api/me the account button stays hidden and nothing else changes.
   Google Identity Services is loaded only when the player opens the account sheet. */
RA.Account = class {
  constructor(ui) {
    this.ui = ui;
    this.user = null;
    this.google = '';
    this.ok = false; // an accounts server answered
    this.gsiInit = false;
    const b = ui.$('accountBtn');
    b.innerHTML = RA.icon('user');
    b.onclick = () => this.sheet();
    if (/^https?:$/.test(location.protocol)) this.load();
  }

  async api(method, path, body) {
    const r = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    let j = null;
    try {
      j = await r.json();
    } catch (_) {}
    if (!r.ok || !j) throw new Error((j && j.e) || 'Server za naloge ne odgovara.');
    return j;
  }

  async load() {
    try {
      const j = await this.api('GET', '/api/me');
      this.ok = true;
      this.google = j.google || '';
      this.set(j.user);
    } catch (_) {
      // no accounts server here (local tests, older deploy): the game works as before
    }
  }

  set(u) {
    const ui = this.ui;
    this.user = u || null;
    const b = ui.$('accountBtn');
    b.hidden = !this.ok;
    b.classList.toggle('on', !!u);
    const label = u ? `Nalog: ${u.name}` : 'Prijava';
    b.setAttribute('aria-label', label);
    b.title = label;
    // the account name fills the name field, unless the player already typed one
    if (u && !ui.settings.name) {
      ui.settings.name = u.name;
      ui.$('nameIn').value = u.name;
      ui._save();
    }
    if (this.open()) this.sheet(true);
  }

  open() {
    return !this.ui.$('sheetWrap').hidden && !!this.ui.$('sheet').querySelector('#accSheet');
  }

  /* Google Identity Services, loaded once */
  gsi() {
    if (window.google && google.accounts && google.accounts.id) return Promise.resolve();
    if (!this.gsiLoading) {
      this.gsiLoading = new Promise((ok, fail) => {
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.onload = ok;
        s.onerror = () => {
          this.gsiLoading = null;
          fail(new Error('Ne mogu učitati Google prijavu. Provjeri internet vezu.'));
        };
        document.head.appendChild(s);
      });
    }
    return this.gsiLoading;
  }

  async googleButton(slot, note) {
    if (!this.google) {
      note.textContent = 'Google prijava još nije podešena na serveru.';
      return;
    }
    note.textContent = 'Učitavam Google prijavu…';
    try {
      await this.gsi();
    } catch (e) {
      note.textContent = e.message;
      return;
    }
    if (!slot.isConnected) return;
    if (!this.gsiInit) {
      google.accounts.id.initialize({
        client_id: this.google,
        callback: (r) => this.login(r.credential),
        ux_mode: 'popup',
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      this.gsiInit = true;
    }
    note.textContent = '';
    google.accounts.id.renderButton(slot, {
      type: 'standard',
      theme: 'filled_black',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      locale: 'bs',
      width: Math.max(220, Math.min(320, slot.clientWidth || 300)),
    });
  }

  async login(credential) {
    const ui = this.ui;
    try {
      const j = await this.api('POST', '/api/login', { credential });
      this.set(j.user);
      ui.toast('good', `Prijavljen si kao ${RA.esc(j.user.name)}.`);
    } catch (e) {
      ui.toast('info', RA.esc(e.message));
    }
  }

  async logout() {
    try {
      await this.api('POST', '/api/logout', {});
    } catch (_) {}
    if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
    this.set(null);
    this.ui.toast('info', 'Odjavljen si.');
  }

  sheet(keep) {
    const ui = this.ui, u = this.user;
    let h = '<div id="accSheet"></div>' + ui.head('Nalog', u ? RA.esc(u.email) : 'Prijava preko Google-a');
    if (!u) {
      h += `<p class="explain">Prijavi se Google nalogom: tvoje igre, statistike i dostignuća čuvaju se na nalogu, pa nastavljaš s bilo kojeg uređaja. Igra radi i bez prijave.</p>
        <div class="gsi-slot" id="gsiSlot"></div><p class="note" id="accNote" aria-live="polite"></p>
        <p class="note">Od Google-a uzimamo samo ime, e-mail i sliku profila. Nalog možeš obrisati kad god hoćeš.</p>`;
    } else {
      h += `<div class="field acc-name"><label class="lab" for="accName">Ime u igri</label>
          <div class="acc-row"><input type="text" id="accName" maxlength="18" value="${RA.esc(u.name)}" autocomplete="nickname" spellcheck="false"><button class="btn good" id="accSave"><span class="t">Sačuvaj</span></button></div></div>
        <p class="note" id="accNote" aria-live="polite"></p>
        <div class="btns" style="margin-top:14px">
          <button class="btn" id="accOut"><span class="t">Odjavi se</span></button>
          <button class="btn danger" id="accDel"><span><span class="t">Obriši nalog</span><br><span class="d">Briše nalog i sve sačuvano na njemu</span></span></button>
        </div>`;
    }
    ui.openSheet(h, (s) => {
      const note = s.querySelector('#accNote');
      if (!u) {
        this.googleButton(s.querySelector('#gsiSlot'), note);
        return;
      }
      const inp = s.querySelector('#accName');
      const save = async () => {
        try {
          const j = await this.api('POST', '/api/name', { name: inp.value });
          ui.settings.name = j.user.name;
          ui.$('nameIn').value = j.user.name;
          ui._save();
          this.set(j.user);
          ui.toast('good', 'Ime sačuvano.');
        } catch (e) {
          note.textContent = e.message;
        }
      };
      s.querySelector('#accSave').onclick = save;
      inp.onkeydown = (e) => {
        e.stopPropagation(); // game hotkeys must not fire while typing
        if (e.key === 'Enter') save();
      };
      s.querySelector('#accOut').onclick = () => this.logout();
      s.querySelector('#accDel').onclick = () => ui.confirm('Obrisati nalog?', 'Brišu se nalog, statistike, dostignuća i sačuvane igre. Ne može se vratiti.', 'Obriši', async () => {
        try {
          await this.api('POST', '/api/delete', {});
          this.set(null);
          ui.toast('info', 'Nalog je obrisan.');
        } catch (e) {
          ui.toast('info', RA.esc(e.message));
        }
      });
    }, keep);
  }
};
