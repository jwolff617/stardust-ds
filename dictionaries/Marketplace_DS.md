# Marketplace DS

Buy, sell, give away, trade, and find a room in Seattle. The first board on Posts, the shared piece every board uses. This doc covers both: the shared Posts piece first, then Marketplace itself.

## What the incumbents do

**Facebook Marketplace.** Huge reach, real names, Messenger built in, photos front and center. It's where most of Seattle actually sells a couch.
- Bad: the feed is ranked by an algorithm and full of ads, shipped dropship junk, and "sponsored" listings. "Is this still available?" is one tap, so sellers drown in messages from people who never answer back. Lowballing, no-shows, and ghosting are normal. Scams are constant: fake payment screenshots, Zelle "upgrade" emails, the Google Voice code scam ("send me the code to prove you're real"), and rental listings copied from real ones to steal deposits.

**Craigslist.** Plain, fast, local, free for most posts. Posts expire on their own (most categories after 7 to 45 days), and the community flags bad posts until they disappear. Anonymous email relay keeps your address private.
- Bad: no names and no reputation, so scams are easy (overpaid cashier's checks, "my shipper will pick it up", deposit scams on rentals). Charges for job posts in big cities. The look is dated, photos are small, and search is clumsy.

**OfferUp.** Seller ratings, a verified-identity badge (TruYou), shipping, and in-app payment. It points people toward public "MeetUp spots."
- Bad: ads and paid "promoted" listings, shipping scams, and the same lowball and no-show culture as Facebook.

**Buy Nothing groups.** A gift economy by neighborhood: give, ask, lend, no selling. The poster picks who gets the thing, not the fastest clicker, which is fairer to people who can't stare at a phone all day.
- Bad: lives inside Facebook groups, so volunteer admins burn out, the feed is a mess, and anyone without Facebook is shut out.

**Nextdoor.** Verified addresses, very local.
- Bad: ads, fear-driven posts, and a long record of racial profiling in "suspicious person" posts.

## What Stardust does differently

1. **No ads, no paid boosts, no ranking algorithm.** Newest first, always. Nobody pays to be seen. Stardust DS sells nothing to anyone.
2. **Every post has a kind and labels.** For Sale, Free, Wanted, Trade, Housing, plus short labels (bike, crib, couch) that power the filters. Finding a free kids' bike in Lake City is two taps.
3. **Free is first class.** A Free post asks how you'll choose: "first to reply" or "I'll wait a day and choose." Waiting a day is the default, so the person checking from a library computer once a day has the same chance as the person glued to their phone.
4. **Replies are private threads, with a Your Turn inbox.** Each board shows how many threads are waiting on you. No read receipts, no "seen at 3:14."
5. **No ghosting by design.** When you mark something sold or given, you can send one kind note to everyone who reached out ("It's gone. Thank you for asking."). It's on by default.
6. **Posts expire.** For Sale, Wanted, and Trade last 30 days, Free 14, Housing 21. Renew with one tap if it's still around. Stale listings are the biggest source of clutter and wasted messages everywhere else.
7. **Scam warnings where scams happen.** When a message in a thread mentions a verification code, a gift card, Zelle before meeting, a cashier's check, or a shipper, a plain warning shows right under it.
8. **Fair housing wording check.** Housing posts are read for phrases that exclude people (no kids, Christians only, no Section 8). The poster sees the rule in plain words and can fix the post before it goes up.
9. **Report and Block from day one.** Report picks a reason (scam, unsafe, unfair, spam, sexual, other). Three reports hide a post until a steward looks at it. Block works both ways and can be undone. A private thread can be reported too, and only then can a steward read it.
10. **Light on data.** Photos are shrunk on your phone before upload (about 150 KB each, four at most), and a list loads without them. A cheap phone on a slow connection still works.

## The shared Posts piece

Every board (Marketplace, Job Match, Idea Index, Manifesto Match, Idea House) is Posts plus its own kinds, fields, and words. Built once in migration 0022.

**Tables.**
- `post_boards`: one row per board (intro text, settings).
- `post_kinds`: the kinds a board holds, in order, each with how many days a post lasts, and three switches: `adult_only` (needs an 18+ confirmation to see or post), `one_per_person`, `stewards_only` (only the poster and the board's stewards see it, for applications), and `open` (a kind can wait to open).
- `posts`: title, body, neighborhood, price (the money line: price, pay, rent, cost), labels, details (the kind's own fields), photos, status (open or closed), counts, hidden and review state, expiry, and an optional organization.
- `post_replies`: private threads between a poster and one replier.
- `post_reports`, `thread_reports`: reports with a reason.
- `user_blocks`: both-ways blocks, with the blocked spark's name so you can find and undo them.
- `post_saves`: Save for later.
- `stewards`: who reviews hidden posts. A steward of every board, or of one.
- `organizations`, `organization_members`: Recovery Cafe, SHARE, the Y. A member can post as the organization, and verified ones get a badge.
- `board_confirmations`: a spark's 18+ confirmation for a board.

**Rules the database keeps (RLS and triggers), so no client can skip them.**
- Every post and reply comes from a signed-in spark. The author's name is stamped from their profile when they post.
- You see a post if it's yours, or you're a steward of the board, or it isn't hidden, its kind isn't steward-only or 18+ without your confirmation, and neither of you has blocked the other.
- Authors can't change their own counts, hidden state, review, or expiry. Renewing restarts the clock from now.
- Ten posts a day per spark, sixty messages an hour. No new threads on a closed post.
- Three reports hide a post. A steward clears it (back up, count reset) or removes it (stays hidden, closed).
- Replies are private: only the two sides read a thread, unless one of them reports it.

**Core words.** Post, Reply, Kind, Steward (nouns); Report, Block, Save, Renew (verbs).

## Marketplace kinds and fields

| Kind | Money line | Its own fields | Lasts |
|---|---|---|---|
| For Sale | Price (required) | Condition: New, Like new, Good, Fair, For parts | 30 days |
| Free | none | Pickup: Porch pickup, Meet up, I can drop off. How I'll choose: I'll wait a day and choose, First to reply | 14 days |
| Wanted | Budget | none | 30 days |
| Trade | none | Looking for in trade | 30 days |
| Housing | Rent (required) | Offering or looking, Type (room in a shared home, studio, 1 bedroom, 2+ bedrooms, other), Move-in, What's included, Step-free entry (yes / no / not sure) | 21 days |

Every post also has a title, details, neighborhood (Seattle neighborhoods suggested), up to 10 labels, and up to 4 photos.

**Labels suggested while posting:** furniture, kids, clothes, coat, bike, tools, kitchen, books, electronics, phone, baby, outdoor, garden, pets, art, room, apartment, roommate.

## The words (Marketplace terms)

| Term | Part | Definition |
|---|---|---|
| For Sale | more | Something you are selling. Put a price, even a rough one. |
| Free | more | Something you are giving away. Say how you'll choose who gets it. |
| Wanted | more | Something you are looking for. |
| Trade | more | Something you would swap, and what you'd like for it. |
| Housing | more | A room or a place to live, offered or wanted. Describe the place, not the person. |
| Porch Pickup | noun | Leaving a free thing outside for someone to collect, so nobody has to meet. |
| Meet Spot | noun | A busy public place in daylight where two sparks hand something over: a library branch, a grocery store entrance, a police precinct lobby. |
| Fair Housing | noun | Everyone gets the same shot at a place to live. A housing post never prefers or excludes people by race, color, religion, sex, sexual orientation, gender identity, national origin, family (kids), disability, veteran or military status, or how they pay rent (like a voucher). |

## Safety and operations

**Meeting safely** (shown on the board, folded away after the first visit):
- Meet in a busy public place in daylight. Bring a friend if you can.
- Look at the thing before you pay. Pay when you have it in your hands.
- Never send money to hold an item or a room. Never share a code sent to your phone. Never take extra money to send back.
- For housing: see the place and meet the person before any deposit. A real landlord shows you inside.

**Payment.** Stardust DS handles no money. People pay each other directly, in person. Said plainly on the board.

**Reports.** Reasons: Scam, Unsafe, Unfair (discrimination), Spam, Sexual, Other, with an optional note. Three reports hide a post. Stewards see hidden posts with every reason and note in a Review list on the board, then Clear or Remove.

**Who reviews.** Stewards. Sage is the first steward of every board. As an organization joins, one or two of its trusted people become stewards of the boards it uses. Goal: a hidden post gets looked at within a day. If the review list grows past what stewards can handle, that's the signal to add a steward, not to automate.

**Threads.** "Report this thread" lets a steward read that one thread, and blocks the other spark at the same time. This is the only way a steward ever reads a private message.

**Blocks.** Both ways: you stop seeing their posts, they stop seeing yours, and neither can message the other. Your blocked list sits at the bottom of the board, with Unblock.

**Expiry.** Lapsed posts drop out of the list and show "Expired" to their poster, with Renew. Nothing is deleted.

**Rate limits.** 10 posts a day, 60 messages an hour. Enough for anyone real, too few for a spammer.

**Fair housing.** Housing posts are checked for excluding phrases before they post. The rule shows in plain words with Edit or Post as is. Stardust's rules are stricter than the law on purpose, and this check is guidance, not legal advice. Reports for "Unfair" go to stewards like any other.

**Phone numbers in posts.** Allowed, since some people only have a phone. A note under the form says every signed-in spark will see it and replies keep it private.

## Sage AI

Noun **Listing** (in Marketplace):
- Add: kind*, title*, details, price, neighborhood, labels, plus the kind's own fields. Runs the same checks as the form, including fair housing.
- Find: kind, query, label, mine. Newest first.
- Edit: changes only the fields given.
- Archive: mark it closed (sold, given, found). Restore: reopen.
- Delete.
- Act Renew: restart its clock.

Sage AI doesn't reply, report, or block for anyone. Those stay with the person.

## Real people, walked through

**Denise, Recovery Cafe member, giving away a winter coat.** She's at the Cafe on Boren, on the shared computer. She adds Marketplace from the library, taps New post, picks Free. The form asks for a title ("Women's winter coat, size L, warm"), pickup (Meet up), and how she'll choose (wait a day, the default). She labels it coat, clothes and puts First Hill. No photo, which is fine. Tomorrow she checks in: the board says "2 waiting on you." She opens the threads, picks the person who said they sleep outside, and agrees to meet at the Cafe. She taps Mark given, keeps "Let everyone who replied know" checked, and the other person gets a kind note instead of silence.
- Check: the default "wait a day" protects people like her who check once a day, on both sides. Works.

**Marcus, SHARE Lockers participant, library computer and a phone.** He's looking for a room under $800 near a bus line. At the Northgate library he opens Marketplace, taps Housing and the label room. Every Housing post shows rent up top. He saves two. Later, on his phone, Saved shows them. One reply back from a "landlord" asks him to Zelle a $300 deposit before seeing the place. A yellow note shows right under that message: never pay a deposit before you've seen the place. He taps Report this thread (scam), which blocks the poster too, and a steward reads that thread the next day and removes the post.
- Check: Saved and Your Turn work across devices since they live in the database. The scam note fires on "Zelle" and "deposit." Works.

**Priya, YMCA after-school staff, clearing out the program closet.** She posts a For Sale of three folding tables at $10 each, a Free box of board games, and a Wanted for donated Legos. Posting the games as the YMCA would need the Y to be an organization on Stardust with her as a member; until then she posts as herself.
- Check: price is required on For Sale, so no "how much?" messages. Wanted gets a budget line she can leave empty.

**Tom, Ballard neighbor.** He has a bike his kid outgrew. Photo from his phone shrinks to about 150 KB before it uploads. Three people reply in an hour. He picks one, meets at the Ballard library branch, marks it sold, and the others get the note. In two weeks he's forgotten the post exists, which is fine: a For Sale post would have expired on its own if he hadn't closed it.

## How it grows

One organization or neighborhood at a time:
1. **Recovery Cafe first.** Sage shows it to members during a shift. Free and Wanted are the useful kinds there: coats, boots, phones, bus passes. Needs: one Cafe staff member as a steward, a printed one-pager by the shared computers.
2. **SHARE next.** Housing leads and Wanted. Needs: the scam warnings to be good, since participants are targeted by rental scams. A SHARE steward.
3. **The Y.** Program closet giveaways, family swaps (kids' clothes, sports gear). Needs: an organization badge so families trust it.
4. **One neighborhood at a time,** starting where Sage lives and works. A neighborhood joins when someone there offers to steward it.

**An organization on Stardust.** A row in `organizations` (name, kind, neighborhood, a short about, website) with its people in `organization_members`. Sage adds it once the organization says yes. When it's verified (Sage has talked to a real person there), its posts carry a small "Verified" badge next to its name. Tapping the name shows its posts on that board and its about line. No organization gets ranked higher, boosted, or charged.

## Later

- Borrow and Lend as a kind (tools, a ladder, a carseat).
- Meet Spots as a short list of real Seattle places, suggested in threads.
- Optional in-person "handed over" confirmation to build trust between sparks over time, without star ratings.
- Delete expired posts' photos after 90 days to keep storage small.
