import { useEffect } from "react";
import type { JSX, ReactNode } from "react";
import { Printer } from "lucide-react";

import { Button } from "../ui/Button";

// The chrome-free shell around a printable document (a board or note handout). On screen it shows the
// paper sheet under a slim toolbar; printing (or Save as PDF) emits just the document, with the browser
// handling pagination. The toolbar is the only interactive surface, so it alone is hidden in print.
type PrintViewProps = {
  /** The document title, set as the page title so it becomes the default print/PDF filename. */
  title: string;
  onBack: () => void;
  children: ReactNode;
};

export function PrintView({ title, onBack, children }: PrintViewProps): JSX.Element {
  // A handout is a paper artefact: force the light theme while it is on screen (the marker palette is
  // theme-independent, so the courts keep their colours) and restore the user's theme on leaving.
  useEffect(() => {
    const previous = document.documentElement.dataset.theme;

    document.documentElement.dataset.theme = "light";

    return () => {
      if (previous === undefined) delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = previous;
    };
  }, []);

  useEffect(() => {
    const previous = document.title;

    document.title = title;

    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <div className="min-h-[100dvh] bg-white text-text [print-color-adjust:exact]">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-white px-[clamp(1.1rem,4vw,2.5rem)] py-[0.65rem] print:hidden">
        <Button variant="text" size="sm" className="pl-0" onClick={onBack}>
          ← Back
        </Button>
        <Button variant="primary" onClick={() => window.print()}>
          <Printer size={15} aria-hidden="true" />
          Print or save as PDF
        </Button>
      </header>
      <main className="mx-auto w-full max-w-[760px] px-[clamp(1.1rem,4vw,2rem)] py-[clamp(1.5rem,4vh,3rem)] print:max-w-none print:p-0">
        {children}
      </main>
    </div>
  );
}
