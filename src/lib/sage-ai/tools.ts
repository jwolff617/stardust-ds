import type Anthropic from "@anthropic-ai/sdk";
import { TIME_FRAMES } from "@/lib/time-frames";

// Each tool is one Core verb (Add, Remove, Edit, Delete, Archive, Restore,
// Find, Share, Label) applied to one noun, plus Night DS's Done. Verbs that need someone on the other end
// (Connect, Match, Message, Email, Call, Vote) or money (Buy, Sell, Trade,
// Give) have no tool yet.
export const SAGE_AI_TOOLS: Anthropic.Tool[] = [
  {
    name: "note_write",
    description:
      "Add: write a new Note in the user's Night DS. Notes have no title, only content. Every note has a time frame, its life: when it runs out the note archives itself. A day note archives at the user's midnight; life never expires.",
    input_schema: {
      type: "object",
      properties: {
        body: { type: "string", description: "The note's content." },
        time_frame: { type: "string", enum: [...TIME_FRAMES], description: "How long the note lives. Default day." },
        label: {
          type: "string",
          description: "Optional single label: goal, lesson, memory, idea, person, place, or any custom word.",
        },
      },
      required: ["body"],
    },
  },
  {
    name: "note_edit",
    description:
      "Edit: change a Note's content, label, or time frame, found by its number (its position in the user's active note list, 1-based). A new time frame starts its life now. An empty label clears it.",
    input_schema: {
      type: "object",
      properties: {
        number: { type: "integer", description: "The note's number in the active list (1-based)." },
        body: { type: "string", description: "New content to replace the note with." },
        time_frame: { type: "string", enum: [...TIME_FRAMES] },
        label: { type: "string" },
      },
      required: ["number"],
    },
  },
  {
    name: "note_search",
    description:
      "Find: look through this user's Notes by content. state picks active (default), archived, done, or all. time_frame and label narrow the results. Results include an id for archived and done notes, used by note_restore.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text to search for. Empty matches every note." },
        state: { type: "string", enum: ["active", "archived", "done", "all"] },
        time_frame: { type: "string", enum: [...TIME_FRAMES] },
        label: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    name: "note_done",
    description:
      "Mark a Note Done, found by its number in the active list (1-based). Done notes move to their own archive, so the user can look back at what they did.",
    input_schema: {
      type: "object",
      properties: {
        number: { type: "integer", description: "The note's number in the active list (1-based)." },
      },
      required: ["number"],
    },
  },
  {
    name: "note_archive",
    description: "Archive: set a Note aside before its time frame runs out, found by its number in the active list (1-based).",
    input_schema: {
      type: "object",
      properties: {
        number: { type: "integer", description: "The note's number in the active list (1-based)." },
      },
      required: ["number"],
    },
  },
  {
    name: "note_restore",
    description:
      "Restore: bring an archived or done Note back with a fresh time frame, found by the id from note_search. Ask which time frame the user wants if they haven't said.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The note's id from note_search." },
        time_frame: { type: "string", enum: [...TIME_FRAMES] },
      },
      required: ["id", "time_frame"],
    },
  },
  {
    name: "note_delete",
    description:
      "Delete: erase a Note for good, found by its number (its position in the user's active note list, 1-based).",
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
      "Share: set a Note to public or private, found by its number (its position in the user's active note list, 1-based). Public notes can be read by other users.",
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
      "Find: look up terms and definitions across every dictionary this user has on.",
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
    description: "Add: turn a dictionary on for this user, by name or address.",
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
      "Remove: turn a dictionary off for this user, by name or address. Locked dictionaries (Core, Stardust, both Profiles) always stay on.",
    input_schema: {
      type: "object",
      properties: {
        dictionary: { type: "string", description: "The dictionary's name or address." },
      },
      required: ["dictionary"],
    },
  },
  {
    name: "dictionary_find",
    description:
      "Find: look for dictionaries by name, description, or label (e.g. 'match', 'marketplace', 'seattle'). Also finds other sparks' Public Profiles.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "A word to look for." },
      },
      required: ["query"],
    },
  },
  {
    name: "dictionary_label",
    description:
      "Label: add or remove a label on a dictionary this user owns, including their own Public Profile, Night DS, and other personal dictionaries. Labels help people find the dictionary.",
    input_schema: {
      type: "object",
      properties: {
        dictionary: {
          type: "string",
          description: "The dictionary's name or address, e.g. 'Public Profile' or 'Night DS'.",
        },
        label: { type: "string", description: "One short word or phrase." },
        action: { type: "string", enum: ["add", "remove"] },
      },
      required: ["dictionary", "label", "action"],
    },
  },
  {
    name: "profile_edit",
    description:
      "Edit: change a field on this user's Private or Public Profile, and optionally whether a Public Profile field is public. Never accepts card numbers.",
    input_schema: {
      type: "object",
      properties: {
        profile: { type: "string", enum: ["private", "public"] },
        field: { type: "string", description: "The field's name, e.g. 'Neighborhood' or 'City'." },
        value: { type: "string", description: "The new value. Leave out to only change visibility." },
        visibility: { type: "string", enum: ["public", "private"] },
      },
      required: ["profile", "field"],
    },
  },
];
