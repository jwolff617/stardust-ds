# Stardust Style Guide

Every dictionary's Display View reads and works the same way. If someone learns one, they know them all. The pieces live in `src/components/ui.tsx` (entries) and `src/components/board/` (post boards). Use them. Don't write new classes for something that already has one.

## Words

- Plain English, short. No jargon, no AI-speak.
- The same action gets the same word everywhere: **+ New**, **Edit**, **Mark done**, **Archive**, **Restore**, **Delete**, **Save**, **Report**, **Block**.
- Tabs on a post board are always **Browse, Messages, Saved, Yours** (plus **Review** for stewards).

## An entry (a note, a story, a log line)

1. What you wrote, first, in normal text.
2. One quiet gray line under it: the date, then tags.
3. Buttons at the end of that line. The ✕ sits last, set apart.

## Lists and sections

- A section has one header line: the title, a gray count, and **Show** / **Hide** on the right. Logs you check often start open. Logs that are mostly bookkeeping start hidden. Use `Section`.
- A list shows its **5 most recent** items, newest first. **Show all N** opens the rest, **Show 5 most recent** closes them.
- Every list has a **Search** box. It finds items holding every word typed, in any field you can see: the text, the date, the tags. While searching, all matches show, with a gray "3 found" or "Nothing matches" line under them.
- Use `useListSearch`, `SearchBox` and `ListFooter`.

## Dates

One format: `Oct 29`. The year shows only when it isn't this year. The time shows only where it matters (`Oct 29, 7:30 PM`). Use `formatDate`.

## Tags and labels

- Gray rounded tags for what an entry is (a kind, an outcome, a principle).
- Labels on posts show as `#label`.
- Filters are chips. Blue means picked. You can pick more than one. Picking none shows everything.

## Buttons

- **Primary** (black, filled): the one main action on the screen, like + New, Post or Save.
- **Quiet** (outlined): the other actions, like Mark done or Archive.
- **Link** (underlined text): small actions inside an open item.

## Delete

Deleting never asks "are you sure". The item disappears right away and an **Undo** bar shows for 8 seconds. Use `useUndoDelete` and `UndoBar`.

## Keep it lean

A dictionary adds only what it truly needs. Ask Sage first before adding new fields, kinds or features.
