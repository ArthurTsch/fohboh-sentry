import type { ChatMessage } from "../types";
import { supportQuickPrompts } from "../data";

export function SupportChat({
  chatInput,
  chatOpen,
  messages,
  onClose,
  onCreateTicket,
  onInputChange,
  onSend,
  onToggle,
}: {
  chatInput: string;
  chatOpen: boolean;
  messages: ChatMessage[];
  onClose: () => void;
  onCreateTicket: () => void | Promise<void>;
  onInputChange: (value: string) => void;
  onSend: (prompt?: string) => void;
  onToggle: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="fixed right-6 bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--text)] text-xl text-white shadow-[0_12px_32px_rgba(0,0,0,0.18)] transition hover:scale-105 hover:bg-[var(--accent)]"
      >
        💬
      </button>

      {chatOpen ? (
        <div className="fixed right-4 bottom-24 z-40 w-[min(420px,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-[0_22px_64px_rgba(0,0,0,0.16)] sm:right-6 sm:w-[min(420px,calc(100vw-2rem))]">
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
              <span className="text-sm font-semibold">FohBoh Support</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-lg text-[var(--muted)] transition hover:bg-white"
            >
              ×
            </button>
          </div>
          <div className="flex h-80 flex-col gap-3 overflow-y-auto bg-[var(--surface)] px-4 py-4">
            {messages.map((message, index) => (
              <div
                key={`${message.from}-${index}`}
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.from === "assistant"
                    ? "self-start rounded-tl-md bg-white text-[var(--text)]"
                    : "self-end rounded-tr-md bg-[var(--text)] text-white"
                }`}
              >
                {message.text}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-[var(--border)] px-4 py-3">
            {supportQuickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onSend(prompt)}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="border-t border-[var(--border)] bg-white p-3">
            <div className="space-y-2">
              <input
                value={chatInput}
                onChange={(event) => onInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onSend();
                }}
                placeholder="Ask a question..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onSend()}
                  className="rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                >
                  Send
                </button>
                <button
                  type="button"
                  onClick={onCreateTicket}
                  className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  Create Ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
