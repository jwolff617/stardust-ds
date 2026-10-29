# Build log: the boards (2026-10-29)

A day of building the five boards on Posts while Sage was at work. Nothing here is pushed or deployed, and no migration has been run. Everything is committed locally.

## Tonight, in short

All five boards are built: Marketplace, Job Match, Idea Index, Manifesto Match, and Idea House, on one shared Posts piece. `npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass.

**Commits, oldest first.**
- `338ade8` Posts: one shared piece for every board
- `948d4db` Marketplace DS
- `e7df584` Job Match DS
- `ae4f543` Idea Index DS
- `2e62d21` Manifesto Match DS
- `9bb6e3f` Idea House DS (and a small fix to 0022)
- plus the commit that finished this log

## Before anything: run the migrations, in order

Run each in the Supabase SQL editor, one at a time, in this order. Each is safe to run twice. Each needs the ones before it.

1. `0022_posts_and_marketplace.sql`: Posts (the shared piece), stewards, organizations, 18+ confirmations, and Marketplace.
2. `0023_post_photos.sql`: the `post-photos` storage bucket and its rules.
3. `0024_job_match.sql`: Job Match.
4. `0025_idea_index.sql`: Idea Index, with sparks, comments, and I'm In.
5. `0026_manifesto_match.sql`: Manifesto Match (Dating closed).
6. `0027_idea_house.sql`: Idea House, with decisions.

I checked them in order against a database at 0021. Every function is defined once, nothing from 0001 to 0021 is redefined, later files use only what 0022 makes, and the display-kind list keeps every earlier kind. Marketplace's display kind is now `marketplace` (the unapplied 0022 used to say `posts`).

Then make yourself a steward of every board (paste in the SQL editor):

```sql
insert into stewards (user_id)
select id from auth.users where email = 'jwolff617@gmail.com'
on conflict do nothing;
```

Push only after the migrations have run. Otherwise the live site would show boards that error.

## What to test first

1. Marketplace: post a Free item, then message it from a second account and close it with the note. That one loop touches posts, threads, Your Turn, and closing notes.
2. Report and Block from the second account, then Unblock.
3. Job Match: a Job with no pay won't post. A Looking post on one account matches a Job with the same label on the other.
4. Idea Index: spark, comment, I'm in.
5. Manifesto Match: the 18+ gate, then two Friends manifestos that share words.
6. Idea House: apply from a non-steward account, then decide as yourself.

Detailed steps for each board are in its section below.

## Not finished, or not built on purpose

- Nothing ran against a real database. The SQL was checked by reading, line by line, since no migration could be run.
- Organizations have no screen yet. Sage adds them and their members by SQL (example below).
- No email or push notices for new messages. People see "Your turn (n)" when they open a board.
- Manifesto Match has no Sage AI noun, on purpose (see its section).
- The 18+ confirmation trusts the birth date a person enters, like every incumbent does. Someone could also write the confirmation row directly through the API without the age check. It's the same level of trust, but it's worth knowing.

**Adding an organization** (once it says yes):

```sql
insert into organizations (slug, name, kind, neighborhood, about, website, verified)
values ('ymca-seattle', 'YMCA of Greater Seattle', 'nonprofit', 'Downtown', 'Programs for kids, families, and neighbors.', 'https://www.seattleymca.org', true)
on conflict (slug) do nothing;

insert into organization_members (organization_id, user_id, role)
select o.id, u.id, 'admin' from organizations o, auth.users u
where o.slug = 'ymca-seattle' and u.email = 'someone@example.com'
on conflict do nothing;
```

## 1. Marketplace DS

**What I built.**
- Rewrote 0022 so Posts can carry every board, not only Marketplace:
  - `post_boards` (intro, settings).
  - `post_kinds` with expiry days and four switches: 18+ only, one per person, stewards only, open.
  - `posts` now has details (each kind's own fields), photos, organization, counts for votes, comments, and joins, review state, and expiry.
  - Report reasons, thread reports (the only way a steward reads a private message), Save, Unblock (blocks keep the name so you can find them).
  - Stewards (who review hidden posts), organizations and their members, 18+ confirmations.
  - Rate limits: 10 posts a day, 60 messages an hour.
  - A closed post takes no new threads, and the author can't touch counts, hidden state, or expiry.
- 0023: the photo bucket. Each spark uploads only into their own folder, 1 MB cap, images only.
- `src/lib/boards.ts`: each board's kinds and fields in one place, like `BASIC_APPS`. A new board is a migration plus one entry there.
- `src/lib/posts.ts` (loading every view: Browse, Your turn, Saved, Yours, Review), `src/lib/posts-db.ts` (writes, shared by the API and Sage AI), `src/lib/wording.ts` (fair housing, fair hiring, scam lines), `src/lib/seattle.ts` (neighborhoods), `src/lib/photos-client.ts` (shrink and upload).
- `src/components/board/`: the pieces every board is built from (tabs, filters, form, threads, report panel, owner actions, review list, 18+ gate).
- `MarketplaceView` replaces the old `PostsView`. Display kind is now `marketplace` (was `posts`).
- Sage AI noun **Listing**: Add, Edit, Find, Archive (close), Restore, Delete, Act Renew. It runs the fair-housing check strictly: it has to reword, it can't post as is.
- Design doc: `dictionaries/Marketplace_DS.md`.

**Commits.** `338ade8`, `948d4db`.

**Test tonight, in this order.**
1. Add Marketplace from the library. The board shows its intro and "Staying safe."
2. Post a Free coat with no photo. Check it shows "14 days left" under Yours.
3. Post a For Sale with a photo from your phone. Check the photo is small and loads.
4. Post a Housing with "no kids" in it. The form stops and explains. Tap "I'll fix it."
5. From a second account: message the coat post, write "send me the code you got", and check the yellow Careful note shows on your first account.
6. On the first account: tap Mark given with "Let them know" checked. The second account gets the note in its thread.
7. Report a post from the second account. With your steward row in place, Review shows nothing until it has three reports. To test Review fast, run `update posts set hidden_at = now() where title = '...';` and look at Review.
8. Block from the second account, then Unblock from the "Blocked" list at the bottom.
9. Ask Sage AI: "Post a free bike on Marketplace in Ballard."

**Open questions for Sage.**
- Photos are in a public bucket, so a copied photo link works even after a post is hidden. Fine to start? The other way is signed links that expire, which is slower on cheap phones.
- Free posts default to "I'll wait a day and choose" (the Buy Nothing way). Keep that as the default?
- The fair-housing check warns and lets people "Post as is." Should Housing posts with an issue be held for a steward instead?
- Who besides you should be a steward first? Someone at Recovery Cafe and someone at SHARE?

**Ideas for later.**
- Borrow and Lend as a kind. Meet Spots as a short list of real places. A "handed over" confirmation that builds trust without star ratings. Cleaning up old photos from expired posts after 90 days.

## 2. Job Match DS

**What I built.**
- `0024_job_match.sql`: the Job Match board, kinds Job (30 days), Gig (7), Looking (30), Training (45), labels, and its words (Job, Gig, Looking, Training, Pay, Fair Chance, Apply, Filled).
- `JOB_MATCH` in `src/lib/boards.ts`: pay required on Job and Gig; Job has Hours, Schedule, Fair chance, Experience, How to apply, Where or how, and "We answer everyone" (a promise: within 3 days or a week). Looking has the work you want, when, and what you've done. Training has when, how long, what you leave with, and who it's for.
- `JobsView`: pay in green up top, Fair chance and No experience filters, "Matches you" (when you have a Looking post, it shows jobs, gigs, and trainings sharing a label), "I'm looking" and "Post work" buttons, apply by message with a starter, and "How to apply" when it's in person, by phone, or online.
- Fair-hiring wording check (age, sex, records, language and citizenship, disability, religion, parents), and a scam note for Social Security or bank details in a message.
- Sage AI noun **Job Post**, from the same factory as Listing.
- Design doc: `dictionaries/Job_Match_DS.md`.

**Commits.** `e7df584`.

**Migrations to run.** 0024, after 0022 and 0023.

**Test tonight.**
1. Add Job Match. Post a Job without pay: the form won't post. Add pay, choose Fair chance, post.
2. Write "energetic young person" in a job: the form explains the age rule. "Working with young kids" doesn't trip it.
3. From a second account, tap "I'm looking," post Looking with the label kitchen. Post a Job with the label kitchen from the first. The second account sees "Matches your Looking post" and a "Matches you" filter.
4. Apply with a message using "Use a starter." Then Mark filled on the job: the applicant gets the note.

**Open questions for Sage.**
- Pay is required on Job and Gig. Should Training's cost be required too (so "Free" is always said)?
- Should Job Match ask employers to agree to a short pledge (answer everyone, pay what you post) before their first job post?
- Which employers would you want verified first, beyond the Y and Recovery Cafe?

**Ideas for later.** Universal Transcript suggestions. A "hired here" note from applicants in place of ratings. Bus time from your neighborhood to the job.

## 3. Idea Index DS

**What I built.**
- `0025_idea_index.sql`: the Idea Index board (kinds Idea, Building, Need; Need lasts 90 days, the others until closed), with three features switched on in its board settings: sparks (`post_votes`, one per spark, never your own), open comments (`post_comments`, one level of replies, Report on every comment, three reports hide it, stewards clear or remove), and I'm In (`post_joins`, with what you'd bring, public on the idea). Counts on posts change only through trusted triggers. `board_has()` keeps each feature to boards that turned it on.
- `IDEA_INDEX` in `boards.ts`: Idea (the problem, first small step, looking for), Building (stage, looking for, how to join), Need (who has it, what would help).
- `IdeasView`: idea cards two across on a wide screen, one on a phone, a spark button with the count, Newest or Most sparked, Who's in with offers, the open conversation, and private messages a tap away.
- `/api/posts/extras`: one idea's comments and who's in, loaded when it opens.
- Review now also lists hidden comments.
- Sage AI noun **Idea** (shared factory). Sparks, comments, and I'm In stay with people, so the counts mean real people.
- Design doc: `dictionaries/Idea_Index_DS.md`.

**From the prototype, kept:** votes (as sparks), comments with one level of replies, favorites (Save), categories (as labels). **Left behind:** downvotes, the leaderboard, the 9-panel grid. Connections and follow are in "Later."

**Commits.** `ae4f543`.

**Migrations to run.** 0025, after 0022 to 0024.

**Test tonight.**
1. Post an Idea. From a second account: spark it (count goes to 1), tap again to take it back.
2. Say I'm in with "I can do design." The first account sees the name and offer, and can Take off.
3. Comment, reply to the comment, delete your own. Report a comment from two more accounts (three total) and check Review shows it.
4. Sort by Most sparked.

**Open questions for Sage.**
- Up only, no downvotes. The prototype had both. OK?
- "Spark" is a Core noun (a person) and now an Idea Index verb (love an idea). Keep the double meaning, or call the verb something else (Light, Love)?
- No leaderboard. Do you want the prototype's "Top leaders" back in some gentler form?

**Ideas for later.** Follow a spark. Turn a Need into an Idea, or an Idea into Building, in one tap. Apply to Idea House from a Building idea.

## 4. Manifesto Match DS

**What I built.**
- `0026_manifesto_match.sql`: the board with kinds Friends, Business Partners, and Dating. All three are 18+, one per person, and mutual; Dating is closed. Words: Manifesto, Line, Match, Say Hello, Pause, Business Partner.
- In 0022, a new kind switch, `mutual`: you see others' posts of that kind only while your own is up. It lives in `can_see_kind()`, so the database keeps it.
- A `lines` field type (words from a list, each with your own line, 5 to 12) and a `number` type (ages) in `boards.ts`.
- `ManifestoView`: the 18+ gate with the rules, a tab per kind, your manifesto editor (headline, word chips, a line per word, the kind's fields, a few lines about you, neighborhood), Pause and Unpause, and matches sorted by shared words with the shared ones in green, an excerpt from their line on a word you share, and "Say hello" with a starter that quotes it. Dating only shows people who fit both ways (who you are, who you hope to meet, ages).
- 48 words: 30 from the Stardust Dictionary, 18 from the prototype.
- No Sage AI noun, on purpose: a manifesto is a person speaking for themselves. Said in the design doc.
- Design doc: `dictionaries/Manifesto_Match_DS.md`.

**Commits.** `2e62d21`.

**Migrations to run.** 0026, after 0022 to 0025. Since 0022 changed again for `mutual`, run it from the file as it is now.

**Opening Dating, when you're ready** (after two stewards are in place):

```sql
update post_kinds set open = true
where name = 'Dating' and dictionary_id = (select id from dictionaries where address = 'manifesto-match-ds');
```

**Test tonight.**
1. Add Manifesto Match. The 18+ gate shows. Try a birth date under 18: it says no. Confirm with a real one.
2. Friends shows the editor and nothing else. Pick 5 words, write 3 lines, put it up.
3. From a second account, write one sharing 2 words. Each account now sees the other with "2 shared words."
4. Say hello with the starter. Pause on one account: both stop seeing each other until Unpause.
5. Dating says "opens soon." Open it with the SQL above and check the fit: a man hoping to meet women only sees women whose ranges include his age.

**Open questions for Sage.**
- 5 to 12 words (the prototype said 10 to 20). Right size?
- Friends and Business Partners are 18+ too. Is that what you want, or should Friends allow 16 and up later with its own rules?
- Is the word list right? Swap any word freely: it's `MANIFESTO_WORDS` in `src/lib/boards.ts`, and existing manifestos keep working as long as words are only added. Removing a word makes manifestos using it fail to save until the person picks another.
- Who would be the second steward before Dating opens?

**Ideas for later.** Your Stardust order (word order as weight in matching). Small groups of three or four who share words, meeting at a real place. Sage AI helping draft your lines, shown to you, never posted for you.

## 5. Idea House DS

**What I built.**
- `0027_idea_house.sql`: the Idea House board, with one kind, Application, marked stewards only. The fund's judges are stewards of this board. `idea_house_decisions` (Reviewing, Granted with a ledger ID, Not this time, and a note) is readable by the applicant and judges and written only by judges. Board settings hold the ledger's CSV link (the same Google Sheet the site's `/idea-house` page reads), a next review date, and the public page link.
- `src/lib/idea-house.ts` and `/api/idea-house`: read the ledger fresh each time and drop any column whose header looks like a name, email, phone, or address, as a second lock on privacy.
- `IdeaHouseView`: three tabs. The fund and its ledger has the story, the tax status said plainly, and the ledger table. Apply (or Your application) has the private form, your status, and questions from judges. Applications is for judges only: answers, a decision panel, and a private thread with the applicant.
- Sage AI noun **Application**: it can help someone write theirs, and Find shows only your own. It never decides.
- Design doc: `dictionaries/Idea_House_DS.md`.

**Commits.** `9bb6e3f`.

**Migrations to run.** 0027, after 0022 to 0026.

**Make a judge** (you, for this board only; you're already a steward of every board if you ran the first SQL):

```sql
insert into stewards (user_id, dictionary_id)
select u.id, d.id from auth.users u, dictionaries d
where u.email = 'judge@example.com' and d.address = 'idea-house-ds'
on conflict do nothing;
```

**Set the next review date** shown on Apply:

```sql
update post_boards set settings = settings || '{"nextReview": "December 1"}'::jsonb
where dictionary_id = (select id from dictionaries where address = 'idea-house-ds');
```

**Test tonight.**
1. The ledger tab shows the same rows as urbanwolfstudio.net/idea-house.
2. From a second account (not a steward), apply. It shows "Received." Check that a third account can't see it anywhere.
3. As a judge, open Applications, ask a question, then mark Granted with IH-001 and a note. The applicant sees "Granted, IH-001 on the ledger" and the note.

**Open questions for Sage.**
- What's the next review date, and should applications close between cycles? Right now Application is always open (`post_kinds.open` can close it).
- Should an applicant be able to have more than one open application at a time?
- Who besides you judges? The fund's board members?
- When donations open, where should the "give" link go?

**Ideas for later.** A first-name-only "thank you" post from grantees who want to share progress. Apply from an Idea Index idea in one tap. Cycle dates as data with reminders.

## A late fix to 0022

On an edit, the post's kind was looked up before its board was pinned back, so a crafted edit could name another board's kind for a moment. Now the board and author are pinned first. Found on the reread; 0022 isn't applied, so it's fixed in place.
