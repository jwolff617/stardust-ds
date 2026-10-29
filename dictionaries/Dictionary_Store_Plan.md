# Dictionary Store: 20 useful dictionaries for Seattle

Idea (2026-10-27): fill the store with 10 to 20 good, simple dictionaries, like the basic apps on a new phone plus the first Craigslist categories. Only Core and Stardust are on by default. Everything else waits in the store until a person adds it, so each person builds their own universe out of the dictionaries they pick.

## Already built

Night DS (notes), Accounts DS, Worthy DS, After School DS, Lockers, Lockers Admin.

## Basic apps (personal, useful to one person alone)

These work on day one with a single user. No one else has to show up first.

| Dictionary | What it holds |
|---|---|
| Notepad | Plain pages that never expire. Night DS is for letting go; Notepad is for keeping. |
| Address Book | People: name, phone, email, address, how you know them. |
| Birthdays | Name and date. Shows who's next. |
| Checklist | Lists with checkboxes: groceries, packing, chores. |
| Calendar | Dated events. |
| Recipes | Ingredients and steps. |
| Habits | Things you do daily, with a streak. |
| Calculator | A calculator. Small, but it makes the store feel like a phone. |
| Clock | World clock and timers. Alarms only ring while the page is open, so it's a timer, not a wake-up alarm, until there's a phone app. |

## Seattle board (shared, needs other people)

The Craigslist part. Each one is empty until people post, so they only work once there are users or once Sage seeds them himself.

| Dictionary | What it holds |
|---|---|
| Ideas | Post an idea, find people who want to build it. Closest to Idea Index DS. |
| Friends | Find people by neighborhood and interest. |
| Dates | Profiles and matching. Needs blocking, reporting, and an 18+ check before it goes live. |
| Housing | Rooms and apartments. Fair-housing rules apply to how listings are worded. |
| Jobs | Gigs and jobs. |
| Free and Trade | Give away, swap, borrow. |
| Events | What's happening this week, by neighborhood. |
| Services | Local businesses and helpers, each one a Business dictionary below. |

## Custom work

- **Business dictionary:** a template that loads a business in: hours, prices, contact, place, menu or services. Sage builds them for people (paid, through UWS), and they show up in Services and search.
- **Custom dictionaries:** built for one person or group, the way Lockers was built for SHARE.

## Order

1. Basic apps first, three at a time: Notepad, Address Book, Birthdays. Each is about one table and one view, the same pattern as Accounts DS.
2. One board Sage can fill himself: Services, seeded with Business dictionaries he writes for real Seattle businesses, so the board isn't empty on day one.
3. The rest of the boards once there are people to post on them.

## New direction (2026-10-29): real tools for Seattle

Sage's call: less on phone-style basics, more on tools that help people in Seattle and the nonprofits he works in (Recovery Cafe, SHARE, the Y) find and help each other. Five dictionaries, all built on one shared piece.

**The shared piece: Posts.** One table of posts (title, body, kind, neighborhood, labels, who posted, open or closed) and one way to reply privately to a post. Every board below is Posts with its own fields and words. Built once, so the five cost far less than five apps. Every post comes from a signed-in spark with a Public Profile, so nothing is anonymous. Report and block are in from day one.

| Dictionary | What it does | Kinds of post |
|---|---|---|
| **Idea Index DS** | Post an idea, vote, comment, find people to build it with. Port of `../idea-index/` (votes, comments, favorites, leaders). | Idea |
| **Manifesto Match DS** | You write a manifesto (who you are, what you want), pick lines that fit you, and say what you are looking for: dating, friends, or business partners. Matches by shared lines. Port of `../manifesto-match/`. Dating needs an 18+ check and blocking before it opens. | Manifesto |
| **Marketplace DS** | Buy, sell, free, trade, and housing (rooms, apartments). Fair-housing rules on how housing posts are worded. No payment in the app yet: people meet or pay each other directly. | For sale, Free, Wanted, Trade, Housing |
| **Job Match DS** | Jobs and gigs, plus people looking. Nonprofits post openings and training for their participants. Later: reads your Universal Transcript to suggest matches. | Job, Gig, Looking, Training |
| **Idea House DS** | The Idea House Fund on Stardust: the story, how to apply, the application itself, and the public ledger (grants by ID number, never by name). Applicants and judges as a group. Waiting on: where the current Idea House website lives. | Application, Grant |

**Who it is for first:** the people Sage already knows through work. Recovery Cafe members and SHARE participants (Marketplace for free items and housing leads, Job Match for work), Idea House applicants, and Sage's own circles (Manifesto Match, Idea Index). Small and real beats big and empty.

**Order:**
1. Posts (the shared piece) with Marketplace DS on top: free and for-sale is the simplest board and the easiest for people to use.
2. Job Match DS: same posts, new fields.
3. Idea House DS: it has a real deadline cycle and real applicants already.
4. Idea Index DS: port the existing prototype.
5. Manifesto Match DS last: dating and matching carry the most safety work.
