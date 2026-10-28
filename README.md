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

**Classes.** Every dictionary has one class, which sets who sees it by default:

- **Shared** (public): one copy everyone reads. Core, Stardust.
- **Personal** (private): a template each spark gets their own copy of. Night DS, Accounts DS, Worthy DS, the profiles. The Public Profile is personal but public.
- **Group** (members only): a template anyone can copy into a group, like a Facebook page or a Slack channel. The owner adds members by email, and everything in the group is visible to every member. After School DS.

**Labels.** Short words on a dictionary (idea, match, seattle) that power dictionary search. Owners label their own dictionaries.

**Views.** Every dictionary has a Term View (its words and definitions). Personal and group dictionaries also have a Display View built for what they hold.

**Your arrangement.** Module 1 shows your dictionaries, then the store (everything you haven't added), which you can hide and filter by label. Module 2 is one feed of Display Views in your order: click a name to jump to it, ▲▼ to move it. Which dictionaries are checked, the tabs, the view, the feed order, and whether the store is open save to your account (`profiles.preferences`) with a copy in the browser, so the app opens how you left it on any device.

**Sage AI: verbs and nouns.** Sage AI's tools are the Core verbs themselves (Add, Edit, Find, Archive, Restore, Delete, Share, Label, Remove), plus Act for a verb a dictionary adds, like Night DS's Done or After School's Regenerate. Each dictionary registers its nouns in `src/lib/sage-ai/nouns/`: the noun's fields, which verbs work on it, and what each verb does. The engine (`src/lib/sage-ai/engine.ts`) checks every field, picks the right dictionary copy, and tells Sage AI exactly what to fix when something's wrong. Sage AI only sees the nouns of dictionaries you have on. A new dictionary registers its nouns and Sage AI can use them, with no new tools. Nouns today: Dictionary, Term, Profile Field, Note, Lesson, Theme, Activity, Account Entry, Worthy Entry, Bet Story, Notepad Note, Contact, Birthday.

**Profile dictionaries.** Every spark gets two, locked on:

- **Private Profile**: registration and payment info, seen only by you. Card numbers are rejected; payment runs through a processor.
- **Public Profile**: contact info, neighborhood, city, and who you are. You choose which fields are public. Other sparks can find it in search.

## The DS list

A DS is a personal dictionary. Only its template shows up in search. Adding it creates your own private copy, named for you ("Sage's Notes").

| DS | Status | What it does |
|---|---|---|
| **Night DS** | Built | Notes that live in the now. Each note has a time frame (day, week, month, year, decade, life) and archives itself when its time is up, so you keep letting go and starting fresh. One label per note (goal, lesson, memory, idea, person, or place). Filter by time frame and label. Mark notes Done to keep a Done archive of what you finished. |
| **Accounts DS** | Built | A bank account for your whole life. Nine accounts in three groups: Matrix (Savings, Home, Avatar), Life (Friends, Community, Hobbies), Imagination (Ideas, Reflections, Memories). Each account keeps dated entries with an optional amount and a note, and shows its balance. |
| **Worthy DS** | Built | Urban Wolf Studio's betting system: save half of every win. Log deposits, wins, savings, and balance snapshots. See savings owed and saved, savings and balance as a share of deposits, and loss, over a day, week, month, year, decade, or life. Keep Bet Stories with the Worthy principles as labels. |
| **After School DS** | Built | A group dictionary for an after-school program. Make a group for your site and add staff by email. Lessons: a Monday-to-Friday template on top, copied into each new week, with five weeks shown at a time and a regenerate button that recopies the template into them. Calendar: weeks by month, each with a theme and five activities. |
| **Notepad** | Built | Plain notes that stay until you delete them, in a 3x3 grid with as many pages as it takes. The first box is always a new note; edit any note where it sits. Night DS is for letting go; Notepad is for keeping. |
| **Address Book** | Built | The people you know: name, phone, email, address, notes. |
| **Birthdays** | Built | Name, month, day, and the year if you know it. Who's next is on top, with how many days away and how old they turn. |
| **Wolffie Games** | Built | Pick or type themes, set kids and age, and Sage AI writes a one-day packet: 5-minute craft, game, joke, riddle, fact, a cut-out template, a coloring page, and a word search. Opens as 6 printable pages; Print or save PDF. Packets and themes are kept. Separate from After School DS. Drawings come from `src/lib/wolffie/printables.js`, a copy of `shop/wolffie-lessons/printables.js`. |
| **Lockers** | Built | SHARE Lockers in North Seattle, shared and public: hours, rules, and announcements. Anyone can read it; Lockers Admin members edit it in place. |
| **Lockers Admin** | Built | The EC and Clerk side of SHARE Lockers, a group with exactly one copy. Members manage participants, the 500 lockers (assign, release, broken), bars (recommend, issue, dismiss, lift), attendance (work shifts, Sunday meetings, Power Lunch, makeup shifts), and reports (renewals due, missed shifts, counts). |
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

**Basic apps.** Notepad, Address Book, and Birthdays share one pattern. Each is one entry in `src/lib/basics.ts` (its table, fields, order, and summary line), and that entry drives its API (`/api/basics`), its Display View (`BasicsView`), and its Sage AI noun. A new basic app (Checklist, Recipes) is a migration plus one entry there.

## Database

Schema changes live in `supabase/migrations/`, numbered and run in order. `supabase/seed/` holds the starting dictionaries for a fresh database.

**Live project:** 0001 to 0018 applied (2026-10-27). Pending: 0019 (Wolffie Games; until it runs, it doesn't show in the store).

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
- **Fairness Index, for Worthy DS (2026-10-22).** While you watch a game, mark the teams and players who earn your rooting, for one of two reasons:
  - **Unlucky:** they looked great but lost anyway. Root for them in their next games.
  - **Dominant:** they looked so amazing that you want to keep rooting for them.

  Each mark gets one line on what you saw. Over time, the index shows who you've been pulling for and why, and whether it held up in later games.
- **More dictionaries past the profile.** The private profile dictionary is basically your settings. From there you can open any public dictionary you want: a review dictionary, a blog dictionary, a newsletter dictionary.

**Buying and selling.** Sparks can buy, sell, trade, and give with each other, so Buy, Sell, Trade, and Give stay in Core. Stardust DS itself never sells to users, and there is no advertising or paid promotion. Think of it as an AI version of Craigslist for the marketplace, combined with Facebook-style profiles, in its own product.
