---
target: homepage
total_score: 23
p0_count: 0
p1_count: 3
timestamp: 2026-08-28T09-08-22Z
slug: src-app-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 2/4 | The hero says “Live” although the site is a static export; pipeline freshness and coverage depth are deferred to `/status`. |
| 2 | Match system / real world | 3/4 | Market language is credible, but “basis,” “instruments,” and “tracked” assume domain fluency. |
| 3 | User control and freedom | 2/4 | Users cannot narrow or prioritize the many homepage boards and must scroll through the editorial sequence. |
| 4 | Consistency and standards | 3/4 | Shared primitives are strong; external news links omit the expected `↗` affordance. |
| 5 | Error prevention | 2/4 | Backend safeguards are strong, but homepage figures do not consistently expose their workload assumptions. |
| 6 | Recognition rather than recall | 3/4 | Destination labels help, but nine board choices make the distinctions hard to learn at a glance. |
| 7 | Flexibility and efficiency | 2/4 | Search and `/` are useful, but common buyer tasks lack quick routes and the shortcut hint disappears on smaller screens. |
| 8 | Aesthetic and minimalist design | 2/4 | Individual pieces are restrained; the complete page is dense and repetitive. |
| 9 | Error recovery | 2/4 | Empty states are calm, but stale or incomplete enrichment is not surfaced on the homepage. |
| 10 | Help and documentation | 2/4 | Methodology exists downstream, while key terms and assumptions arrive after the reader needs them. |
| **Total** |  | **23/40** | **Capable foundation; hierarchy and progressive disclosure need another editorial pass.** |

## Anti-patterns verdict

The page does not look generically AI-generated. Its daylight market-desk register, IBM Plex typography, semantic palette, specific copy, and lack of decorative effects are distinctive and disciplined.

The main residual risk is structural: up to nine similarly shaped `DeckCard` components repeat the same eyebrow, title, blurb, ranked list, and CTA grammar. That makes the homepage feel algorithmically assembled rather than editorially selected.

Deterministic detector result: zero findings from `src/app/page.tsx`, `src/components`, and `src/app/globals.css`. No false positives were identified.

## Overall impression

The homepage has a credible voice and a strong design-system foundation, but it currently behaves like a complete catalog of homepage ideas rather than a front page with ruthless selection. The clearest sequence should be: what changed, what evidence proves it, and what should I investigate next.

The implementation currently renders Lead, Ecosystem watch, Boards, Wire, Gap, Three answers, and Subscribe. This conflicts with the documented hierarchy, where the wire and price gap should precede the broader board deck.

## What's working

- The hero has a clear editorial contract: story, timestamp, selection rule, one primary CTA, and a market rail (`src/app/page.tsx:95-120`).
- First-party versus reseller movement is legible through separate sections, labels, and tones (`src/app/page.tsx:282-306`).
- The copy has a distinctive point of view, especially “Same weights. Wildly different bill.” and “A floor, never a recommendation.”

## Priority issues

### [P1] The editorial hierarchy is implemented in the wrong order

Location: `src/app/page.tsx:743-746`, `src/app/page.tsx:748-915`.

Ecosystem watch and the full board deck appear before the wire and price gap, burying the current story and strongest differentiated evidence under evergreen analysis. Render Wire immediately after Lead, then TheGap, then a smaller board deck; move ecosystem watch into the deck or below the decision tools. Suggested command: `$impeccable layout homepage`.

### [P1] Nine identical cards create cognitive overload

Location: `src/app/page.tsx:344-385`, `src/app/page.tsx:748-910`.

Up to nine equal-weight analytical destinations communicate that every cut matters equally and make the page feel schema-generated. Keep three or four editorially selected boards above the fold, move the remainder to their owning routes, or use a deliberate “more cuts” disclosure. Suggested command: `$impeccable distill homepage boards`.

### [P1] Important price figures do not consistently name their workload

Location: `src/app/page.tsx:420-456`, `src/app/page.tsx:694-710`.

The gap and cheapest-1M-context figures use the default chat workload without naming it, so buyers can compare them incorrectly with calculator results using RAG, agentic, or long-context profiles. Add a compact “chat workload” basis label beside affected sections and link to the calculator methodology. Suggested command: `$impeccable clarify homepage pricing basis`.

### [P2] The market rail has too many equal-weight destinations

Location: `src/app/page.tsx:123-151`, `src/app/page.tsx:694-741`.

Six rows compete with the lede and turn the rail into a second dashboard. Keep three high-signal rows above the fold and move the rest to a secondary market map or board index. Suggested command: `$impeccable distill homepage rail`.

### [P2] Discovery is strong for experts but weak for first-time orientation

Location: `src/app/layout.tsx:73-90`, `src/components/model-search.tsx:160-176`.

On smaller screens the search trigger becomes icon-only, while the horizontal navigation uses domain terms without an orientation layer. Preserve the visible “Search models” label on mobile and add three task-oriented routes: compare providers, price a workload, and evaluate self-hosting. Suggested command: `$impeccable clarify homepage orientation`.

## Cognitive-load assessment

Intrinsic load is high and appropriate: model identity, units, workload profiles, providers, provenance, and retirement states are genuinely complex.

Extraneous load is too high because of six hero rail decisions, ecosystem content before the current story, nine repeated boards, repeated metadata, and deferred explanations. Germane load is good—the page teaches lab versus street, unlisted versus free, and floor versus recommendation—but those lessons are distributed across too many modules. Visible decision points exceed four in the hero and board deck; stronger progressive disclosure is needed.

## Emotional journey

Trust begins well with the dated data stamp and selection rule. The lede creates a useful first peak. The ecosystem module and large board deck then create a valley before the reader sees the evidence behind the story. The price gap is a strong second peak but appears too late. The three answers are useful but arrive after substantial scroll depth. The subscription block is sensible, though “Almost none of them matter” slightly weakens the final value impression.

## Persona red flags

### Alex — power user / infrastructure engineer

The homepage makes Alex scroll through editorial content before common tasks. The `/` shortcut is hidden below large-screen breakpoints, and price figures require recalling or verifying their workload basis. Nine boards create scan fatigue instead of fast routing.

### Jordan — first-timer

Jordan encounters “wire,” “basis,” “first-party,” “instruments,” and “tracked” without a simple first action. The mobile search trigger can appear as an unlabeled icon-only control, and “The boards” does not explain which board answers which question.

### Morgan — technical buyer / procurement

Morgan sees prices, scores, provider counts, hosting floors, and market signals with similar visual status. “Cheapest 1M context” can be mistaken for generally cheapest without the workload basis. The hero date helps, but coverage depth and enrichment freshness are not adjacent to claims.

## Minor observations

- External news links open in a new tab but do not visibly end in `↗` (`src/app/page.tsx:183-188`).
- The `selected by` rule is useful evidence but can read like debug metadata next to the Live pill (`src/app/page.tsx:98-105`).
- The ecosystem score is shown as `/100` without an inline methodology cue (`src/app/page.tsx:556-568`).
- The subscription line “Almost none of them matter” is witty but slightly adversarial at the conversion moment (`src/components/subscribe.tsx:23-34`).
- The long homepage has no visible skip-to-section mechanism beyond the global skip-to-content link.

## Questions to consider

- What if the homepage exposed only three decisive analytical cuts and sent the rest to their owning routes?
- Is “The ecosystem watch” truly part of today’s market desk, or is it stealing the front-page position from the tape?
- Should every homepage price show its workload basis directly, even at the cost of a little more metadata?
- Can a first-time visitor tell what to do in the first 10 seconds without knowing “basis,” “tracked,” or “instrument”?
