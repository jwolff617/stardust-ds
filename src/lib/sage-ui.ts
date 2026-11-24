// What Sage AI tells the page to show. The Sage AI route streams plain
// text, and slips these in between two record-separator characters so
// the page can pull them out of the stream.

export const UI_MARK = "\u001e";

export type WordFields = {
  place?: string;
  people?: string;
  time?: string;
  visibility?: string;
};

// One thing a search found.
export type FoundWord = WordFields & {
  kind: string;
  id: string;
  word: string;
  body: string;
  createdAt?: string;
  // How well it fits the search: higher shows first.
  score?: number;
  // Matches: the words shared, and a line of the kind's own details.
  shared?: string[];
  details?: string;
};

export type UiDirective =
  // A word fills WORD, the rectangle, and the row of four.
  // kind and id say what it is (a note, a journal entry...) so it can be edited.
  | ({ type: "word"; word: string; body: string; kind?: string; id?: string } & WordFields)
  // A dictionary's own view, or one of the app's panels, in the rectangle.
  | { type: "view"; id: string; name: string }
  | { type: "panel"; panel: "settings" | "organizations" | "new-notebook" | "reports" | "inbox" | "profile" | "nouns"; section?: string }
  // Search results, listed in the rectangle.
  // A list: search results, or "your journals" from a shortcut (title, and
  // the thing so Create makes one of them).
  | { type: "results"; query: { word?: string; body?: string } & WordFields; items: FoundWord[]; title?: string; thing?: string }
  // Back to the blank search form.
  | { type: "clear" }
  // Open one word by what it is and its id (a hotkey to an org or entry).
  | { type: "open"; kind: string; id: string }
  // Today's Word List changed: reload it.
  | { type: "word-list" };

export function encodeDirective(d: UiDirective): string {
  return `${UI_MARK}${JSON.stringify(d)}${UI_MARK}`;
}

// Splits streamed text into the words to show and the directives in it.
// Returns what's left over when a directive hasn't fully arrived yet.
export function splitStream(buffer: string): { text: string; directives: UiDirective[]; rest: string } {
  let text = "";
  const directives: UiDirective[] = [];
  let i = 0;
  while (i < buffer.length) {
    const start = buffer.indexOf(UI_MARK, i);
    if (start === -1) {
      text += buffer.slice(i);
      return { text, directives, rest: "" };
    }
    text += buffer.slice(i, start);
    const end = buffer.indexOf(UI_MARK, start + 1);
    if (end === -1) return { text, directives, rest: buffer.slice(start) };
    try {
      directives.push(JSON.parse(buffer.slice(start + 1, end)) as UiDirective);
    } catch {
      // A broken directive is dropped; the reply text still shows.
    }
    i = end + 1;
  }
  return { text, directives, rest: "" };
}
