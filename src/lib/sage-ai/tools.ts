import type Anthropic from "@anthropic-ai/sdk";

// One tool per Core/Night DS verb Sage AI is allowed to execute in v1.
// Buy/Sell/Give/Receive are real Core words but have no processor behind
// them yet, so they're deliberately left out of this list.
export const SAGE_AI_TOOLS: Anthropic.Tool[] = [
  {
    name: "note_write",
    description: "Create a new personal Note under Night DS. Notes have no title -- just content.",
    input_schema: {
      type: "object",
      properties: {
        body: { type: "string", description: "The note's content." },
      },
      required: ["body"],
    },
  },
  {
    name: "note_edit",
    description:
      "Replace the content of an existing personal Note, found by its number (its position in the user's active note list, 1-based).",
    input_schema: {
      type: "object",
      properties: {
        number: { type: "integer", description: "The note's number in the active list (1-based)." },
        body: { type: "string", description: "New content to replace the note with." },
      },
      required: ["number", "body"],
    },
  },
  {
    name: "note_search",
    description:
      "Search this user's personal Notes by content. Archived notes are excluded unless includeArchived is true.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text to search for." },
        includeArchived: { type: "boolean" },
      },
      required: ["query"],
    },
  },
  {
    name: "note_delete",
    description:
      "Permanently delete a personal Note, found by its number (its position in the user's active note list, 1-based). Archiving is whole-dictionary only (done from Display View), so this is the only way to remove a single note.",
    input_schema: {
      type: "object",
      properties: {
        number: { type: "integer", description: "The note's number in the active list (1-based)." },
      },
      required: ["number"],
    },
  },
  {
    name: "note_share",
    description:
      "Set a personal Note's visibility to public or private, found by its number (its position in the user's active note list, 1-based). Public notes can be read by other users.",
    input_schema: {
      type: "object",
      properties: {
        number: { type: "integer", description: "The note's number in the active list (1-based)." },
        visibility: { type: "string", enum: ["public", "private"], description: "'public' or 'private'." },
      },
      required: ["number", "visibility"],
    },
  },
  {
    name: "info_search",
    description:
      "Search the terms and definitions of every dictionary this user currently has opted into (shared and personal).",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text to search for." },
      },
      required: ["query"],
    },
  },
  {
    name: "dictionary_add",
    description: "Opt this user into a dictionary by name or address, adding its vocabulary.",
    input_schema: {
      type: "object",
      properties: {
        dictionary: { type: "string", description: "The dictionary's name or address." },
      },
      required: ["dictionary"],
    },
  },
  {
    name: "dictionary_remove",
    description:
      "Opt this user out of a dictionary by name or address. Fails for locked dictionaries (Core).",
    input_schema: {
      type: "object",
      properties: {
        dictionary: { type: "string", description: "The dictionary's name or address." },
      },
      required: ["dictionary"],
    },
  },
];
