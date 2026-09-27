/* =====================================================================
 *  BAROQUE BASIC  —  a `bbasic.ino` masolata JavaScriptben
 *
 *  ⭐ A tarolas alakja a valodi gepen korhuen tomor:
 *      [uint16 sorszam][uint8 hossz][szoveg ... hossz bajt]
 *    Itt egy rendezett tomb, DE a meretet UGYANIGY szamoljuk (3 + hossz),
 *    mert a `FRE` azt a szamot irja ki — es annak egyeznie kell.
 *
 *  ⭐⭐ AZ `INPUT` A LEGERDEKESEBB RESZ
 *    A gep EGY szalon fut: az `INPUT`-nal nem lehet varakozni, mert az
 *    megfagyasztana a kepernyot es az orat. Ezert a program FELFUGGESZTI
 *    magat, megjegyzi, hol folytassa, es a VALASZ inditja ujra.
 *    ⭐ A bongeszoben ugyanez a helyzet (egy szal), tehat a szerkezet
 *      valtozatlanul athozhato — ez nem veletlen, hanem ugyanaz a
 *      kenyszer ugyanazt a megoldast szuli.
 * ===================================================================== */
(function () {
  'use strict';
  var gyoker = (typeof module !== 'undefined' && module.exports)
    ? require('./baroque48.js') : window;
  var B = gyoker.Baroque48;
  var b = B.belso;
  var csonk = b.csonk, betu = b.betu, szamjegy = b.szamjegy,
      betuSzam = b.betuSzam, nagy = b.nagy;
  var BB_ZONA = b.BB_ZONA, BB_LEPES_MAX = b.BB_LEPES_MAX,
      BB_FOR_MELY = b.BB_FOR_MELY, BB_GOSUB_MELY = b.BB_GOSUB_MELY,
      BB_SOR_MAX = b.BB_SOR_MAX;
  var MUNKATERULET = B.MUNKATERULET;
  var BASIC_SZOVEG_MAX = B.BASIC_SZOVEG_MAX;
  var OSZLOPOK = B.OSZLOPOK;
  var szamSzoveg = B.szamSzoveg;

  /* =====================================================================
   *  A PROGRAMTAR
   * ===================================================================== */
  B.prototype.bbHossz = function () {
    var n = 0;
    for (var i = 0; i < this.prog.length; i++) n += 3 + this.prog[i].t.length;
    return n;
  };

  B.prototype.bbSzabad = function () {
    var ossz = this.szabadBajt > 0 ? this.szabadBajt : MUNKATERULET;
    var h = this.bbHossz();
    return h < ossz ? ossz - h : 0;
  };

  /* ⭐ Megkeresi a sorszamot, vagy azt a helyet, AHOVA kerulne (rendezve). */
  B.prototype.bbKeres = function (sorszam) {
    for (var i = 0; i < this.prog.length; i++) {
      if (this.prog[i].sz === sorszam) return { i: i, megvan: true };
      if (this.prog[i].sz > sorszam) return { i: i, megvan: false };
    }
    return { i: this.prog.length, megvan: false };
  };

  B.prototype.bbSorBeszur = function (sorszam, szoveg) {
    var k = this.bbKeres(sorszam);
    if (k.megvan) this.prog.splice(k.i, 1);
    if (!szoveg.length) return true;          /* ⭐ csak sorszam = TORLES */
    if (szoveg.length > 255) szoveg = szoveg.slice(0, 255);
    if (this.bbHossz() + szoveg.length + 3 > MUNKATERULET) return false;
    this.prog.splice(k.i, 0, { sz: sorszam, t: szoveg });
    return true;
  };

  /* ---- a BASIC sajat hibauzenete ----------------------------------- */
  B.prototype.bbHiba = function (mit, sorszam) {
    this.kiirSor(sorszam ? (mit + ' IN ' + sorszam) : mit);
    this.bbAllj = true;
  };

  /* =====================================================================
   *  PRINT
   *  ⭐ A vesszo 14 karakteres OSZLOPZONAba ugrik, a pontosvesszo
   *    osszeragaszt, a sorvegi pontosvesszo NEM tor sort.
   *  ⚠ A SZAM utan is all egy szokoz — ezert ad a `PRINT 1;2;3` KET
   *    szokozt a szamok koze. A szoveg utan NINCS.
   * ===================================================================== */
  B.prototype.bbPrint = function (arg, sorszam) {
    var sor = '', p = 0, torjunk = true;
    var s = String(arg);

    var zonara = function () {
      var cel = (Math.floor(sor.length / BB_ZONA) + 1) * BB_ZONA;
      while (sor.length < cel && sor.length < BB_SOR_MAX) sor += ' ';
    };

    while (p < s.length) {
      while (s[p] === ' ') p++;
      if (p >= s.length) break;

      if (s[p] === ',' || s[p] === ';') {
        /* elvalaszto a darab helyen — lentebb kezeljuk */
      } else {
        /* ⭐ A darab a kovetkezo FELSO SZINTU `,` vagy `;` jelig tart. */
        var resz = '', zarojel = 0, idez = false;
        while (p < s.length && resz.length < BB_SOR_MAX) {
          if (s[p] === '"') idez = !idez;
          if (!idez) {
            if (s[p] === '(') zarojel++;
            if (s[p] === ')') zarojel--;
            if (zarojel === 0 && (s[p] === ',' || s[p] === ';')) break;
          }
          resz += s[p];
          p++;
        }

        if (this.szovegE(resz)) {
          var r = this.szovegKiertekel(resz);
          if (!r.jo) { this.bbHiba(r.mier, sorszam); return; }
          sor += r.szoveg;
          if (sor.length > BB_SOR_MAX) sor = sor.slice(0, BB_SOR_MAX);
          /* ⚠ A szoveg utan NINCS zaro szokoz — az csak a SZAM kezjegye. */
          while (s[p] === ' ') p++;
          if (s[p] === ',') { p++; zonara(); torjunk = true; }
          else if (s[p] === ';') { p++; torjunk = false; }
          else torjunk = true;
          if (p < s.length) torjunk = true;
          continue;
        }

        var e = this.kiertekel(resz);
        if (e.hiba) { this.bbHiba(e.mier, sorszam); return; }
        sor += szamSzoveg(e.ertek);
        if (sor.length > BB_SOR_MAX) sor = sor.slice(0, BB_SOR_MAX);
        if (sor.length < BB_SOR_MAX) sor += ' ';       /* ⭐ a szam utani szokoz */
      }

      while (s[p] === ' ') p++;
      if (s[p] === ',') { p++; zonara(); torjunk = true; }
      else if (s[p] === ';') { p++; torjunk = false; }
      else torjunk = true;
      if (p < s.length) torjunk = true;
    }

    if (torjunk) this.kiirSor(sor);
    else this.kiir(sor);
  };

  /* ⭐ Kulcsszot keres SZOHATARON es idezojelen KIVUL.
   * ⚠ A hatart BETUre nezzuk: a `FOR I=1TO10` szokoz nelkul is ervenyes. */
  function szoKeres(sz, szo) {
    var h = szo.length, idez = false;
    for (var i = 0; i < sz.length; i++) {
      if (sz[i] === '"') { idez = !idez; continue; }
      if (idez) continue;
      if (nagy(sz.substr(i, h)) !== szo) continue;
      var elotte = (i === 0) ? ' ' : sz[i - 1];
      var utana = sz[i + h];
      if (!betu(elotte) && !(utana !== undefined && betu(utana))) return i;
    }
    return -1;
  }

  /* ⭐ `FOR I=1 TO 0` eseten at kell ugrani a hozza tartozo NEXT utanra. */
  B.prototype.bbNextKeres = function (honnan) {
    var melyseg = 0;
    for (var q = honnan + 1; q < this.prog.length; q++) {
      var p = this.prog[q].t.replace(/^ +/, '');
      var f = nagy(p.substr(0, 3)), n = nagy(p.substr(0, 4));
      if (f === 'FOR' && !betu(p[3] || '')) melyseg++;
      else if (n === 'NEXT' && !betu(p[4] || '')) {
        if (melyseg === 0) return q + 1;
        melyseg--;
      }
    }
    return -1;
  };

  /* ---- SZOVEGES feltetel:  A$ = "Y" -------------------------------- */
  B.prototype.bbSzovegFeltetel = function (felt) {
    var melyseg = 0, idez = false, op = -1, oph = 0;
    for (var i = 0; i < felt.length; i++) {
      var c = felt[i];
      if (c === '"') { idez = !idez; continue; }
      if (idez) continue;
      if (c === '(') { melyseg++; continue; }
      if (c === ')') { melyseg--; continue; }
      if (melyseg) continue;
      var ketto = felt.substr(i, 2);
      if (ketto === '<>' || ketto === '><' || ketto === '<=' || ketto === '>=') {
        op = i; oph = 2; break;
      }
      if (c === '=' || c === '<' || c === '>') { op = i; oph = 1; break; }
    }
    if (op < 0) return { jo: false, mier: 'TYPE MISMATCH' };

    var bal = this.szovegKiertekel(felt.slice(0, op));
    if (!bal.jo) return { jo: false, mier: bal.mier };
    var jobb = this.szovegKiertekel(felt.slice(op + oph));
    if (!jobb.jo) return { jo: false, mier: jobb.mier };

    var c2 = bal.szoveg < jobb.szoveg ? -1 : (bal.szoveg > jobb.szoveg ? 1 : 0);
    var jel = felt.substr(op, oph), ki;
    if (oph === 2) {
      if (jel === '<>' || jel === '><') ki = (c2 !== 0);
      else if (jel === '>=') ki = (c2 >= 0);
      else ki = (c2 <= 0);
    } else {
      if (jel === '=') ki = (c2 === 0);
      else if (jel === '<') ki = (c2 < 0);
      else ki = (c2 > 0);
    }
    return { jo: true, ertek: ki };
  };

  /* =====================================================================
   *  A FUTASI CIKLUS
   *  ⭐ Kulon fuggveny, mert KETTEN hivjak: a `RUN` (elolrol) es az
   *    `INPUT` valasza (FOLYTATAS). ⚠ A kezdoallapotot a HIVO allitja.
   * ===================================================================== */
  B.prototype.bbFutasCiklus = function () {
    while (this.bbMutato < this.prog.length && !this.bbAllj) {
      var sz2 = this.prog[this.bbMutato].sz;
      var sor = this.prog[this.bbMutato].t;
      this.bbUgrott = false;
      this.bbUgrottPoz = false;
      this.bbVegrehajt(sor, sz2);

      /* ⭐ INPUT: a program EL, de nem fut. */
      if (this.bbInputVar) {
        this.bbInputFolytat = this.bbMutato + 1;
        return;
      }

      if (++this.bbLepes > BB_LEPES_MAX) {
        this.kiirSor('TOO MANY STATEMENTS - STOPPED');
        break;
      }
      if (this.bbUgrottPoz) {
        this.bbMutato = this.bbUgrasPoz;
      } else if (this.bbUgrott) {
        var k = this.bbKeres(this.bbUgrasCel);
        if (!k.megvan) { this.bbHiba('UNDEFINED LINE NUMBER', sz2); break; }
        this.bbMutato = k.i;
      } else {
        this.bbMutato++;
      }
    }
    this.bbFutasban = false;
  };

  /* =====================================================================
   *  EGY SOR VEGREHAJTASA
   *  ⭐ Visszaad: false = `SYSTEM`, tehat ki a BASIC-bol.
   * ===================================================================== */
  B.prototype.bbVegrehajt = function (s0, sorszam) {
    var s = String(s0).replace(/^ +/, '');
    if (!s.length) return true;

    var kulcs = '', i = 0;
    while (i < s.length && betu(s[i]) && kulcs.length < 11) { kulcs += nagy(s[i]); i++; }
    while (s[i] === ' ') i++;
    var arg = s.slice(i);

    /* --- REM --- */
    if (kulcs === 'REM') return true;
    if (s[0] === "'") return true;

    /* --- PRINT es a ? --- */
    if (kulcs === 'PRINT') { this.bbPrint(arg, sorszam); return true; }
    if (s[0] === '?') { this.bbPrint(s.slice(1), sorszam); return true; }

    /* --- END / STOP --- */
    if (kulcs === 'END' || kulcs === 'STOP') {
      this.bbAllj = true;
      if (kulcs === 'STOP' && sorszam) this.kiirSor('BREAK IN ' + sorszam);
      return true;
    }

    /* --- GOTO --- */
    if (kulcs === 'GOTO') {
      var g = this.kiertekel(arg);
      if (g.hiba) { this.bbHiba(g.mier, sorszam); return true; }
      if (!this.bbKeres(csonk(g.ertek)).megvan) {
        this.bbHiba('UNDEFINED LINE NUMBER', sorszam); return true;
      }
      this.bbUgrott = true;
      this.bbUgrasCel = csonk(g.ertek);
      return true;
    }

    /* --- IF ... THEN ... --- */
    if (kulcs === 'IF') {
      /* ⚠ A `THEN`-t idezojelen KIVUL kell keresni: `IF A=1 THEN PRINT "THEN"` */
      var t = -1, idez = false;
      for (var q = 0; q < arg.length; q++) {
        if (arg[q] === '"') idez = !idez;
        if (!idez && nagy(arg.substr(q, 4)) === 'THEN') {
          var elotte = (q === 0) ? ' ' : arg[q - 1];
          var utana = arg[q + 4];
          if (!betuSzam(elotte) && !(utana !== undefined && betuSzam(utana))) { t = q; break; }
        }
      }
      if (t < 0) { this.bbHiba('SYNTAX ERROR', sorszam); return true; }

      var felt = arg.slice(0, t);
      var igaz;
      if (this.szovegE(felt)) {
        var f = this.bbSzovegFeltetel(felt);
        if (!f.jo) { this.bbHiba(f.mier, sorszam); return true; }
        igaz = f.ertek;
      } else {
        var e = this.kiertekel(felt);
        if (e.hiba) { this.bbHiba(e.mier, sorszam); return true; }
        igaz = (e.ertek !== 0);
      }
      if (!igaz) return true;

      var utan = arg.slice(t + 4).replace(/^ +/, '');
      /* ⭐ `IF A=1 THEN 100` — a puszta szam GOTO (korhu). */
      if (szamjegy(utan[0])) return this.bbVegrehajt('GOTO ' + utan.substr(0, 16), sorszam);
      return this.bbVegrehajt(utan, sorszam);
    }

    /* --- GOSUB / RETURN --- */
    if (kulcs === 'GOSUB') {
      if (!sorszam) { this.bbHiba('ILLEGAL DIRECT', sorszam); return true; }
      var gs = this.kiertekel(arg);
      if (gs.hiba) { this.bbHiba(gs.mier, sorszam); return true; }
      if (!this.bbKeres(csonk(gs.ertek)).megvan) {
        this.bbHiba('UNDEFINED LINE NUMBER', sorszam); return true;
      }
      if (this.gosubVerem.length >= BB_GOSUB_MELY) {
        this.bbHiba('OUT OF MEMORY', sorszam); return true;
      }
      this.gosubVerem.push(this.bbMutato + 1);   /* ⭐ a KOVETKEZO sor */
      this.bbUgrott = true;
      this.bbUgrasCel = csonk(gs.ertek);
      return true;
    }

    if (kulcs === 'RETURN') {
      if (!this.gosubVerem.length) { this.bbHiba('RETURN WITHOUT GOSUB', sorszam); return true; }
      this.bbUgrottPoz = true;
      this.bbUgrasPoz = this.gosubVerem.pop();
      return true;
    }

    /* --- FOR valt = kezdet TO veg [STEP lepes] --- */
    if (kulcs === 'FOR') {
      if (!sorszam) { this.bbHiba('ILLEGAL DIRECT', sorszam); return true; }
      var a = arg.replace(/^ +/, '');
      if (!betu(a[0] || '')) { this.bbHiba('SYNTAX ERROR', sorszam); return true; }
      var valt = nagy(a[0]);
      var r = a.slice(1).replace(/^ +/, '');
      if (r[0] !== '=') { this.bbHiba('SYNTAX ERROR', sorszam); return true; }
      r = r.slice(1);

      var to = szoKeres(r, 'TO');
      if (to < 0) { this.bbHiba('SYNTAX ERROR', sorszam); return true; }
      var utanTo = r.slice(to + 2);
      var st = szoKeres(utanTo, 'STEP');

      var kez = this.kiertekel(r.slice(0, to));
      if (kez.hiba) { this.bbHiba(kez.mier, sorszam); return true; }
      var vegSz = (st >= 0) ? utanTo.slice(0, st) : utanTo;
      var veg = this.kiertekel(vegSz);
      if (veg.hiba) { this.bbHiba(veg.mier, sorszam); return true; }
      var lep = 1;
      if (st >= 0) {
        var l = this.kiertekel(utanTo.slice(st + 4));
        if (l.hiba) { this.bbHiba(l.mier, sorszam); return true; }
        lep = l.ertek;
      }
      if (!this.valtozoAllit(valt, kez.ertek)) { this.bbHiba('SYNTAX ERROR', sorszam); return true; }

      /* ⭐ BELEPESKOR is vizsgal: `FOR I=1 TO 0` egyszer sem fut le. */
      var belep = (lep >= 0) ? (kez.ertek <= veg.ertek) : (kez.ertek >= veg.ertek);
      if (!belep) {
        var utana2 = this.bbNextKeres(this.bbMutato);
        if (utana2 < 0) { this.bbHiba('FOR WITHOUT NEXT', sorszam); return true; }
        this.bbUgrottPoz = true;
        this.bbUgrasPoz = utana2;
        return true;
      }

      /* ⭐ Ugyanarra a valtozora nyitott ciklus UJRAINDUL, nem verodik ra. */
      for (var j = 0; j < this.forVerem.length; j++) {
        if (this.forVerem[j].valt === valt) { this.forVerem.length = j; break; }
      }
      if (this.forVerem.length >= BB_FOR_MELY) { this.bbHiba('OUT OF MEMORY', sorszam); return true; }
      this.forVerem.push({ valt: valt, veg: veg.ertek, lep: lep, vissza: this.bbMutato + 1 });
      return true;
    }

    /* --- NEXT [valt] --- */
    if (kulcs === 'NEXT') {
      if (!this.forVerem.length) { this.bbHiba('NEXT WITHOUT FOR', sorszam); return true; }
      var idx = this.forVerem.length - 1;
      var av = arg.replace(/^ +/, '');
      if (betu(av[0] || '')) {
        var v = nagy(av[0]);
        while (idx >= 0 && this.forVerem[idx].valt !== v) idx--;
        if (idx < 0) { this.bbHiba('NEXT WITHOUT FOR', sorszam); return true; }
        /* ⭐ A nevesitett NEXT a belsobb ciklusokat is lezarja. */
        this.forVerem.length = idx + 1;
      }
      var c = this.forVerem[idx];
      var uj = this.valtozoOlvas(c.valt) + c.lep;
      this.valtozoAllit(c.valt, uj);
      var megy = (c.lep >= 0) ? (uj <= c.veg) : (uj >= c.veg);
      if (megy) { this.bbUgrottPoz = true; this.bbUgrasPoz = c.vissza; }
      else this.forVerem.pop();
      return true;
    }

    /* --- INPUT ["kerdes";] valt [, valt ...] --- */
    if (kulcs === 'INPUT') {
      if (!sorszam) { this.bbHiba('ILLEGAL DIRECT', sorszam); return true; }
      var qp = 0, ar = arg;
      while (ar[qp] === ' ') qp++;
      var kerdes = '', kerdojel = true;

      if (ar[qp] === '"') {
        qp++;
        while (qp < ar.length && ar[qp] !== '"') { kerdes += ar[qp]; qp++; }
        if (ar[qp] !== '"') { this.bbHiba('SYNTAX ERROR', sorszam); return true; }
        qp++;
        while (ar[qp] === ' ') qp++;
        if (ar[qp] === ';') { kerdojel = true; qp++; }
        else if (ar[qp] === ',') { kerdojel = false; qp++; }
        else { this.bbHiba('SYNTAX ERROR', sorszam); return true; }
      }

      this.bbInputNevek = [];
      this.bbInputSzoveg = [];
      for (;;) {
        while (ar[qp] === ' ') qp++;
        if (!betu(ar[qp] || '')) { this.bbHiba('SYNTAX ERROR', sorszam); return true; }
        if (this.bbInputNevek.length >= 8) { this.bbHiba('SYNTAX ERROR', sorszam); return true; }
        var nv = nagy(ar[qp]); qp++;
        /* ⚠ Tobbbetus nev ma nem letezik — mondjuk ki. */
        if (betuSzam(ar[qp] || '')) { this.bbHiba('SYNTAX ERROR', sorszam); return true; }
        var szv = false;
        if (ar[qp] === '$') { szv = true; qp++; }
        this.bbInputNevek.push(nv);
        this.bbInputSzoveg.push(szv);
        while (ar[qp] === ' ') qp++;
        if (ar[qp] === ',') { qp++; continue; }
        break;
      }
      if (!this.bbInputNevek.length || qp < ar.length) {
        this.bbHiba('SYNTAX ERROR', sorszam); return true;
      }
      this.bbInputDb = this.bbInputNevek.length;

      if (kerdojel) kerdes += '? ';
      /* ⚠ `kiir`, NEM `kiirSor`: a valasz a kerdes MOGE kerul. */
      this.kiir(kerdes);
      this.bbInputVar = true;
      this.bbInputSor = sorszam;
      return true;
    }

    /* --- LET vagy a LET nelkuli ertekadas --- */
    var e2 = (kulcs === 'LET') ? arg : s;
    e2 = e2.replace(/^ +/, '');
    if (betu(e2[0] || '')) {
      var rr = e2.slice(1);
      /* ⭐ `A$ = ...` — SZOVEGES ertekadas. ⚠ ELOBB all, mint a szamos ag. */
      if (rr[0] === '$') {
        var r2 = rr.slice(1).replace(/^ +/, '');
        if (r2[0] === '=') {
          var ert = this.szovegKiertekel(r2.slice(1));
          if (!ert.jo) { this.bbHiba(ert.mier, sorszam); return true; }
          if (!this.szovegAllit(e2[0], ert.szoveg)) {
            this.bbHiba('STRING TOO LONG', sorszam); return true;
          }
          return true;
        }
      }
      var r3 = rr.replace(/^ +/, '');
      if (r3[0] === '=') {
        var v2 = this.kiertekel(r3.slice(1));
        if (v2.hiba) { this.bbHiba(v2.mier, sorszam); return true; }
        if (!this.valtozoAllit(e2[0], v2.ertek)) { this.bbHiba('SYNTAX ERROR', sorszam); return true; }
        return true;
      }
    }
    if (kulcs === 'LET') { this.bbHiba('SYNTAX ERROR', sorszam); return true; }

    /* --- a hej parancsai: csak AZONNALI modban --- */
    if (!sorszam) {
      if (kulcs === 'SAVE') { this.bbasicMent(this.bbNevKivesz(arg)); return true; }
      if (kulcs === 'LOAD') { this.bbasicTolt(this.bbNevKivesz(arg)); return true; }
      if (kulcs === 'FILES') { this.bbasicFajlLista(this.bbNevKivesz(arg)); return true; }
      if (kulcs === 'KILL') {
        var nev = this.bbNevKivesz(arg);
        if (!nev) { this.bbHiba('SYNTAX ERROR', sorszam); return true; }
        this.bbasicFajlTorol(nev);
        return true;
      }
      if (kulcs === 'LIST') {
        for (var li = 0; li < this.prog.length; li++) {
          this.kiirSor(this.prog[li].sz + ' ' + this.prog[li].t);
        }
        return true;
      }
      if (kulcs === 'NEW') {
        this.prog = [];
        this.valtozokTorol();
        /* ⚠ NINCS sajat `Ok` — a hej ugyis kiirja. */
        return true;
      }
      if (kulcs === 'CLEAR') { this.valtozokTorol(); return true; }
      if (kulcs === 'RUN') {
        this.valtozokTorol();               /* ⭐ a RUN torli a valtozokat */
        this.bbFutasban = true;
        this.bbAllj = false;
        this.bbLepes = 0;
        this.bbMutato = 0;
        /* ⚠ A ket verem MINDEN RUN-nal urul. */
        this.forVerem = [];
        this.gosubVerem = [];
        this.bbInputVar = false;
        this.bbInputDb = 0;
        this.bbFutasCiklus();
        return true;
      }
      if (kulcs === 'FRE') { this.kiirSor(' ' + this.bbSzabad()); return true; }
      if (kulcs === 'SYSTEM' || kulcs === 'BYE') return false;
    }

    this.bbHiba('SYNTAX ERROR', sorszam);
    return true;
  };

  /* ⭐ A `SAVE "NEV"` idezojelet var, de a korabeli gepek elnezoek voltak. */
  B.prototype.bbNevKivesz = function (arg) {
    var s = String(arg).replace(/^ +/, ''), ki = '';
    if (s[0] === '"') {
      var i = 1;
      while (i < s.length && s[i] !== '"') { ki += s[i]; i++; }
    } else {
      var j = 0;
      while (j < s.length && s[j] !== ' ') { ki += s[j]; j++; }
    }
    return ki;
  };

  /* ---- a BASIC promptja ------------------------------------------- */
  /* ⭐ `Ok` — ES KISBETUS: a korabeli gepek pont igy irtak. */
  B.prototype.bbPrompt = function () { this.kiirSor('Ok'); };

  B.prototype.bbasicIndul = function () {
    this.bbFut = true;
    this.kiirSor('BAROQUE BASIC 1.1');
    this.kiirSor(this.bbSzabad() + ' BYTES FREE');
    this.bbPrompt();
  };

  B.prototype.bbasicFut = function () { return this.bbFut; };

  /* =====================================================================
   *  EGY BEIRT SOR A BASIC-BEN
   * ===================================================================== */
  B.prototype.bbasicSorFogad = function (s0) {
    if (!this.bbFut) return false;
    var s = String(s0);

    /* ⭐⭐⭐ INPUT-ra varunk: ez a sor a VALASZ. */
    if (this.bbInputVar) {
      var r = 0, jo = true;
      for (var i = 0; i < this.bbInputDb; i++) {
        while (s[r] === ' ') r++;
        var ertek = '', idez = false;
        if (s[r] === '"') { idez = true; r++; }
        while (r < s.length) {
          if (idez) { if (s[r] === '"') { r++; break; } }
          else if (s[r] === ',') break;
          /* ⚠ A tullogas NEM csendes csonkitas. */
          if (ertek.length >= BASIC_SZOVEG_MAX) { jo = false; break; }
          ertek += s[r];
          r++;
        }
        ertek = ertek.replace(/ +$/, '');
        if (!jo) break;
        while (s[r] === ' ') r++;
        if (s[r] === ',') r++;

        if (this.bbInputSzoveg[i]) {
          if (!this.szovegAllit(this.bbInputNevek[i], ertek)) { jo = false; break; }
        } else {
          /* ⭐ Ures valasz = 0, ahogy a korabeli BASIC-ben. */
          var e = 0;
          if (ertek.length) {
            var sd = B.belso.strtod(ertek);
            if (!sd.hol || sd.hol < ertek.length) { jo = false; break; }
            e = sd.ertek;
          }
          this.valtozoAllit(this.bbInputNevek[i], e);
        }
      }

      if (!jo) {
        /* ⭐ A korabeli BASIC uzenete, szo szerint. ⚠ A program NEM all le. */
        this.kiirSor('?REDO FROM START');
        this.kiir('? ');
        return true;
      }

      this.bbInputVar = false;
      this.bbMutato = this.bbInputFolytat;
      this.bbFutasCiklus();
      /* ⚠ Ha a folytatas UJABB INPUT-on allt meg, nincs `Ok`. */
      if (!this.bbInputVar) this.bbPrompt();
      return true;
    }

    s = s.replace(/^ +/, '');

    /* ⭐ Szammal kezdodik -> TAROLAS (vagy torles). */
    if (szamjegy(s[0] || '')) {
      var m = /^(\d+)/.exec(s);
      var n = parseInt(m[1], 10);
      if (n === 0 || n > 65529) {
        this.kiirSor('SYNTAX ERROR');
        this.bbPrompt();
        return true;
      }
      var sor = s.slice(m[1].length).replace(/^ +/, '').replace(/ +$/, '');
      if (sor.length > BB_SOR_MAX) sor = sor.slice(0, BB_SOR_MAX);
      if (!this.bbSorBeszur(n, sor)) this.kiirSor('OUT OF MEMORY');
      /* ⭐ Sorbeirasnal NINCS `Ok` — ettol lehet folyamatosan gepelni. */
      return true;
    }

    /* ⭐ Kulonben: AZONNALI vegrehajtas. */
    this.bbAllj = false;
    var masolat = s.length > BB_SOR_MAX ? s.slice(0, BB_SOR_MAX) : s;

    if (!this.bbVegrehajt(masolat, 0)) {            /* SYSTEM */
      this.bbFut = false;
      this.kiirSor('');
      return true;
    }
    /* 🔴 2026-09-27: ha a `RUN` egy `INPUT`-on felfuggesztette magat, az `Ok`
     *   ODAIRODOTT A KERDES MOGE. Korhuen ott CSAK a kerdes allhat. */
    if (!this.bbInputVar) this.bbPrompt();
    return true;
  };

  /* ⭐ ^C a BASIC-ben: megszakit. */
  B.prototype.bbasicVezerloKar = function (c) {
    if (!this.bbFut) return false;
    if (c !== 3) return false;
    this.bbAllj = true;
    this.bbInputVar = false;
    this.bbInputDb = 0;
    return true;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = gyoker;
})();
