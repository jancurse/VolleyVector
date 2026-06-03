import type { JSX } from "react";

import { Court } from "./court/Court";
import { Legend } from "./court/Legend";
import type { Marker } from "./court/types";
import { useTheme } from "./theme/useTheme";
import { ThemeToggle } from "./ui/ThemeToggle";

// A static perimeter defence against an outside attack, used to showcase the court's visual
// language in Stage 1. The opposing outside hitter attacks from their position 4, which mirrors to
// our right side of the net, so the ball sits high-x on their side, with the block formed beneath it.
const FORMATION: Marker[] = [
  { id: "opp", role: "opposite", label: "OPP", position: { x: 0.82, y: 0.08 } },
  { id: "mb1", role: "middle", label: "MB1", position: { x: 0.64, y: 0.08 } },
  { id: "oh1", role: "outside", label: "OH1", position: { x: 0.22, y: 0.27 } },
  { id: "s", role: "setter", label: "S", position: { x: 0.84, y: 0.55 } },
  { id: "l", role: "libero", label: "L", position: { x: 0.2, y: 0.7 } },
  { id: "oh2", role: "outside", label: "OH2", position: { x: 0.5, y: 0.85 } },
  { id: "ball", role: "ball", position: { x: 0.8, y: -0.085 } },
];

export function App(): JSX.Element {
  const [theme, toggleTheme] = useTheme();

  return (
    <div className="vc-app">
      <header className="vc-header">
        <div className="vc-brand">
          <svg className="vc-logo" viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="12" cy="15" r="2.1" fill="currentColor" />
          </svg>
          <span>VolleyCoach</span>
        </div>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </header>

      <main className="vc-main">
        <section className="vc-stage">
          <div className="vc-caption">
            <p className="vc-eyebrow">Tactic</p>
            <h1 className="vc-title">Base defence</h1>
            <p className="vc-subtitle">Perimeter, against an outside attack</p>
          </div>
          <figure className="vc-court-frame">
            <Court markers={FORMATION} label="Base defence: perimeter against an outside attack" />
          </figure>
        </section>

        <aside className="vc-panel">
          <h2 className="vc-panel-title">Roles</h2>
          <Legend />
        </aside>
      </main>
    </div>
  );
}
