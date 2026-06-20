import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

import { buttonClass, cx } from "./styles";
import type { ButtonSize, ButtonVariant } from "./styles";

// The one button used across the app. Variants cover the primary action, a bordered ghost, a quiet
// text button, a quiet inline `danger` text button, a prominent bordered `danger-strong` for a
// standalone destructive action, a filled `danger-solid` for a modal's destructive confirm, and the
// dashed "add" affordance. It forwards its ref and spreads props, so Base UI primitives can drive it
// through their `render` prop. Set `paired` on a quiet button beside a full-size button so it matches
// that button's height.
type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  paired?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", paired = false, type = "button", className, ...props },
  ref
) {
  return <button ref={ref} type={type} className={cx(buttonClass(variant, size, paired), className)} {...props} />;
});
