/* =====================================================================
 *  BAROQUE 48  —  A GEP, JAVASCRIPTBEN
 *
 *  ⭐⭐⭐ MIERT LETEZIK EZ A FAJL
 *
 *  A gep egy ESP32-S3-on fut, C-ben. Ez itt ANNAK A MASOLATA, hogy a
 *  bongeszoben (es a `.exe`-ben) is ki lehessen probalni, anelkul hogy
 *  barkinek hardvere lenne hozza.
 *
 *  ⚠ EGY MASOLAT KONNYEN HAZUDIK. Eleg egy szokoz elteres a `PRINT` utan,
 *    es mar nem azt mutatja, amit a gep — a latogato viszont azt hinne,
 *    hogy igen.
 *
 *  ⭐ EZERT: a hasonlosagot NEM ALLITJUK, hanem MERJUK.
 *      1. `emu_korpusz_gyujt.py`  megkerdezi a VALODI gepet, es JSON-ba irja
 *      2. `emu_kapu.js`           ugyanazt lefuttatja EZEN a magon
 *      3. a kapu SORONKENT osszeveti a kettot
 *    Amit a kapu nem igazol, arra a demo nem is hivatkozik.
 *
 *  ⭐ EGY MAG, HAROM BOR
 *      demo.html       a weboldal bemutatoja
 *      emu_kapu.js     a kapu (node)
 *      BAROQUE48.exe   az asztali gep
 *    Mind a harom UGYANEZT a fajlt hasznalja. Ha egyszer javitunk benne,
 *    mind a harom javul — es nem tudnak elcsuszni egymastol.
 *
 *  🔴 AMI SZANDEKOSAN NINCS BENNE
 *    • halozat (`NET`) — a gep neve es cime nem valo nyilvanos lapra
 *    • hang (`BEEP`, `TAPE`) — az I2S a vason lakik
 *    • `FORMAT`, `CHKDSK` melyellenorzes, `DUMP`
 *    Ezek NEM `BAD COMMAND`-ot adnak (az hazugsag lenne: a gep ismeri oket),
 *    hanem kimondjak, hogy a valodi gepen elerhetok.
 *
 *  A forras, amibol keszult:
 *    01-SOURCE/baroque48_parancssor/{baroque48_parancssor,kifejezes,bbasic,
 *                                    lemez,ora}.ino
 * ===================================================================== */
(function (gyoker) {
  'use strict';

  /* ---- a gep allandoi, a forrasbol beture ------------------------- */
  var OSZLOPOK = 64;                       /* baroque48_parancssor.ino:184 */
  var SOROK = 22;                          /* ...:196 */
  var VERZIO = 'BAROQUE-DOS 0.2';          /* ...:55  */
  var BASIC_SZOVEG_MAX = 40;               /* ...:195 */
  var MUNKATERULET = 49152;                /* ...:175 */
  var BB_ZONA = 14;                        /* bbasic.ino: PRINT oszlopzona */
  var BB_LEPES_MAX = 200000;
  var BB_FOR_MELY = 8;
  var BB_GOSUB_MELY = 12;
  var BB_SOR_MAX = 160;
  var FA_MELYSEG = 8;

  /* =====================================================================
   *  C-SZERU SEGEDEK
   *  ⚠ Ezek NEM „kozel hasonlo" megoldasok: a `%.7g`, a `strtod` es az
   *    egesz-osztas csonkitasa mind LATSZIK a kepernyon. Ha barmelyik
   *    elter, a kapu megbukik — es meg is kell buknia.
   * ===================================================================== */

  /* C `(long)x` — a NULLA FELE csonkit, nem lefele. */
  function csonk(x) { return x < 0 ? Math.ceil(x) : Math.floor(x); }

  /* C `%.*g` — a printf szabalya szerint.
   *   Ha  prec > X >= -4  (X a kitevo), akkor `f` alak `prec-1-X` tizedessel,
   *   kulonben `e` alak `prec-1` tizedessel; a vegi nullak lemennek. */
  function gAlak(v, prec) {
    if (v === 0) return '0';
    var e = v.toExponential(prec - 1);
    var X = parseInt(e.slice(e.indexOf('e') + 1), 10);
    var s;
    if (X >= -4 && X < prec) {
      s = v.toFixed(Math.max(0, prec - 1 - X));
      if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
      return s;
    }
    var d = e.split('e');
    var m = d[0];
    if (m.indexOf('.') >= 0) m = m.replace(/0+$/, '').replace(/\.$/, '');
    var jel = d[1][0];
    var jegy = d[1].slice(1);
    while (jegy.length < 2) jegy = '0' + jegy;   /* C: legalabb 2 jegyu kitevo */
    return m + 'e' + jel + jegy;
  }

  /* C `strtod` — a szoveg ELEJEROL olvas, es megmondja, hol allt meg. */
  var SZAM_RE = /^[ \t\n\r\f\v]*[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
  function strtod(s) {
    var m = SZAM_RE.exec(s);
    if (!m || !/\d/.test(m[0])) return { ertek: 0, hol: 0 };
    return { ertek: parseFloat(m[0]), hol: m[0].length };
  }

  /* C `snprintf("%Nd")` / `%-Ns` — a DIR oszlopaihoz kell, betűre. */
  function jobbra(s, n) { s = String(s); while (s.length < n) s = ' ' + s; return s; }
  function balra(s, n) { s = String(s); while (s.length < n) s = s + ' '; return s; }
  function ketjegy(n) { return (n < 10 ? '0' : '') + n; }

  function betu(c) { return /[A-Za-z]/.test(c); }
  function szamjegy(c) { return c >= '0' && c <= '9'; }
  function betuSzam(c) { return /[A-Za-z0-9]/.test(c); }
  function nagy(s) { return String(s).toUpperCase(); }

  /* =====================================================================
   *  A KIFEJEZES-KIERTEKELO          (kifejezes.ino)
   *
   *  ⚠ Az allapota a valodi gepen GLOBALIS — a forras feje ki is mondja,
   *    miert (az arduino-cli prototipus-csapdaja). ⭐ Itt egy objektum
   *    mezoi, de UGYANAZ a szerkezet: a beagyazott hivasok koruli
   *    mentes-visszaallitas ezert marad szuksegszeru.
   * ===================================================================== */
  function Kifejezes(gep) {
    this.gep = gep;
    this.p = '';        /* a szoveg */
    this.i = 0;         /* hol tartunk */
    this.hiba = false;
    this.hibaSzo = '';
  }

  Kifejezes.prototype.hibat = function (mit) {
    if (this.hiba) return;             /* az ELSO hiba szamit */
    this.hiba = true;
    this.hibaSzo = mit;
  };

  Kifejezes.prototype.szokoz = function () {
    while (this.p[this.i] === ' ' || this.p[this.i] === '\t') this.i++;
  };

  /* ⭐ Kulcsszonal vigyaz, hogy ne nyeljen be hosszabb nevet: `MODEM` != `MOD`. */
  Kifejezes.prototype.jel = function (mit) {
    this.szokoz();
    var n = mit.length;
    if (nagy(this.p.substr(this.i, n)) !== nagy(mit)) return false;
    if (betu(mit[0])) {
      var k = this.p[this.i + n];
      if (k !== undefined && (betuSzam(k) || k === '_' || k === '.')) return false;
    }
    this.i += n;
    return true;
  };

  Kifejezes.prototype.szamAlap = function (alap, jegyek) {
    var e = 0, db = 0;
    for (;;) {
      var c = nagy(this.p[this.i] || '');
      var h = jegyek.indexOf(c);
      if (!c || h < 0) break;
      e = e * alap + h;
      this.i++;
      db++;
    }
    if (!db) this.hibat('SYNTAX ERROR');
    return e;
  };

  /* ---- a `(`-tol a PARJAIG (kifArgKivesz) --------------------------- */
  function argKivesz(s, tol) {
    if (s[tol] !== '(') return null;
    var i = tol + 1, melyseg = 1, idez = false, ki = '';
    while (i < s.length) {
      if (s[i] === '"') idez = !idez;
      if (!idez) {
        if (s[i] === '(') melyseg++;
        else if (s[i] === ')') { melyseg--; if (!melyseg) { i++; break; } }
      }
      ki += s[i];
      i++;
    }
    return melyseg ? null : { szoveg: ki, hol: i };
  }

  /* ---- a lista `sorszam`-adik darabja, FELSO szintu vesszok menten --- */
  function argDarab(lista, sorszam) {
    var db = 0, melyseg = 0, idez = false, kezd = 0;
    for (var i = 0; i <= lista.length; i++) {
      var vege = (i === lista.length);
      var c = lista[i];
      if (!vege && c === '"') idez = !idez;
      if (!idez && !melyseg && (vege || c === ',')) {
        if (db === sorszam) return lista.slice(kezd, i);
        db++;
        kezd = i + 1;
      }
      if (!idez && !vege) {
        if (c === '(') melyseg++;
        else if (c === ')') melyseg--;
      }
    }
    return null;
  }

  /* ---- LEN / VAL / ASC:  SZOVEGET kernek, SZAMOT adnak -------------
   * 🔴 A beagyazott hivas ATIRNA a kiertekelo allapotat — ezert MENTJUK. */
  Kifejezes.prototype.szovegFuggveny = function (nev) {
    var len = (nev === 'LEN'), val = (nev === 'VAL'), asc = (nev === 'ASC');
    if (!len && !val && !asc) return { kezelte: false, ertek: 0 };

    var a = argKivesz(this.p, this.i);
    if (!a) { this.hibat('SYNTAX ERROR'); return { kezelte: true, ertek: 0 }; }
    this.i = a.hol;

    /* ---- a globalis allapot mentese ---- */
    var mI = this.i, mHiba = this.hiba, mSzo = this.hibaSzo, mP = this.p;
    var r = this.gep.szovegKiertekel(a.szoveg);
    /* ---- es a visszaallitasa ---- */
    this.p = mP; this.i = mI; this.hiba = mHiba; this.hibaSzo = mSzo;

    if (!r.jo) { this.hibat(r.mier || 'TYPE MISMATCH'); return { kezelte: true, ertek: 0 }; }
    if (len) return { kezelte: true, ertek: r.szoveg.length };
    if (asc) {
      if (!r.szoveg.length) { this.hibat('ILLEGAL FUNCTION CALL'); return { kezelte: true, ertek: 0 }; }
      return { kezelte: true, ertek: r.szoveg.charCodeAt(0) };
    }
    /* ⭐ VAL: a szoveg ELEJEROL olvas — `VAL("12ALMA")` = 12 */
    return { kezelte: true, ertek: strtod(r.szoveg).ertek };
  };

  Kifejezes.prototype.alap = function () {
    this.szokoz();
    if (this.hiba) return 0;
    var c = this.p[this.i];

    if (c === '(') {
      this.i++;
      var e = this.vagy();
      this.szokoz();
      if (this.p[this.i] !== ')') { this.hibat('SYNTAX ERROR'); return 0; }
      this.i++;
      return e;
    }

    if (c === '&') {
      this.i++;
      var t = nagy(this.p[this.i] || '');
      if (t === 'H') { this.i++; return this.szamAlap(16, '0123456789ABCDEF'); }
      if (t === 'O') { this.i++; return this.szamAlap(8, '01234567'); }
      if (t === 'B') { this.i++; return this.szamAlap(2, '01'); }
      return this.szamAlap(8, '01234567');      /* ⭐ a puszta `&` oktalis */
    }

    if (szamjegy(c) || (c === '.' && szamjegy(this.p[this.i + 1]))) {
      var s = strtod(this.p.slice(this.i));
      if (!s.hol) { this.hibat('SYNTAX ERROR'); return 0; }
      this.i += s.hol;
      return s.ertek;
    }

    if (c !== undefined && betu(c)) {
      var nev = '';
      while (this.i < this.p.length &&
             (betuSzam(this.p[this.i]) || this.p[this.i] === '_') && nev.length < 11) {
        nev += nagy(this.p[this.i]);
        this.i++;
      }
      this.szokoz();
      if (this.p[this.i] === '(') {
        var sz = this.szovegFuggveny(nev);
        if (sz.kezelte) return sz.ertek;
        return this.fuggveny(nev);
      }
      if (nev === 'PI') return 3.14159265358979323846;
      if (nev.length === 1) return this.gep.valtozo[nev.charCodeAt(0) - 65];
      this.hibat('SYNTAX ERROR');
      return 0;
    }

    this.hibat('SYNTAX ERROR');
    return 0;
  };

  Kifejezes.prototype.fuggveny = function (nev) {
    this.i++;                                   /* a '(' */
    var a = this.vagy();
    this.szokoz();
    if (this.p[this.i] !== ')') { this.hibat('SYNTAX ERROR'); return 0; }
    this.i++;
    if (this.hiba) return 0;

    switch (nev) {
      case 'ABS': return Math.abs(a);
      case 'SGN': return a > 0 ? 1 : (a < 0 ? -1 : 0);
      case 'INT': return Math.floor(a);              /* ⭐ a BASIC INT-je LEFELE */
      case 'FIX': return a < 0 ? Math.ceil(a) : Math.floor(a);
      case 'SIN': return Math.sin(a);
      case 'COS': return Math.cos(a);
      case 'TAN': return Math.tan(a);
      case 'ATN': return Math.atan(a);
      case 'EXP': return Math.exp(a);
      case 'SQR':
        if (a < 0) { this.hibat('ILLEGAL FUNCTION CALL'); return 0; }
        return Math.sqrt(a);
      case 'LOG':
        /* ⚠ A BASIC LOG-ja TERMESZETES alapu (ln) — nem tizes. */
        if (a <= 0) { this.hibat('ILLEGAL FUNCTION CALL'); return 0; }
        return Math.log(a);
    }
    this.hibat('UNDEFINED FUNCTION');
    return 0;
  };

  /* ⚠ A hatvany EROSEBB az elojelnel:  -2^2 = -4 */
  Kifejezes.prototype.hatvany = function () {
    var e = this.alap();
    for (;;) {
      this.szokoz();
      if (this.p[this.i] !== '^') return e;
      this.i++;
      var k = this.elojel();
      if (this.hiba) return 0;
      e = Math.pow(e, k);
    }
  };

  Kifejezes.prototype.elojel = function () {
    this.szokoz();
    if (this.p[this.i] === '-') { this.i++; return -this.elojel(); }
    if (this.p[this.i] === '+') { this.i++; return this.elojel(); }
    return this.hatvany();
  };

  Kifejezes.prototype.szorzat = function () {
    var e = this.elojel();
    for (;;) {
      if (this.hiba) return 0;
      this.szokoz();
      var c = this.p[this.i];
      if (c === '*') { this.i++; e *= this.elojel(); }
      else if (c === '/') {
        this.i++;
        var j = this.elojel();
        if (j === 0) { this.hibat('DIVISION BY ZERO'); return 0; }
        e /= j;
      } else if (c === '\\') {
        /* ⭐ egesz-osztas: MINDKET oldal elobb egeszre kerekul */
        this.i++;
        var j2 = this.elojel();
        if (csonk(j2 < 0 ? j2 - 0.5 : j2 + 0.5) === 0) { this.hibat('DIVISION BY ZERO'); return 0; }
        e = csonk(csonk(e < 0 ? e - 0.5 : e + 0.5) / csonk(j2 < 0 ? j2 - 0.5 : j2 + 0.5));
      } else if (this.jel('MOD')) {
        var j3 = this.elojel();
        if (csonk(j3) === 0) { this.hibat('DIVISION BY ZERO'); return 0; }
        e = csonk(e) % csonk(j3);
      } else {
        return e;
      }
    }
  };

  Kifejezes.prototype.osszeg = function () {
    var e = this.szorzat();
    for (;;) {
      if (this.hiba) return 0;
      this.szokoz();
      if (this.p[this.i] === '+') { this.i++; e += this.szorzat(); }
      else if (this.p[this.i] === '-') { this.i++; e -= this.szorzat(); }
      else return e;
    }
  };

  /* ⭐ A BASIC-ben IGAZ = -1 (minden bitje 1), HAMIS = 0. */
  var IGAZ = -1, HAMIS = 0;

  Kifejezes.prototype.osszehas = function () {
    var e = this.osszeg();
    for (;;) {
      if (this.hiba) return 0;
      this.szokoz();
      /* ⚠ A HOSSZABB jel eloszor: a `<=` nem `<` + `=`. */
      if (this.jel('<=') || this.jel('=<')) e = (e <= this.osszeg()) ? IGAZ : HAMIS;
      else if (this.jel('>=') || this.jel('=>')) e = (e >= this.osszeg()) ? IGAZ : HAMIS;
      else if (this.jel('<>') || this.jel('><')) e = (e !== this.osszeg()) ? IGAZ : HAMIS;
      else if (this.jel('<')) e = (e < this.osszeg()) ? IGAZ : HAMIS;
      else if (this.jel('>')) e = (e > this.osszeg()) ? IGAZ : HAMIS;
      else if (this.jel('=')) e = (e === this.osszeg()) ? IGAZ : HAMIS;
      else return e;
    }
  };

  Kifejezes.prototype.nem = function () {
    if (this.jel('NOT')) {
      var a = this.nem();
      if (this.hiba) return 0;
      return ~csonk(a);                        /* ⭐ 32 bites, mint a gepen */
    }
    return this.osszehas();
  };

  Kifejezes.prototype.es = function () {
    var e = this.nem();
    while (!this.hiba && this.jel('AND')) e = csonk(e) & csonk(this.nem());
    return e;
  };

  Kifejezes.prototype.vagy = function () {
    var e = this.es();
    for (;;) {
      if (this.hiba) return 0;
      if (this.jel('OR')) e = csonk(e) | csonk(this.es());
      else if (this.jel('XOR')) e = csonk(e) ^ csonk(this.es());
      else return e;
    }
  };

  /* =====================================================================
   *  SZAM -> SZOVEG, A KORABELI BASIC MODJAN        (kifSzamSzoveg)
   *  ⭐ NEM `%g`. Harom dolog, amit utanozni kell:
   *     1. a POZITIV szam ele SZOKOZ kerul  ->  ` 4`, nem `4`
   *     2. az EGESZ ertek tizedespont NELKUL all
   *     3. a vezeto nulla lemegy:  0.5  ->  .5
   * ===================================================================== */
  function szamSzoveg(e) {
    if (isNaN(e) || !isFinite(e)) return ' OVERFLOW';
    var t;
    var k = e < 0 ? -e : e;
    if (e === Math.floor(e) && k < 1e15) {
      t = e.toFixed(0);
      if (t === '-0') t = '0';
    } else {
      t = gAlak(e, 7);
      if (t.slice(0, 2) === '0.') t = t.slice(1);
      else if (t.slice(0, 3) === '-0.') t = '-' + t.slice(2);
    }
    return (e < 0 ? '' : ' ') + t;
  }

  /* =====================================================================
   *  A KEPERNYO      (baroque48_parancssor.ino: kiirKar / kiirSor / ujSor)
   *  ⚠ 64 oszlop utan KEMENYEN tor. Ez latszik a hosszu DIR-soroknal.
   * ===================================================================== */
  function Kepernyo() {
    this.sorok = [''];          /* az UTOLSO az eppen irt sor */
  }
  Kepernyo.prototype.kar = function (c) {
    var u = this.sorok.length - 1;
    if (this.sorok[u].length >= OSZLOPOK) { this.sorok.push(''); u++; }
    this.sorok[u] += c;
  };
  Kepernyo.prototype.kiir = function (s) {
    s = String(s);
    for (var i = 0; i < s.length; i++) this.kar(s[i]);
  };
  Kepernyo.prototype.ujSor = function () { this.sorok.push(''); };
  Kepernyo.prototype.kiirSor = function (s) { this.kiir(s); this.ujSor(); };
  Kepernyo.prototype.torol = function () { this.sorok = ['']; };

  /* =====================================================================
   *  A LEMEZ  —  egy kicsi fajlrendszer a memoriaban    (lemez.ino)
   *  ⭐ A szerkezet: konyvtarak es fajlok, DOS-alaku utvonalakkal.
   * ===================================================================== */
  function Lemez(cimke, ossz) {
    this.cimke = cimke || 'BAROQUE 48';
    this.ossz = ossz || 10485760;
    this.gyoker = { dir: true, gyerekek: {}, ido: new Date(1980, 0, 1) };
  }

  Lemez.prototype.bont = function (ut) {
    return String(ut).split(/[\\/]+/).filter(function (s) { return s && s !== '.'; });
  };

  /* ⭐ Feloldja az utvonalat az AKTUALIS konyvtarhoz kepest. */
  Lemez.prototype.felold = function (kvt, ut) {
    var reszek;
    if (/^[\\/]/.test(ut) || /^[A-Za-z]:/.test(ut)) {
      reszek = this.bont(ut.replace(/^[A-Za-z]:/, ''));
    } else {
      reszek = this.bont(kvt).concat(this.bont(ut));
    }
    var ki = [];
    for (var i = 0; i < reszek.length; i++) {
      if (reszek[i] === '..') { ki.pop(); continue; }
      ki.push(nagy(reszek[i]));
    }
    return ki;
  };

  Lemez.prototype.keres = function (reszek) {
    var cs = this.gyoker;
    for (var i = 0; i < reszek.length; i++) {
      if (!cs.dir) return null;
      var k = cs.gyerekek[reszek[i]];
      if (!k) return null;
      cs = k;
    }
    return cs;
  };

  Lemez.prototype.szulo = function (reszek) {
    return this.keres(reszek.slice(0, -1));
  };

  Lemez.prototype.dosUt = function (reszek) {
    return '\\' + reszek.join('\\');
  };

  Lemez.prototype.hasznalt = function (cs, be) {
    cs = cs || this.gyoker;
    var n = 0;
    for (var k in cs.gyerekek) {
      var g = cs.gyerekek[k];
      n += g.dir ? this.hasznalt(g, true) : g.meret;
    }
    return n;
  };

  Lemez.prototype.szabad = function () {
    /* ⚠ A valodi FAT foglalasi egysegekkel dolgozik; itt a MERT szabad
     *   helybol indulunk, es csak a valtozast kovetjuk. */
    return this.szabadAlap - (this.hasznalt() - this.hasznaltAlap);
  };

  /* =====================================================================
   *  A GEP
   * ===================================================================== */
  function Baroque48(beall) {
    beall = beall || {};
    this.kep = new Kepernyo();
    this.kif = new Kifejezes(this);

    /* --- memoria --- */
    this.szabadBajt = beall.szabadBajt || MUNKATERULET;

    /* --- valtozok --- */
    this.valtozo = new Array(26);
    this.szovegValt = new Array(26);
    this.valtozokTorol();

    /* --- lemez --- */
    this.lemez = new Lemez(beall.cimke || 'BAROQUE 48', beall.lemezMeret);
    this.lemez.szabadAlap = beall.lemezSzabad || 10199040;
    this.lemez.hasznaltAlap = 0;
    this.kvt = '\\';
    this.promptMinta = '$P$G';

    /* --- BASIC --- */
    this.bbFut = false;
    this.prog = [];                 /* [{sz, t}] sorszam szerint rendezve */
    this.bbFutasban = false;
    this.bbMutato = 0;
    this.bbAllj = false;
    this.bbLepes = 0;
    this.bbUgrott = false; this.bbUgrasCel = 0;
    this.bbUgrottPoz = false; this.bbUgrasPoz = 0;
    this.forVerem = [];
    this.gosubVerem = [];
    this.bbInputVar = false;
    this.bbInputFolytat = 0;
    this.bbInputNevek = [];
    this.bbInputSzoveg = [];
    this.bbInputDb = 0;

    /* --- ora --- ⭐ a demoban a BONGESZO oraja jar; ez IGAZSAG, nem
     *   kitalalas: a valodi gepen a `DATE`-tel allitod be. */
    this.oraEltolas = 0;

    /* --- a lapozo --- */
    this.lapozoAktiv = false;
    this.lapozoLeall = false;
    this.lapozoSorok = 0;
    this.lapozoTele = false;
    this.lapozoVar = false;
    this.lapozoSor = [];

    /* --- a fenypor, a batch es az ora --- */
    this.fenypor = beall.fenypor || 'AMBER';
    this.batchMelyseg = 0;
    this.batchEcho = true;
    this.batchLeall = false;
    this.oraVar = null;
    this.oraLancol = false;
    /* ⚠ A heap es a PSRAM a VASON mert szam. A demoban a MERT erteket
     *   mutatjuk, es a kapu kulon jelzi, hogy ez ingadozo mezo. */
    this.heapBajt = beall.heapBajt || 132924;
    this.psramBajt = beall.psramBajt || 6416464;

    /* --- a `COPY CON` allapota --- */
    this.conMod = false;
    this.conUt = null;
    this.conSorok = [];

    /* ⭐ Ami CSAK a valodi gepen van. Nem `BAD COMMAND` — az hazugsag
     *   lenne: a gep ismeri oket. */
    this.csakVason = {
      NET: 'NETWORK IS ON THE REAL MACHINE ONLY',
      BEEP: 'SOUND IS ON THE REAL MACHINE ONLY',
      TAPE: 'TAPE IS ON THE REAL MACHINE ONLY',
      AUDIO: 'SOUND IS ON THE REAL MACHINE ONLY',
      DUMP: 'A DEVELOPER COMMAND - THE REAL MACHINE ONLY',
      FORMAT: 'FORMAT IS ON THE REAL MACHINE ONLY',
      STAT: 'TIMING COUNTERS ARE ON THE REAL MACHINE ONLY'
    };

    if (beall.lemezKep) this.lemezBetolt(beall.lemezKep);
    this.lemez.hasznaltAlap = this.lemez.hasznalt();
  }

  /* =====================================================================
   *  A LAPOZO  —  a korabeli `/P` kapcsolo
   *
   *  ⭐⭐ A gep 21 sor utan `-- MORE --`-t ir, es VAR egy leutesre. Egy sugo,
   *    amit nem lehet elolvasni, nem sugo.
   *
   *  🔴 A CSAPDA, ES A MEGOLDAS: a valodi gep a varakozas alatt egy `while`
   *    ciklusban all. A bongeszoben EZ NEM LEHET — ott egy szal van, es a
   *    varakozas megfagyasztana a lapot.
   *  ⭐ Ezert ugyanaz a szerkezet, mint az `INPUT`-nal: a kiiras
   *    FELFUGGESZTI magat (a maradek sorok VARNAK), es a kovetkezo leutes
   *    folytatja. A vegeredmeny a kepernyon UGYANAZ.
   * ===================================================================== */
  Baroque48.prototype.lapozoKezd = function (be) {
    this.lapozoAktiv = !!be;
    this.lapozoLeall = false;
    this.lapozoSorok = 0;
    this.lapozoTele = false;
    this.lapozoSor = [];
  };

  Baroque48.prototype.lapozoSorSzamol = function () {
    if (!this.lapozoAktiv || this.lapozoLeall) return;
    /* ⚠ SOROK-1: az utolso sor maradjon a `-- MORE --`-nak. */
    if (++this.lapozoSorok < SOROK - 1) return;
    this.lapozoSorok = 0;
    /* ⚠ A sajat kiirasunk NE szamitson bele — kulonben minden lap egy sorral
     *   rovidebb lenne, es a hiba lapokkent halmozodna. */
    this.kep.kiir('-- MORE --');
    this.kep.ujSor();
    this.lapozoTele = true;
  };

  Baroque48.prototype.lapozoVege = function () {
    this.lapozoAktiv = false;
    /* ⭐ Ha maradt varo sor, a kovetkezo leutes folytatja. */
    this.lapozoVar = this.lapozoTele && this.lapozoSor.length > 0;
    if (!this.lapozoVar) { this.lapozoTele = false; this.lapozoSor = []; }
  };

  Baroque48.prototype.lapozoMegszakadt = function () { return this.lapozoLeall; };

  Baroque48.prototype.lapozoFolytat = function () {
    var varo = this.lapozoSor;
    this.lapozoSor = [];
    this.lapozoTele = false;
    this.lapozoAktiv = true;
    this.lapozoSorok = 0;
    for (var i = 0; i < varo.length; i++) this.kiirSor(varo[i]);
    this.lapozoVege();
  };

  Baroque48.prototype.lapozoMegszakit = function () {
    this.lapozoLeall = true;
    this.lapozoTele = false;
    this.lapozoAktiv = false;
    this.lapozoVar = false;
    this.lapozoSor = [];
    this.kep.kiir('^C');
    this.kep.ujSor();
  };

  /* ---- a kepernyo rovidites ---------------------------------------- */
  /* ⚠ MINDEN sorkiiras ezen megy at — igy a lapozas EGY helyen ul, es nem
   *   lehet elfelejteni egyetlen parancsban sem. */
  Baroque48.prototype.kiirSor = function (s) {
    if (this.lapozoTele) { this.lapozoSor.push(s); return; }
    this.kep.kiirSor(s);
    this.lapozoSorSzamol();
  };
  Baroque48.prototype.kiir = function (s) { this.kep.kiir(s); };
  Baroque48.prototype.ujSor = function () { this.kep.ujSor(); };

  /* ---- ora ---------------------------------------------------------- */
  Baroque48.prototype.most = function () { return new Date(Date.now() + this.oraEltolas); };
  Baroque48.prototype.fajlIdo = function (d) {
    return ketjegy(d.getDate()) + '-' + ketjegy(d.getMonth() + 1) + '-' +
           ketjegy(d.getFullYear() % 100) + '  ' +
           ketjegy(d.getHours()) + ':' + ketjegy(d.getMinutes());
  };

  /* ---- valtozok ----------------------------------------------------- */
  Baroque48.prototype.valtozokTorol = function () {
    for (var i = 0; i < 26; i++) { this.valtozo[i] = 0; this.szovegValt[i] = ''; }
  };
  Baroque48.prototype.valtozoAllit = function (b, e) {
    b = nagy(b);
    if (b < 'A' || b > 'Z') return false;
    this.valtozo[b.charCodeAt(0) - 65] = e;
    return true;
  };
  Baroque48.prototype.valtozoOlvas = function (b) {
    b = nagy(b);
    if (b < 'A' || b > 'Z') return 0;
    return this.valtozo[b.charCodeAt(0) - 65];
  };
  Baroque48.prototype.szovegAllit = function (b, e) {
    b = nagy(b);
    if (b < 'A' || b > 'Z') return false;
    if (e.length > BASIC_SZOVEG_MAX) return false;   /* ⚠ NEM csonkitunk csendben */
    this.szovegValt[b.charCodeAt(0) - 65] = e;
    return true;
  };
  Baroque48.prototype.szovegOlvas = function (b) {
    b = nagy(b);
    if (b < 'A' || b > 'Z') return '';
    return this.szovegValt[b.charCodeAt(0) - 65];
  };

  /* ---- a szamos kiertekelo nyilvanos belepesi pontja ---------------- */
  Baroque48.prototype.kiertekel = function (szoveg) {
    var k = this.kif;
    k.p = szoveg === undefined || szoveg === null ? '' : String(szoveg);
    k.i = 0;
    k.hiba = false;
    k.hibaSzo = '';
    var e = k.vagy();
    if (!k.hiba) {
      k.szokoz();
      /* ⭐⭐ A TELJES szoveget fel kell hasznalni: `2+3 XYZ` nem 5, hanem hiba. */
      if (k.i < k.p.length) k.hibat('SYNTAX ERROR');
    }
    return { ertek: k.hiba ? 0 : e, hiba: k.hiba, mier: k.hibaSzo || 'SYNTAX ERROR' };
  };

  /* =====================================================================
   *  A SZOVEG-KIFEJEZESEK KIERTEKELOJE      (kifSzovegKiertekel)
   *  ⭐ MASIK, kicsi gep — nem a szamos bovitese. Ezert `TYPE MISMATCH`
   *    az `A$ = A`, es ezert mukodik a `"A" + B$`.
   * ===================================================================== */
  Baroque48.prototype.szovegE = function (s) {
    var i = 0;
    while (s[i] === ' ') i++;
    if (s[i] === '"') return true;
    if (s[i] !== undefined && betu(s[i])) {
      var j = i + 1;
      while (j < s.length && betuSzam(s[j])) j++;
      if (s[j] === '$') return true;
    }
    return false;
  };

  Baroque48.prototype.szovegKiertekel = function (s) {
    s = String(s);
    var ki = '', i = 0, mier = 'SYNTAX ERROR';
    var hiba = function (m) { return { jo: false, szoveg: '', mier: m }; };

    for (;;) {
      while (s[i] === ' ') i++;
      if (i >= s.length) break;
      var darab = '';

      if (s[i] === '"') {                                  /* szoveg-allando */
        i++;
        while (i < s.length && s[i] !== '"') { darab += s[i]; i++; }
        if (s[i] !== '"') return hiba('SYNTAX ERROR');
        i++;
      } else if (betu(s[i])) {                             /* nev */
        var nev = '';
        while (i < s.length && betuSzam(s[i]) && nev.length < 11) { nev += nagy(s[i]); i++; }
        if (s[i] !== '$') return hiba('TYPE MISMATCH');
        i++;
        while (s[i] === ' ') i++;

        if (s[i] === '(') {                                /* fuggveny */
          var a = argKivesz(s, i);
          if (!a) return hiba('SYNTAX ERROR');
          i = a.hol;
          var a1 = argDarab(a.szoveg, 0);
          if (a1 === null) return hiba('SYNTAX ERROR');

          if (nev === 'CHR') {
            var r1 = this.kiertekel(a1);
            if (r1.hiba) return hiba('SYNTAX ERROR');
            var c = csonk(r1.ertek);
            if (c < 1 || c > 255) return hiba('ILLEGAL FUNCTION CALL');
            darab = String.fromCharCode(c);
          } else if (nev === 'STR') {
            var r2 = this.kiertekel(a1);
            if (r2.hiba) return hiba('SYNTAX ERROR');
            darab = szamSzoveg(r2.ertek);
          } else if (nev === 'LEFT' || nev === 'RIGHT' || nev === 'MID') {
            var f = this.szovegKiertekel(a1);
            if (!f.jo) return hiba(f.mier);
            var forras = f.szoveg, h = forras.length;
            var a2 = argDarab(a.szoveg, 1);
            if (a2 === null) return hiba('SYNTAX ERROR');
            var r3 = this.kiertekel(a2);
            if (r3.hiba) return hiba('SYNTAX ERROR');
            var m = csonk(r3.ertek);
            if (m < 0) return hiba('ILLEGAL FUNCTION CALL');

            if (nev === 'LEFT') {
              if (m > h) m = h;
              darab = forras.slice(0, m);
            } else if (nev === 'RIGHT') {
              if (m > h) m = h;
              darab = forras.slice(h - m);
            } else {
              /* ⭐ MID$ — a korabeli BASIC 1-TOL indexel */
              if (m < 1) return hiba('ILLEGAL FUNCTION CALL');
              var db = h;
              var a3 = argDarab(a.szoveg, 2);
              if (a3 !== null && a3.length) {
                var r4 = this.kiertekel(a3);
                if (r4.hiba) return hiba('SYNTAX ERROR');
                db = csonk(r4.ertek);
                if (db < 0) return hiba('ILLEGAL FUNCTION CALL');
              }
              if (m > h) darab = '';
              else {
                var maradek = h - (m - 1);
                if (db > maradek) db = maradek;
                darab = forras.substr(m - 1, db);
              }
            }
          } else {
            return hiba('SYNTAX ERROR');
          }
        } else {                                           /* sima `A$` */
          if (nev.length !== 1) return hiba('SYNTAX ERROR');
          darab = this.szovegOlvas(nev[0]);
        }
      } else {
        return hiba('TYPE MISMATCH');
      }

      /* ⚠ A tullogas NEM csendes */
      if (ki.length + darab.length > BASIC_SZOVEG_MAX * 2) return hiba('STRING TOO LONG');
      ki += darab;

      while (s[i] === ' ') i++;
      if (s[i] === '+') { i++; continue; }                 /* ⭐ osszefuzes */
      if (i >= s.length) break;
      return hiba('SYNTAX ERROR');
    }
    return { jo: true, szoveg: ki, mier: mier };
  };

  gyoker.Baroque48 = Baroque48;
  gyoker.Baroque48.szamSzoveg = szamSzoveg;
  gyoker.Baroque48.OSZLOPOK = OSZLOPOK;
  gyoker.Baroque48.SOROK = SOROK;
  gyoker.Baroque48.VERZIO = VERZIO;
  gyoker.Baroque48.BASIC_SZOVEG_MAX = BASIC_SZOVEG_MAX;
  gyoker.Baroque48.MUNKATERULET = MUNKATERULET;
  gyoker.Baroque48.belso = {
    csonk: csonk, gAlak: gAlak, strtod: strtod, argKivesz: argKivesz,
    argDarab: argDarab, jobbra: jobbra, balra: balra, Lemez: Lemez,
    Kepernyo: Kepernyo, BB_ZONA: BB_ZONA, BB_LEPES_MAX: BB_LEPES_MAX,
    BB_FOR_MELY: BB_FOR_MELY, BB_GOSUB_MELY: BB_GOSUB_MELY,
    BB_SOR_MAX: BB_SOR_MAX, FA_MELYSEG: FA_MELYSEG,
    betu: betu, szamjegy: szamjegy, betuSzam: betuSzam, nagy: nagy,
    ketjegy: ketjegy
  };
})(typeof module !== 'undefined' && module.exports ? module.exports
                                                   : (typeof window !== 'undefined' ? window : this));
