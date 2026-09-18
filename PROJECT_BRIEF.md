# Stardust DS — Project Brief

This is a brief for another Claude conversation to get up to speed on Stardust DS, so Sage (the CEO, real name Jeremy Wolff, pen name Sage Peace) can brainstorm with you directly. Read this fully before responding — it's the accumulated design from a long planning conversation with another Claude instance acting as CTO.

*Naming note:* "Sage AI" below is the platform's AI layer (built on Claude) — not to be confused with "Sage Peace," Jeremy's own pen name, or "Sage" as a nickname for Jeremy himself. All three appear in this document; watch the context.

## The one-sentence pitch

Stardust DS is a universal, self-describing dictionary system — every kind of information (a word, a person, a business, a note, a plan) is represented the same way, as a **Term** with one or more **Definitions**, searchable and actionable through an AI command bar called **Sage AI**.

## Why it could be big

The moat isn't any single dictionary's content — it's the protocol: one addressing scheme (unique term names), one trust/ranking system (labels + thumbs, with an optional per-dictionary position score on top), and one AI interface that understands the vocabulary of whatever dictionaries a user has turned on. It's pitched as a potential billion-dollar business: a search-and-interaction layer over all human-created meaning, positioned to streamline how people, businesses, and agencies find each other, share information, and transact.

## Core data model

- **Term** — a word or phrase. "Word" just means a term that happens to be one word. Term names are globally unique.
- **Definition** — one dictionary's stated meaning for a term. A term can have multiple definitions (one per dictionary that defines it).
- **Dictionary** — a named, addressable collection of term definitions. Kinds: `core` (permanent, always on, can never be turned off), `stardust` (on by default, toggleable), `topical`/community, `user` (one auto-created per person, holds personal contact info), `business` (one per organization, has a single owner linked to a User Dictionary).
- **No special-cased structured fields, ever.** A phone number is not a schema column — it's just a Definition whose body matches a recognizable pattern. Core defines "Phone Number" as its own noun-term; the verb "Call" states in its own definition that it requires a Phone Number. Everything is data-driven and self-describing, never hardcoded per content type. This was an explicit, hard-won design correction — don't reintroduce structured fields for anything (email, address, etc.) even if it seems more "reliable."
- **A user's active collection can only have one live meaning per term.** If two of a user's turned-on dictionaries define the same term differently, that's a **Conflict**, resolved by the **Choose** verb.
- **Domain + Verb naming convention.** Verbs stay broad and generic, like real dictionary definitions (e.g. "Add" = to increase, "Edit" = to modify). Specificity comes from pairing a verb with a domain: `Dictionary Add`, `Dictionary Search`, `User Dictionary Connect`, `User Dictionary Call`. This makes the system extensible — a brand-new domain (Note, Plan, Person, Business) gets existing verbs for free just by supplying the noun-shapes those verbs need.
- **Position score (opt-in, per-dictionary) — formerly "XYZ score."** Every definition *may* carry three optional numbers, 0–100 each: **X = Reality** (how present/alive/sensed something is), **Y = Digital** (how coded/organized/planned it is), **Z = Spiritual** (how much love/soul/oneness it has). These are plain nullable fields on a Definition — not a mandatory Core concept. Core's own generic verbs/nouns ("Add," "Delete," "Phone Number") don't have a meaningful position and simply leave it unset. A dictionary that wants "words as points in a meaning-space" — Stardust is the first example — fills it in for its own definitions. No separate voting/consensus mechanism for v1: whoever can edit a definition can edit its position, same as any other field. (0,0,0) sits at the visual center of the space, not a cube corner — everything radiates outward from "nothing."
- **Labels and Thumbs.** Users label their definitions with searchable tags; the more label hits a term gets against a search, the higher it ranks. Thumbs up/down (net value) also affect ranking, alongside trust labels (Official, Government, Non-Profit) earned via admin approval. Where a dictionary uses position scores, they're an additional optional ranking/filter axis on top of this.
- **Multiple entries can exist about the same subject** without conflicting, because term names are unique strings — e.g. an official business's dictionary entry vs. a differently-named, unofficial background-info entry someone else wrote about that business.

## The three consoles (one screen, one session)

1. **Dictionary Control** — turn dictionaries on/off, search to find and add new ones.
2. **View** — defaults to *Dictionary view* everywhere: read all definitions as a plain list, for one term or a whole dictionary. No default imaging or visualization — Core ships with none. A dictionary may optionally register **one custom View** that replaces the default while the user is browsing that specific dictionary (e.g. Stardust's own spiral/nearness browser over its position-scored terms, Goodnight DS's spiral view, a business dictionary's own programmed visual). The custom View is entirely that dictionary's responsibility to build and interpret; Core just tracks which key is registered and hands off to it.
3. **Command Bar** — where the user talks to **Sage AI**.

## Sage AI

Not a custom-trained model — a thin orchestration layer on the Claude API using tool-use/function-calling. Every currently-active Domain+Verb function (Core plus whatever dictionaries the user has turned on) is registered as a callable tool for that request. Model tiering for cost: Haiku by default for command parsing, escalate to Sonnet for ambiguous/complex reasoning. Trust gating: a dictionary's custom verbs are only *executable* by Sage AI once that dictionary is admin-approved (confirmed decision — dictionaries are added manually by the admin to start, no self-serve approval flow yet).

## Business entities and roles

- **Stardust DS** is its own business.
- **Goodnight DS** is a separate business, built by **Urban Wolf Studio** (a new entity), and is simply the *first* business customer of Stardust DS — not architecturally special. It uploads a Business Dictionary (its own contact info, e.g. owner Jeremy Wolff's personal User Dictionary) and is also, itself, a product: a personal note/memory-profile dictionary template with privacy controls (public/friends/private), that Goodnight DS defines its own custom verbs/nouns for, which merge into Sage AI's vocabulary when a user turns Goodnight DS on. Goodnight DS is also expected to be one of the dictionaries that registers a custom View (its own spiral view) per the mechanism above.
- Sage (Jeremy) is CEO, Claude is CTO — an explicitly two-way partnership, not a pure command-execution relationship.

## Operating principle

Lean, spend-as-needed startup approach, ~$200 initial budget. Priority order: (1) a small reserve for real Claude API spend so Sage AI gets genuinely tested end-to-end, non-negotiable; (2) Supabase and Vercel stay on free tier until an actual limit is hit; (3) no domain purchase yet — ship on free `*.vercel.app` subdomains.

## Stack

Next.js (App Router) + TypeScript on Vercel. Supabase (Postgres + Auth + Storage). Claude API (Anthropic SDK) as Sage AI. GitHub for source control.

## Current build status

This is a from-scratch build, not an extension of any prior prototype.

Done so far:
- New Next.js + TypeScript scaffold, folder renamed `sage-ds` → `stardust-ds`, package name `stardust-ds`, deployed live at `sage-ds.vercel.app` (a fresh Vercel project, not touching the old one) — the Vercel project itself still carries the old name and needs a manual rename/redeploy under the new name when convenient; not done as part of this pass.
- **Project location (2026-08-10):** moved from a standalone `Downloads\stardust-ds\` into `Documents\UrbanWolfStudio\apps\stardust-ds\` — Sage stopped using Downloads for project storage; everything lives under the Urban Wolf Studio folder now, per its own Apps track. Draft content for two other DS-family dictionaries (`Urban_Wolf_Dictionary.md`, `Evolve_Idea_Index_Dictionary.md`) lives alongside it in `dictionaries/`, not yet turned into seed SQL.
- Full Core schema written as a SQL migration: `dictionaries` (now including an optional `custom_view_key` for the per-dictionary View mechanism above), `terms`, `definitions` (now with nullable, opt-in position-score columns instead of mandatory XYZ), `labels`, `definition_labels`, `votes`, `user_collections`, `term_resolutions`, `verb_requirements`, `kind_verbs`, `dictionary_verbs`.
- Seed content written: Core's generic verbs/nouns plus the concrete `Dictionary *` and `User Dictionary *` executable functions (none of these carry position scores — they're generic, not spatial), and a real Stardust dictionary seeded from Sage Peace's existing WACK book content (down-to-earth biological/spiritual definitions of love, fear, attraction, shame, etc.), each with a real, hand-authored position score.

Not done yet / blocked:
- No Supabase project actually exists yet — migrations and seed data are written but not run against a real database. Waiting on Sage to create one and share the URL + anon key.
- No API routes, UI components (beyond a placeholder homepage), or the Sage AI command-bar integration exist yet.
- Console 1 (Dictionary Control) and Console 2 (View, including Stardust's own position-score browser) haven't been started.
- Communication/transaction verbs beyond `Connect`/`Message`/`Share` haven't been designed yet — deferred until the basics work end-to-end.

## Good brainstorming angles for this conversation

- Sharpening the monetization thesis beyond the rough sketch above (transaction fees, paid trust labels, premium hosting, API access).
- Search ranking algorithm design (it's meant to be editable/tunable over time — label match count, net thumbs, text relevance, plus position-score match/filter for dictionaries that use it — combined into one scoring function).
- What a good custom View actually looks like for Stardust's own position-scored terms — the math for a best-fit nearness/spiral browse through an arbitrary cloud of labeled points, and how much of that (if any) belongs as a shared, reusable View component other dictionaries could adopt rather than each dictionary reinventing its own.
- Anything about how Domain+Verb should generalize to new domains beyond Dictionary/User Dictionary (Note, Plan, Person, Business) once those exist.
