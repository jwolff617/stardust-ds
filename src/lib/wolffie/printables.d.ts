type Page = { how: string; svg: string };
export declare const P: {
  helicopter(): Page;
  bracelet(): Page;
  badge(label: string): Page;
  stickers(group: string): Page;
  wordsearch(title: string, words: string[], grade: number | "m", seed?: number): Page;
  octopus(): Page;
  bee(): Page;
  mandala(seed?: number, grade?: number | "m"): Page;
};
