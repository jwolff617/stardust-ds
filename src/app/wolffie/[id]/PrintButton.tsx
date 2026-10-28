"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="ml-auto rounded bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white"
    >
      Print or save PDF
    </button>
  );
}
