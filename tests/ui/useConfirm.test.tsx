import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { useConfirm } from "../../src/ui/useConfirm";

type Result = { confirmed: boolean; option: boolean };

function Harness({ onResult }: { onResult: (r: Result) => void }) {
  const { confirmWith, dialog } = useConfirm();

  return (
    <>
      <button onClick={() => void confirmWith({ title: "Delete?", option: "Download a copy first" }).then(onResult)}>
        Ask
      </button>
      {dialog}
    </>
  );
}

async function ask(untick: boolean): Promise<Result> {
  let result: Result | undefined;

  render(<Harness onResult={(r) => (result = r)} />);
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  if (untick) await userEvent.click(screen.getByRole("checkbox", { name: "Download a copy first" }));
  await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

  return result!;
}

describe("useConfirm with an option", () => {
  test("the option starts ticked", async () => {
    expect(await ask(false)).toEqual({ confirmed: true, option: true });
  });

  test("unticking it opts out", async () => {
    expect(await ask(true)).toEqual({ confirmed: true, option: false });
  });
});
