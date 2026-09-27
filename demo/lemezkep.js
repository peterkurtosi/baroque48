/* =====================================================================
 *  A DEMO LEMEZKEPE  —  GENERALT FAJL, NE SZERKESZD
 *
 *  ⭐ Ez a valodi BAROQUE 48 lemeze: ugyanazok a konyvtarak, ugyanazok a
 *    fajlok, ugyanazokkal a meretekkel es idobelyegekkel.
 *
 *  Keszitette:  04-TOOLS/meroeszkozok/emu_lemezkep.py
 *  Merve:       2026-09-27 12:22:49
 *  ⚠ A szkript ELLENORZI, hogy a visszaolvasott tartalom pont annyi
 *    bajt-e, amennyit a `DIR` mond. Ha nem, nem keszul el a fajl.
 * ===================================================================== */
var BAROQUE48_LEMEZ = {
 "cimke": "LUCY DISK",
 "szabad": 10203136,
 "tetelek": [
  {
   "ut": "\\DOS",
   "dir": true,
   "datum": "01-01-80",
   "ido": "00:59"
  },
  {
   "ut": "\\BASIC",
   "dir": true,
   "datum": "01-01-80",
   "ido": "00:59"
  },
  {
   "ut": "\\TAPES",
   "dir": true,
   "datum": "01-01-80",
   "ido": "00:59"
  },
  {
   "ut": "\\README.TXT",
   "dir": false,
   "datum": "01-01-80",
   "ido": "00:59",
   "meret": 170,
   "tartalom": [
    "BAROQUE 48",
    "(C) 2026 CREATIVE PEARLS",
    "",
    "DRIVE C IS 9.9 MB OF THE MACHINE'S OWN FLASH.",
    "IT KEEPS WHAT YOU PUT ON IT.",
    "",
    "TRY:  DIR   TREE   CD DOS   TYPE README.TXT   MEM"
   ]
  },
  {
   "ut": "\\TEMP",
   "dir": true,
   "datum": "01-01-80",
   "ido": "00:09"
  },
  {
   "ut": "\\AUTOEXEC.BAT",
   "dir": false,
   "datum": "01-01-80",
   "ido": "00:06",
   "meret": 100,
   "tartalom": [
    "@ECHO OFF",
    "ECHO BAROQUE 48 - THE DISK IS READY",
    "IF EXIST README.TXT ECHO README.TXT IS ON THE DISK"
   ]
  },
  {
   "ut": "\\DOS\\COMMANDS",
   "dir": true,
   "datum": "01-01-80",
   "ido": "00:07"
  },
  {
   "ut": "\\TEMP\\SUB",
   "dir": true,
   "datum": "01-01-80",
   "ido": "00:09"
  }
 ]
};
if (typeof module !== 'undefined' && module.exports) module.exports = BAROQUE48_LEMEZ;
