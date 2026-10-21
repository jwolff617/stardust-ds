# Stardust DS

Stardust DS is a dictionary system for sparks. Every person, business, nonprofit, and government is a spark, and everything a spark does here is a word from a dictionary. Sage AI, the assistant built on Claude, acts only through the words of the dictionaries you have on.

Stardust DS starts in one city: Seattle.

## The pieces

**Sparks.** Anyone who acts in Stardust DS: a person, a business, a nonprofit, or a government.

**Dictionaries.** A dictionary is a named set of terms and their definitions. Two are always on for everyone:

- **Core**: the small shared vocabulary every spark can read end to end.
- **Stardust**: the language of love and human connection (feeling, body, spirit, soul). Sage AI always speaks it. The canonical definitions live in the book, `books/stardust-dictionary/STARDUST_Dictionary_First_Edition.md`.

**Core vocabulary.**

- Verbs: Add, Remove, Edit, Delete, Archive, Restore, Find, Filter, Share, Connect, Match, Message, Email, Call, Vote, Buy, Sell, Trade, Give
- Both: Label, View
- Nouns: Spark, Person, Business, Nonprofit, Government, Dictionary, Term, Definition, Private Profile, Public Profile, Place, City, Neighborhood, Email Address, Phone Number, Hours, Price, Note, Account, Time Frame, Connection

**Labels.** Short words on a dictionary (idea, match, seattle) that power dictionary search. Owners label their own dictionaries.

**Views.** Every dictionary has a Term View (its words and definitions). Personal dictionaries also have a Display View built for what they hold.

**Profile dictionaries.** Every spark gets two, locked on:

- **Private Profile**: registration and payment info, seen only by you. Card numbers are rejected; payment runs through a processor.
- **Public Profile**: contact info, neighborhood, city, and who you are. You choose which fields are public. Other sparks can find it in search.

## The DS list

A DS is a personal dictionary. Only its template shows up in search. Adding it creates your own private copy, named for you ("Sage's Notes").

| DS | Status | What it does |
|---|---|---|
| **Night DS** | Built | Notes that live in the now. Each note has a time frame (minute, hour, day, week, month, year, decade, life) and archives itself when its time is up, so you keep letting go and starting fresh. One label per note (goal, lesson, memory, idea, person, place, or your own word). Filter by time frame and label. Mark notes Done to keep a Done archive of what you finished. |
| **Accounts DS** | Built | A bank account for your whole life. Nine accounts in three groups: Matrix (Savings, Home, Avatar), Life (Friends, Community, Hobbies), Imagination (Ideas, Reflections, Memories). Each account keeps dated entries with an optional amount and a note, and shows its balance. |
| **Worthy DS** | Built | Urban Wolf Studio's betting system: save half of every win. Log deposits, wins, savings, and balance snapshots. See savings owed and saved, savings and balance as a share of deposits, and loss, over a day, week, month, year, decade, or life. Keep Bet Stories with the Worthy principles as labels. |
| Goodnight DS | Planned | Rebuild of the old Night DS line. |
| Idea Index DS | Planned | Specs in `../idea-index/`. |
| Manifesto Match DS | Planned | Stub in `../manifesto-match/`. |
| Universal Transcript DS | Outline | Reads your Night DS Done notes and builds a transcript of your strengths. See `dictionaries/Universal_Transcript_DS.md`. |

## Run it

```
npm install
npm run dev
```

Needs `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `ANTHROPIC_API_KEY`. Checks before a commit: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

The app is Next.js 16 (read `node_modules/next/dist/docs/` before changing Next code, per `AGENTS.md`) on Supabase. A daily Vercel Cron hits `/api/keepalive`, which keeps the free Supabase project awake and archives expired Night DS notes. Notes also archive themselves whenever they are read.

## Database

Schema changes live in `supabase/migrations/`, numbered and run in order. `supabase/seed/` holds the starting dictionaries for a fresh database.

**Pending application to the live project** (written, not yet run):

- `0006_core_vocabulary_trim.sql` through `0008_profile_dictionaries.sql`, if they haven't been applied yet
- `0009_night_ds_time_frames.sql`: time frames, labels, Done, auto-archive. Existing notes become life notes, so nothing vanishes.
- `0010_accounts_ds.sql`: Accounts DS template and entries
- `0011_worthy_ds.sql`: Worthy DS template, entries, and Bet Stories
- `0012_stardust_accounts_words.sql`: the Accounts words in Stardust

Run each file in order in the Supabase SQL editor, or with the Supabase CLI linked to the project: `supabase db push`.

## Ideas, not built

Notes on where Stardust DS could go. Nothing here exists yet.

- **Your Stardust order.** Your profile is a dictionary whose word order you can change, so the words that matter most to you sit on top. That order shapes your connections: who you are close to and who is farther away, scored by points.
- **Matching.** Three spectrums:
  - geographic: where you are, by city name
  - spiritual: your Stardust order
  - body: where you are from 0 to 10. Match with the same score or the inverse, and say who you want their self-score to be (a confidence measure).
- **Problem solver.** Say the problem, the budget, and the city. Housing comes back as options like a tent, a shelter, or roommates. Transportation comes back as a bike, a car, or a train. Healthcare and education come next.
- **Like Facebook for the age of AI.** No engagement farming and no ads. A simple site, like early Craigslist, with an AI assistant. Profile names for everyone, some fields private by default and others public. Code small enough to read every line in a couple of hours.
- **Trust.** User verification. Payments are low priority.
- **Start with the spectrum.** Love, God, community.
- **The thesis.** An AI of stories, of imagination. Just connection. What people want is a date.
- **Notes on the spectrum.** A note gets placed on the heaven-to-hell spectrum, up high or down low, so it reminds you how much it matters. The words work like floating clouds of priority: love, feeling, god, and sex up high; fear and hate down low. WACK's Map is the same idea drawn for a reader, a spectrum of feeling filled with the dictionary's own nouns.
- **After School DS (2026-10-21).** A one-line generator for after-school staff: type "outdoor game, 2nd grade, 20 kids, no equipment" and get the exact activity card, ready to run. Sage defines the words (game, include, line, transition, cool-down, the include/exclude chart) and the AI builds from his dictionary, so output reads like someone who runs a Y program wrote it. Sold under the Wolffie name, kept apart from Sage Peace. Order: sell hand-made PDF game guides first to prove demand and build the dictionary, then sell the generator. Free competitors exist (MagicSchool, plain ChatGPT/Claude), so the edge has to be the after-school setting and his tested games. Each generation costs API money, so it needs a subscription, not a one-time price. No trademarked characters (no Star Wars pages).
- **More dictionaries past the profile.** The private profile dictionary is basically your settings. From there you can open any public dictionary you want: a review dictionary, a blog dictionary, a newsletter dictionary.

**Buying and selling.** Sparks can buy, sell, trade, and give with each other, so Buy, Sell, Trade, and Give stay in Core. Stardust DS itself never sells to users, and there is no advertising or paid promotion. Think of it as an AI version of Craigslist for the marketplace, combined with Facebook-style profiles, in its own product.
