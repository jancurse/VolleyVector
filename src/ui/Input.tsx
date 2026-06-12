import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { Input as BaseInput } from "@base-ui/react/input";

import { cx, INPUT } from "./styles";

// The box variant is the standard mono text input; the title variant is the large display-font field
// that heads the board and note editors. Both connect to a surrounding Field for labelling.
type InputProps = ComponentPropsWithoutRef<"input"> & {
  variant?: "box" | "title";
};

const VARIANT = {
  box: cx(INPUT, "font-mono text-base px-2.5 py-2"),
  title:
    "w-full min-w-0 flex-1 border-0 border-b-2 border-b-transparent bg-transparent px-[0.15rem] py-[0.1rem] font-display text-[clamp(1.5rem,3vw,2.1rem)] font-bold tracking-[-0.022em] text-text transition-[border-color] duration-200 ease-out focus:border-b-accent focus:outline-none placeholder:text-text-dim placeholder:opacity-55",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { variant = "box", className, ...props },
  ref
) {
  return <BaseInput ref={ref} className={cx(VARIANT[variant], className)} {...props} />;
});
