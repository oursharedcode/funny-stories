# Contributing to Funny Stories

Thanks for considering it. This is a small, opinionated project and contributions are welcome within those opinions.

---

## Before you open a PR

1. **Read the spec.** [`FUNNY_STORIES_SPEC_v4.md`](./FUNNY_STORIES_SPEC_v4.md) is binding. If your change contradicts it, the spec wins or the spec changes — not the code silently.
2. **Read the design system.** [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) is binding for visuals and motion.
3. **One feature per PR.** Bundled PRs get sent back.
4. **Open an issue first for anything bigger than a one-file change.** Saves both of us the rework.

---

## Local setup

```bash
git clone https://github.com/oursharedcode/funny-stories.git
cd funny-stories
npm install
cp .env.example .env       # fill in the Cloudflare Worker vars if you want image generation
npm run dev
```

Requires Node 20+ and npm. Don't use a different package manager — the lockfile and workspaces config assume npm.

---

## Checks that must pass

Before pushing, run all four. CI runs the same checks on every PR.

```bash
npm run typecheck   # tsc --noEmit, all workspaces
npm run lint        # ESLint, strict
npm run format      # Prettier (write); CI runs --check
npm run test        # Vitest, all workspaces
```

If any check fails, fix it before opening the PR. We don't merge red branches.

### Test discipline

- New behaviour comes with new tests. New rotation, scoring, or filter logic comes with tests written **before** the code.
- The rotation formula (`server/src/game.ts`) has exhaustive coverage and is the canonical example of what good test density looks like in this repo. New game-logic code should match that density.
- UI behaviour is tested via component tests against the rendered DOM, not via screenshot diffs. Snapshot tests are fine for stable static markup; don't use them for anything animated.

---

## Code style

- TypeScript strict mode. No `any` without a `// eslint-disable-next-line` and a comment justifying it.
- Prettier defaults, 100-char line width. Don't argue with the formatter — it doesn't argue back.
- Files are kebab-case. React components are PascalCase. Hooks are `useCamelCase`.
- Comments explain *why*, not *what*. The code already says what.
- One default export per file for React components; named exports otherwise.

### What not to add

A short, non-exhaustive list. The full list is in [`FUNNY_STORIES_SPEC_v4.md` §18](./FUNNY_STORIES_SPEC_v4.md#18-things-not-to-do).

- A database, an ORM, Redis, any persistence layer.
- A reconnect mechanism. Disconnect = bot is a feature.
- Sound, video, Lottie, Rive, or WebGL.
- Auto-translation of player answers.
- A regenerate-picture button.
- Hardcoded donation, payment, or sponsor URLs in the client. The end-screen donation button is operator-controlled via `DEPLOYER_DONATE_URL` — see the spec.
- A second package manager. Stick with npm.
- A second display font. Stick with Fredoka + Georgia + the system stack.

If you think one of these is justified, open an issue first. Sometimes the answer is yes. Usually it isn't.

---

## Translations

The project is multilingual from v1. Adding a language is welcome.

### Adding a new language

The full, current checklist — every file to touch, what's optional, and the gotchas — lives in [LANGUAGES.md → Adding a new language](./LANGUAGES.md#adding-a-new-language). That guide is the single source of truth; this section deliberately doesn't duplicate the file list so the two can't drift.

### Russian-string review

The implementer (Claude or a human) drafts Russian strings during initial build and writes them naturally — not as slot-for-slot ports of English. Any PR that adds or changes Russian strings gets the `needs-ru-review` label and waits for a native-speaker review before merge. If you are a native Russian speaker, reviews are welcome — open an issue labelled `ru-review-volunteer` and we'll route requests to you.

### Russian template note

The Russian prose template in `server/src/i18n/ru.json` intentionally puts slot 3 (when) before slot 2 (where) and uses "В итоге" as the connective. This is correct Russian word order. **Do not "fix" it back to slot order** during translation review or refactor — the spec ([§9](./FUNNY_STORIES_SPEC_v4.md)) calls this out specifically.

---

## Mascot and design changes

The nine mascot SVGs in `client/src/components/art/` are implementer-drafted and flagged for design review **post-launch**. PRs that polish, improve, or replace them are welcome — but:

- The personality rules in [`DESIGN_SYSTEM.md` §5](./DESIGN_SYSTEM.md) (exaggerated eyes, visible outlines, hand-drawn imperfection, no gradients) are binding.
- The motion presets in [`DESIGN_SYSTEM.md` §4](./DESIGN_SYSTEM.md) (`snappy` / `goofy` / `panic`) are the only springs in use. Don't introduce a fourth without a written justification.
- Reduced-motion fallbacks must be honoured in any new animation.

---

## Commit messages

Conventional Commits, loosely:

```
feat: add German translation
fix: timer character no longer shakes when reduced-motion is set
docs: clarify Cloudflare Worker secret setup
test: add coverage for storyIndex at N=2
chore: bump vitest to 2.1
```

Body is optional. If the change is non-obvious, write a paragraph explaining why. If it's obvious, don't.

---

## Sign your commits (DCO)

This project uses the [Developer Certificate of Origin](https://developercertificate.org/) (DCO). It's lightweight and there is no CLA to sign — you simply certify that you wrote the change, or otherwise have the right to submit it under AGPL-3.0.

Add a sign-off to every commit with the `-s` flag:

```bash
git commit -s -m "docs: clarify Cloudflare Worker setup"
```

This appends a trailer to your commit message using your configured `git config user.name` and `user.email`, so set those once before you start:

```
Signed-off-by: Your Name <your@email.com>
```

If you forget, amend the last commit with `git commit --amend -s`, or for several commits rebase with `git rebase --signoff <base>`. Please make sure every commit in your PR is signed off — unsigned commits will be asked to amend before merge.

---

## Reporting bugs

Open an issue. Useful issues include:

- What you did, what you expected, what happened.
- Phone or browser (real device matters — "Safari on Mac" is not the same as "Safari on iPhone").
- Whether you can reproduce it from a fresh game, or only sometimes.
- Console errors if any (open DevTools, copy the red).

Reports of "the AI made an inappropriate cartoon" should also include the room language and the room code if you still have it — though without persistence we can't reconstruct the prompt, so the most useful detail is *the answers in the story*. Submit those and we can reproduce.

---

## Reporting security issues

Don't open a public issue. Follow the process in [`SECURITY.md`](../SECURITY.md) — report privately through GitHub's "Report a vulnerability" flow on the repo's **Security** tab.

In-scope: anything that lets a player read another room's data, escalate to host, exhaust the Worker neuron budget cheaply, or DoS the Node process with a single message. Out of scope: rate-limit edge cases on a deliberately abusive client, social-engineering nicknames, the game being "too silly."

---

## License

By contributing, you agree your contribution is licensed under [AGPL-3.0](../LICENSE), the project's license. There is no CLA — we use a lightweight DCO sign-off instead (see [Sign your commits (DCO)](#sign-your-commits-dco)).

---

## Thanks

For real. This is a small project that hopes to make someone's car trip slightly more bearable. Every PR that helps it work on one more phone, in one more language, for one more group of friends is appreciated.
