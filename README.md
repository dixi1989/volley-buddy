# Beach Volley Buddy

Beach volleyball as a PWA with gummy-bear characters (HTML/Canvas/JS, works offline).

- **1 vs 1** – two players on one keyboard (P1: A/D/W + Ctrl, P2: arrows + Right Ctrl)
- **2 vs 2** – two players as a team against 2 CPU opponents
- **1 vs CPU** – WASD or arrow keys
- Enter your name(s) before each match; high scores are stored in the browser (localStorage)
- **Power-ups:** every 30 s of rally time each player gets a power-up of random type that falls from the sky through their half (it disappears below the ground if missed). Catch it, press Ctrl to use it.
  - *Fluffy Towel* – lays a towel on your half of the court for 25 s; the ball bounces on them instead of ending the rally.
  - *Aura+10* – a pair of cool sunglasses: for 10 s your bear's hit box is 30 % larger, so the ball is easier to hit (golden ring shows the new size).
  - *Alman Mode* – your opponents get a flag-covered bucket hat, white socks and sandals for 10 s: they move at 80 % speed and jump 80 % as high, and a short techno version of the German anthem plays.

Run locally: `python3 -m http.server`, then open http://localhost:8000

Live: https://dixi1989.github.io/volley-buddy/

Bears: every player picks a color (8 to choose from) and a gender in the name screen – male bears wear black speedos, female bears a black bikini. Choices are remembered.
