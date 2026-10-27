import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { anthropic, MODEL_CAPABLE, MODEL_FAST } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/sage-ai/system-prompt";
import { availableNouns, buildTools, describeNouns, loadCopies, runTool, todayIn, type NounContext } from "@/lib/sage-ai/engine";
import { NOUNS } from "@/lib/sage-ai/nouns";
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
  if (!prompt) {
    return Response.json({ error: "Message can't be empty." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
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
  const tools = buildTools(nouns);
  const today = todayIn(timeZone);
  const nounContext: NounContext = {
    supabase,
    userId: user.id,
    displayName: profile?.display_name ?? null,
    timeZone,
    today,
    copies,
  };
  const systemPrompt = await buildSystemPrompt(supabase, profile?.display_name ?? null, describeNouns(nouns, copies), today);
  const conversationIdForClosure = activeConversationId;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (text: string) => controller.enqueue(encoder.encode(text));

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
            const result = await runTool(nouns, nounContext, block.name, block.input as Record<string, unknown>);
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
