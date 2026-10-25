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
  /** Print options shown beside the print button. */
  options?: ReactNode;
  children: ReactNode;
};

export function PrintView({ title, onBack, options, children }: PrintViewProps): JSX.Element {
  useEffect(() => {
    const previous = document.title;

    document.title = title;

    return () => {
      document.title = previous;
    };
  }, [title]);

  // A handout is a paper artefact, so it pins the light theme on its own root (the marker palette is
  // theme-independent, so the courts keep their colours). Leaving <html> alone keeps the app's theme hook from
  // switching the page back to dark when the print dialog closes.
  return (
    <div data-theme="light" className="min-h-[100dvh] bg-white text-text [print-color-adjust:exact]">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-white px-[clamp(1.1rem,4vw,2.5rem)] py-[0.65rem] print:hidden">
        <Button variant="text" size="sm" className="pl-0" onClick={onBack}>
          ← Back
        </Button>
        <span className="flex items-center gap-2">
          {options}
          <Button variant="primary" onClick={() => window.print()}>
            <Printer size={15} aria-hidden="true" />
            Print or save as PDF
          </Button>
        </span>
      </header>
      <main className="mx-auto w-full max-w-[760px] px-[clamp(1.1rem,4vw,2rem)] py-[clamp(1.5rem,4vh,3rem)] print:max-w-none print:p-0">
        {children}
      </main>
    </div>
  );
}
