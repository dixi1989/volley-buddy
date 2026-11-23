/* Build info shown in the main menu. Update together with VERSION in sw.js on every change.
 * log = Änderungsprotokoll auf Deutsch (einzige deutsche Stelle im Spiel): dreimal auf die Version im Hauptmenü klicken.
 * Immer die letzten 3 Versionen eintragen (neueste zuerst), jeweils was geändert wurde und was zum Testen gedacht ist. */
window.BUILD = {
  version: 'vb-v55', time: '23.11.2026 17:35',
  log: [
    { v: 'vb-v55', items: [
      'Neu: dieses Änderungsprotokoll. Dreimal schnell auf die Versionsnummer oben rechts im Hauptmenü klicken öffnet die Liste (die einzige deutsche Stelle im Spiel).',
      'Es zeigt immer die letzten 3 Versionen mit dem, was neu ist und getestet werden soll.'
    ] },
    { v: 'vb-v54', items: [
      'Zweiter Hintergrund-Track: Techno (132 BPM, 8-Takt-Aufbau mit Bassdrum, Acid-Linie, Stabs und Snare-Roll).',
      'Die Musik-Taste im Hauptmenü (Taste N) schaltet jetzt durch: Miami → Techno → Aus. Die Auswahl wird gespeichert.',
      'Testen: Klingt der Mix gut (Bass, Stabs, Lautstärke gegenüber den Effekten)? Läuft der Wechsel ohne Aussetzer?'
    ] },
    { v: 'vb-v53', items: [
      'Tablet: Sobald ein Controller verbunden ist, werden die Touch-Buttons ausgeblendet. Wird der Controller getrennt, kommen sie wieder.',
      'Testen: Tablet mit Controller koppeln, ein Match starten, dann den Controller trennen.'
    ] }
  ]
};
