import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { MembersList, memberLabel } from "../../src/team/MembersList";
import type { Member } from "../../src/team/useMembers";

const member = (over: Partial<Member> = {}): Member => ({
  userId: "u1",
  name: "Coach Cara",
  role: "coach",
  ...over,
});

const base = {
  loading: false,
  canManage: false,
  currentUserId: undefined,
  onSetRole: () => {},
  onRemove: () => {},
};

describe("MembersList", () => {
  test.each([
    { kind: "display name", member: member(), expected: "Coach Cara" },
    { kind: "account id when unnamed", member: member({ name: "" }), expected: "u1" },
  ])("a non-manageable row leads with the $kind and shows the role as a read-only chip", ({ member: m, expected }) => {
    render(<MembersList {...base} members={[m]} />);

    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.getByText(m.role)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  test("a manageable row shows an editable role control while the manager's own row keeps the chip", () => {
    const me = member({ userId: "me", name: "Coach Me", role: "coach" });
    const other = member({ userId: "other", name: "Player Pat", role: "player" });

    render(<MembersList {...base} canManage members={[me, other]} currentUserId="me" />);

    expect(screen.getByRole("combobox", { name: `Role for ${memberLabel(other)}` })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: `Role for ${memberLabel(me)}` })).not.toBeInTheDocument();
    expect(screen.getByText(me.role)).toBeInTheDocument();
  });
});
