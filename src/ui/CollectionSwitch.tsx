import type { JSX } from "react";

export type Collection = "tactics" | "drills";

// Flips the workspace between the tactics and drills collections. A placeholder for Stage 4's unified
// library; for now it keeps the two content types as separate browse-and-edit worlds.
type CollectionSwitchProps = {
  value: Collection;
  onChange: (value: Collection) => void;
};

export function CollectionSwitch({ value, onChange }: CollectionSwitchProps): JSX.Element {
  return (
    <div className="vc-segmented vc-collection-switch" role="group" aria-label="Library">
      {(["tactics", "drills"] as const).map((collection) => (
        <button
          key={collection}
          type="button"
          className={`vc-seg${value === collection ? " vc-seg--on" : ""}`}
          aria-pressed={value === collection}
          onClick={() => onChange(collection)}
        >
          {collection === "tactics" ? "Tactics" : "Drills"}
        </button>
      ))}
    </div>
  );
}
