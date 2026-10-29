// Plain checks that run on the words people post. They catch the common
// cases and explain the rule; they're guidance, not legal advice, and
// Stardust's rules are stricter than the law on purpose.

export type WordingCheck = "housing" | "hiring";
export type WordingIssue = { phrase: string; why: string };

type Rule = { re: RegExp; why: string };

const HOUSING: Rule[] = [
  { re: /\b(no|not for|without) (kids|children|families)\b|\badults? only\b|\bno (babies|toddlers)\b|\bperfect for (a )?(single|couple)s?\b/i, why: "Housing posts can't turn away families with kids." },
  { re: /\bno (section ?8|vouchers?|housing (vouchers?|assistance)|subsid(y|ies|ized))\b|\b(section ?8|vouchers?) not accepted\b/i, why: "In Washington, a landlord can't refuse someone because of how they pay rent, like a voucher or Section 8." },
  { re: /\b(christians?|muslims?|jews|jewish|catholics?|buddhists?|hindus?|mormons?|believers?)( (only|preferred|wanted|household))\b|\b(church|faith)[- ]going (only|preferred)\b/i, why: "Housing posts can't prefer or exclude a religion." },
  { re: /\b(males?|females?|men|women|guys?|girls?|ladies|gentlem[ae]n|man|woman)( only| preferred|-only)\b|\bno (men|women|males|females|guys|girls)\b/i, why: "Housing posts can't prefer a sex or gender. If you're sharing your own home as roommates, say so and describe the space." },
  { re: /\b(no|not for) (disabled|wheelchairs?|handicapped|service animals?)\b|\bmust be able[- ]bodied\b|\bno (mental illness|addicts?)\b/i, why: "Housing posts can't exclude people with disabilities. Service animals aren't pets, so a no-pets rule doesn't cover them." },
  { re: /\b(english speakers? only|must speak (perfect )?english|americans? only|citizens? only|no (immigrants|foreigners|refugees))\b/i, why: "Housing posts can't exclude people by where they're from." },
  { re: /\b(no|not for) (gays?|lesbians?|lgbtq?\+?|trans(gender)?( people)?)\b|\bstraight only\b/i, why: "Housing posts can't exclude people by sexual orientation or gender identity." },
  { re: /\b(white|black|asian|hispanic|latino|latina)s? (only|preferred)\b|\b(quiet|nice|safe) (white|christian) (neighborhood|family|home)\b/i, why: "Housing posts can't prefer or exclude a race." },
  { re: /\bno (felons?|criminals?|criminal (record|history|background)s?|ex[- ]?cons?|records?)\b/i, why: "Stardust asks housing posts not to shut out people with records. Describe the place and the rules of the house instead." },
  { re: /\bno (military|veterans?|soldiers)\b/i, why: "Housing posts can't exclude veterans or military families." },
];

const HIRING: Rule[] = [
  { re: /\b(young|youthful|energetic young|recent (college )?grads? only|digital natives?|under (2|3|4)\d|max(imum)? age)\b/i, why: "Job posts can't prefer an age. Say what the work needs instead, like lifting 30 pounds or being on your feet." },
  { re: /\b(males?|females?|men|women|guys?|girls?|ladies|man|woman)( only| preferred| wanted)\b|\bwaitress(es)?\b|\bsalesm[ae]n\b/i, why: "Job posts can't prefer a sex or gender. Name the job, not the person: server, salesperson." },
  { re: /\bno (felons?|criminals?|criminal (record|history|background)s?|ex[- ]?cons?|records?)\b|\bclean (criminal )?record (required|only)\b|\bmust pass (a )?background check\b/i, why: "Seattle's Fair Chance rules keep job ads from shutting out people with records. Many people here are rebuilding, and many employers welcome them." },
  { re: /\b(native|perfect|unaccented) english\b|\bamericans? only\b|\bcitizens? only\b|\bmust be (a )?(us |u\.s\. )?citizen\b/i, why: "Job posts can't require a native language or citizenship unless the law requires it. Say what language the work uses: \"speaks English with customers.\"" },
  { re: /\b(able[- ]bodied|no (disabled|disabilities|handicapped))\b/i, why: "Job posts can't exclude people with disabilities. Describe the tasks, and people can ask for what they need." },
  { re: /\b(christians?|muslims?|catholics?|believers?) (only|preferred)\b/i, why: "Job posts can't prefer a religion." },
  { re: /\b(no|not hiring) (moms|mothers|parents|pregnant)\b|\bno (kids|children) at home\b/i, why: "Job posts can't exclude parents or pregnant people." },
];

export function checkWording(check: WordingCheck, text: string): WordingIssue[] {
  const rules = check === "housing" ? HOUSING : HIRING;
  const issues: WordingIssue[] = [];
  for (const rule of rules) {
    const m = text.match(rule.re);
    if (m && !issues.some((i) => i.why === rule.why)) issues.push({ phrase: m[0], why: rule.why });
  }
  return issues;
}

// Common scam lines in a message. Returns a plain warning, or null.
const SCAMS: Rule[] = [
  { re: /\b(verif(y|ication)|confirm(ation)?|security|6[- ]?digit|six[- ]digit)( your)? (code|number)\b|\bgoogle voice\b|\bsend (me )?the code\b|\bcode (i|we) (just )?sent\b/i, why: "Never share a code sent to your phone. It lets someone take over your number or accounts." },
  { re: /\bgift ?cards?\b|\bitunes cards?\b|\bsteam cards?\b|\bbitcoin\b|\bcrypto\b|\bwestern union\b|\bmoney ?gram\b|\bwire (the |me )?(money|transfer)\b/i, why: "Gift cards, crypto, and wires can't be taken back. Real buyers and landlords don't ask for them." },
  { re: /\bcashier'?s? check\b|\bmoney order\b|\bsend (back )?the (extra|difference|rest)\b|\boverpa(y|id|yment)\b/i, why: "An overpaid check that you send money back from is a scam. The check bounces days later and you lose what you sent." },
  { re: /\b(my|our) (shipper|mover|agent|assistant|courier) will\b|\bshipping only\b|\bi'?m (out of town|overseas|away|deployed)\b.*\b(ship|send|mail)\b/i, why: "Someone who can't meet and wants to ship is a common scam. Keep it local and in person." },
  { re: /\b(zelle|venmo|cash ?app|paypal)\b.*\b(deposit|hold|first|before|ahead|now)\b|\b(deposit|hold) .*\b(zelle|venmo|cash ?app|paypal)\b/i, why: "Never pay to hold something or a deposit before you've seen it in person. Pay when it's in your hands." },
  { re: /\b(deposit|first month|application fee).{0,40}\b(before|without) (seeing|a showing|viewing|meeting)\b|\bcan'?t show (you )?(the|it)\b/i, why: "Never pay a deposit before you've seen the place inside and met the person. Rental scams copy real listings." },
  { re: /\b(pay|buy) (for )?(your |the )?(training|equipment|starter kit|uniform|background check)\b|\breship(ping)? (packages|items)\b|\bpackage (forward|reship)/i, why: "A real job never asks you to pay to start or to reship packages." },
];

export function scamWarning(text: string): string | null {
  for (const rule of SCAMS) if (rule.re.test(text)) return rule.why;
  return null;
}

// A phone number or email in a post body: allowed, with a note.
export function hasContactInfo(text: string): boolean {
  return /\b\d{3}[\s.)-]*\d{3}[\s.-]*\d{4}\b/.test(text) || /\b[\w.+-]+@[\w-]+\.[\w.]+\b/.test(text);
}
