"use client";

import { useEffect, useState } from "react";
import { createPage } from "@/app/actions/dictionaries";
import { createSearch, createWordList, listMakers } from "@/app/actions/listings";
import type { Maker } from "@/lib/listings";
import { MakerFields, type MakerSettings } from "./DictionaryLabels";
import { ListingForm } from "./ListingForm";
import { input, link, primary } from "./ui";

type Kind = "listing" | "search" | "page" | "words" | "app";

const KINDS: { kind: Kind; title: string; about: string }[] = [
  { kind: "listing", title: "Listing", about: "Share one thing: an idea, something for sale, a job, a room." },
  { kind: "search", title: "Search", about: "Collect everything with a label: your own idea center or market." },
  { kind: "page", title: "Page", about: "A page for your business, project, or nonprofit." },
  { kind: "words", title: "Word list", about: "Words and what they mean." },
  { kind: "app", title: "App", about: "A tool that does something. Describe it and Sage builds it." },
];

// "+ Create": pick a type, and the type gives you its template. Every type
// gets labels, imports, and search the same way.
export function CreateDictionary({ onDone, onAskSage, onClose }: { onDone: () => void; onAskSage: () => void; onClose: () => void }) {
  const [kind, setKind] = useState<Kind | null>(null);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-300 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        {kind && (
          <button type="button" onClick={() => setKind(null)} className={link}>
            ← Back
          </button>
        )}
        <h3 className="text-sm font-semibold">{kind ? KINDS.find((k) => k.kind === kind)?.title : "What are you making?"}</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="ml-auto px-1 text-neutral-400 hover:text-neutral-900">
          ✕
        </button>
      </div>

      {!kind && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {KINDS.map((k) => (
            <li key={k.kind}>
              <button
                type="button"
                onClick={() => (k.kind === "app" ? (onAskSage(), onClose()) : setKind(k.kind))}
                className="flex h-full w-full flex-col gap-1 rounded-md border border-neutral-200 px-3 py-2.5 text-left hover:border-neutral-900"
              >
                <span className="text-sm font-medium">{k.title}</span>
                <span className="text-xs text-neutral-600">{k.about}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {kind === "listing" && <NewListing onDone={onDone} onClose={onClose} />}
      {kind === "search" && <NewSearch onDone={onDone} />}
      {kind === "page" && (
        <NameOnly
          placeholder="Your business, project, or nonprofit"
          button="Make the page"
          onCreate={async (name) => {
            await createPage(name);
            onDone();
          }}
        />
      )}
      {kind === "words" && (
        <NameOnly
          placeholder="Name your word list"
          withDescription
          button="Make the word list"
          onCreate={async (name, description) => {
            await createWordList(name, description);
            onDone();
          }}
        />
      )}
    </div>
  );
}

// Pick where it goes (Idea Index, Marketplace, someone's market), then fill
// in that shape.
function NewListing({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [makers, setMakers] = useState<Maker[] | null>(null);
  const [maker, setMaker] = useState<Maker | null>(null);

  useEffect(() => {
    listMakers()
      .then(setMakers)
      .catch(() => setMakers([]));
  }, []);

  if (!makers) return <p className="text-sm text-neutral-400">Loading...</p>;
  if (makers.length === 0) return <p className="text-sm text-neutral-500">Nothing makes listings yet. Make a Search first.</p>;

  if (maker) {
    return (
      <ListingForm
        searchId={maker.id}
        noun={maker.noun}
        fields={maker.fields}
        photoLimit={maker.photoLimit}
        lastsDays={maker.lastsDays}
        onCancel={() => setMaker(null)}
        onSaved={() => {
          onDone();
          onClose();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-neutral-600">Where should people find it?</p>
      <div className="flex flex-wrap gap-2">
        {makers.map((m) => (
          <button key={m.id} type="button" onClick={() => setMaker(m)} className="rounded-full border border-neutral-300 px-3 py-1 text-xs hover:border-neutral-900">
            {m.name} <span className="text-neutral-400">· {m.noun}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function NewSearch({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ name: "", description: "", imports: "" });
  const [maker, setMaker] = useState<MakerSettings>({ noun: "", shape: "Details (long), Neighborhood, How to reach you", photoLimit: 0, lastsDays: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
          await createSearch({ ...form, ...maker });
          onDone();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setSaving(false);
        }
      }}
      className="flex flex-col gap-2.5 text-xs text-neutral-600"
    >
      <label className="flex flex-col gap-1">
        Name
        <input autoFocus value={form.name} onChange={set("name")} placeholder="Ballard Market Village" maxLength={80} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        Labels it searches, with commas
        <input value={form.imports} onChange={set("imports")} placeholder="marketplace, ballard" className={input} />
      </label>
      <MakerFields value={maker} onChange={setMaker} />
      <label className="flex flex-col gap-1">
        What it&apos;s for (optional)
        <input value={form.description} onChange={set("description")} maxLength={300} className={input} />
      </label>
      {error && <p className="text-red-600">{error}</p>}
      <div>
        <button type="submit" disabled={saving} className={primary}>
          {saving ? "Making..." : "Make the search"}
        </button>
      </div>
    </form>
  );
}

function NameOnly({
  placeholder,
  button,
  withDescription,
  onCreate,
}: {
  placeholder: string;
  button: string;
  withDescription?: boolean;
  onCreate: (name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        setError(null);
        try {
          await onCreate(name, description);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setSaving(false);
        }
      }}
      className="flex flex-col gap-2.5"
    >
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} maxLength={80} className={input} />
      {withDescription && (
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What it's for (optional)" maxLength={300} className={input} />
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div>
        <button type="submit" disabled={saving || !name.trim()} className={primary}>
          {saving ? "Making..." : button}
        </button>
      </div>
    </form>
  );
}
