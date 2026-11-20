import { useRef } from "react";
import type { JSX, ReactNode } from "react";

import { Button } from "./Button";

type FileButtonProps = {
  children: ReactNode;
  accept?: string;
  multiple?: boolean;
  /** Beside a primary button, as on `Button`. */
  paired?: boolean;
  title?: string;
  disabled?: boolean;
  className?: string;
  onFiles: (files: File[]) => void;
};

/** A ghost button that opens a file picker; it takes JSON files unless `accept` says otherwise. */
export function FileButton({
  children,
  accept = "application/json,.json",
  multiple,
  paired,
  title,
  disabled,
  className,
  onFiles,
}: FileButtonProps): JSX.Element {
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        variant="ghost"
        paired={paired}
        title={title}
        disabled={disabled}
        className={className}
        onClick={() => input.current?.click()}
      >
        {children}
      </Button>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);

          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </>
  );
}
