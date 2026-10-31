# Core Toolbox

Every dictionary in Stardust DS is written in words, and every word it uses to work comes from Core. I build each Core word once, test it, and make it look like Stardust. Anyone writes a dictionary by naming Core words: in Claude, in a notes app, or by talking to Sage. Sage builds only from Core, and when someone asks for something Core doesn't have, Sage says so and adds it to the Wanted list.

Core holds three kinds of words:

- **Nouns**: the things a dictionary keeps.
- **Tools**: the parts a noun is made of. Each one holds something and knows how to show it.
- **Verbs**: what you can do with a noun. Each one does the work.

Status: this is the paper test (step 1). Nothing here is built as a written dictionary yet. Words marked **(new)** don't exist anywhere in the app.

## Nouns

A dictionary's own nouns are each built on one Core noun, so Stardust and Sage already know what they are.

| Noun | What it is |
|---|---|
| **Note** | Something you write and keep. The base for most things. |
| **Entry** | One line in a record: a time, an amount, a check-in. |
| **Post** | Something others can see and answer: a listing, a job, an idea. |
| **Person** | One human being. Linked to a spark, or just a name. |
| **Group** | Sparks who share a dictionary. |
| **Place** | A spot in the world: a neighborhood, an address, a room. |
| **Event** | Something that happens at a time. |

## Tools

| Tool | Holds | Shows as |
|---|---|---|
| **Text** | A few words | A line |
| **Long Text** | Paragraphs | A paragraph |
| **Number** | A number, or a word | The number |
| **Money** | An amount, or "free" | `$40` |
| **Date** | A day | `Oct 30` |
| **Time** | A time of day | `7:30 PM` |
| **Timer** (new) | How long something took | A running clock with Start and Stop |
| **Days** (new) | Days until or since a date | "in 12 days", "41 days" |
| **Repeat** (new) | Every day, week, month, or year | The next time it comes |
| **Choice** | One or more from a short list | A tag |
| **Check** (new) | Yes or no | A box |
| **Rating** (new) | 1 to 5 | Stars |
| **Photo** | Up to 4 pictures | A thumbnail |
| **Person** | A member, or a name | Their name |
| **Phone**, **Email**, **Link** | A way to reach someone or something | Tap to call, write, or open |
| **Labels** | Short words for finding things | `#label` chips |
| **Time Frame** | How long it lives: day to life | When it archives itself |

## Verbs

Every noun gets the Core verbs: **Add, Edit, Find, Filter, Archive, Restore, Delete, Label**. A dictionary names only the extra ones it uses.

| Verb | What it does | Built in |
|---|---|---|
| **Done** | Check it off | Night DS |
| **Order** | Drag to arrange | Night DS |
| **Start**, **Stop** (new) | Run a Timer | |
| **Total** | Add up Money, Numbers, Timers, or count entries, by label or time | Worthy |
| **Assign** (new) | Give it to a Person | |
| **Request**, **Approve** (new) | A member asks, an admin says yes | Lockers, by hand |
| **Remind** (new) | Alert you before a Date | Needs phone or email alerts |
| **Share** | Who sees it | Everywhere |
| **Post**, **Message** | Others see it and write to you privately | Boards |
| **Comment**, **Spark**, **Join** | Others answer in the open | Idea Index |
| **Match** | Find others who share labels or words | Job Match, Manifesto Match |
| **Save**, **Renew**, **Report**, **Block** | Keep it, keep it up, flag it, stop someone | Boards |
| **Generate** | Sage fills it in for you | Wolffie Games |

## Who

| Share | Who reads | Who writes |
|---|---|---|
| **Just me** | You | You |
| **Group** | Members | Pick one: everyone edits everything, each edits their own, or admins edit everything and members add |
| **Public** | Everyone | Each spark posts their own; a steward reviews reports |

Just me and Group go live at once. Public waits for a steward, who reviews what it's for, not whether it works.

## How a dictionary is written

```
Name of the dictionary
For: one line on what it's for.
Share: Just me | Group (who writes) | Public

Noun name (a Core noun): one line on what it is.
  Field name: Tool
  Field name: Tool
  Verbs: any extra verbs
  Show: how the list is sorted or grouped
```

Rules Sage checks before building:

1. Every noun is built on a Core noun.
2. Every field uses a Core tool.
3. Every verb is a Core verb.
4. Keep it lean: the fewest fields that do the job, most important first.

If something isn't in Core, Sage says so plainly, offers the closest thing, and adds the missing word to the Wanted list.

## Paper test: 10 real dictionaries

### 1. Focus Timer (just me)

```
Focus Timer
For: seeing where my hours go.
Share: Just me

Session (an Entry): something I timed.
  Task: Text
  Time: Timer
  Labels
  Verbs: Start, Stop, Total (Time, by label, this week)
```

Needs: Timer, Start, Stop.

### 2. Night DS (just me)

```
Night DS
For: clearing my mind before sleep.
Share: Just me

Note (a Note): a thought to let go of.
  Note: Long Text
  Lives for: Time Frame
  Labels
  Verbs: Done, Order
  Show: shortest time frame first
```

Needs nothing new.

### 3. Worthy (just me)

```
Worthy
For: what I earn, spend, and save, and the stories behind my bets.
Share: Just me

Entry (an Entry): money in or out.
  Amount: Money
  Kind: Choice (Earn, Spend, Save, Bet)
  When: Date
  Note: Text
  Verbs: Total (Amount, by kind, this month)
Bet Story (a Note): what a bet taught me.
  Story: Long Text
  Outcome: Choice (Won, Lost, Pushed)
  Principles: Choice, pick many (Good Reason, Find Value, Brave Bet)
```

Needs nothing new.

### 4. SHARE Lockers (group)

```
SHARE Lockers
For: who has which locker, and when it's due back.
Share: Group (admins edit everything, members add)

Locker (a Note): one locker.
  Number: Text
  Status: Choice (Open, Taken, Broken)
  Holder: Person
  Due back: Date
  Verbs: Assign, Request, Approve, Remind (2 days before Due back)
  Show: grouped by Status
Rule (a Post): something everyone should know.
  Rule: Long Text
```

Needs: Assign, Request, Approve, Remind, grouping by a Choice.

### 5. YMCA Check-in (group)

```
Kid Zone Check-in
For: who came in today, and when they left.
Share: Group (each edits their own)

Check-in (an Entry): one kid, one visit.
  Kid: Person
  In: Time
  Out: Time
  Verbs: Total (count, by day)
  Show: today first
```

Needs nothing new. Out could be a Timer if we want time spent.

### 6. Small Shop Orders (group)

```
Corner Bakery Orders
For: custom cake orders and pickups.
Share: Group (everyone edits)

Order (a Note): one cake.
  Customer: Text
  Phone: Phone
  Cake: Long Text
  Price: Money
  Pickup: Date
  Status: Choice (New, Baking, Ready, Picked up)
  Verbs: Remind (1 day before Pickup), Total (Price, this week)
  Show: grouped by Status
```

Needs: Remind, grouping. Phone needs to tap to call.

### 7. Birthdays (just me)

```
Birthdays
For: never missing one.
Share: Just me

Birthday (a Note): someone to celebrate.
  Name: Text
  Day: Date, Repeat (every year)
  Until: Days
  Verbs: Remind (3 days before)
  Show: soonest first
```

Needs: Repeat, Days, Remind.

### 8. House Chores (group)

```
House Chores
For: who does what this week.
Share: Group (everyone edits)

Chore (a Note): one job around the house.
  Chore: Text
  Who: Person
  Every: Repeat (weekly)
  Verbs: Done, Assign
  Show: grouped by Who
```

Needs: Repeat (Done comes back next week), Assign, grouping.

### 9. Recovery Steps (just me)

```
My Recovery
For: the steps I'm working and the days I've kept.
Share: Just me

Clean Since (an Event): the day I started.
  Day: Date
  Days: Days (since)
Step (a Note): one step.
  Step: Number
  What it means to me: Long Text
  Verbs: Done
  Show: by Step
```

Needs: Days.

### 10. Job Match (public)

```
Job Match
For: work in Seattle, with pay up front.
Share: Public

Job Post (a Post): a job, or someone looking.
  Kind: Choice (Job, Looking)
  Pay: Money
  Labels
  Verbs: Post, Message, Match (Looking with Job, by labels), Save, Renew, Report, Block
```

Needs nothing new. It's the boards we built.

## What the paper test found

All 10 fit. Every missing word is small and shared, so building it once helps many dictionaries:

| Missing | Used by |
|---|---|
| **Remind** | Lockers, Bakery, Birthdays. Needs phone or email alerts first, which Stardust doesn't have yet. |
| **Repeat** | Birthdays, Chores |
| **Days** | Birthdays, Recovery |
| **Timer**, **Start**, **Stop** | Focus Timer, Check-in |
| **Assign** | Lockers, Chores |
| **Request**, **Approve** | Lockers |
| **Show: grouped by a Choice** | Lockers, Bakery, Chores |
| **Check**, **Rating** | None of the 10 yet. Hold them until someone needs them. |

Things that still need a dictionary built by hand, because no small word covers them: Idea House judging, Manifesto Match's matching by shared words, and Wolffie's printable packets. Each reuses Core words wherever it can.

## Build order

1. Add the Nouns, Tools, and Verbs above to the Core dictionary as terms, so anyone can read the toolbox in Core's Term View.
2. The engine: a written dictionary becomes a working one, using the Stardust style. Start with Just me, the tools that exist, Done, Order, Total.
3. Timer, Start, Stop. Then Focus Timer works.
4. Sage writes dictionaries: asks what you need, points you to Core, writes the page, shows a preview, builds it on yes. Missing words go to the Wanted list.
5. Groups and who writes. Then Assign, grouping, Request and Approve. Then Lockers works.
6. Repeat and Days. Then Birthdays, Chores, and Recovery work.
7. Alerts, then Remind.
8. Public dictionaries with steward review.
9. Move my dictionaries onto Core words, one at a time, Night DS first, only where nothing is lost.

The built-dictionary form from 0028 (+ Create my own) becomes step 2's starting point: it already stores a dictionary's fields and entries in the Stardust style.
