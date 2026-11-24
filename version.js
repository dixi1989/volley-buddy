/* Build info shown in the main menu. Update together with VERSION in sw.js on every change.
 * log = Änderungsprotokoll auf Deutsch (einzige deutsche Stelle im Spiel), erreichbar über den Button „Changelog“ im Hauptmenü
 * (und per Klick auf die Version). Regeln: nur die WICHTIGSTEN Änderungen, keine Test-Hinweise / To-dos, keine Kleinigkeiten;
 * Versionen ohne wichtige Änderung bekommen keinen Eintrag; es werden die letzten 3 Einträge angezeigt (neueste zuerst). */
window.BUILD = {
  version: 'vb-v61', time: '24.11.2026 16:30',
  log: [
    { v: 'vb-v61', items: [
      'Volley Fight: Fernkampf-Schüsse treffen jetzt auch Gegner. Ein Treffer betäubt kurz (Sterne über dem Kopf) und schleudert den Gegner zurück; danach gibt es eine kurze Schutzzeit. Das Schwarze-Loch-Geschütz teleportiert den Getroffenen stattdessen auf der eigenen Seite.'
    ] },
    { v: 'vb-v60', items: [
      'Siegerpose: Der Gewinner hüpft mit erhobenen Armen im Konfettiregen, dazu gibt es einen Siegerspruch pro Held im Endbildschirm.',
      'Jede Nahkampfwaffe hat jetzt eigene Schwung- und Treffer-Sounds.',
      'Neue Musik-Einstellung „Stage“: Mond, Unterwasser, Dönerbude und Schwarzes-Loch-Arena spielen ihr eigenes Thema (Strand bleibt Miami). Die Musik-Taste schaltet jetzt Miami → Techno → Stage → Aus.'
    ] },
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
