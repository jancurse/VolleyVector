import type { ReactNode } from "react";
import { Field as BaseField } from "@base-ui/react/field";

import { cx, FIELD_LABEL } from "./styles";

// A labelled field. Base UI wires the label to whatever control sits inside (an Input/Textarea), so
// the control is reachable by its label text without a manual htmlFor/id.
type FieldProps = {
  label: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Field({ label, children, className }: FieldProps) {
  return (
    <BaseField.Root className={cx("flex flex-col gap-2", className)}>
      <BaseField.Label className={FIELD_LABEL}>{label}</BaseField.Label>
      {children}
    </BaseField.Root>
  );
}
