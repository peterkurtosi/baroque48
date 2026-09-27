# BAROQUE 48

A small computer with a deliberate limit.
ESP32-S3 · 7" 800×480 · its own DOS · BASIC · floppies you can hold.

**The page:** `index.html` — no external requests, no fonts, no trackers.
The boot screen on it is drawn live, not photographed.

> A **baroque pearl** is the irregular one — prized for it, not despite it.
> The **48** is a promise: whatever you write here fits on a real 48K machine.

## Status

**The site is live:** https://peterkurtosi.github.io/baroque48/

Published on 2026-09-27, once the machine had a DOS, a BASIC and two manuals
worth showing. GitHub Pages is free from a public repository — that is all it
took.

## What is here

    index.html                    the page itself, in Hungarian, German and English
    kep/                          three photographs of the real machine
    kezikonyv/baroque-dos.html    the command-line manual, 28 screens
    kezikonyv/baroque-basic.html  the BASIC manual, 15 chapters

⭐ In both manuals **every screen line is the machine's real answer**. The BASIC
manual is generated: a script runs 48 examples on the machine, stores what it
replied, and builds the page from that. A gate re-queries the machine and checks
that all 293 screen lines still match. Not one example was typed from memory.

## Where the work lives

The project's working directory (ideas, measurements, the vendor documentation,
the firmware sketches) is **not** in this repository:

`OneDrive\Desktop\Own Projects for Claud\ClaudeCode - BAROQUE 48`

- `03-STATE/OTLET-TAR.md` — every idea, with the reasoning and what was rejected
- `08-REFERENCE/panel-gyari-ESP32-8048S070/` — the manufacturer's schematics
- `01-SOURCE/baroque48_indulas/` — the boot screen sketch

Creative Pearls · Peter Kurtosi · 2026
