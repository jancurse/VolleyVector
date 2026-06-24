// The single source of the user-facing Terms & Privacy notice, rendered by `LegalView` and linked from
// the login screen, the account menu, and the signup acceptance checkboxes. Plain English, kept
// proportionate to a free, non-commercial app for a small invited group. Prose lines are not wrapped to a
// width (markdown soft-wraps), so a sentence stays on one line.

export const LEGAL_UPDATED = "23 June 2026";

// The version recorded against an account when it accepts. Bump this (a sortable date) whenever the
// notice below changes materially, so a record reflects which text was agreed to.
export const LEGAL_VERSION = "2026-06-23";

export const LEGAL_MARKDOWN = `# Terms & Privacy

_Last updated ${LEGAL_UPDATED}._

VolleyVector is a free, non-commercial app run by an individual for a small, invited group of users. There is no company behind it and no charge for using it. By creating an account or using the app you agree to the terms below. If you do not agree, please do not use it.

## Use at your own risk

- The app is provided **"as is"**, with no warranty of any kind, express or implied.
- There is no guarantee that it will stay available, that it will work without faults, or that your data will be preserved. Content can be lost, corrupted, or deleted, including by mistake.
- **Do not store anything here that you could not afford to lose.** Keep your own copies of anything important.
- To the fullest extent allowed by law, the operator is not liable for any loss or damage arising from your use of the app.

## What data is stored

When you use VolleyVector, the following is stored:

- Your **email address**, used only to sign you in and to send account and invite emails. It is never shown to other users and never used for marketing.
- Your **display name**, which is shown on the boards, notes, and teams you share with others.
- The **content you create** — boards, notes, teams, tags, and their edit history.

There is no advertising, no analytics, and no tracking. Your data is never sold, and it is never shared with anyone except the infrastructure providers below.

## Who can see your data

- Other members of a team see the content shared with that team, and anyone you share a board or note with directly sees it at the level you grant.
- An **administrator can technically read all content, including boards and notes in your private personal space.** This is a deliberate trade-off for a small, trusted group and is not how a larger service should work. Do not treat your personal space as private from the administrator.

## Where your data is stored

The app relies on two third-party providers, which process and store your data on their infrastructure:

- **[Supabase](https://supabase.com)** hosts the database and handles sign-in.
- **[Cloudflare](https://www.cloudflare.com)** serves the app.

Your data may be stored or processed on their systems, which may be located outside the UK.

## Your choices

- You can edit or delete your boards and notes at any time, and delete your account from the Account settings page.
- Deleted content and accounts are kept for about three months so they can be recovered if removed by mistake, then permanently purged.
- To ask what data is held about you, or to have it removed, email the address below.

## Acceptable use

Do not use the app to store or share unlawful content, and do not misuse the service or disrupt other users.

## Changes

These terms may change over time. Continued use of the app after a change means you accept the updated terms.

## Contact

Questions about these terms or your data: **privacy@volleyvector.app**.

These terms are governed by the laws of England and Wales.
`;
