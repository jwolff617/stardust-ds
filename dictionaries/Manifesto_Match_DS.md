# Manifesto Match DS

Write who you are in your own words, and find people who share them: friends, business partners, and later, dates. A port of the prototype in `../manifesto-match/` onto Posts. You pick words from a list (Presence, Honest, Roots, Play...), write one line about what each means to you, and you match with people by the words you share.

This is the most Stardust board of the five: everyone writes a small personal dictionary, and people find each other through their definitions.

## What the incumbents do

**Hinge.** Prompts ("A shower thought I recently had...") give people something real to react to. "Designed to be deleted." Likes go to a specific photo or prompt, so openers aren't generic.
- Bad: photos still decide most of it. Paid tiers ("Hinge X") sell visibility. Ghosting is normal. Endless swiping.

**Bumble and Bumble BFF.** Women message first. BFF tries to make friendship a real thing to look for.
- Bad: same swipe loop, profiles judged in a second, paid boosts, and friend matches that fizzle after "hey."

**Meetup.** Real-life groups by interest.
- Bad: paid organizer fees push groups out, and it's about activities, not about who you are.

**LinkedIn and cofounder sites (YC Co-Founder Matching).** Business partners by skills.
- Bad: résumé first, values last. Most partnerships break over values, not skills.

**The prototype.** Pick 10 to 20 words, write 1 to 3 sentences for each, set age, city, how far you'd go, and what you're looking for (love, kids and family, building things, home, friendship, activities, ideas). Matches score shared words, shared wants, age, and place. A chat per match.
- Keep: the words and your own lines for them, matching by shared words, the shared-word chips on each match, an excerpt from their manifesto on a word you share, and messaging.
- Change: fewer words (5 to 12 is enough and works on a phone), "what you're looking for" becomes the kind (Friends, Business Partners, Dating), and the score is shown as shared words, not a percent that feels like a grade.

## What Stardust does differently

1. **Words first, no photos.** You meet someone through how they define Honest and Home. Photos can come later in a conversation if both want.
2. **You see others only after you write yours.** No lurkers. Everyone browsing a kind has put their own manifesto up for it. The database keeps this rule.
3. **18+ for the whole board.** A birth date check before anything opens; only the yes is kept.
4. **Matches by shared words, newest people never buried.** Sorted by how many words you share, then by newest.
5. **Say hello by quoting a line.** The first message starts from a word you share ("You wrote about Roots..."), so openers aren't "hey."
6. **One manifesto per kind.** Friends, Business Partners, and Dating each get their own, because who you are as a friend and as a partner reads differently. Pause one any time.
7. **No paid boosts, no swipe limit games, no "who liked you" paywall.** Nothing is for sale.
8. **Dating opens last.** Friends and Business Partners open first. Dating is built (18+, its own fields, mutual fit) but stays closed until Sage opens it, once there are stewards ready.

## Kinds and fields

| Kind | Words | Its own fields | Opens |
|---|---|---|---|
| Friends | 5 to 12 | Into (what you love doing), Free when | Now |
| Business Partners | 5 to 12 | What I'm building, What I bring, What I need | Now |
| Dating | 5 to 12 | Age (18+), I am (a woman, a man, nonbinary), Hoping to meet (women, men, everyone), Ages open to (from, to), Looking for (something serious, seeing where it goes) | When Sage opens it |

Every manifesto has a headline (the title), a few lines about you (the body), and a neighborhood. Manifestos don't expire, since they're yours; pause one by closing it.

**The words (48).** From the Stardust Dictionary: Love, Presence, Empathy, Peace, Freedom, Community, Family, Forgiveness, Imagination, Nature, Music, Art, Dream, Purpose, Passion, Growth, Balance, Relax, Stories, Travel, Sports, Yes, Focus, Energy, Spirit, Soul, Body, Confidence, Time, Innocence. From the prototype: Roots, Risk, Slowness, Depth, Wonder, Loyalty, Craft, Solitude, Tender, Play, Legacy, Wild, Honest, Grounded, Vision, Simple, Curious, Home.

**Dating fit.** Both ways: their Hoping to meet includes who you are, yours includes who they are, and each of your ages is in the other's range. A Dating match only shows if it fits both ways.

## The words of the board

| Term | Part | Definition |
|---|---|---|
| Manifesto | noun | Who you are, in your own words: a headline, a few lines, and the words that matter most to you, each with what it means to you. |
| Line | noun | One word from your manifesto and what it means to you, in a sentence or two. |
| Match | verb | Find the sparks who share your words. The more words you share, the higher they show. |
| Say Hello | verb | Send the first private message to a match, starting from a word you share. |
| Pause | verb | Take your manifesto down for now. You won't show up, and you won't see others, until you unpause. |
| Business Partner | noun | Someone to build a thing with, found by shared words before skills. |

## Safety and operations

**Before anything opens:** the 18+ check and the rules:
- Be who you are. One manifesto per kind, about you.
- Meet somewhere public the first time, and tell a friend where you'll be.
- No sexual messages unless you both want them, and never on Friends or Business Partners.
- Block anyone who makes you uneasy. Report anyone who is unsafe.

**Reports.** On every manifesto and every conversation. Reasons include Sexual and Unsafe. Three reports hide a manifesto until a steward looks. A reported conversation is the only private message a steward reads.

**Blocks.** Both ways, immediate, and undoable.

**Mutual seeing.** If you pause your manifesto, you stop seeing others in that kind. Fair both ways.

**Who reviews.** Stewards, starting with Sage. Before Dating opens, at least two stewards (Sage plus one person Sage trusts, ideally not a man alone) and a promise to look at Dating reports within a day.

**Opening Dating.** One line in the SQL editor when ready:

```sql
update post_kinds set open = true
where name = 'Dating' and dictionary_id = (select id from dictionaries where address = 'manifesto-match-ds');
```

**Scams.** Romance scams ask for money, crypto, gift cards, or to move to another app fast. The scam notes in threads cover money; the safety notes on the board say "never send money to someone you haven't met."

## Sage AI

Noun **Manifesto** is not given to Sage AI on purpose. A manifesto is a person speaking for themselves, and matching people is too personal to hand to an assistant. Sage AI can still explain the board's words. (Later: Sage AI could help someone draft their lines, shown to them to edit, never posted for them.)

## Real people, walked through

**Denise, Recovery Cafe member, looking for friends.** She confirms 18+, opens Friends, picks Presence, Forgiveness, Honest, Music, Nature, Slowness. For Forgiveness she writes "I've needed a lot of it. I give it easily now." Into: walks, gospel choir. Her matches show two people sharing four words; one shares Forgiveness and Music. Their excerpt on Forgiveness reads close to hers. She says hello starting from that word.
- Check: works on the Cafe computer; no photos to stress about; the starter makes the first message easy.

**Marcus, SHARE participant, library computer and a phone.** He writes a Business Partners manifesto: building a bike repair stand; brings 5 years fixing bikes; needs someone good with money and permits. Words: Craft, Honest, Community, Risk, Simple. He matches with Tom on Craft, Community, Simple. They talk, and the idea goes on Idea Index too.
- Check: Business Partners works the same on a library computer; the thread carries across devices.

**Priya, YMCA staff, Friends.** New to Seattle. Her manifesto says Play, Curious, Nature, Family, Yes. She pauses it on weekends she's away; unpausing brings everyone back.
- Check: Pause and Unpause work (close and reopen), and while paused she sees nobody.

**A neighbor in Greenwood, Dating (once open).** He's 41, a man, hoping to meet women 35 to 48. He only sees women in that range whose own ranges include 41. Someone sends a message asking him to move to WhatsApp and invest in crypto; the Careful note shows, he reports the conversation, which blocks her too.

## How it grows

1. **Sage's circle and Urban Wolf readers, Friends and Business Partners first.** A small, real group writes manifestos so the board isn't empty.
2. **Recovery Cafe:** Friends, as a quiet way to find people in recovery who share words like Forgiveness and Presence. A Cafe staff steward.
3. **Idea House and Idea Index builders:** Business Partners.
4. **Dating, last,** once there are two stewards and Sage opens it.

## Later

- Your Stardust order (from the README's ideas): the order of your words as how much each matters, used in matching.
- Groups of three or four friends who share words, meeting at a real place.
- Sage AI as a drafting help for your lines, shown to you, never posted for you.
