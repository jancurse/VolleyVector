import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

import { buttonClass, cx } from "./styles";
import type { ButtonSize, ButtonVariant } from "./styles";

// The one button used across the app. Variants cover the primary action, a bordered ghost, a quiet
// text button, a destructive text button, and the dashed "add" affordance. It forwards its ref and
// spreads props, so Base UI primitives can drive it through their `render` prop.
type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", type = "button", className, ...props },
  ref
) {
  return <button ref={ref} type={type} className={cx(buttonClass(variant, size), className)} {...props} />;
});
