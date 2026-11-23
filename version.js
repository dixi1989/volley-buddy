/* Build info shown in the main menu. Update together with VERSION in sw.js on every change.
 * log = Änderungsprotokoll auf Deutsch (einzige deutsche Stelle im Spiel), erreichbar über den Button „Changelog“ im Hauptmenü
 * (und per Klick auf die Version). Regeln: nur die WICHTIGSTEN Änderungen, keine Test-Hinweise / To-dos, keine Kleinigkeiten;
 * Versionen ohne wichtige Änderung bekommen keinen Eintrag; es werden die letzten 3 Einträge angezeigt (neueste zuerst). */
window.BUILD = {
  version: 'vb-v58', time: '23.11.2026 17:35',
  log: [
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
