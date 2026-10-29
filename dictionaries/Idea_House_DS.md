# Idea House DS

The Idea House Fund on Stardust: its story, how to apply, a private application, and the public ledger. The ledger stays in its Google Sheet; Stardust reads it, the same sheet `site/src/pages/idea-house.astro` reads. Grants are listed by ID number, never by name.

## What the incumbents do

**GoFundMe and crowdfunding.** Anyone can ask, money moves fast.
- Bad: you have to tell your hardest story in public, with your face and name, and the people with the best networks and photos get funded. Fees on every gift.

**Foundation grants (big funders, city grants).** Real money, real review.
- Bad: long forms, a computer, a bank account, and grant-writing skills. Months of waiting. Almost nobody who is homeless or in recovery gets through the door.

**Mutual aid on social media (Venmo requests, Instagram).** Fast and personal.
- Bad: public, no records, easy to scam and be scammed, and burns out organizers.

**Recovery Cafe's own help and case managers.** People who know you.
- Bad: no small, flexible pot for a member's own idea, like tools to start a cleaning business.

## What Stardust does differently

1. **Private by default.** An application is seen only by the person who wrote it and the fund's judges. Nothing about an applicant is ever public.
2. **The public ledger is by ID.** Grant IH-007: $250, tools, October. No names, ever. Stardust reads the fund's sheet and hides any column that looks like a name, email, or phone, as a second lock.
3. **Short, plain application.** A few questions, in plain words, that work on a phone or a library computer. Your words count more than your writing.
4. **In-kind, said plainly.** The fund gives things (tools, a laptop, a bus pass, materials), not cash. Stardust handles no money.
5. **You always know where it stands.** Each application shows Received, Reviewing, Granted (with its ledger ID), or Not this time (with a kind note). Judges can message you privately with questions.
6. **Judges are stewards of this board.** Added by Sage. They see applications, message applicants, and decide.

## Kinds and fields

One kind, **Application** (stewards only, never expires; judges close it).

| Field | Notes |
|---|---|
| Your idea (title) | One line. |
| What you need (money line: "About what it costs") | Tools, a laptop, a bus pass, materials. |
| What you need, in detail | What exactly, and where it comes from. |
| How it helps | What changes for you, and for people around you. |
| First step once you have it | The first thing you'll do. |
| How you found the fund | Recovery Cafe, SHARE, a friend, other. |
| Best way to reach you | Optional; messages here work too. |

## The words

| Term | Part | Definition |
|---|---|---|
| Idea House Fund | noun | A Seattle nonprofit that gives small in-kind grants (things, not cash) to low-income people with an idea, starting with Recovery Cafe members. |
| Application | more | Your idea, what you need, and how it helps, seen only by you and the fund's judges. |
| Grant | noun | What the fund gives: a thing you need for your idea. Listed on the public ledger by ID number, never by name. |
| Ledger | noun | The fund's public record of every grant, by ID number, kept in its own sheet. |
| Judge | noun | A steward of Idea House who reads applications, asks questions, and decides. |
| In-Kind | noun | Given as a thing, like tools or a laptop, not as money. |

## Safety and operations

- **Privacy is the rule.** Applications are `stewards_only` in the database, so even a bug in the app can't show them to other sparks. Decisions are readable only by the applicant and judges.
- **No names on the ledger.** The sheet already lists grants by ID. Stardust drops any column whose header says name, applicant, email, phone, or address.
- **Judges.** Sage first, added as a steward of this board (or of all boards). Then the fund's board members. Judges should not decide on someone they're close to; say so and let another judge decide.
- **Scams.** The fund never asks for money, a bank account, or a Social Security number in a message. The board says so. A fake "judge" can't message you unless they're a steward, since only stewards can see applications.
- **Money.** None through Stardust. The fund buys the thing and hands it over, from its own account, per its own rules.
- **Tax status.** The fund is incorporated in Washington (EIN 42-4388998). IRS tax-exempt recognition is pending, so the page doesn't promise deductible donations.

## Sage AI

Noun **Application**: Add (helping someone write theirs, in their words), Find (your own only), Edit, Archive (withdraw), Restore, Delete. Sage AI never decides; judges do.

## Real people, walked through

**Denise, Recovery Cafe member.** She wants to start a small house-cleaning business and needs supplies and a vacuum, about $300. On the Cafe computer she adds Idea House, reads the story and the ledger (three grants by ID), and taps Apply. A few plain questions. She writes in her own words. Her application shows "Received." Two days later a judge messages: "Do you have a way to get the vacuum to jobs?" She answers. A week later it shows "Granted, IH-008," with a note on when to pick it up at the Cafe. The ledger row for IH-008 appears once the fund updates the sheet. Her name is nowhere public.
- Check: private by RLS; status and ledger ID shown to her; judge thread works.

**Marcus, SHARE participant, library computer and phone.** He applies for bike tools for his repair stand. "Not this time" comes back with a note ("We'd love to see this again next cycle with a spot lined up"), so he isn't left wondering. He can apply again.

**Priya, YMCA staff.** She reads the story and ledger and tells a parent about the fund. She doesn't need to apply.

**A neighbor.** Reads the ledger to see where the money goes, and how to give (a link Sage adds to the board's settings when donations open).

## How it grows

1. **Recovery Cafe members**, in cycles the fund sets. The next review date shows on the board (set in `post_boards.settings.nextReview`).
2. **SHARE participants**, once judges are ready for more applications.
3. **Idea Index link:** a Building idea that needs materials applies here.
4. **More judges** from the fund's board.

## Later

- A "Thank you" post from grantees who want to share progress (opt-in, first name only).
- Apply from an Idea Index idea in one tap.
- Cycle dates as data, with "applications close" reminders.
