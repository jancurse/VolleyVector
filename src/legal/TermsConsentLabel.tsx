import type { JSX } from "react";

// The text beside the signup acceptance checkbox. The Terms link opens the public page in a new tab so a
// newcomer can read it without losing their half-filled signup form.
export function TermsConsentLabel(): JSX.Element {
  return (
    <>
      I agree to the{" "}
      <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-accent underline">
        Terms &amp; Privacy
      </a>
      .
    </>
  );
}
