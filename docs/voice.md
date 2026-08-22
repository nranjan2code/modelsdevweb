# Model Pulse — Voice & Tone Guide

How Model Pulse sounds. `docs/brand.md` covers how we look. Both are binding:
copy that breaks these rules is a bug, same as a broken token.

---

## 1. Voice in one line

**A sharp market analyst who happens to be fun at parties.**

We report the AI market like a tape: precise, current, unbothered. We have
opinions about *prices*, not about *models*. We never hype, never shame, and
never talk down.

Since the front page now makes a claim about the day, one more thing is
binding: **we only say what the data supports, and we say who said it.** A
number a lab published about itself is a claim; a number someone independent
measured is a measurement. The copy never blurs the two.

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
11. **Name who moved.** A lab repricing its own model and a gateway changing
    its markup are different events and never share a sentence. Say "the lab"
    or name the reseller; never let "price hike" stand alone when a gateway did
    it.
    - "OpenAI cut input pricing from $5 to $2 per million tokens."
    - "Kilo Gateway raised its DeepSeek V4 markup by 214%. The lab has not moved."
12. **Attribute every score.** Benchmark numbers carry `Self-reported` or
    `Independent`. Never rank a self-reported score against a measured one, and
    say so where the ranking appears: "30 independently measured scores · 29
    self-reported excluded".
13. **Thin data gets a date, not a shrug.** When a view needs more history than
    exists, say what is missing and when it arrives. Never render a flat line,
    a 0.0% delta, or an empty chart to fill the slot.
    - "The index needs 12 more days of tape before a trend line means anything
      — it starts publishing September 3."
14. **Show the rule behind a judgment.** Anything that ranks, picks or leads
    states the rule that chose it, in lowercase, near the claim: "selected by:
    largest first-party price cut, last 7 days". If a rule cannot be written in
    one line, it is not ready to ship.

## 3. Tone by surface

| Surface | Register | Example |
|---|---|---|
| Hero | Confident, declarative | "What the AI model market did today." |
| The lede — headline | One claim, present tense, no hedging | "DeepSeek V4 Flash Vision Exp is out" · "GPT-5.6 Sol is 60% cheaper" |
| The lede — body | Two sentences: what happened, why it matters to a buyer | "DeepSeek shipped it with a 1.05M-token context window, and 9 providers already list it at $0.14/$0.28 per million." |
| Rule disclosure | Lowercase, mono, unglamorous | "selected by: first-party launch within 3 days" |
| Section heads | Short, concrete, slightly wry | "Who moved the price", "Same model, different price", "What a dollar buys" |
| Board subtitles | State the basis before the numbers | "First-party repricing — the model itself got cheaper or dearer." |
| Provenance labels | Flat, non-judgmental | "Self-reported" / "Independent" — never "unverified", never "marketing" |
| Body explanations | Plain, one idea per sentence | "Numbers a lab published about its own model are claims, not measurements." |
| Warnings / disclaimers | Direct, protective | "Verify with the provider before purchasing." |
| Errors / empty / pending | Calm, forward-pointing, dated | see rules 7 and 13 |
| Footer | Quiet, factual | "© 2026 Model Pulse · data updated Aug 22, 2026" |

**The quiet day is a real headline.** When nothing qualifies, the lede says so
plainly and reports what *is* true. It never reaches for a lesser story to
avoid looking empty.

> "No lab moved its prices this week. The tape logged 37 changes, all of them
> resellers adjusting listings rather than labs repricing models."

## 4. Words we use / words we don't

Use: model, group, lab, provider, listing, blended price, per million (/M),
context window, open weights, snapshot, sync, diff, changelog, tape, movers,
frontier, first-party, the street, gateway, reseller, markup, spread,
self-reported, independently measured, tracked model, archive.

Say "the street" or "gateways" for resellers in aggregate; name the specific
one when a single venue moved. "Tracked models" means lab-attributed — say it
whenever a count could otherwise be read as the whole catalog.

Avoid: AI solution, cutting-edge, revolutionary, unleash, game-changing,
seamless, robust, leverage (as a verb), ecosystem (unless literally about
provider ecosystems), "state of the art" (say the benchmark instead). Also
avoid "verified" for benchmark scores (we did not verify them — someone
independent measured them), and "best" without a stated basis.

## 5. Formatting contract

Same as brand §7, restated as voice: prices via `fmtPerM`, deltas signed with
arrow, tokens via `fmtTokens`, dates `Aug 22, 2026`, relative time `3h ago`,
missing = `—`. If you're typing a formatted value by hand, stop — use the
formatter so every page agrees.

## 6. When in doubt

Read it aloud. If it sounds like a press release, cut the adjectives until
only facts remain. If it sounds like a robot, add exactly one human clause —
then stop.
