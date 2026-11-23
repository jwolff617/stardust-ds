import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { anthropic, MODEL_CAPABLE, MODEL_FAST } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/sage-ai/system-prompt";
import { availableNouns, buildTools, describeNouns, loadCopies, runTool, todayIn, type NounContext } from "@/lib/sage-ai/engine";
import { NOUNS } from "@/lib/sage-ai/nouns";
import { pageTools, runPageTool } from "@/lib/sage-ai/page-tools";
import { encodeDirective } from "@/lib/sage-ui";
import { cleanPreferences } from "@/lib/preferences";
import { safeTimeZone } from "@/lib/time-frames";

export const dynamic = "force-dynamic";

type ChatMessage = Anthropic.MessageParam;

const MAX_TOOL_TURNS = 6;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "You need to be signed in to use Sage AI." }, { status: 401 });
  }

  const body = await request.json();
  const prompt = String(body.message ?? "").trim();
  const conversationId: string | undefined = body.conversationId;
  const timeZone = safeTimeZone(body.timeZone);
  // What's on the page now, so "edit this" or "match it" has a meaning.
  const onPage = body.onPage && typeof body.onPage === "object" ? (body.onPage as Record<string, unknown>) : null;
  if (!prompt) {
    return Response.json({ error: "Message can't be empty." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, preferences")
    .eq("id", user.id)
    .single();

  let activeConversationId = conversationId;
  let history: ChatMessage[] = [];
  if (!activeConversationId) {
    const { data: conversation, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: prompt.slice(0, 60) })
      .select("id")
      .single();
    if (error || !conversation) {
      return Response.json({ error: "Couldn't start a conversation." }, { status: 500 });
    }
    activeConversationId = conversation.id;
  } else {
    const { data: pastMessages } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", activeConversationId)
      .order("created_at", { ascending: true });

    history = (pastMessages ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  }

  await supabase.from("messages").insert({
    conversation_id: activeConversationId,
    role: "user",
    content: prompt,
  });

  // Tools come from the nouns of the dictionaries the user has on.
  const copies = await loadCopies(supabase);
  const nouns = availableNouns(NOUNS, copies);
  const viewNames = copies.map((c) => c.name.replace(/^.{1,40}?['’]s\s+/, "") || c.name);
  const tools = [...buildTools(nouns), ...pageTools(viewNames)];
  const { data: isModerator } = await supabase.rpc("is_moderator");
  const today = todayIn(timeZone);
  const nounContext: NounContext = {
    supabase,
    userId: user.id,
    displayName: profile?.display_name ?? null,
    timeZone,
    today,
    copies,
  };
  const hotkeys = cleanPreferences(profile?.preferences ?? {}).hotkeys ?? {};
  const hotkeyLines = Object.entries(hotkeys).map(([n, h]) => {
    const copy = h.dictionaryId ? copies.find((c) => c.id === h.dictionaryId) : undefined;
    const where = copy ? ` (dictionary "${copy.name}", ${copy.scope === "personal" ? "private" : copy.scope === "group" ? "group" : "public"})` : "";
    return `- ${n} = ${h.meaning || copy?.name || "?"}${where}`;
  });
  const pageLines: string[] = onPage
    ? ["word", "body", "place", "people", "time", "visibility", "status"]
        .map((k) => (typeof onPage[k] === "string" && onPage[k] ? `- ${k}: ${String(onPage[k]).slice(0, k === "body" ? 2000 : 200)}` : null))
        .filter((l): l is string => Boolean(l))
    : [];
  // What the open word is, whether it's theirs, and how to edit it.
  const openKind = typeof onPage?.kind === "string" ? onPage.kind : "";
  const openId = typeof onPage?.id === "string" && /^[0-9a-f-]{36}$/i.test(onPage.id) ? onPage.id : "";
  if (openKind && openId) pageLines.push(await describeOpenWord(supabase, user.id, openKind, openId));
  const systemPrompt = await buildSystemPrompt(supabase, profile?.display_name ?? null, describeNouns(nouns, copies), today, {
    hotkeys: hotkeyLines.join("\n"),
    onPage: pageLines.join("\n"),
  });
  const conversationIdForClosure = activeConversationId;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (text: string) => controller.enqueue(encoder.encode(text));
      nounContext.emit = (d) => enqueue(encodeDirective(d));

      try {
        let finalText = "";
        let messages: ChatMessage[] = [...history, { role: "user", content: prompt }];
        let model: string = MODEL_FAST;
        let usedTools = false;

        for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
          const toolBlocks: Anthropic.ToolUseBlock[] = [];
          let turnText = "";

          const run = anthropic.messages.stream({
            model,
            max_tokens: 1024,
            system: systemPrompt,
            tools,
            messages,
          });

          run.on("text", (delta) => {
            turnText += delta;
            enqueue(delta);
          });

          const finalMessage = await run.finalMessage();
          for (const block of finalMessage.content) {
            if (block.type === "tool_use") toolBlocks.push(block);
          }

          // Haiku produced no tool call and no text -- ambiguous command,
          // retry once on the more capable model before giving up.
          if (
            model === MODEL_FAST &&
            toolBlocks.length === 0 &&
            turnText.trim().length === 0 &&
            finalMessage.stop_reason === "end_turn"
          ) {
            model = MODEL_CAPABLE;
            continue;
          }

          finalText += turnText;

          if (toolBlocks.length === 0) break;

          usedTools = true;
          messages = [...messages, { role: "assistant", content: finalMessage.content }];

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of toolBlocks) {
            const input = block.input as Record<string, unknown>;
            const result =
              block.name === "search" || block.name === "show"
                ? await runPageTool(block.name, input, { supabase, copies, isModerator: Boolean(isModerator) }, (d) => enqueue(encodeDirective(d)))
                : await runTool(nouns, nounContext, block.name, input);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
              is_error: !result.ok,
            });
          }
          messages = [...messages, { role: "user", content: toolResults }];
        }

        if (!finalText.trim()) {
          finalText = usedTools ? "Done." : "I'm not sure what you're asking -- can you rephrase?";
          enqueue(finalText);
        }

        await supabase.from("messages").insert({
          conversation_id: conversationIdForClosure,
          role: "assistant",
          content: finalText,
        });
        await supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationIdForClosure);
      } catch (err) {
        enqueue(`\n\n[Error: ${(err as Error).message}]`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Conversation-Id": activeConversationId as string,
    },
  });
}

// One line telling Sage which noun, target, and dictionary the open word is,
// and whether the user owns it.
async function describeOpenWord(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, kind: string, id: string): Promise<string> {
  const notYours = `- open: ${kind} ${id}. It isn't theirs, so it can't be edited; offer to save their own version.`;
  if (kind === "note" || kind === "journal") {
    const table = kind === "note" ? "notes" : "journal_entries";
    const { data } = await supabase.from(table).select("owner_user_id, dictionary:dictionaries(name)").eq("id", id).maybeSingle();
    if (!data || data.owner_user_id !== userId) return notYours;
    const d = Array.isArray(data.dictionary) ? data.dictionary[0] : data.dictionary;
    const noun = kind === "note" ? "Note" : "Journal Entry";
    const extra = kind === "note" ? " Visibility goes through Share (public or private); Time is its time_frame (day, week, month, year, decade, life)." : " Journal entries have no visibility or time to change.";
    return `- open: their ${noun}, target ${id}, dictionary "${d?.name ?? ""}". Edit it with noun ${noun}.${extra}`;
  }
  if (["person", "idea", "job", "resource"].includes(kind)) {
    const { data } = await supabase.from("profile_entries").select("owner_user_id").eq("id", id).maybeSingle();
    if (!data || data.owner_user_id !== userId) return notYours;
    return `- open: their Profile Entry (${kind}), target ${id}. Edit word, body, place, people, visibility with noun Profile Entry. Time is when it was made and can't change.`;
  }
  if (kind === "organization") {
    const { data } = await supabase.from("organization_members").select("role").eq("organization_id", id).eq("user_id", userId).maybeSingle();
    if (data?.role !== "admin") return notYours;
    return `- open: their Organization, target ${id}. Edit name, body, kind, place (its neighborhood), people, visibility with noun Organization.`;
  }
  return `- open: a ${kind} from the dictionary. Dictionary words can't be edited.`;
}
