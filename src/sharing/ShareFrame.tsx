import type { JSX, ReactNode } from "react";

import { useAuth } from "../auth/useAuth";
import { BrandLockup } from "../shell/BrandMark";
import { Button } from "../ui/Button";

const BG = "flex min-h-[100dvh] flex-col [background:var(--app-backdrop)]";
const STAGE =
  "flex min-h-0 flex-1 flex-col items-center px-[clamp(1.1rem,4vw,2.75rem)] pt-[clamp(0.5rem,2vh,1.5rem)] pb-[clamp(1.5rem,4vh,2.5rem)]";

/** The chrome around what a share link opens: the brand and, for a visitor without an account, the way to sign in. */
export function ShareFrame({ children }: { children: ReactNode }): JSX.Element {
  const { user } = useAuth();

  return (
    <div className={BG}>
      <header className="flex items-center justify-between px-[clamp(1.1rem,4vw,2.75rem)] py-[1.1rem]">
        <BrandLockup />
        {!user && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.location.hash = "";
            }}
          >
            Sign in
          </Button>
        )}
      </header>

      <main className={STAGE}>{children}</main>
    </div>
  );
}
