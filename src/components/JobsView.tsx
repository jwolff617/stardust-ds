"use client";

import { JOB_MATCH } from "@/lib/boards";
import { BoardView } from "./board/BoardView";

// Job Match: Jobs and Looking posts, on the shared board layout.
export function JobsView({ dictionary, reloadKey = 0 }: { dictionary: { id: string; name: string }; reloadKey?: number }) {
  return <BoardView dictionary={dictionary} reloadKey={reloadKey} config={JOB_MATCH} />;
}
