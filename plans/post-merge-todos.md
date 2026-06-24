# Post-merge to-dos

This file lists what to do after the merge.

## Password reset

After `request-password-reset` has deployed to production:

- **Happy path.** On the live app, use "Forgot password?", request a link for a real account, click the email link, and confirm it lands on the recovery screen and that the new password signs you in and works on a later sign-in.
- **Oracle-safety.** Request a reset for an address with no account. Confirm the UI shows the same neutral confirmation and that no email is sent. The miss is visible only as a server-side `console.error` line in the `request-password-reset` function logs, never as a different HTTP response.
