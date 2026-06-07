import { useState } from "react";
import type { JSX } from "react";

import { Button } from "../ui/Button";
import { Menu, MenuItem } from "../ui/Menu";
import type { TeamMembership } from "../workspace/useWorkspace";

// A coach's "add this shared board to a team library" action (a deep copy). One coached team renders a
// direct button; several render a menu to pick the team. Confirms (or surfaces an error) beside it.
type PromoteToTeamMenuProps = {
  teams: readonly TeamMembership[];
  onPromote: (teamId: string) => Promise<{ error: string | null }>;
};

export function PromoteToTeamMenu({ teams, onPromote }: PromoteToTeamMenuProps): JSX.Element {
  const [status, setStatus] = useState<string | null>(null);

  const run = async (teamId: string, name: string) => {
    setStatus(null);

    const { error } = await onPromote(teamId);

    setStatus(error ?? `Added to ${name}`);
  };

  const trigger =
    teams.length === 1 ? (
      <Button variant="ghost" onClick={() => void run(teams[0].teamId, teams[0].teamName)}>
        Add to {teams[0].teamName}
      </Button>
    ) : (
      <Menu trigger={<Button variant="ghost">Add to team library</Button>}>
        {teams.map((t) => (
          <MenuItem key={t.teamId} onClick={() => void run(t.teamId, t.teamName)}>
            {t.teamName}
          </MenuItem>
        ))}
      </Menu>
    );

  return (
    <div className="flex items-center gap-2">
      {trigger}
      {status && <span className="text-sm text-text-dim">{status}</span>}
    </div>
  );
}
