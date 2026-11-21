/** Whether a key press belongs to what has focus (a text field, a dialog, an open list), not to a shortcut. */
export function isTyping(target: EventTarget | null): boolean {
  const t = target as HTMLElement;

  return (
    (t.tagName === "INPUT" && (t as HTMLInputElement).type !== "range") ||
    t.tagName === "TEXTAREA" ||
    t.tagName === "SELECT" ||
    t.isContentEditable ||
    // A dialog or an open select popup owns its keys.
    !!t.closest?.("[role=dialog],[role=alertdialog],[role=listbox]")
  );
}
