import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { P } from "@/lib/wolffie/printables";
import { gradeOf, type Activity, type PacketContent } from "@/lib/wolffie/shared";
import { PrintButton } from "./PrintButton";

// One Wolffie Games packet as printable letter pages. "Save PDF" opens the
// browser's print dialog, where Save as PDF downloads it.
export default async function WolffiePacketPage({ params }: PageProps<"/wolffie/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("wolffie_packets").select("themes, kids, age, content").eq("id", id).maybeSingle();
  if (!data) notFound();

  const c = data.content as PacketContent;
  const grade = gradeOf(data.age);
  const cutout =
    c.cutout.template === "helicopter" ? P.helicopter() : c.cutout.template === "bracelet" ? P.bracelet() : P.badge(escapeXml(c.cutout.badgeLabel || c.title));
  const coloring = c.coloring.template === "mandala" ? P.mandala(c.seed, grade) : c.coloring.template === "octopus" ? P.octopus() : P.bee();
  const search = P.wordsearch(c.wordsearch.title, c.wordsearch.words, grade, c.seed);
  const sheets = Math.ceil(data.kids / (c.cutout.template === "helicopter" ? 3 : c.cutout.template === "bracelet" ? 7 : 6));

  return (
    <main className="wolffie mx-auto flex max-w-[8.5in] flex-col items-center gap-6 bg-neutral-100 py-6 text-neutral-900 print:block print:bg-white print:py-0">
      <style>{`
        @page { size: letter; margin: 0.5in; }
        .wolffie .pr { max-width: 100%; height: auto; }
        @media print {
          .sheet { box-shadow: none !important; margin: 0 !important; break-after: page; }
          .sheet:last-child { break-after: auto; }
        }
      `}</style>

      <div className="flex w-full items-center gap-3 px-4 print:hidden">
        <h1 className="text-lg font-semibold">{c.title}</h1>
        <span className="text-sm text-neutral-500">6 pages, black and white</span>
        <PrintButton />
      </div>

      <Sheet>
        <Header c={c} themes={data.themes} kids={data.kids} age={data.age} page="Today's plan" />
        <Block label="5-minute craft" a={c.craft} />
        <Block label={`Game${c.game.where ? `, ${c.game.where}` : ""}`} a={c.game} />
      </Sheet>

      <Sheet>
        <Header c={c} page="Read aloud" />
        <Talk label="Joke" q={c.joke.q} a={c.joke.a} />
        <Talk label="Riddle" q={c.riddle.q} a={c.riddle.a} />
        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-bold uppercase tracking-wide">Fact of the day</h3>
          <p className="text-xl">{c.fact}</p>
        </section>
      </Sheet>

      <Sheet>
        <Header c={c} page="Cut-out activity" />
        <Block label={`${c.cutout.title} (print ${sheets} sheet${sheets === 1 ? "" : "s"}, next page)`} a={c.cutout} />
      </Sheet>

      <Printable title={c.cutout.title} how={cutout.how} svg={cutout.svg} />
      <Printable title={c.coloring.title} how={c.coloring.how || coloring.how} svg={coloring.svg} />
      <Printable title={c.wordsearch.title} how={search.how} svg={search.svg} />
    </main>
  );
}

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <section className="sheet flex min-h-[10in] w-full flex-col gap-5 bg-white p-8 shadow-md sm:w-[7.5in] print:min-h-0 print:w-full print:p-0">
      {children}
    </section>
  );
}

function Header({ c, page, themes, kids, age }: { c: PacketContent; page: string; themes?: string[]; kids?: number; age?: number }) {
  return (
    <header className="flex items-baseline justify-between border-b-2 border-neutral-900 pb-1">
      <h2 className="text-2xl font-extrabold">{c.title}</h2>
      <span className="text-right text-xs">
        {page}
        {themes && ` · ${themes.join(", ")} · ${kids} kids · age ${age}`}
        <br />
        Wolffie Games
      </span>
    </header>
  );
}

function Block({ label, a }: { label: string; a: Activity }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-sm font-bold uppercase tracking-wide">{label}</h3>
      <p className="text-lg font-semibold">{a.title}</p>
      <p className="text-sm">
        <b>You need:</b> {a.need.join(", ")}
      </p>
      <ol className="list-decimal pl-6 text-sm">
        {a.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {a.tip && (
        <p className="text-sm italic">
          <b>Tip:</b> {a.tip}
        </p>
      )}
    </section>
  );
}

function Talk({ label, q, a }: { label: string; q: string; a: string }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-sm font-bold uppercase tracking-wide">{label}</h3>
      <p className="text-xl">{q}</p>
      <p className="text-base text-neutral-600">Answer: {a}</p>
    </section>
  );
}

function Printable({ title, how, svg }: { title: string; how: string; svg: string }) {
  return (
    <section className="sheet flex w-full flex-col items-center gap-2 bg-white p-6 shadow-md sm:w-[7.5in] print:w-full print:p-0">
      <p className="self-stretch text-sm">
        <b>{title}.</b> {how}
      </p>
      {/* Drawn by printables.js; the only free text in it (the badge label) is escaped above. */}
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </section>
  );
}

const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
