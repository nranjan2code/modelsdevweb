# Model Pulse — Voice & Tone Guide

How Model Pulse sounds. `docs/brand.md` covers how we look. Both are binding:
copy that breaks these rules is a bug, same as a broken token.

---

## 1. Voice in one line

**A sharp market analyst who happens to be fun at parties.**

We report the AI market like a tape: precise, current, unbothered. We have
opinions about *prices*, not about *models*. We never hype, never shame, and
never talk down.

Three traits, always on:

| Trait | Means | Sounds like |
|---|---|---|
| **Precise** | Numbers first, adjectives last. Every claim is checkable against our data. | "Median blended /M fell 4.2% in 7 days." |
| **Dry-witty, not jokey** | One knowing aside per view, max. Deadpan, never slapstick. | "The tape is quiet." |
| **Honest broker** | We show the dash when data is missing and say what it means. No spin. | "— means unlisted, not free." |

## 2. The rules

1. **Sentence case everything.** Headings, buttons, nav, eyebrows — sentence
   case. Never Title Case, never ALL CAPS (`.mono-label` uppercases via CSS;
   you still type it lowercase).
2. **Numbers are nouns.** Lead with the number, keep the unit tight: `$1.25/M`,
   `▼ 4.2%`, `200K context`. No "approximately", no "around" — we track exact
   diffs or we say nothing.
3. **Verbs of the market.** Use the house verbs consistently:

   | Say | Not |
   |---|---|
   | cut, price cut, repriced (down) | discount, slash, crash, cheaper-ized |
   | hike, price hike, repriced (up) | increase, surge, gouge |
   | sunset, deprecation | kill, EOL'd, discontinued (in UI copy) |
   | launch, new model | drop, land, ship (ok in news headlines we quote) |
   | listing, provider | vendor, seller, API guy |

4. **Arrows carry direction.** ▼ cheaper, ▲ pricier — always paired with a
   signed number, never naked.
5. **Em dashes for absence.** Missing data is `—` in tables and stats. In
   prose, explain it once per page if needed ("a dash means unlisted, not
   free").
6. **Links end in →** (internal) or **↗** (external). Labels are 2–5 words:
   "Full changelog", "Browse all", "Board ↗". Never "Click here", never
   "Check out our…".
7. **Empty states reassure + point.** Two parts: what's true, where to look.
   Never apologize, never blame the data source.
   - "No input-price cuts this week — the tape is quiet."
   - "Catalog is stable — no new releases this cycle."
8. **One exclamation mark per… none.** There are zero exclamation marks in
   this product. That's the rule.
9. **No emoji in UI chrome.** Exception: medal glyphs 🥇🥈🥉 on benchmark boards,
   nowhere else. Arrows (→ ↗), deltas (▼▲), and ✓ are punctuation, not emoji.
10. **Credit data, always.** models.dev gets its link; external signals get
    their attribution line. First-person plural is fine ("we track"), but the
    site itself is the speaker — avoid "I".

## 3. Tone by surface

| Surface | Register | Example |
|---|---|---|
| Hero | Confident, declarative | "Every AI model. Every provider. Every change." |
| Market briefing labels | Terminal-neutral | "Frontier price index", "Steepest move · 7 days" |
| Section heads | Short, concrete, slightly wry | "The tape", "Lab scoreboards", "Record watch" |
| Body explanations | Plain, one idea per sentence | "Weighted blend of HF downloads, likes, trending score, GitHub stars/forks…" |
| Warnings / disclaimers | Direct, protective | "Verify with the provider before purchasing." |
| Errors / empty | Calm, forward-pointing | see rule 7 |
| Footer | Quiet, factual | "© 2026 Model Pulse · data updated Aug 22, 2026" |

## 4. Words we use / words we don't

Use: model, group, lab, provider, listing, blended price, per million (/M),
context window, open weights, snapshot, sync, diff, changelog, tape, movers,
frontier.

Avoid: AI solution, cutting-edge, revolutionary, unleash, game-changing,
seamless, robust, leverage (as a verb), ecosystem (unless literally about
provider ecosystems), "state of the art" (say the benchmark instead).

## 5. Formatting contract

Same as brand §7, restated as voice: prices via `fmtPerM`, deltas signed with
arrow, tokens via `fmtTokens`, dates `Aug 22, 2026`, relative time `3h ago`,
missing = `—`. If you're typing a formatted value by hand, stop — use the
formatter so every page agrees.

## 6. When in doubt

Read it aloud. If it sounds like a press release, cut the adjectives until
only facts remain. If it sounds like a robot, add exactly one human clause —
then stop.
