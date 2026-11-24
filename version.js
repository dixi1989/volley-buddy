/* Build info shown in the main menu. Update together with VERSION in sw.js on every change.
 * log = Änderungsprotokoll auf Deutsch (einzige deutsche Stelle im Spiel), erreichbar über den Button „Changelog“ im Hauptmenü
 * (und per Klick auf die Version). Regeln: nur die WICHTIGSTEN Änderungen, keine Test-Hinweise / To-dos, keine Kleinigkeiten;
 * Versionen ohne wichtige Änderung bekommen keinen Eintrag; es werden die letzten 3 Einträge angezeigt (neueste zuerst). */
window.BUILD = {
  version: 'vb-v59', time: '24.11.2026 15:30',
  log: [
    { v: 'vb-v59', items: [
      'Neuer Held „Bruiser“: kahlköpfig und bullig, seine Waffe ist ein pinker Blumenstrauß, der einen Fächer aus drei Regenbogenstrahlen verschießt (Fernkampf, beschleunigt oder bremst den Ball).'
    ] },
    { v: 'vb-v58', items: [
      'Neuer Button „Changelog“ im Hauptmenü zeigt die letzten Änderungen (auch per Klick auf die Versionsnummer).'
    ] },
    { v: 'vb-v54', items: [
      'Zweiter Hintergrund-Track: Techno. Die Musik-Taste im Hauptmenü (Taste N) schaltet durch: Miami → Techno → Aus.'
    ] },
    { v: 'vb-v52', items: [
      'Salto: In der Luft nochmal Springen macht einen Salto (einmal pro Sprung). Ein Ball, den man dabei trifft, fliegt direkt zum Gegner.'
    ] }
  ]
};
