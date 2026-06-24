# Post-merge to-dos

This file lists what to verify against production after the merge deploys. None of it can be exercised on the local Supabase stack: the local stack has no Resend (so no real email is sent), no production function secrets, and no production auth redirect allow-list. Everything else in this PR is covered by `npm run test` and `npm run test:rls`.

## Production config

Both are expected to be set already (shared with `send-invite`), so confirm rather than create:

- **`RESEND_API_KEY` is set** as a function secret, so `request-password-reset` and `send-invite` can send.
- **`https://volleyvector.app` is in Supabase Auth's redirect allow-list**, so the password-recovery link resolves back to the app.

## Password reset

After `request-password-reset` has deployed to production:

- **Happy path.** On the live app, use "Forgot password?", request a link for a real account, click the email link, and confirm it lands on the recovery screen and that the new password signs you in and works on a later sign-in.
- **Oracle-safety.** Request a reset for an address with no account. Confirm the UI shows the same neutral confirmation and that no email is sent. The miss is visible only as a server-side `console.error` line in the `request-password-reset` function logs, never as a different HTTP response.

## Team-less email invite

The send-invite change lets an email invite carry no team, and email delivery is the part the local stack can't exercise:

- **Happy path.** On the live app, send an email invite with no team selected. Confirm the email arrives naming VolleyVector only (no team or role), the `#/invite/<token>` link opens the accept screen, and redeeming onboards the recipient into their personal space alone, with no team membership.
- **Regression.** Send an email invite for a team as before, and confirm it still names the team and role and adds the membership on redeem.
