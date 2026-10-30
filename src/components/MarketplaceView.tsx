"use client";

import { MARKETPLACE } from "@/lib/boards";
import { BoardView } from "./board/BoardView";

// Marketplace: For Sale, Free, and Housing, on the shared board layout.
export function MarketplaceView({ dictionary, reloadKey = 0 }: { dictionary: { id: string; name: string }; reloadKey?: number }) {
  return <BoardView dictionary={dictionary} reloadKey={reloadKey} config={MARKETPLACE} />;
}
