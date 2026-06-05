# Security Policy

## Supported versions

Funny Stories is a young project. Security fixes land on `master` and in the
latest release. Please run the most recent version before reporting — older
deploys are not separately patched.

| Version | Supported |
|---|---|
| Latest release / `master` | ✅ |
| Older releases | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub's **"Report a vulnerability"** button on this
repository's **Security** tab, or directly at:

<https://github.com/oursharedcode/funny-stories/security/advisories/new>

This opens a private advisory visible only to you and the maintainers. We'll
acknowledge the report, work with you on a fix, and credit you in the published
advisory unless you'd prefer to remain anonymous.

If you can't use the GitHub flow, open a normal issue containing only the words
"I'd like to report a security issue privately" — with **no details** — and we'll
arrange a private channel.

## In scope

Things worth reporting:

- Reading another room's data, or otherwise crossing the boundary between rooms.
- Escalating to host — gaining host powers you were not granted.
- Cheaply exhausting the Cloudflare Worker neuron / daily image budget.
- Crashing or hanging the Node server (DoS) with a single message or a small
  number of messages.

## Out of scope

- Rate-limit edge cases on a deliberately abusive client.
- Social-engineering nicknames or display names.
- The game being "too silly."
- Content an operator's players choose to generate — in-deployment moderation is
  the operator's responsibility (see the README and `docs/CONTRIBUTING.md`).

## A note for self-hosters

Funny Stories is self-hosted: each operator runs it on their own Cloudflare and
Render accounts. Keep your deployment's secrets (the Cloudflare Worker auth
header and any API keys) out of source control, and keep dependencies current.

---

Thank you for helping keep Funny Stories and the people who deploy it safe.
