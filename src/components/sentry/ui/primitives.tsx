"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getScoreBar, getTrustTone } from "../utils";

export function SectionCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl border border-[var(--border)] bg-white p-6 ${className}`}>
      {children}
    </div>
  );
}

export function KpiCard({
  accent,
  label,
  labelHelp,
  sub,
  value,
}: {
  accent?: boolean;
  label: string;
  labelHelp?: {
    title: string;
    sections: { label: string; text: string }[];
    footerLabel?: string;
    footerValue?: string;
  };
  sub: string;
  value: string;
}) {
  return (
    <SectionCard className="shadow-[0_8px_28px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
        <span>{label}</span>
        {labelHelp ? (
          <HelpTip
            title={labelHelp.title}
            sections={labelHelp.sections}
            footerLabel={labelHelp.footerLabel}
            footerValue={labelHelp.footerValue}
          />
        ) : null}
      </div>
      <div
        className={`mt-3 font-[family-name:var(--font-display)] text-5xl font-extrabold tracking-[-0.06em] ${
          accent ? "text-[var(--success)]" : "text-[var(--text)]"
        }`}
      >
        {value}
      </div>
      <div className="mt-2 text-sm text-[var(--muted)]">{sub}</div>
    </SectionCard>
  );
}

export function ProgressRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className={getTrustTone(value)}>{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white">
        <div className={`h-full rounded-full ${getScoreBar(value)}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
}) {
  const toneClass =
    {
      success: "bg-[rgba(0,200,83,0.08)] text-[var(--success)]",
      warning: "bg-[rgba(255,152,0,0.1)] text-[#b86a00]",
      danger: "bg-[rgba(214,48,49,0.08)] text-[var(--accent)]",
      info: "bg-[rgba(0,97,255,0.08)] text-[var(--info)]",
      neutral: "bg-[var(--panel-soft)] text-[var(--muted)]",
    }[tone];

  return (
    <span
      className={`rounded-full px-2 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] ${toneClass}`}
    >
      {children}
    </span>
  );
}

export function MetaBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

export function HelpTip({
  title,
  sections,
  footerLabel,
  footerValue,
}: {
  title: string;
  sections: { label: string; text: string }[];
  footerLabel?: string;
  footerValue?: string;
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({ left: -9999, top: -9999 });
  const tooltipId = useId();
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearCloseTimer() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function openTooltip(target: HTMLElement) {
    clearCloseTimer();
    positionTooltip(target);
    setOpen(true);
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
    }, 120);
  }

  function positionTooltip(target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    const tooltipWidth = 320;
    const tooltipMaxHeight = Math.min(460, Math.round(window.innerHeight * 0.72));
    const margin = 10;
    let left = rect.left;
    let top = rect.bottom + margin;

    if (rect.left < 280) {
      left = rect.right + margin;
      top = Math.max(margin, rect.top - 8);
    }

    if (left + tooltipWidth > window.innerWidth - margin) {
      left = window.innerWidth - tooltipWidth - margin;
    }
    if (left < margin) left = margin;

    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    if (spaceBelow < tooltipMaxHeight && spaceAbove > spaceBelow) {
      top = Math.max(margin, rect.top - tooltipMaxHeight - margin);
    }

    if (top + tooltipMaxHeight > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - tooltipMaxHeight - margin);
    }

    setStyle({
      left,
      maxHeight: tooltipMaxHeight,
      position: "fixed",
      top,
    });
  }

  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, []);

  return (
    <>
      <button
        type="button"
        aria-describedby={tooltipId}
        aria-expanded={open}
        onMouseEnter={(event) => openTooltip(event.currentTarget)}
        onMouseLeave={scheduleClose}
        onFocus={(event) => openTooltip(event.currentTarget)}
        onBlur={scheduleClose}
        onClick={(event) => {
          if (open) {
            clearCloseTimer();
            setOpen(false);
            return;
          }
          openTooltip(event.currentTarget);
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel-soft)] font-[family-name:var(--font-mono)] text-[9px] font-bold text-[var(--muted)] transition hover:border-[var(--accent)] hover:bg-[rgba(214,48,49,0.08)] hover:text-[var(--accent)]"
      >
        ?
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              id={tooltipId}
              style={style}
              onMouseEnter={clearCloseTimer}
              onMouseLeave={scheduleClose}
              className="z-[120] flex w-[320px] max-w-[calc(100vw-20px)] flex-col overflow-hidden rounded-[14px] border border-[var(--border)] border-t-[3px] border-t-[var(--accent)] bg-white p-4 text-left shadow-[0_12px_40px_rgba(0,0,0,0.14)]"
            >
              <div className="font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                {title}
              </div>
              <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {sections.map((section) => (
                  <div key={section.label}>
                    <div className="font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                      {section.label}
                    </div>
                    <div className="mt-1 whitespace-pre-line text-[11px] leading-5 text-[var(--muted)]">{section.text}</div>
                  </div>
                ))}
              </div>
              {footerLabel && footerValue ? (
                <div className="mt-3 border-t border-[var(--border)] pt-3">
                  <div className="font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                    {footerLabel}
                  </div>
                  <div className="mt-1 font-[family-name:var(--font-display)] text-sm font-bold italic text-[var(--text)]">
                    {footerValue}
                  </div>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <SectionCard className="text-center">
      <div className="font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
        {title}
      </div>
      <div className="mt-2 text-sm text-[var(--muted)]">{body}</div>
    </SectionCard>
  );
}
