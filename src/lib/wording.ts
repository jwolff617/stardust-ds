// Plain checks on the words people send. They catch the common scams and
// explain why; they're guidance, not legal advice.

type Rule = { re: RegExp; why: string };

const SCAMS: Rule[] = [
  { re: /\b(verif(y|ication)|confirm(ation)?|security|6[- ]?digit|six[- ]digit)( your)? (code|number)\b|\bgoogle voice\b|\bsend (me )?the code\b|\bcode (i|we) (just )?sent\b/i, why: "Never share a code sent to your phone. It lets someone take over your number or accounts." },
  { re: /\bgift ?cards?\b|\bitunes cards?\b|\bsteam cards?\b|\bbitcoin\b|\bcrypto\b|\bwestern union\b|\bmoney ?gram\b|\bwire (the |me )?(money|transfer)\b/i, why: "Gift cards, crypto, and wires can't be taken back. Real buyers and landlords don't ask for them." },
  { re: /\bcashier'?s? check\b|\bmoney order\b|\bsend (back )?the (extra|difference|rest)\b|\boverpa(y|id|yment)\b/i, why: "An overpaid check that you send money back from is a scam. The check bounces days later and you lose what you sent." },
  { re: /\b(my|our) (shipper|mover|agent|assistant|courier) will\b|\bshipping only\b|\bi'?m (out of town|overseas|away|deployed)\b.*\b(ship|send|mail)\b/i, why: "Someone who can't meet and wants to ship is a common scam. Keep it local and in person." },
  { re: /\b(zelle|venmo|cash ?app|paypal)\b.*\b(deposit|hold|first|before|ahead|now)\b|\b(deposit|hold) .*\b(zelle|venmo|cash ?app|paypal)\b/i, why: "Never pay to hold something or a deposit before you've seen it in person. Pay when it's in your hands." },
  { re: /\b(deposit|first month|application fee).{0,40}\b(before|without) (seeing|a showing|viewing|meeting)\b|\bcan'?t show (you )?(the|it)\b/i, why: "Never pay a deposit before you've seen the place inside and met the person. Rental scams copy real listings." },
  { re: /\b(pay|buy) (for )?(your |the )?(training|equipment|starter kit|uniform|background check)\b|\breship(ping)? (packages|items)\b|\bpackage (forward|reship)/i, why: "A real job never asks you to pay to start or to reship packages." },
  { re: /\b(social security|ssn|bank account|routing number|account number|debit card (number|pin))\b/i, why: "Don't send your Social Security number or bank details in a message. Paperwork comes after you're hired, in person." },
];

export function scamWarning(text: string): string | null {
  for (const rule of SCAMS) if (rule.re.test(text)) return rule.why;
  return null;
}

// A phone number or email in a post body: allowed, with a note.
export function hasContactInfo(text: string): boolean {
  return /\b\d{3}[\s.)-]*\d{3}[\s.-]*\d{4}\b/.test(text) || /\b[\w.+-]+@[\w-]+\.[\w.]+\b/.test(text);
}
