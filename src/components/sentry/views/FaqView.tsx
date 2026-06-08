import type { FaqItem } from "../types";
import { SectionCard } from "../ui/primitives";

export function FaqView({
  items,
  onQueryChange,
  onToggleQuestion,
  openQuestion,
  query,
}: {
  items: FaqItem[];
  onQueryChange: (value: string) => void;
  onToggleQuestion: (question: string) => void;
  openQuestion: string | null;
  query: string;
}) {
  return (
    <div className="space-y-6">
      <SectionCard className="p-5">
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search Trust Score, CAAR, schema, recovery..."
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
        />
      </SectionCard>

      <div className="space-y-3">
        {items.map((item) => {
          const open = item.question === openQuestion;
          return (
            <SectionCard key={item.question} className="overflow-hidden p-0">
              <button
                type="button"
                onClick={() => onToggleQuestion(item.question)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <div>
                  <div className="mb-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                    {item.topic}
                  </div>
                  <div className="font-medium">{item.question}</div>
                </div>
                <div className="text-xl text-[var(--muted)]">{open ? "−" : "+"}</div>
              </button>
              {open ? (
                <div className="border-t border-[var(--border)] px-5 py-4 text-sm leading-7 text-[var(--muted)]">
                  {item.answer}
                </div>
              ) : null}
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}
