# Build log: the boards (2026-10-29)

A day of building the five boards on Posts while Sage was at work. Nothing here is pushed or deployed, and no migration has been run. Everything is committed locally.

## Before anything: run the migrations, in order

Run each in the Supabase SQL editor, one at a time, in this order. Each is safe to run twice.

1. `0022_posts_and_marketplace.sql`: Posts (the shared piece), stewards, organizations, 18+ confirmations, and Marketplace.
2. `0023_post_photos.sql`: the `post-photos` storage bucket and its rules.

Then make yourself a steward of every board (paste in the SQL editor, with your email):

```sql
insert into stewards (user_id)
select id from auth.users where email = 'jwolff617@gmail.com'
on conflict do nothing;
```

Push only after the migrations have run: the live site would show empty boards that error otherwise.

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

**Commits.** See `git log`: "Posts: one shared piece for every board..." and "Marketplace DS: ...".

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
