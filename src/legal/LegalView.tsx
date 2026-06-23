import type { JSX } from "react";

import { Button } from "../ui/Button";
import { Markdown } from "../ui/Markdown";
import { BrandLockup } from "../shell/BrandMark";
import { LEGAL_MARKDOWN } from "./legalText";

// The public Terms & Privacy page at `/terms`. It is rendered before the auth gate so it is reachable
// with or without an account (the signup screens open it in a new tab), and reads as a plain document:
// the brand lockup, a way back, and the notice itself.
export function LegalView({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] px-6 py-10 text-text">
      <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <BrandLockup />
          <Button variant="ghost" onClick={onClose}>
            Back to VolleyVector
          </Button>
        </div>
        <Markdown>{LEGAL_MARKDOWN}</Markdown>
      </div>
    </div>
  );
}
