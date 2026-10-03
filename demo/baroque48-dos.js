/* =====================================================================
 *  BAROQUE-DOS  —  a parancssor es a lemez masolata JavaScriptben
 *    (baroque48_parancssor.ino · lemez.ino · ora.ino)
 *
 *  ⭐ A KEPERNYOT utanozzuk, nem a soros vonalat. A valodi gep a
 *    `Serial.printf("[DISK] ...")` sorokat CSAK a huzalra kuldi — azok
 *    nincsenek a 64x22-es kepernyon, tehat itt sincsenek.
 *    ⚠ A kapu ezert kizarja a `[...]` sorokat, es ki is mondja, hogy kizarta.
 *
 *  ⭐⭐ A SZABAD HELY MODELLJE
 *    A gepen FAT van, furtokkel. Mert ertekek:
 *        ures allapot ............... 10 203 136
 *        + egy konyvtar (`MD`) ...... 10 199 040   (-4096)
 *        + egy 170 bajtos fajl ...... 10 199 040   (-4096)
 *    ⭐ Tehat minden bejegyzes legalabb EGY 4096 bajtos furtot foglal. A demo
 *      a MERT kezdoertekbol indul, es furtonkent szamol — igy minden mert
 *      szam visszajon.
 * ===================================================================== */
(function () {
  'use strict';
  var gyoker = (typeof module !== 'undefined' && module.exports)
    ? require('./baroque48-basic.js') : window;
  var B = gyoker.Baroque48;
  var b = B.belso;
  var csonk = b.csonk, nagy = b.nagy, jobbra = b.jobbra, balra = b.balra,
      ketjegy = b.ketjegy, betu = b.betu;
  var OSZLOPOK = B.OSZLOPOK, VERZIO = B.VERZIO, MUNKATERULET = B.MUNKATERULET;
  var szamSzoveg = B.szamSzoveg;
  var FA_MELYSEG = b.FA_MELYSEG;
  var FURT = 4096;
  var NAPOK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var FENYPOROK = ['AMBER', 'GREEN', 'PAPER'];

  function furt(m) { return Math.max(1, Math.ceil(m / FURT)) * FURT; }

  /* =====================================================================
   *  A LEMEZ MUVELETEI
   * ===================================================================== */
  B.prototype.utvonal = function (arg) {
    return this.lemez.felold(this.kvt, arg);
  };

  B.prototype.dosAlak = function (reszek) {
    return '\\' + reszek.join('\\');
  };

  /* ⭐ A DIR 8.3-as mezoi. `nevSor()` a forrasban. */
  function nyolcHarom(nev) {
    var pont = nev.lastIndexOf('.');
    var alap, kit;
    if (pont > 0) { alap = nev.slice(0, pont).slice(0, 8); kit = nev.slice(pont + 1).slice(0, 3); }
    else { alap = nev.slice(0, 8); kit = ''; }
    return { alap: alap, kit: kit };
  }

  /* ⭐ A minta a KET MEZORE kulon illeszkedik: a `*.TXT` igy jelenti azt,
   *   amit az ember var. (A forrasban `mintaEgyezik` / `darabEgyezik`.) */
  function darabEgyezik(m, sz) {
    var csillag = -1, visszaSz = -1, i = 0, j = 0;
    while (j < sz.length) {
      if (i < m.length && m[i] !== '*' &&
          (m[i] === '?' || nagy(m[i]) === nagy(sz[j]))) { i++; j++; continue; }
      if (i < m.length && m[i] === '*') { csillag = i++; visszaSz = j; continue; }
      if (csillag >= 0) { i = csillag + 1; j = ++visszaSz; continue; }
      return false;
    }
    while (i < m.length && m[i] === '*') i++;
    return i === m.length;
  }

  function mintaEgyezik(minta, nev) {
    var a = nyolcHarom(minta), c = nyolcHarom(nev);
    /* ⚠ Ha a mintaban nincs pont, csak az alapnevre illesztunk — es a
     *   kiterjesztesnek uresnek kell lennie, hacsak nincs `*` a vegen. */
    if (minta.indexOf('.') < 0) return darabEgyezik(a.alap, c.alap) && !c.kit;
    return darabEgyezik(a.alap, c.alap) && darabEgyezik(a.kit, c.kit);
  }

  B.prototype.lemezBetolt = function (kep) {
    /* `kep`: { cimke, szabad, fak: { '\\UT': [ {nev,dir,meret,ido,tartalom} ] } } */
    var g = this;
    if (kep.cimke) this.lemez.cimke = kep.cimke;
    if (kep.szabad) this.lemez.szabadBajt = kep.szabad;
    (kep.tetelek || []).forEach(function (t) {
      var reszek = g.lemez.felold('\\', t.ut);
      var sz = g.lemez.keres(reszek.slice(0, -1));
      if (!sz || !sz.dir) return;
      var nev = reszek[reszek.length - 1];
      var ido = t.ido ? new Date(t.ido) : new Date(1980, 0, 1);
      if (t.dir) sz.gyerekek[nev] = { dir: true, gyerekek: {}, ido: ido };
      else {
        var tart = t.tartalom || [];
        sz.gyerekek[nev] = {
          dir: false, sorok: tart, ido: ido,
          /* ⭐ A MERT meret, nem szamitott — a `README.TXT` 170 bajtja igy jon ki. */
          meret: (t.meret !== undefined) ? t.meret : g.sorokMeret(tart)
        };
      }
    });
  };

  B.prototype.sorokMeret = function (sorok) {
    var n = 0;
    for (var i = 0; i < sorok.length; i++) n += sorok[i].length + 2;   /* CRLF */
    return n;
  };

  /* =====================================================================
   *  A PROMPT
   * ===================================================================== */
  B.prototype.datumSzoveg = function () {
    var d = this.most();
    return NAPOK[d.getDay()] + ' ' + ketjegy(d.getDate()) + '-' +
           ketjegy(d.getMonth() + 1) + '-' + d.getFullYear();
  };
  B.prototype.idoSzoveg = function () {
    var d = this.most();
    return ketjegy(d.getHours()) + ':' + ketjegy(d.getMinutes()) + ':' + ketjegy(d.getSeconds());
  };

  B.prototype.promptEpit = function () {
    var ki = '', m = this.promptMinta;
    for (var i = 0; i < m.length; i++) {
      if (m[i] !== '$') { ki += m[i]; continue; }
      i++;
      if (i >= m.length) break;
      switch (nagy(m[i])) {
        case 'P': ki += 'C:' + this.dosAlak(this.lemez.bont(this.kvt)); break;
        case 'N': ki += 'C'; break;
        case 'G': ki += '>'; break;
        case 'L': ki += '<'; break;
        case 'B': ki += '|'; break;
        case 'Q': ki += '='; break;
        case 'S': ki += ' '; break;
        case '$': ki += '$'; break;
        case 'T': ki += this.idoSzoveg(); break;
        case 'D': ki += this.datumSzoveg(); break;
        case 'V': ki += VERZIO; break;
        case '_': ki += '\n'; break;
        case 'H': ki = ki.slice(0, -1); break;
        default: break;                     /* ismeretlen kod: a DOS is elnyelte */
      }
    }
    return ki;
  };

  B.prototype.promptKiir = function () {
    var p = this.promptEpit().split('\n');
    for (var i = 0; i < p.length; i++) {
      this.kiir(p[i]);
      if (i + 1 < p.length) this.ujSor();
    }
  };

  /* ⭐ EGY helyen dol el, kell-e prompt — igy nem lehet elfelejteni. */
  B.prototype.keszenlet = function () {
    if (this.oraVar) return;              /* DATE/TIME kerdesre var */
    /* ⚠ 2026-09-27, a kapu talalta: a `-- MORE --` mogé promptot irtunk,
     *   pedig a gep ott VAR. Ket prompt egymas mellett pont az a zavar,
     *   ami miatt nem tudod, hol vagy. */
    if (this.lapozoVar) return;           /* a lapozo leutesre var */
    if (this.batchMelyseg) return;        /* batch kozben nincs prompt */
    if (this.bbFut) return;               /* a BASIC-nek sajat promptja van */
    this.promptKiir();
  };

  /* =====================================================================
   *  DIR
   * ===================================================================== */
  B.prototype.parancsDir = function (arg) {
    var nyers = String(arg || '').trim();
    var lapoz = /\/P\b/i.test(nyers);              /* ⭐ a `/P` kapcsolo */
    var argM = nyers.replace(/\s*\/P\b/i, '').trim();

    var minta = '';
    var reszek = this.utvonal(argM || '.');
    var cs = this.lemez.keres(reszek);
    if (argM && (!cs || !cs.dir)) {
      /* ⭐ Nem konyvtar: az UTOLSO komponens a MINTA, az eleje a konyvtar. */
      var v = Math.max(argM.lastIndexOf('\\'), argM.lastIndexOf('/'));
      minta = nagy(v >= 0 ? argM.slice(v + 1) : argM);
      var kvtResz = (v >= 0) ? argM.slice(0, v) : '.';
      if (!kvtResz) kvtResz = '\\';
      reszek = this.utvonal(kvtResz);
      cs = this.lemez.keres(reszek);
    }
    if (!cs || !cs.dir) { this.kiirSor('PATH NOT FOUND'); return; }

    this.lapozoKezd(lapoz);
    this.kiirSor(' VOLUME IN DRIVE C IS ' + this.lemez.cimke);
    this.kiirSor(' DIRECTORY OF C:' + this.dosAlak(reszek));
    this.ujSor();

    var fdb = 0, ddb = 0, osszes = 0, g = this;
    Object.keys(cs.gyerekek).forEach(function (nev) {
      if (minta && !mintaEgyezik(minta, nev)) return;
      var e = cs.gyerekek[nev];
      var nh = nyolcHarom(nev);
      var d = g.fajlIdo(e.ido);
      if (e.dir) {
        g.kiirSor(balra(nh.alap, 8) + ' ' + balra(nh.kit, 3) + '      <DIR>  ' + d);
        ddb++;
      } else {
        g.kiirSor(balra(nh.alap, 8) + ' ' + balra(nh.kit, 3) + ' ' +
                  jobbra(e.meret, 10) + '  ' + d);
        fdb++;
        osszes += e.meret;
      }
    });

    this.lapozoVege();
    if (!fdb && !ddb) this.kiirSor('FILE NOT FOUND');
    this.kiirSor(jobbra(fdb, 9) + ' FILE(S) ' + jobbra(osszes, 12) + ' BYTES');
    this.kiirSor(jobbra(ddb, 9) + ' DIR(S)  ' + jobbra(this.lemez.szabadBajt, 12) + ' BYTES FREE');
  };

  /* =====================================================================
   *  TREE   —  ⭐ ASCII-val rajzol, ahogy a DOS `TREE /A`-ja
   * ===================================================================== */
  B.prototype.faAg = function (cs, elotag, melyseg) {
    if (melyseg >= FA_MELYSEG) return;
    var nevek = Object.keys(cs.gyerekek).filter(function (n) { return cs.gyerekek[n].dir; });
    for (var i = 0; i < nevek.length; i++) {
      var utolso = (i === nevek.length - 1);
      this.kiirSor(elotag + (utolso ? '\\---' : '+---') + nevek[i]);
      this.faAg(cs.gyerekek[nevek[i]], elotag + (utolso ? '    ' : '|   '), melyseg + 1);
    }
  };

  B.prototype.parancsTree = function (arg) {
    var reszek = this.utvonal(String(arg || '.').trim() || '.');
    var cs = this.lemez.keres(reszek);
    if (!cs || !cs.dir) { this.kiirSor('INVALID DRIVE'); return; }
    this.kiirSor('C:' + this.dosAlak(reszek));
    this.faAg(cs, '', 0);
  };

  /* =====================================================================
   *  CD / MD / RD / DEL / TYPE / COPY / REN
   * ===================================================================== */
  B.prototype.parancsCd = function (arg) {
    arg = String(arg || '').trim();
    if (!arg) { this.kiirSor('C:' + this.dosAlak(this.lemez.bont(this.kvt))); return; }
    var reszek = this.utvonal(arg);
    var cs = this.lemez.keres(reszek);
    if (!cs || !cs.dir) { this.kiirSor('INVALID DIRECTORY'); return; }
    this.kvt = this.dosAlak(reszek);
  };

  B.prototype.parancsMd = function (arg) {
    arg = String(arg || '').trim();
    if (!arg) { this.kiirSor('SYNTAX ERROR'); return; }
    var reszek = this.utvonal(arg);
    if (!reszek.length) { this.kiirSor('DIRECTORY ALREADY EXISTS'); return; }
    if (this.lemez.keres(reszek)) { this.kiirSor('DIRECTORY ALREADY EXISTS'); return; }
    var sz = this.lemez.szulo(reszek);
    if (!sz || !sz.dir) { this.kiirSor('UNABLE TO CREATE DIRECTORY'); return; }
    sz.gyerekek[reszek[reszek.length - 1]] = { dir: true, gyerekek: {}, ido: this.most() };
    this.lemez.szabadBajt -= furt(0);
  };

  B.prototype.parancsRd = function (arg) {
    arg = String(arg || '').trim();
    if (!arg) { this.kiirSor('SYNTAX ERROR'); return; }
    var reszek = this.utvonal(arg);
    if (!reszek.length) { this.kiirSor('CANNOT REMOVE THE ROOT'); return; }
    if (this.dosAlak(reszek) === this.dosAlak(this.lemez.bont(this.kvt))) {
      this.kiirSor('CANNOT REMOVE THE CURRENT DIRECTORY'); return;
    }
    var cs = this.lemez.keres(reszek);
    if (!cs || !cs.dir || Object.keys(cs.gyerekek).length) {
      this.kiirSor('DIRECTORY NOT EMPTY OR NOT FOUND'); return;
    }
    delete this.lemez.szulo(reszek).gyerekek[reszek[reszek.length - 1]];
    this.lemez.szabadBajt += furt(0);
  };

  B.prototype.parancsDel = function (arg) {
    arg = String(arg || '').trim();
    if (!arg) { this.kiirSor('SYNTAX ERROR'); return; }
    var reszek = this.utvonal(arg);
    var e = this.lemez.keres(reszek);
    if (!e) { this.kiirSor('FILE NOT FOUND'); return; }
    if (e.dir) { this.kiirSor('THAT IS A DIRECTORY - USE RD'); return; }
    delete this.lemez.szulo(reszek).gyerekek[reszek[reszek.length - 1]];
    this.lemez.szabadBajt += furt(e.meret);
  };

  B.prototype.parancsType = function (arg, mindigLapoz) {
    var nyers = String(arg || '');
    /* ⚠ A kapcsolot KI KELL VAGNI, mielott az argumentumot utvonalkent
     *   ertelmezzuk — kulonben a `/P` nevu fajlt keresnenk. */
    var lapoz = /\/P\b/i.test(nyers) || !!mindigLapoz;
    arg = nyers.replace(/\s*\/P\b/i, '').trim();
    if (!arg) { this.kiirSor('SYNTAX ERROR'); return; }
    var e = this.lemez.keres(this.utvonal(arg));
    if (!e) { this.kiirSor('FILE NOT FOUND'); return; }
    if (e.dir) { this.kiirSor('THAT IS A DIRECTORY'); return; }
    this.lapozoKezd(lapoz);
    for (var i = 0; i < e.sorok.length; i++) {
      this.kiirSor(e.sorok[i]);
      if (this.lapozoMegszakadt()) break;
    }
    this.lapozoVege();
  };

  B.prototype.parancsCopy = function (arg) {
    var d = String(arg || '').trim().split(/\s+/);
    if (d.length < 2) { this.kiirSor('SYNTAX ERROR'); return; }
    /* ⭐ `COPY CON <FAJL>` — a billentyuzetrol a lemezre. */
    if (nagy(d[0]) === 'CON') {
      var cel = this.utvonal(d[1]);
      if (!this.lemez.szulo(cel)) { this.kiirSor('PATH NOT FOUND'); return; }
      this.conMod = true;
      this.conUt = cel;
      this.conSorok = [];
      return;
    }
    var f = this.lemez.keres(this.utvonal(d[0]));
    if (!f) { this.kiirSor('FILE NOT FOUND'); return; }
    if (f.dir) { this.kiirSor('THAT IS A DIRECTORY'); return; }
    var cel2 = this.utvonal(d[1]);
    var sz = this.lemez.szulo(cel2);
    if (!sz || !sz.dir) { this.kiirSor('PATH NOT FOUND'); return; }
    var nev = cel2[cel2.length - 1];
    var regi = sz.gyerekek[nev];
    if (regi && !regi.dir) this.lemez.szabadBajt += furt(regi.meret);
    sz.gyerekek[nev] = { dir: false, sorok: f.sorok.slice(), meret: f.meret, ido: this.most() };
    this.lemez.szabadBajt -= furt(f.meret);
    this.kiirSor(jobbra(1, 9) + ' FILE(S) COPIED');
  };

  B.prototype.parancsRen = function (arg) {
    var d = String(arg || '').trim().split(/\s+/);
    if (d.length < 2) { this.kiirSor('SYNTAX ERROR'); return; }
    var reszek = this.utvonal(d[0]);
    var e = this.lemez.keres(reszek);
    /* ⚠ A gep EGY uzenetet ad a ket esetre — merve. */
    if (!e) { this.kiirSor('DUPLICATE FILE NAME OR FILE NOT FOUND'); return; }
    var sz = this.lemez.szulo(reszek);
    var uj = nagy(String(d[1]).replace(/^.*[\\\/]/, ''));
    if (sz.gyerekek[uj]) { this.kiirSor('DUPLICATE FILE NAME OR FILE NOT FOUND'); return; }
    sz.gyerekek[uj] = e;
    delete sz.gyerekek[reszek[reszek.length - 1]];
  };

  /* =====================================================================
   *  A BASIC LEMEZ-PARANCSAI  (a `lemez.ino` also fele)
   * ===================================================================== */
  B.prototype.bbFajlNev = function (nev) {
    var csak = String(nev).replace(/^.*[\\\/]/, '');
    return csak.indexOf('.') < 0 ? nev + '.BAS' : nev;
  };

  B.prototype.bbasicMent = function (nev) {
    if (!nev) { this.kiirSor('SYNTAX ERROR'); return false; }
    var reszek = this.utvonal(this.bbFajlNev(nev));
    var sz = this.lemez.szulo(reszek);
    if (!sz || !sz.dir) { this.kiirSor('INVALID DRIVE'); return false; }
    /* ⭐ SIMA SZOVEGKENT, CRLF-fel — hogy a DOS `TYPE`-ja is elolvassa. */
    var sorok = this.prog.map(function (l) { return l.sz + ' ' + l.t; });
    var bajtok = this.sorokMeret(sorok);
    var nev2 = reszek[reszek.length - 1];
    var regi = sz.gyerekek[nev2];
    if (regi && !regi.dir) this.lemez.szabadBajt += furt(regi.meret);
    sz.gyerekek[nev2] = { dir: false, sorok: sorok, meret: bajtok, ido: this.most() };
    this.lemez.szabadBajt -= furt(bajtok);
    this.kiirSor('SAVED ' + nev2.slice(0, 20) + '  ' + sorok.length + ' LINES  ' + bajtok + ' BYTES');
    return true;
  };

  B.prototype.bbasicTolt = function (nev) {
    if (!nev) { this.kiirSor('SYNTAX ERROR'); return false; }
    var reszek = this.utvonal(this.bbFajlNev(nev));
    var e = this.lemez.keres(reszek);
    if (!e) { this.kiirSor('FILE NOT FOUND'); return false; }
    if (e.dir) { this.kiirSor('THAT IS A DIRECTORY'); return false; }

    /* ⭐ A LOAD TOROL — a regi program ES a valtozok is mennek. */
    this.prog = [];
    this.valtozokTorol();

    var sorok = 0, rossz = 0, elsoRossz = 0, tele = false;
    for (var i = 0; i < e.sorok.length; i++) {
      var s = e.sorok[i].replace(/^[ \t]+/, '');
      if (!s) continue;
      var m = /^(\d+)/.exec(s);
      if (!m) { rossz++; if (!elsoRossz) elsoRossz = i + 1; continue; }
      var n = parseInt(m[1], 10);
      var t = s.slice(m[1].length).replace(/^ +/, '').replace(/ +$/, '');
      if (n === 0 || n > 65529) { rossz++; if (!elsoRossz) elsoRossz = i + 1; continue; }
      if (!this.bbSorBeszur(n, t)) { tele = true; break; }
      sorok++;
    }
    if (tele) { this.kiirSor('OUT OF MEMORY'); return false; }
    var nev2 = reszek[reszek.length - 1];
    this.kiirSor('LOADED ' + nev2.slice(0, 20) + '  ' + sorok + ' LINES');
    /* ⚠ A hibas sorokat KIMONDJUK, nem nyeljuk el. */
    if (rossz) {
      this.kiirSor(rossz + ' LINE(S) SKIPPED, FIRST AT LINE ' + elsoRossz + ' OF FILE');
    }
    return true;
  };

  B.prototype.bbasicFajlLista = function (minta) {
    var m = nagy(minta || '*.BAS');
    var reszek = this.lemez.bont(this.kvt);
    var cs = this.lemez.keres(reszek);
    if (!cs || !cs.dir) { this.kiirSor('PATH NOT FOUND'); return; }
    this.kiirSor(this.dosAlak(reszek).slice(0, 60));

    var sor = '', db = 0, g = this;
    Object.keys(cs.gyerekek).forEach(function (nev) {
      var e = cs.gyerekek[nev];
      if (e.dir || !mintaEgyezik(m, nev)) return;
      /* ⭐ negy oszlop 15 karakteren = 60, elfer a 64-ben */
      if (sor.length + 15 > OSZLOPOK) { g.kiirSor(sor); sor = ''; }
      sor += balra(nev.slice(0, 14), 15);
      db++;
    });
    if (sor.length) this.kiirSor(sor.replace(/ +$/, '') || sor);
    if (!db) { this.kiirSor('NO FILES'); return; }
    this.kiirSor(db + ' FILE(S)   ' + this.lemez.szabadBajt + ' BYTES FREE ON DISK');
  };

  B.prototype.bbasicFajlTorol = function (nev) {
    if (!nev) { this.kiirSor('SYNTAX ERROR'); return; }
    var reszek = this.utvonal(this.bbFajlNev(nev));
    var e = this.lemez.keres(reszek);
    if (!e) { this.kiirSor('FILE NOT FOUND'); return; }
    if (e.dir) { this.kiirSor('THAT IS A DIRECTORY'); return; }
    delete this.lemez.szulo(reszek).gyerekek[reszek[reszek.length - 1]];
    this.lemez.szabadBajt += furt(e.meret);
    this.kiirSor('DELETED ' + reszek[reszek.length - 1].slice(0, 20));
  };

  /* =====================================================================
   *  COPY CON  —  a sor a FAJLBA megy, nem a parancsertelmezobe
   *  ⭐ Ugyanaz a minta, mint a DATE/TIME kerdesnel.
   * ===================================================================== */
  B.prototype.lemezSorFogad = function (s) {
    if (!this.conMod) return false;
    /* ^Z zarja a fajlt, ^C megszakit — a pult a vezerlokaraktert eldobja,
     * ezert a SZOVEGES alak is mukodik. */
    if (s.indexOf('\x1a') >= 0 || nagy(s.trim()) === '^Z') {
      var sz = this.lemez.szulo(this.conUt);
      var nev = this.conUt[this.conUt.length - 1];
      var meret = this.sorokMeret(this.conSorok);
      var regi = sz.gyerekek[nev];
      if (regi && !regi.dir) this.lemez.szabadBajt += furt(regi.meret);
      sz.gyerekek[nev] = { dir: false, sorok: this.conSorok.slice(), meret: meret, ido: this.most() };
      this.lemez.szabadBajt -= furt(meret);
      this.conMod = false;
      this.kiirSor(jobbra(1, 9) + ' FILE(S) COPIED');
      this.keszenlet();
      return true;
    }
    if (s.indexOf('\x03') >= 0 || nagy(s.trim()) === '^C') {
      this.conMod = false;
      this.kiirSor('COPY CANCELLED');
      this.keszenlet();
      return true;
    }
    this.conSorok.push(s);
    return true;
  };

  /* =====================================================================
   *  A .BAT FAJLOK
   *  ⭐ ECHO · REM · PAUSE · GOTO :CIMKE · IF EXIST · @ eloteg
   * ===================================================================== */
  B.prototype.batchFuttat = function (reszek) {
    var e = this.lemez.keres(reszek);
    if (!e || e.dir) return false;
    if (this.batchMelyseg >= 4) { this.kiirSor('TOO MANY NESTED BATCH FILES'); return true; }
    this.batchMelyseg++;
    /* ⚠ A `batchEcho` GLOBALIS a gepen, de a LEGKULSO batch visszaallitja. */
    if (this.batchMelyseg === 1) { this.batchEcho = true; this.batchLeall = false; }

    var i = 0, korlat = 0;
    while (i < e.sorok.length && !this.batchLeall && korlat++ < 20000) {
      var s = e.sorok[i];
      i++;
      var ugras = this.batchSorVegrehajt(s, e);
      if (ugras >= 0) i = ugras;
    }
    this.batchMelyseg--;
    return true;
  };

  /* ⭐ Egy batch-sor. Visszaad: -1, vagy a KOVETKEZO sor indexe (GOTO utan). */
  B.prototype.batchSorVegrehajt = function (s0, fajl) {
    var s = String(s0).replace(/^ +/, '');
    if (!s) return -1;

    /* ⭐ `@` — EZ AZ EGY sor ne visszhangozzon (innen az `@ECHO OFF`). */
    var nema = false;
    if (s[0] === '@') { nema = true; s = s.slice(1).replace(/^ +/, ''); }
    if (s[0] === ':') return -1;                      /* cimke */

    var kulcs = nagy(s.split(/[ ]/)[0]);
    var arg = s.slice(kulcs.length).replace(/^ +/, '');

    if (kulcs === 'REM') return -1;
    if (kulcs === 'ECHO.') { this.ujSor(); return -1; }

    if (kulcs === 'ECHO') {
      if (!arg) { this.kiirSor(this.batchEcho ? 'ECHO IS ON' : 'ECHO IS OFF'); return -1; }
      if (nagy(arg) === 'ON') { this.batchEcho = true; return -1; }
      if (nagy(arg) === 'OFF') { this.batchEcho = false; return -1; }
      this.kiirSor(arg);            /* ⭐ a szoveg VALTOZATLANUL — kisbetuvel is */
      return -1;
    }

    if (kulcs === 'PAUSE') { this.kiirSor('PRESS ANY KEY TO CONTINUE . . .'); return -1; }

    if (kulcs === 'GOTO') {
      var cimke = nagy(arg.split(/[ ]/)[0] || '');
      if (cimke) {
        for (var q = 0; q < fajl.sorok.length; q++) {
          var c = fajl.sorok[q].replace(/^ +/, '');
          if (c[0] === ':' && nagy(c.slice(1).replace(/^ +/, '').split(/[ ]/)[0]) === cimke) {
            return q + 1;                          /* ⭐ a cimke UTAN folytatjuk */
          }
        }
      }
      this.kiirSor('LABEL NOT FOUND');
      this.batchLeall = true;                      /* ⚠ tovabbfutni ertelmetlen */
      return -1;
    }

    if (kulcs === 'IF') {
      var p = arg, tagad = false;
      if (nagy(p.slice(0, 4)) === 'NOT ') { tagad = true; p = p.slice(4).replace(/^ +/, ''); }
      if (nagy(p.slice(0, 6)) !== 'EXIST ') {
        this.kiirSor('ONLY `IF [NOT] EXIST` IS SUPPORTED'); return -1;
      }
      p = p.slice(6).replace(/^ +/, '');
      var nev = p.split(/[ ]/)[0] || '';
      p = p.slice(nev.length).replace(/^ +/, '');
      var van = !!(nev && this.lemez.keres(this.utvonal(nev)));
      if (van !== tagad && p) return this.batchSorVegrehajt(p, fajl);
      return -1;
    }

    /* ---- barmi mas: RENDES parancs ----
     * ⭐ `ECHO ON` eseten a DOS kiirta a promptot ES a parancsot, mielott
     *   vegrehajtotta. ⚠ CSAK itt — az `ECHO`/`REM`/`IF` sorok nem. */
    if (this.batchEcho && !nema) { this.promptKiir(); this.kiirSor(s); }
    this.parancs(s, true);
    return -1;
  };

  /* ⭐⭐ KULSO PARANCS: ha egyetlen BELSO sem illeszkedett, `.BAT`-kent
   *   keressuk — eloszor az AKTUALIS konyvtarban, aztan a `\DOS`-ban.
   * ⚠ Ha a nevnek mar van kiterjesztese, csak a `.BAT` johet szoba: kulonben
   *   egy elgepelt `README.TXT` parancsbol `README.TXT.BAT` lenne. */
  B.prototype.batchProbal = function (e) {
    var nev = String(e).split(/[ ]/)[0];
    if (!nev) return false;
    var pont = nev.lastIndexOf('.');
    if (pont > 0) {
      if (nagy(nev.slice(pont)) !== '.BAT') return false;
    } else {
      nev += '.BAT';
    }
    if (this.batchFuttat(this.utvonal(nev))) return true;
    return this.batchFuttat(this.lemez.felold('\\DOS', nev));
  };

  /* =====================================================================
   *  CALC  —  a kiertekelo elso felulete
   * ===================================================================== */
  B.prototype.parancsCalc = function (arg) {
    if (!arg || !String(arg).trim()) {
      this.kiirSor('CALC <EXPRESSION>      ? IS THE SHORT FORM');
      this.kiirSor('  + - * /  \\ MOD  ^   AND OR XOR NOT   = <> < > <= >=');
      this.kiirSor('  ABS SGN INT FIX SQR SIN COS TAN ATN LOG EXP   PI');
      this.kiirSor('  &H1F HEX   &O17 OCTAL   &B1010 BINARY');
      this.kiirSor('  A..Z HOLD VALUES:   CALC A=10    THEN   CALC A*2');
      return;
    }
    var s = String(arg), q = 0;
    while (s[q] === ' ') q++;
    /* ---- valtozo-ertekadas: `A = kifejezes` ----
     * ⚠ Csak ha az ELSO nem-szokoz egy betu, a MASODIK pedig `=` — es NEM
     *   `==`. Kulonben az ertekadas es az osszehasonlitas osszekeveredne. */
    if (betu(s[q] || '')) {
      var r = q + 1;
      while (s[r] === ' ') r++;
      if (s[r] === '=' && s[r + 1] !== '=') {
        var e = this.kiertekel(s.slice(r + 1));
        if (e.hiba) { this.kiirSor(e.mier); return; }
        if (!this.valtozoAllit(s[q], e.ertek)) { this.kiirSor('SYNTAX ERROR'); return; }
        this.kiirSor(nagy(s[q]) + ' =' + szamSzoveg(e.ertek));
        return;
      }
    }

    var r2 = this.kiertekel(s);
    if (r2.hiba) { this.kiirSor(r2.mier); return; }
    var sz = szamSzoveg(r2.ertek);

    /* ⭐⭐ Egesz ertek 32 biten: HEXA es BINARIS alakban is — ez a PROGRAMOZOI
     *   kalkulator magja. ⭐ A szin SOHA nem az egyetlen jelzes: itt nincs is
     *   szin, a `&H` es a `&B` eloteg mondja meg, mit latsz. */
    var e2 = r2.ertek;
    if (e2 === Math.floor(e2) && e2 >= -2147483648 && e2 <= 4294967295) {
      var u = e2 < 0 ? (e2 >>> 0) : (e2 % 4294967296);
      var bin = '', kezd = false;
      for (var bit = 31; bit >= 0; bit--) {
        var b1 = Math.floor(u / Math.pow(2, bit)) % 2;
        if (b1) kezd = true;
        if (kezd || bit === 0) bin += b1;
      }
      this.kiirSor((sz + '   &H' + u.toString(16).toUpperCase() + '   &B' + bin)
                   .slice(0, OSZLOPOK));
    } else {
      this.kiirSor(sz.slice(0, OSZLOPOK));
    }
  };

  /* =====================================================================
   *  AZ ORA  —  DATE / TIME
   *  ⭐ A kerdes ugyanaz a minta, mint a `COPY CON`-nal es az `INPUT`-nal:
   *    a KOVETKEZO begepelt sor NEM parancs, hanem VALASZ.
   * ===================================================================== */
  B.prototype.datumotKerdez = function () {
    this.kiirSor('CURRENT DATE IS ' + this.datumSzoveg());
    this.kiir('ENTER NEW DATE (DD-MM-YY): ');
    this.oraVar = 'DATUM';
  };
  B.prototype.idotKerdez = function () {
    this.kiirSor('CURRENT TIME IS ' + this.idoSzoveg());
    this.kiir('ENTER NEW TIME: ');
    this.oraVar = 'IDO';
  };

  B.prototype.datumotErtelmez = function (s) {
    var m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/.exec(String(s).trim());
    if (!m) return false;
    var nap = +m[1], ho = +m[2], ev = +m[3];
    if (ev < 100) ev += (ev < 80) ? 2000 : 1900;
    if (ho < 1 || ho > 12 || nap < 1 || nap > 31) return false;
    var d = this.most();
    var uj = new Date(ev, ho - 1, nap, d.getHours(), d.getMinutes(), d.getSeconds());
    /* ⚠ A `31-02` nem letezik: a Date atcsuszna marciusba — ezt KISZURJUK. */
    if (uj.getMonth() !== ho - 1 || uj.getDate() !== nap) return false;
    this.oraEltolas += uj.getTime() - d.getTime();
    return true;
  };

  B.prototype.idotErtelmez = function (s) {
    var m = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(String(s).trim());
    if (!m) return false;
    var o = +m[1], p = +m[2], mp = m[3] ? +m[3] : 0;
    if (o > 23 || p > 59 || mp > 59) return false;
    var d = this.most();
    var uj = new Date(d.getFullYear(), d.getMonth(), d.getDate(), o, p, mp);
    this.oraEltolas += uj.getTime() - d.getTime();
    return true;
  };

  /* Igaz, ha ez a modul elvette a sort. ⚠ Ures sor = marad a mostani ertek. */
  B.prototype.oraSorFogad = function (s0) {
    if (!this.oraVar) return false;
    var s = String(s0).replace(/^ +/, '');
    var mire = this.oraVar;
    this.oraVar = null;
    if (s) {
      var ok = (mire === 'DATUM') ? this.datumotErtelmez(s) : this.idotErtelmez(s);
      if (!ok) {
        this.kiirSor(mire === 'DATUM' ? 'INVALID DATE' : 'INVALID TIME');
        if (mire === 'DATUM') this.datumotKerdez(); else this.idotKerdez();
        return true;
      }
    }
    /* ⭐ Induloskor a datum utan az IDO jon — az `oraLancol` csak ott all. */
    if (mire === 'DATUM' && this.oraLancol) { this.oraLancol = false; this.idotKerdez(); }
    return true;
  };

  /* =====================================================================
   *  A PARANCSERTELMEZO
   *  ⚠ A gep NAGYBETUSIT es levagja a vegi szokozoket, MIELOTT barmit nez.
   * ===================================================================== */
  B.prototype.parancs = function (p0, batchbol) {
    var e = nagy(String(p0)).replace(/ +$/, '').replace(/^ +/, '');
    var vege = function () { if (!batchbol) this.keszenlet(); }.bind(this);
    if (!e) return vege();

    var elso = e.split(/[ ]+/)[0];
    var arg = e.slice(elso.length).replace(/^ +/, '');

    /* ⭐ Ami CSAK a valodi gepen van. ⚠ NEM `BAD COMMAND` — az hazugsag
     *   lenne: a gep ISMERI ezeket, csak vas kell hozzajuk. */
    if (this.csakVason[elso] !== undefined) {
      this.kiirSor(this.csakVason[elso]);
      this.kiirSor('THE DEMO RUNS THE SAME CODE, NOT THE SAME HARDWARE.');
      return vege();
    }

    /* ---- a lemez sajat parancsai eloszor ---- */
    switch (elso) {
      case 'DIR': this.parancsDir(arg); return vege();
      case 'TREE': this.parancsTree(arg); return vege();
      case 'CD': case 'CHDIR': this.parancsCd(arg); return vege();
      case 'MD': case 'MKDIR': this.parancsMd(arg); return vege();
      case 'RD': case 'RMDIR': this.parancsRd(arg); return vege();
      case 'DEL': case 'ERASE': this.parancsDel(arg); return vege();
      case 'TYPE': this.parancsType(arg, false); return vege();
      /* ⭐ A `MORE` mindig lapoz — ez a kulonbseg a `TYPE`-hoz kepest. */
      case 'MORE': this.parancsType(arg, true); return vege();
      case 'COPY': this.parancsCopy(arg); return vege();
      case 'REN': case 'RENAME': this.parancsRen(arg); return vege();
      case 'VOL':
        this.kiirSor(' VOLUME IN DRIVE C IS ' + this.lemez.cimke);
        return vege();
      case 'LABEL':
        /* ⚠ A cimke a NYERS argumentum, szokozzel egyutt: `LUCY DISK`. */
        if (arg) this.lemez.cimke = arg;
        this.kiirSor(' VOLUME IN DRIVE C IS ' + this.lemez.cimke);
        return vege();
      case 'MEM':
        this.kiirSor(jobbra(MUNKATERULET, 10) + ' BYTES TOTAL CONVENTIONAL MEMORY');
        this.kiirSor(jobbra(this.szabadBajt, 10) + ' BYTES FREE');
        this.kiirSor(jobbra(this.heapBajt, 10) + ' BYTES SYSTEM HEAP');
        this.kiirSor(jobbra(this.psramBajt, 10) + ' BYTES EXTENDED MEMORY');
        this.kiirSor(jobbra(this.lemez.szabadBajt, 10) + ' BYTES FREE ON DRIVE C');
        return vege();
      case 'PROMPT':
        this.promptMinta = arg || '$P$G';
        this.kiirSor('PROMPT IS NOW:  ' + this.promptEpit());
        return vege();
      case 'DATE':
        if (arg) { if (!this.datumotErtelmez(arg)) this.kiirSor('INVALID DATE'); }
        /* ⭐ merve 2026-10-03: a `DATE` CSAK a datumot kerdezi, ahogy a DOS.
         *   (Addig a gep utana az idot is megkerdezte - a firmware-ben javitva;
         *   a datum-ido lanc most csak induloskor jon.) */
        else { this.datumotKerdez(); }
        return vege();
      case 'TIME':
        if (arg) { if (!this.idotErtelmez(arg)) this.kiirSor('INVALID TIME'); }
        else this.idotKerdez();
        return vege();
    }

    if (elso === 'BBASIC' || elso === 'BASIC') { this.bbasicIndul(); return vege(); }
    if (elso === 'CALC') { this.parancsCalc(arg); return vege(); }
    /* ⭐ A `?` azert mukodik, mert a kulcsszo szokozig tart — es a `?` nem betu. */
    if (e[0] === '?') { this.parancsCalc(e.slice(1)); return vege(); }

    if (elso === 'CLS') { this.kep.torol(); return vege(); }
    if (elso === 'VER') {
      this.kiirSor(VERZIO);
      this.kiirSor('CREATIVE PEARLS 2026');
      return vege();
    }
    if (elso === 'FRE') { this.kiirSor(this.szabadBajt + ' BYTES FREE'); return vege(); }
    if (elso === 'MODE') {
      if (!arg) { this.kiirSor('MODE ' + this.fenypor); return vege(); }
      if (FENYPOROK.indexOf(arg) >= 0) {
        this.fenypor = arg;
        this.kiirSor('MODE ' + this.fenypor);
        if (this.fenyporValtott) this.fenyporValtott(this.fenypor);
        return vege();
      }
      this.kiirSor('NO SUCH PHOSPHOR');
      return vege();
    }
    if (elso === 'HELP') { this.parancsHelp(); return vege(); }

    /* ⭐⭐ KULSO PARANCS: `.BAT` — ettol van ujra ertelme a `\DOS` mappanak. */
    if (this.batchProbal(e)) return vege();
    this.kiirSor('BAD COMMAND OR FILE NAME');
    return vege();
  };

  B.prototype.parancsHelp = function () {
    /* ⭐⭐ A HELP MAGA lapoz: 29 sor nem fer a 22 soros kepernyore. */
    this.lapozoKezd(true);
    var s = [
      'DIR [PATH|MASK]    LIST A DIRECTORY - DIR *.TXT  (/P PAUSES)',
      'TREE [PATH]        SHOW THE DIRECTORY TREE',
      'CD / MD / RD       CHANGE, MAKE, REMOVE A DIRECTORY',
      'DEL <FILE>         DELETE A FILE',
      'REN <OLD> <NEW>    RENAME A FILE - SAME DIRECTORY',
      'TYPE <FILE> [/P]   SHOW A FILE',
      'MORE <FILE>        SHOW A FILE, A PAGE AT A TIME',
      'COPY <FROM> <TO>   COPY A FILE',
      'COPY CON <FILE>    KEY A FILE IN - ^Z ENDS, ^C CANCELS',
      '<NAME>             RUN <NAME>.BAT FROM HERE OR FROM \\DOS',
      'ECHO REM PAUSE     IN .BAT - ALSO GOTO :LABEL, IF EXIST',
      'VOL / MEM          VOLUME NAME, MEMORY',
      'CHKDSK [/V] [/F]   CHECK THE DISK - READS EVERY FILE',
      'PROMPT [$CODES]    SET THE PROMPT - PROMPT ALONE RESETS IT',
      'CALC <EXPR>   ?    CALCULATE - CALC ALONE LISTS THE OPERATORS',
      'BBASIC             BAROQUE BASIC - SYSTEM COMES BACK HERE',
      'LABEL <NAME>       SET THE VOLUME NAME',
      'DATE / TIME        SHOW OR SET THE CLOCK',
      'FORMAT C:          MAKE A FRESH DRIVE C',
      'CLS                CLEAR THE SCREEN',
      'FRE                FREE WORKSPACE IN BYTES',
      'MODE <PHOSPHOR>    AMBER / GREEN / PAPER',
      'LOGO               SHOW THE MARK',
      'NET [ON|OFF]       NETWORK - OFF KEEPS THE PICTURE CLEAN',
      'BEEP               TEST TONE',
      'TAPE               SAVE A BLOCK TO TAPE',
      'AUDIO [0|19|VOL n] BCLK PIN, STATUS, LOUDNESS',
      'STAT               TIMING AND MEMORY',
      'VER                VERSION'
    ];
    for (var i = 0; i < s.length; i++) {
      this.kiirSor(s[i]);
      if (this.lapozoMegszakadt()) break;
    }
    this.lapozoVege();
  };

  /* =====================================================================
   *  A BELEPESI PONT — EGY BEGEPELT SOR
   *  ⭐ A sorrend a `sortVegrehajt()`-bol jon, beture:
   *      ora  ->  lemez (COPY CON)  ->  BASIC  ->  DOS
   * ===================================================================== */
  B.prototype.be = function (sor) {
    var s = (sor === undefined || sor === null) ? '' : String(sor);

    /* ⭐⭐ A `-- MORE --` leutesre var: ez a sor NEM parancs, hanem a
     *   folytatas jele. ⚠ Ezert NEM is visszhangozzuk. */
    if (this.lapozoVar) {
      if (s.indexOf('\x03') >= 0) this.lapozoMegszakit();
      else this.lapozoFolytat();
      if (!this.lapozoVar) this.keszenlet();
      return this.kepernyoSorok();
    }

    /* ⭐ A vezerlokarakter KULON esemeny, es a gep KALAPOS alakban mutatja.
     * ⚠ A pulton a `^Z` utan meg egy ENTER is erkezik — ezert all ket prompt
     *   egymas alatt a meresben. Itt is ugy kell lennie. */
    var vez = /[\x00-\x08\x0b\x0c\x0e-\x1f]/.exec(s);
    if (vez) {
      var c = vez[0].charCodeAt(0);
      this.kiir('^' + String.fromCharCode(64 + c));
      this.ujSor();
      this.vezerloKar(c);
      /* a maradek (jellemzoen semmi) sima sorkent megy tovabb */
      s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
      this.kiir(s);
      this.ujSor();
      if (this.oraSorFogad(s)) { this.keszenlet(); return this.kepernyoSorok(); }
      if (this.lemezSorFogad(s)) return this.kepernyoSorok();
      if (this.bbasicSorFogad(s)) { this.keszenlet(); return this.kepernyoSorok(); }
      this.parancs(s);
      return this.kepernyoSorok();
    }

    /* ⭐ A gepelt sor a kepernyon is ott van — visszhangozzuk, majd sort torunk. */
    this.kiir(s);
    this.ujSor();

    if (this.oraSorFogad(s)) { this.keszenlet(); return this.kepernyoSorok(); }
    if (this.lemezSorFogad(s)) return this.kepernyoSorok();
    if (this.bbasicSorFogad(s)) { this.keszenlet(); return this.kepernyoSorok(); }
    this.parancs(s);
    return this.kepernyoSorok();
  };

  /* ⭐ Egy vezerlokarakter. A sorrend a gepe: lapozo -> lemez -> BASIC. */
  B.prototype.vezerloKar = function (c) {
    if (this.lapozoVar && c === 3) { this.lapozoMegszakit(); return true; }
    if (this.conMod) {
      if (c === 26) {                                   /* ^Z: a fajl kesz */
        var sz = this.lemez.szulo(this.conUt);
        var nev = this.conUt[this.conUt.length - 1];
        var meret = this.sorokMeret(this.conSorok);
        var regi = sz.gyerekek[nev];
        if (regi && !regi.dir) this.lemez.szabadBajt += Math.max(1, Math.ceil(regi.meret / 4096)) * 4096;
        sz.gyerekek[nev] = { dir: false, sorok: this.conSorok.slice(), meret: meret, ido: this.most() };
        this.lemez.szabadBajt -= Math.max(1, Math.ceil(meret / 4096)) * 4096;
        this.conMod = false;
        this.kiirSor(jobbra(1, 9) + ' FILE(S) COPIED');
        this.keszenlet();
        return true;
      }
      if (c === 3) {                                    /* ^C: megszakitva */
        this.conMod = false;
        this.kiirSor('COPY CANCELLED');
        this.keszenlet();
        return true;
      }
    }
    if (this.bbasicVezerloKar(String.fromCharCode(c))) return true;
    return false;
  };

  B.prototype.kepernyoSorok = function () { return this.kep.sorok; };

  /* ⭐ A gep bekapcsolasa — ugyanaz a sorrend, mint a `setup()`-ban. */
  B.prototype.indul = function (beall) {
    beall = beall || {};
    this.kiirSor('BAROQUE 48');
    this.kiirSor('(C) 2026 CREATIVE PEARLS');
    this.kiirSor('MEMORY TEST: ' + MUNKATERULET + ' BYTES RESERVED, ' +
                 this.szabadBajt + ' BYTES VERIFIED GOOD');
    this.kiirSor(VERZIO);
    this.ujSor();
    if (beall.oratKerdez) {
      /* ⭐ Induláskor a gep MEGKERDEZI a datumot — ahogy egy ora nelkuli gep. */
      this.oraLancol = true;
      this.datumotKerdez();
    } else {
      this.keszenlet();
    }
    return this.kep.sorok;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = gyoker;
})();
