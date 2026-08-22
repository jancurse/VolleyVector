# Court coordinate cheat sheet

The app draws one half-court (9 m × 9 m) with the net at the top, and the opponent's half above it on a board that opts in.
Every position is a normalized fraction of our half (derived from `src/court/geometry.ts`):

- **x**: `0` left sideline → `1` right sideline (as displayed; this is the players' right, since they face the net).
- **y**: `0` the net → `1` the end line.
- The **attack line** sits at `y = 1/3`. The front zone is `y < 1/3`, the back court `y > 1/3`.
- Markers may sit up to `0.1` outside the court on either axis (the free zone); anything further is clamped on import.
- **The opponent half mirrors ours into negative y**: `0` the net → `-1` their end line, their attack line at `y = -1/3`. It needs the board's `"opponentSide": true`; without it, `y` stops at `-0.1` and anything deeper is clamped.
- **Players never cross the net.** On a full court, keep our markers at `y >= 0` and opponent markers at `y <= 0`. Only the ball uses both halves.

## Useful spots

| Spot                        | Position                             |
|-----------------------------|--------------------------------------|
| Ball hanging over the net   | `{ "x": 0.5, "y": -0.05 }`           |
| Server behind the end line  | `{ "x": 0.83, "y": 1.05 }`           |
| Setter target at the net    | `{ "x": 0.55, "y": 0.08 }`           |
| Bench row (waiting markers) | `y = 1.07`, `x = 0.1, 0.21, 0.32, …` |
| Opponent block at the net   | `{ "x": 0.5, "y": -0.08 }`           |
| Opponent bench row          | `y = -1.07`, same `x` steps          |

## Rotation zones

Numbered as the players see them facing the net; zone 1 is back-right, counting counter-clockwise. Rotations cover our side only, so never assign an opponent marker to a zone.

| Zone | Court area   | x range   | y range | Centre                 | Official spot         |
|------|--------------|-----------|---------|------------------------|-----------------------|
| 1    | back right   | 2/3 – 1   | 2/3 – 1 | `{ x: 0.83, y: 0.83 }` | `{ x: 0.8, y: 0.72 }` |
| 2    | front right  | 2/3 – 1   | 0 – 1/3 | `{ x: 0.83, y: 0.17 }` | `{ x: 0.8, y: 0.22 }` |
| 3    | front middle | 1/3 – 2/3 | 0 – 1/3 | `{ x: 0.5, y: 0.17 }`  | `{ x: 0.5, y: 0.22 }` |
| 4    | front left   | 0 – 1/3   | 0 – 1/3 | `{ x: 0.17, y: 0.17 }` | `{ x: 0.2, y: 0.22 }` |
| 5    | back left    | 0 – 1/3   | 2/3 – 1 | `{ x: 0.17, y: 0.83 }` | `{ x: 0.2, y: 0.72 }` |
| 6    | back middle  | 1/3 – 2/3 | 2/3 – 1 | `{ x: 0.5, y: 0.83 }`  | `{ x: 0.5, y: 0.72 }` |

A three-player serve-receive line sits at roughly `y ≈ 2/3`. The base splits the width in thirds (`x ≈ 1/6, 3/6, 5/6`), usually shifted toward the side of the front-court OH receiver, e.g. `x ≈ 0.1 / 0.4 / 0.8`. Treat both as rough guides, not exact spots.

## Roles (from `src/court/roles.ts`)

| Role       | Default label | Colour  | Mode      |
|------------|---------------|---------|-----------|
| `setter`   | `S`           | amber   | positions |
| `outside`  | `OH`          | blue    | positions |
| `middle`   | `MB`          | teal    | positions |
| `opposite` | `OPP`         | magenta | positions |
| `libero`   | `L`           | violet  | positions |
| `ball`     | —             | —       | both      |
| `coach`    | `C`           | slate   | basic     |
| `player`   | `P`           | blue    | basic     |
