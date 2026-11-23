/* Build info shown in the main menu. Update together with VERSION in sw.js on every change.
 * log = Änderungsprotokoll auf Deutsch (einzige deutsche Stelle im Spiel): ein Klick auf die Version im Hauptmenü.
 * Immer die letzten 3 Versionen eintragen (neueste zuerst), jeweils was geändert wurde und was zum Testen gedacht ist. */
window.BUILD = {
  version: 'vb-v57', time: '23.11.2026 17:35',
  log: [
    { v: 'vb-v57', items: [
      'Fix: Das Antippen der Versionsnummer mit dem Finger (Tablet) öffnet das Änderungsprotokoll jetzt zuverlässig – die Tippfläche ist deutlich größer und reagiert auch auf Touch direkt.',
      'Testen: Auf dem Tablet im Hauptmenü auf die Versionsnummer oben rechts tippen (auch etwas daneben, links/unterhalb).'
    ] },
    { v: 'vb-v56', items: [
      'Das Änderungsprotokoll öffnet sich jetzt mit einem normalen Klick (statt Dreifachklick) auf die Versionsnummer oben rechts im Hauptmenü.',
      'Testen: Hauptmenü öffnen, einmal auf die kleine Versionsnummer klicken bzw. tippen, mit „Zurück“ oder Esc wieder schließen.'
    ] },
    { v: 'vb-v55', items: [
      'Neu: dieses Änderungsprotokoll. Ein Klick auf die Versionsnummer oben rechts im Hauptmenü öffnet die Liste (die einzige deutsche Stelle im Spiel).',
      'Es zeigt immer die letzten 3 Versionen mit dem, was neu ist und getestet werden soll.'
    ] }
  ]
};
