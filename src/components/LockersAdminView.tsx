"use client";

import { useEffect, useState } from "react";
import {
  ATTENDANCE_KINDS,
  LOCKER_COUNT,
  daysAgo,
  formatDate,
  isActiveBar,
  today,
  type Attendance,
  type AttendanceKind,
  type AttendanceStatus,
  type Bar,
  type Locker,
  type Participant,
} from "@/lib/lockers";
import { GroupMembers } from "./GroupMembers";

type GroupDictionary = { id: string; name: string };
type Data = { participants: Participant[]; lockers: Locker[]; bars: Bar[]; attendance: Attendance[] };
type Save = (action: "participant" | "locker" | "bar" | "attendance", record: Record<string, unknown>) => Promise<void>;

const TABS = ["participants", "lockers", "bars", "attendance", "reports"] as const;
type Tab = (typeof TABS)[number];

const EMPTY: Data = { participants: [], lockers: [], bars: [], attendance: [] };

const input = "rounded-md border border-neutral-300 px-2 py-1 text-sm";
const pill = (on: boolean) =>
  `rounded-full px-3 py-1 text-xs font-medium ${on ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600"}`;

// Lockers Admin Display View: the EC and Clerk work, shared by everyone in
// the admin group.
export function LockersAdminView({ dictionary, reloadKey = 0 }: { dictionary: GroupDictionary; reloadKey?: number }) {
  const [tab, setTab] = useState<Tab>("participants");
  const [data, setData] = useState<Data>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ dictionaryId: dictionary.id, since: daysAgo(60) });
    fetch(`/api/lockers/admin?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      });
    return () => controller.abort();
  }, [dictionary.id, refreshToken, reloadKey]);

  const save: Save = async (action, record) => {
    setError(null);
    try {
      const res = await fetch("/api/lockers/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dictionaryId: dictionary.id, action, record }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Something went wrong.");
      }
    } catch (err) {
      setError((err as Error).message);
    }
    setRefreshToken((t) => t + 1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-medium text-neutral-500">{dictionary.name}</h3>
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`capitalize ${pill(tab === t)}`}>
            {t}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {tab === "participants" && <Participants data={data} save={save} />}
      {tab === "lockers" && <Lockers data={data} save={save} />}
      {tab === "bars" && <Bars data={data} save={save} />}
      {tab === "attendance" && <AttendanceSheet data={data} save={save} />}
      {tab === "reports" && <Reports data={data} />}

      <GroupMembers dictionaryId={dictionary.id} reloadKey={reloadKey} onError={setError} />
    </div>
  );
}

function lockersOf(data: Data, participantId: string) {
  return data.lockers.filter((l) => l.participantId === participantId).map((l) => l.number);
}

function ParticipantPicker({
  participants,
  value,
  onChange,
}: {
  participants: Participant[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>
      <option value="">Pick a participant</option>
      {participants
        .filter((p) => !p.archived)
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
    </select>
  );
}

function Participants({ data, save }: { data: Data; save: Save }) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const q = query.trim().toLowerCase();
  const shown = data.participants.filter(
    (p) => p.archived === showArchived && (!q || p.name.toLowerCase().includes(q) || lockersOf(data, p.id).includes(Number(q))),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find by name or locker" className={input} />
        <button type="button" onClick={() => setShowArchived((s) => !s)} className={pill(showArchived)}>
          Archived
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) save("participant", { name: newName, memberSince: today() }).then(() => setNewName(""));
          }}
          className="ml-auto flex items-center gap-1"
        >
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New participant" className={input} />
          <button type="submit" className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium">
            Add
          </button>
        </form>
      </div>

      {shown.length === 0 && <p className="text-sm text-neutral-400">No participants.</p>}
      {shown.map((p) => {
        const barred = data.bars.some((b) => b.participantId === p.id && isActiveBar(b));
        const overdue = p.renewedThru !== null && p.renewedThru < today();
        return (
          <div key={p.id} className="flex flex-col gap-2 border-b border-neutral-100 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setOpenId(openId === p.id ? null : p.id)} className="flex flex-wrap items-center gap-2 text-left text-sm">
                <span className="font-medium">{p.name}</span>
                {barred && <span className="rounded-full bg-red-100 px-2 text-xs text-red-700">Barred</span>}
                {overdue && <span className="rounded-full bg-yellow-100 px-2 text-xs text-yellow-800">Renewal due</span>}
              </button>
              {!p.archived && <LockerAssigner participant={p} data={data} save={save} />}
            </div>
            {openId === p.id && <ParticipantForm participant={p} save={save} />}
          </div>
        );
      })}
    </div>
  );
}

function ParticipantForm({ participant: p, save }: { participant: Participant; save: Save }) {
  const field = (key: keyof Participant, value: unknown) => save("participant", { ...p, [key]: value });
  return (
    <div className="grid grid-cols-1 gap-2 rounded-md bg-neutral-50 p-3 text-xs sm:grid-cols-2">
      <label className="flex flex-col gap-1">
        Name
        <input defaultValue={p.name} onBlur={(e) => e.target.value !== p.name && field("name", e.target.value)} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        Shifts required per week
        <input
          type="number"
          min={0}
          max={7}
          defaultValue={p.shiftsRequired}
          onBlur={(e) => Number(e.target.value) !== p.shiftsRequired && field("shiftsRequired", Number(e.target.value))}
          className={input}
        />
      </label>
      <label className="flex flex-col gap-1">
        Member since
        <input type="date" defaultValue={p.memberSince ?? ""} onBlur={(e) => field("memberSince", e.target.value)} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        Renewed thru
        <input type="date" defaultValue={p.renewedThru ?? ""} onBlur={(e) => field("renewedThru", e.target.value)} className={input} />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        Notes
        <textarea defaultValue={p.notes} rows={3} onBlur={(e) => e.target.value !== p.notes && field("notes", e.target.value)} className={input} />
      </label>
      <button
        type="button"
        onClick={() =>
          (p.archived || window.confirm(`Archive ${p.name}? Their lockers are released.`)) && field("archived", !p.archived)
        }
        className="justify-self-start rounded-full border border-neutral-300 px-3 py-1 font-medium"
      >
        {p.archived ? "Restore" : "Archive"}
      </button>
    </div>
  );
}

// A participant's lockers, each with an ✕ to release it, and a box to
// assign another by number. Shown on every row of the participant list.
function LockerAssigner({ participant: p, data, save }: { participant: Participant; data: Data; save: Save }) {
  const [number, setNumber] = useState("");
  const nameOf = new Map(data.participants.map((x) => [x.id, x.name]));
  const theirs = data.lockers.filter((l) => l.participantId === p.id);

  function assign() {
    const n = Number(number);
    if (!Number.isInteger(n) || n < 1 || n > LOCKER_COUNT) return window.alert(`Pick a locker from 1 to ${LOCKER_COUNT}.`);
    const locker = data.lockers.find((l) => l.number === n) ?? { number: n, participantId: null, assignedDate: null, broken: false, notes: "" };
    if (locker.participantId === p.id) return setNumber("");
    if (locker.participantId && !window.confirm(`Locker ${n} belongs to ${nameOf.get(locker.participantId)}. Move it to ${p.name}?`)) return;
    if (locker.broken && !window.confirm(`Locker ${n} is marked broken. Assign it anyway?`)) return;
    save("locker", { ...locker, participantId: p.id, assignedDate: today(), broken: false }).then(() => setNumber(""));
  }

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      {theirs.length === 0 && <span className="text-neutral-400">No locker</span>}
      {theirs.map((l) => (
        <span key={l.number} className="flex items-center gap-1 rounded-full border border-neutral-300 bg-white px-2 py-0.5">
          {l.number}
          <button
            type="button"
            onClick={() => window.confirm(`Release locker ${l.number}?`) && save("locker", { ...l, participantId: null })}
            aria-label={`Release locker ${l.number}`}
            className="text-neutral-400 hover:text-red-600"
          >
            ✕
          </button>
        </span>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          assign();
        }}
        className="flex items-center gap-1"
      >
        <input
          type="number"
          min={1}
          max={LOCKER_COUNT}
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Locker #"
          className={`${input} w-24 text-xs`}
        />
        <button type="submit" className="rounded-full border border-neutral-300 bg-white px-3 py-1 font-medium">
          Assign
        </button>
      </form>
    </div>
  );
}

function Lockers({ data, save }: { data: Data; save: Save }) {
  const [selected, setSelected] = useState<number | null>(null);
  const byNumber = new Map(data.lockers.map((l) => [l.number, l]));
  const nameOf = new Map(data.participants.map((p) => [p.id, p.name]));
  const locker = selected ? (byNumber.get(selected) ?? { number: selected, participantId: null, assignedDate: null, broken: false, notes: "" }) : null;

  const counts = {
    assigned: data.lockers.filter((l) => l.participantId).length,
    broken: data.lockers.filter((l) => l.broken).length,
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-neutral-500">
        {counts.assigned} assigned, {LOCKER_COUNT - counts.assigned - counts.broken} free, {counts.broken} broken. Click a locker to change it.
      </p>

      {locker && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-neutral-50 p-3 text-sm">
          <span className="font-medium">Locker {locker.number}</span>
          {locker.participantId ? (
            <>
              <span>
                {nameOf.get(locker.participantId)}, since {formatDate(locker.assignedDate)}
              </span>
              <button
                type="button"
                onClick={() => window.confirm(`Release locker ${locker.number}?`) && save("locker", { ...locker, participantId: null })}
                className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium"
              >
                Release
              </button>
            </>
          ) : (
            <ParticipantPicker
              participants={data.participants}
              value=""
              onChange={(id) => id && save("locker", { ...locker, participantId: id, assignedDate: today() })}
            />
          )}
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={locker.broken} onChange={(e) => save("locker", { ...locker, broken: e.target.checked })} />
            Broken
          </label>
          <input
            key={`${locker.number}-${locker.notes}`}
            defaultValue={locker.notes}
            placeholder="Notes"
            onBlur={(e) => e.target.value !== locker.notes && save("locker", { ...locker, notes: e.target.value })}
            className={`${input} min-w-0 flex-1`}
          />
        </div>
      )}

      <div className="grid max-h-96 grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1 overflow-y-auto">
        {Array.from({ length: LOCKER_COUNT }, (_, i) => i + 1).map((n) => {
          const l = byNumber.get(n);
          const color = l?.broken ? "bg-neutral-300 text-neutral-500" : l?.participantId ? "bg-neutral-900 text-white" : "border border-neutral-300";
          return (
            <button
              key={n}
              type="button"
              onClick={() => setSelected(n)}
              title={l?.participantId ? nameOf.get(l.participantId) : l?.broken ? "Broken" : "Free"}
              className={`rounded py-1 text-xs ${color} ${selected === n ? "ring-2 ring-blue-500" : ""}`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Bars({ data, save }: { data: Data; save: Save }) {
  const [form, setForm] = useState({ participantId: "", type: "temporary", reason: "", endDate: "" });
  const nameOf = new Map(data.participants.map((p) => [p.id, p.name]));
  const recommended = data.bars.filter((b) => b.status === "recommended");
  const active = data.bars.filter((b) => isActiveBar(b));

  function submit(status: "recommended" | "issued") {
    save("bar", { ...form, status, startDate: today() }).then(() => setForm({ participantId: "", type: "temporary", reason: "", endDate: "" }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-md bg-neutral-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <ParticipantPicker participants={data.participants} value={form.participantId} onChange={(id) => setForm({ ...form, participantId: id })} />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={input}>
            <option value="temporary">Temporary</option>
            <option value="permanent">Permanent</option>
          </select>
          {form.type === "temporary" && (
            <label className="flex items-center gap-1 text-xs">
              Ends
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={input} />
            </label>
          )}
        </div>
        <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason" className={input} />
        <div className="flex gap-2">
          <button type="button" onClick={() => submit("recommended")} className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium">
            Recommend
          </button>
          <button type="button" onClick={() => submit("issued")} className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white">
            Issue
          </button>
        </div>
      </div>

      <BarList title="Recommendations" bars={recommended} nameOf={nameOf}>
        {(b) => (
          <>
            <button
              type="button"
              onClick={() =>
                b.type === "temporary" && !b.endDate
                  ? save("bar", { ...b, status: "issued", endDate: window.prompt("End date (YYYY-MM-DD)") ?? "" })
                  : save("bar", { ...b, status: "issued" })
              }
              className="text-xs underline"
            >
              Issue
            </button>
            <button type="button" onClick={() => save("bar", { ...b, status: "dismissed" })} className="text-xs underline">
              Dismiss
            </button>
          </>
        )}
      </BarList>

      <BarList title="Active bars" bars={active} nameOf={nameOf}>
        {(b) => (
          <button
            type="button"
            onClick={() => window.confirm(`Lift the bar on ${nameOf.get(b.participantId)}?`) && save("bar", { ...b, status: "dismissed" })}
            className="text-xs underline"
          >
            Lift
          </button>
        )}
      </BarList>
    </div>
  );
}

function BarList({
  title,
  bars,
  nameOf,
  children,
}: {
  title: string;
  bars: Bar[];
  nameOf: Map<string, string>;
  children: (bar: Bar) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-sm font-medium">{title}</h4>
      {bars.length === 0 && <p className="text-sm text-neutral-400">None.</p>}
      {bars.map((b) => (
        <div key={b.id} className="flex flex-wrap items-center gap-2 border-b border-neutral-100 py-1 text-sm">
          <span className="font-medium">{nameOf.get(b.participantId)}</span>
          <span className="text-xs text-neutral-500">
            {b.type === "permanent" ? "Permanent" : b.endDate ? `Until ${formatDate(b.endDate)}` : "Temporary"}
          </span>
          <span className="min-w-0 flex-1 text-neutral-700">{b.reason}</span>
          {children(b)}
        </div>
      ))}
    </div>
  );
}

function AttendanceSheet({ data, save }: { data: Data; save: Save }) {
  const [date, setDate] = useState(today());
  const [kind, setKind] = useState<AttendanceKind>("work");
  const [showAll, setShowAll] = useState(false);

  const markOf = (participantId: string) =>
    data.attendance.find((a) => a.participantId === participantId && a.date === date && a.kind === kind)?.status ?? null;
  const people = data.participants.filter((p) => !p.archived && (showAll || kind === "sunday" || markOf(p.id) !== null));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        {ATTENDANCE_KINDS.map((k) => (
          <button key={k.key} type="button" onClick={() => setKind(k.key)} className={pill(kind === k.key)}>
            {k.label}
          </button>
        ))}
        {kind !== "sunday" && (
          <button type="button" onClick={() => setShowAll((s) => !s)} className="text-xs underline">
            {showAll ? "Only scheduled" : "Everyone"}
          </button>
        )}
      </div>
      <p className="text-xs text-neutral-500">Older than 60 days isn&apos;t loaded here.</p>

      {people.length === 0 && <p className="text-sm text-neutral-400">Nobody scheduled. Show everyone to add someone.</p>}
      {people.map((p) => {
        const mark = markOf(p.id);
        return (
          <div key={p.id} className="flex items-center gap-2 border-b border-neutral-100 py-1 text-sm">
            <span className="min-w-0 flex-1">{p.name}</span>
            {(["scheduled", "present", "missed"] as AttendanceStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => save("attendance", { participantId: p.id, date, kind, status: mark === s ? null : s })}
                className={`capitalize ${pill(mark === s)}`}
              >
                {s}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Reports({ data }: { data: Data }) {
  const now = today();
  const soon = daysAgo(-14);
  const active = data.participants.filter((p) => !p.archived);
  const assigned = data.lockers.filter((l) => l.participantId).length;
  const broken = data.lockers.filter((l) => l.broken).length;
  const overdue = active.filter((p) => p.renewedThru && p.renewedThru < now);
  const dueSoon = active.filter((p) => p.renewedThru && p.renewedThru >= now && p.renewedThru <= soon);
  const since = daysAgo(30);
  const missed = active
    .map((p) => ({
      name: p.name,
      count: data.attendance.filter((a) => a.participantId === p.id && a.status === "missed" && a.date >= since).length,
    }))
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count);

  const stats = [
    ["Participants", active.length],
    ["Lockers assigned", assigned],
    ["Lockers free", LOCKER_COUNT - assigned - broken],
    ["Lockers broken", broken],
    ["Active bars", data.bars.filter((b) => isActiveBar(b)).length],
    ["Bar recommendations", data.bars.filter((b) => b.status === "recommended").length],
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-md border border-neutral-200 p-3">
            <p className="text-xs text-neutral-500">{label}</p>
            <p className="text-lg font-medium">{value}</p>
          </div>
        ))}
      </div>
      <NameList title="Renewal overdue" items={overdue.map((p) => `${p.name}, ${formatDate(p.renewedThru)}`)} />
      <NameList title="Renewal due in 14 days" items={dueSoon.map((p) => `${p.name}, ${formatDate(p.renewedThru)}`)} />
      <NameList title="Missed shifts, last 30 days" items={missed.map((m) => `${m.name}: ${m.count}`)} />
    </div>
  );
}

function NameList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-sm font-medium">{title}</h4>
      {items.length === 0 ? <p className="text-sm text-neutral-400">None.</p> : items.map((t) => <p key={t} className="text-sm">{t}</p>)}
    </div>
  );
}
