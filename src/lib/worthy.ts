// Worthy DS: Urban Wolf Studio's betting system. Save half of every win.
// Pure math, safe to import from client and server.

export const WORTHY_KINDS = ["deposit", "win", "savings", "balance"] as const;
export type WorthyKind = (typeof WORTHY_KINDS)[number];

export const WORTHY_KIND_LABELS: Record<WorthyKind, string> = {
  deposit: "Deposit",
  win: "Win",
  savings: "Savings",
  balance: "Balance",
};

export const BET_OUTCOMES = ["win", "loss", "missed", "other"] as const;
export type BetOutcome = (typeof BET_OUTCOMES)[number];

export const BET_OUTCOME_LABELS: Record<BetOutcome, string> = {
  win: "Win",
  loss: "Loss",
  missed: "Missed opportunity",
  other: "Other",
};

export const PRINCIPLES = ["unique", "present", "open_minded", "fun", "good_reason", "heart"] as const;
export type Principle = (typeof PRINCIPLES)[number];

export const PRINCIPLE_LABELS: Record<Principle, string> = {
  unique: "Every game and week is unique. Let go of the past.",
  present: "Be present.",
  open_minded: "Be open minded.",
  fun: "Have fun.",
  good_reason: "Have a good reason: research informed or just having fun.",
  heart:
    "The best bets come from the heart. Find what the books missed, the story no one is talking about. Read the stats, the players, the situation. Love the game and good bets reveal themselves. Less is more.",
};

export const PRINCIPLE_SHORT: Record<Principle, string> = {
  unique: "Unique",
  present: "Present",
  open_minded: "Open minded",
  fun: "Fun",
  good_reason: "Good reason",
  heart: "Heart",
};

export type WorthyEntry = { kind: WorthyKind; amount: number; occurredAt: string };

export type WorthySummary = {
  deposits: number;
  wins: number;
  savings: number;
  savingsOwed: number;
  // Positive means more savings are due; zero or below means the rule is met.
  savingsGap: number;
  startBalance: number;
  balance: number;
  hasBalance: boolean;
  loss: number;
  savingsPctOfDeposits: number | null;
  balancePctOfDeposits: number | null;
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// Sums a range. `start` null means life. Loss = deposits minus the change
// in balance over the range minus savings. Over life the starting balance
// is zero, so this is exactly deposits - current balance - savings.
export function summarize(entries: WorthyEntry[], start: Date | null): WorthySummary {
  const startMs = start?.getTime() ?? -Infinity;
  let deposits = 0;
  let wins = 0;
  let savings = 0;
  let startBalance = 0;
  let startBalanceAt = -Infinity;
  let balance: number | null = null;
  let balanceAt = -Infinity;

  for (const e of entries) {
    const at = new Date(e.occurredAt).getTime();
    if (e.kind === "balance") {
      if (at < startMs && at > startBalanceAt) {
        startBalance = e.amount;
        startBalanceAt = at;
      }
      if (at > balanceAt) {
        balance = e.amount;
        balanceAt = at;
      }
      continue;
    }
    if (at < startMs) continue;
    if (e.kind === "deposit") deposits += e.amount;
    else if (e.kind === "win") wins += e.amount;
    else if (e.kind === "savings") savings += e.amount;
  }

  const currentBalance = balance ?? startBalance;
  const savingsOwed = wins / 2;
  const pct = (n: number) => (deposits > 0 ? round((n / deposits) * 100) : null);

  return {
    deposits: round(deposits),
    wins: round(wins),
    savings: round(savings),
    savingsOwed: round(savingsOwed),
    savingsGap: round(savingsOwed - savings),
    startBalance: round(startBalance),
    balance: round(currentBalance),
    hasBalance: balance !== null,
    loss: round(deposits - (currentBalance - startBalance) - savings),
    savingsPctOfDeposits: pct(savings),
    balancePctOfDeposits: pct(currentBalance),
  };
}
