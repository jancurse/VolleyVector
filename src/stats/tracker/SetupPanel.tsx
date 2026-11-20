import type { JSX } from "react";

import { Field } from "../../ui/Field";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { PANEL_TITLE, SUBPANEL } from "../../ui/styles";
import type { MatchMeta } from "../types";

type SetupPanelProps = {
  meta: MatchMeta;
  names: { us: string; them: string };
  /** Once a stat is recorded the first serve and start rotation are fixed. */
  hasEvents: boolean;
  onMeta: (meta: Partial<MatchMeta>) => void;
};

/** What a set starts from: its number, who serves first, and our rotation at the start. */
export function SetupPanel({ meta, names, hasEvents, onMeta }: SetupPanelProps): JSX.Element {
  return (
    <section className={SUBPANEL} aria-labelledby="setup-title">
      <h2 id="setup-title" className={PANEL_TITLE}>
        Set
      </h2>
      <div className="flex flex-wrap gap-3">
        <Field label="Set number" className="w-24">
          <Input value={meta.setNumber} onChange={(e) => onMeta({ setNumber: e.target.value })} placeholder="1" />
        </Field>
        {!hasEvents && (
          <Field label="First serve" className="w-40">
            <Select
              ariaLabel="First serve"
              value={meta.firstServe ?? ""}
              onValueChange={(v) => onMeta({ firstServe: v === "us" || v === "them" ? v : null })}
              options={[
                { value: "", label: "Auto-detect" },
                { value: "us", label: names.us },
                { value: "them", label: names.them },
              ]}
            />
          </Field>
        )}
        {!hasEvents && (
          <Field label="Start rotation" className="w-32">
            <Select
              ariaLabel="Start rotation"
              value={String(meta.startRotation)}
              onValueChange={(v) => onMeta({ startRotation: parseInt(v, 10) })}
              options={[1, 2, 3, 4, 5, 6].map((r) => ({ value: String(r), label: String(r) }))}
            />
          </Field>
        )}
      </div>
      {hasEvents && (
        <p className="m-0 text-xs text-text-dim">First serve and start rotation are fixed once a stat is recorded.</p>
      )}
    </section>
  );
}
