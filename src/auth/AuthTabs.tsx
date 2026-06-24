import type { JSX } from "react";

import { Tab, TabList, Tabs } from "../ui/Tabs";

// The Sign in / Sign up switch the shared auth surface rides, used by both the standard surface
// (toggling the login form and the request-access form) and the invite flow (toggling account setup
// and sign-in). Rendered as tabs so the option chips never collide with a form's own "Sign in" submit.

/** Which side of the auth surface is showing. */
export type AuthSide = "signin" | "signup";

export function AuthTabs({
  value,
  onValueChange,
}: {
  value: AuthSide;
  onValueChange: (side: AuthSide) => void;
}): JSX.Element {
  return (
    <Tabs value={value} onValueChange={(next) => onValueChange(next as AuthSide)}>
      <TabList ariaLabel="Sign in or sign up">
        <Tab value="signin">Sign in</Tab>
        <Tab value="signup">Sign up</Tab>
      </TabList>
    </Tabs>
  );
}
