# Core Toolbox

Every dictionary in Stardust DS is written in words, and the words come from Core. Core has two lists: **nouns** (things) and **verbs** (what you do). I build each one once, test it, and make it look like Stardust. Anyone writes a dictionary using Core words: in Claude, in a notes app, or by talking to Sage.

Sage follows one rule: every word in a dictionary must be a Core noun or verb. When someone asks for something Core doesn't have, Sage says so plainly, offers the closest thing, and adds the missing word to the Wanted list.

Status: this is the paper test. Nothing here is built as a written dictionary yet. Words marked **(new)** don't exist anywhere in the app.

## Nouns

| Noun | What it is |
|---|---|
| **Note** | Something you write and keep |
| **Entry** | One line in a record: a time, an amount, a visit |
| **Post** | Something others can see and answer |
| **Person** | One human being, a member or just a name |
| **Group** | Sparks who share a dictionary |
| **Place** | A spot in the world |
| **Event** | Something that happens at a time |
| **Text** | A few words |
| **Long Text** | Paragraphs |
| **Number** | A number, or a word in its place |
| **Money** | An amount, or "free" |
| **Date** | A day, shown as `Oct 30` |
| **Time** | A time of day |
| **Timer** (new) | How long something took, with a running clock |
| **Days** (new) | Days until or since a date |
| **Repeat** (new) | Every day, week, month, or year |
| **Status** | One choice from a short list, like Open or Taken |
| **Choice** | One or more from a short list |
| **Check** (new) | Yes or no |
| **Rating** (new) | 1 to 5 |
| **Photo** | Up to 4 pictures |
| **Phone** | A number you can tap to call |
| **Email** | An address you can tap to write |
| **Link** | A web address you can tap to open |
| **Label** | A short word for finding things, shown as `#label` |
| **Time Frame** | How long something lives, from a day to a life |

## Verbs

Every noun can be **Added, Edited, Found, Filtered, Archived, Restored, Deleted,** and **Labeled**. A dictionary names only the other verbs it uses.

| Verb | What it does | Already in |
|---|---|---|
| **Done** | Check it off | Night DS |
| **Order** | Drag to arrange | Night DS |
| **Start**, **Stop** (new) | Run a Timer | |
| **Total** | Add up Money, Numbers, or Timers, or count, by label or time | Worthy |
| **Group by** (new) | Show the list in sections, by Status or Person | |
| **Assign** (new) | Give it to a Person | |
| **Request**, **Approve** (new) | A member asks, an admin says yes | |
| **Remind** (new) | Alert you before a Date. Needs phone or email alerts first | |
| **Call**, **Email** | Reach someone from their Phone or Email | |
| **Share** | Who sees it | Everywhere |
| **Post**, **Message** | Others see it and write to you privately | Boards |
| **Comment**, **Spark**, **Join** | Others answer in the open | Idea Index |
| **Match** | Find others who share labels or words | Job Match, Manifesto Match |
| **Save**, **Renew**, **Report**, **Block** | Keep it, keep it up, flag it, stop someone | Boards |
| **Generate** | Sage fills it in for you | Wolffie Games |

## Who sees it

| Share | Who reads | Who writes |
|---|---|---|
| **Just me** | You | You |
| **Group** | Members | Everyone edits, or each edits their own, or admins edit and members add |
| **Public** | Everyone | Each spark posts their own; a steward reviews reports |

Just me and Group go live at once. Public waits for a steward, who reviews what it's for.

## How a dictionary is written

```
Name
For: one line on what it's for.
Share: Just me, Group (who writes), or Public

Noun: one line on what it is.
  has a ..., a ..., a ...
  you can ...
```

## Paper test: 10 real dictionaries

### 1. Focus Timer

```
Focus Timer
For: seeing where my hours go.
Share: Just me

Session: something I timed.
  has a Task (Text), a Time (Timer), Labels
  you can Start, Stop, Total the Time by label this week
```

Needs: Timer, Start, Stop.

### 2. Night DS

```
Night DS
For: clearing my mind before sleep.
Share: Just me

Note: a thought to let go of.
  has a Note (Long Text), a Time Frame, a Label
  you can mark it Done, Order it
  shortest time frame first
```

Needs nothing new.

### 3. Worthy

```
Worthy
For: what I earn, spend, and save, and what my bets teach me.
Share: Just me

Entry: money in or out.
  has an Amount (Money), a Kind (Status: Earn, Spend, Save, Bet), a Date, a Note (Text)
  you can Total the Amount by kind this month
Bet Story: what a bet taught me.
  has a Story (Long Text), an Outcome (Status: Won, Lost, Pushed), Principles (Choice: Good Reason, Find Value, Brave Bet)
```

Needs nothing new.

### 4. SHARE Lockers

```
SHARE Lockers
For: who has which locker, and when it's due back.
Share: Group (admins edit, members add)

Locker: one locker.
  has a Number, a Status (Open, Taken, Broken), a Holder (Person), a Due Back (Date)
  you can Assign, Request, Approve, Remind 2 days before Due Back, Group by Status
Rule: something everyone should know.
  has a Rule (Long Text)
```

Needs: Assign, Request, Approve, Remind, Group by.

### 5. Kid Zone Check-in

```
Kid Zone Check-in
For: who came in today, and when they left.
Share: Group (each edits their own)

Check-in: one kid, one visit.
  has a Kid (Person), an In (Time), an Out (Time)
  you can Total the count by day
  today first
```

Needs nothing new.

### 6. Bakery Orders

```
Corner Bakery Orders
For: custom cake orders and pickups.
Share: Group (everyone edits)

Order: one cake.
  has a Customer (Text), a Phone, a Cake (Long Text), a Price (Money), a Pickup (Date), a Status (New, Baking, Ready, Picked Up)
  you can Call, Remind 1 day before Pickup, Total the Price this week, Group by Status
```

Needs: Remind, Group by.

### 7. Birthdays

```
Birthdays
For: never missing one.
Share: Just me

Birthday: someone to celebrate.
  has a Name (Text), a Day (Date, Repeat every year), Days until
  you can Remind 3 days before
  soonest first
```

Needs: Repeat, Days, Remind.

### 8. House Chores

```
House Chores
For: who does what this week.
Share: Group (everyone edits)

Chore: one job around the house.
  has a Chore (Text), a Who (Person), a Repeat (weekly)
  you can mark it Done, Assign, Group by Who
```

Needs: Repeat, Assign, Group by.

### 9. My Recovery

```
My Recovery
For: the steps I'm working and the days I've kept.
Share: Just me

Clean Since: the day I started.
  has a Day (Date), Days since
Step: one step.
  has a Step (Number), What It Means to Me (Long Text)
  you can mark it Done
```

Needs: Days.

### 10. Job Match

```
Job Match
For: work in Seattle, with pay up front.
Share: Public

Job Post: a job, or someone looking.
  has a Kind (Status: Job, Looking), a Pay (Money), Labels
  you can Post, Message, Match Looking with Job by labels, Save, Renew, Report, Block
```

Needs nothing new. It's the boards we built.

## What the paper test found

All 10 fit. The missing words are few and shared, so building each once helps many dictionaries:

| Missing | Used by |
|---|---|
| **Timer**, **Start**, **Stop** | Focus Timer |
| **Repeat**, **Days** | Birthdays, Chores, Recovery |
| **Assign** | Lockers, Chores |
| **Group by** | Lockers, Bakery, Chores |
| **Request**, **Approve** | Lockers |
| **Remind** | Lockers, Bakery, Birthdays. Needs alerts first |
| **Check**, **Rating** | None yet. Hold until someone needs them |

Still built by hand, because no small word covers them: Idea House judging, Manifesto Match's matching by shared words, and Wolffie's printable packets. Each reuses Core words wherever it can.

## Build order

1. Add these nouns and verbs to the Core dictionary, so anyone can read them in Core's Term View.
2. The engine: a written dictionary becomes a working one in the Stardust style. Start with Just me and the words that already exist.
3. Timer, Start, Stop. Then Focus Timer works.
4. Sage writes dictionaries with you: asks what you need, points you to Core, writes the page, shows a preview, builds on yes. Missing words go to the Wanted list.
5. Groups and who writes, then Assign, Group by, Request, Approve. Then Lockers works.
6. Repeat and Days.
7. Alerts, then Remind.
8. Public dictionaries with steward review.
9. Move my dictionaries onto Core words, one at a time, Night DS first, only where nothing is lost.

The + Create my own builder from 0028 is the starting point for step 2: it already stores a dictionary's fields and entries in the Stardust style.
