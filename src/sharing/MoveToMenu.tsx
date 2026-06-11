import type { JSX } from "react";

import { MenuItem, SubMenu } from "../ui/Menu";
import type { TeamRef } from "../workspace/useWorkspace";

// The owner's "move this personal board into a team library" action, beside Copy to in the overflow
// menu. Unlike a copy it relocates the original, so the caller confirms before moving. A single target
// renders as a direct item.
type MoveToMenuProps = {
  teams: readonly TeamRef[];
  onMove: (teamId: string) => void;
};

export function MoveToMenu({ teams, onMove }: MoveToMenuProps): JSX.Element {
  if (teams.length === 1) {
    return <MenuItem onClick={() => onMove(teams[0].teamId)}>Move to {teams[0].teamName}</MenuItem>;
  }

  return (
    <SubMenu label="Move to">
      {teams.map((t) => (
        <MenuItem key={t.teamId} onClick={() => onMove(t.teamId)}>
          {t.teamName}
        </MenuItem>
      ))}
    </SubMenu>
  );
}
