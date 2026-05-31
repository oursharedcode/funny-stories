# Funny Stories

A party game where 3–7 friends, on their phones, answer 7 silly questions about a shared story they can't see — then watch an AI cartoon goof of the result. English and Russian from day one. No accounts, no database, no analytics. Self-hostable for free.

[![Build](https://img.shields.io/github/actions/workflow/status/oursharedcode/funny-stories/ci.yml?branch=master)](https://github.com/oursharedcode/funny-stories/actions)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](./LICENSE)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/oursharedcode?label=sponsor)](https://github.com/sponsors/oursharedcode)
[![Stars](https://img.shields.io/github/stars/oursharedcode/funny-stories?style=social)](https://github.com/oursharedcode/funny-stories/stargazers)

## How it plays

One person taps **Create room**, picks a language, and shares a 6-character code or QR. Friends join, pick nicknames, and the host taps **Start**. Everyone answers one of seven questions — *Who? With whom? Where? When? What did they do? What for? What was at the end?* — and the story rotates each round, so you never see the answers in your own story. After seven rounds your phone shows the story you helped write, and **Generate picture** turns it into a goofy cartoon. Disconnect mid-game and you become a bot; no reconnect, no abandoned rooms.

## Deploy your own (free, ~5 minutes)

You deploy onto **your own** Cloudflare + Render accounts — both free, no credit card. The author hosts nothing. Two buttons, in order; carry two values between them.

**1. Make a shared secret S** (32+ chars). Pick the line for your machine:

```bash
openssl rand -hex 32                                                # macOS / Linux / Git Bash
```
```powershell
[guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")   # Windows PowerShell
```

**2. Deploy the image Worker (Cloudflare).**

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/oursharedcode/funny-stories/tree/master/cloudflare)

After it deploys, set `WORKER_SECRET = S` in the Worker's **Settings → Variables** (the button can't do this — until you do, it returns 403). Copy the Worker URL it gives you.

**3. Deploy the game server (Render).**

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/oursharedcode/funny-stories)

When Render prompts for environment variables, paste:

| Variable | Value |
|---|---|
| `CLOUDFLARE_WORKER_URL` | the Worker URL from step 2 |
| `CLOUDFLARE_WORKER_SECRET` | **S** (the *same* string) |

First build takes ~3 minutes. Open your `.onrender.com` URL on a phone and play.

> **If "Generate picture" fails on every phone,** the two secrets don't match — re-check steps 2 and 3. The free Render tier also sleeps when idle, so the first visit after a quiet period is slow.

## Documentation

| Guide | What's in it |
|---|---|
| [handbook/DEPLOYMENT.md](./handbook/DEPLOYMENT.md) | Full deploy reference — Render details, Docker self-hosting, the Cloudflare Worker, optional KV, and the silent-failure gotchas. |
| [handbook/DEVELOPMENT.md](./handbook/DEVELOPMENT.md) | Local dev, toolchain, npm scripts, project layout, tests, known limitations. |
| [handbook/LANGUAGES.md](./handbook/LANGUAGES.md) | Adding a language; how image prompts are translated to English. |
| [handbook/MODERATION.md](./handbook/MODERATION.md) | Content moderation, operator responsibility, known visual artefacts. |
| [handbook/CUSTOMIZATION.md](./handbook/CUSTOMIZATION.md) | Logo stamp, rebranding a fork, screenshot guidance. |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to work on the project. |

## License

[AGPL-3.0](./LICENSE). If you deploy a modified version on a network service, you must offer the source of your modifications to the users of that service. Want different terms? Open an issue and we can talk.
