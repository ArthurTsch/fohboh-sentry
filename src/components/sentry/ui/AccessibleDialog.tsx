"use client";

import { forwardRef, useEffect, useRef } from "react";
import type { HTMLAttributes, KeyboardEvent as ReactKeyboardEvent } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type AccessibleDialogProps = HTMLAttributes<HTMLDivElement> & {
  ariaLabel?: string;
  closeOnEscape?: boolean;
  onClose?: () => void;
};

export const AccessibleDialog = forwardRef<HTMLDivElement, AccessibleDialogProps>(
  function AccessibleDialog(
    {
      ariaLabel,
      children,
      closeOnEscape = true,
      onClose,
      onKeyDown,
      ...props
    },
    forwardedRef,
  ) {
    const dialogRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const isolatedElements = isolateBackground(dialog);
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const frame = window.requestAnimationFrame(() => {
        const initial = dialog.querySelector<HTMLElement>("[autofocus]") ?? getFocusable(dialog)[0] ?? dialog;
        initial.focus();
      });

      return () => {
        window.cancelAnimationFrame(frame);
        document.body.style.overflow = previousOverflow;
        restoreBackground(isolatedElements);
        if (opener?.isConnected) opener.focus();
      };
    }, []);

    function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
      onKeyDown?.(event);
      if (event.defaultPrevented || !isTopmostDialog(dialogRef.current)) return;
      if (event.key === "Escape") {
        if (onClose && closeOnEscape) {
          event.preventDefault();
          onClose();
        }
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = getFocusable(dialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    return (
      <div
        {...props}
        ref={(node) => {
          dialogRef.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        aria-label={ariaLabel}
        aria-modal="true"
        data-accessible-dialog="true"
        onKeyDown={handleKeyDown}
        role="dialog"
        tabIndex={-1}
      >
        {children}
      </div>
    );
  },
);

function getFocusable(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hidden && element.getAttribute("aria-hidden") !== "true",
  );
}

function isTopmostDialog(dialog: HTMLElement | null) {
  const dialogs = document.querySelectorAll<HTMLElement>("[data-accessible-dialog='true']");
  return Boolean(dialog && dialogs[dialogs.length - 1] === dialog);
}

type IsolatedElement = { ariaHidden: string | null; element: HTMLElement; inert: boolean };

function isolateBackground(dialog: HTMLElement) {
  const isolated: IsolatedElement[] = [];
  let branch: HTMLElement = dialog;
  while (branch.parentElement) {
    for (const sibling of Array.from(branch.parentElement.children)) {
      if (sibling === branch || !(sibling instanceof HTMLElement)) continue;
      isolated.push({
        ariaHidden: sibling.getAttribute("aria-hidden"),
        element: sibling,
        inert: sibling.inert,
      });
      sibling.inert = true;
      sibling.setAttribute("aria-hidden", "true");
    }
    if (branch.parentElement === document.body) break;
    branch = branch.parentElement;
  }
  return isolated;
}

function restoreBackground(isolated: IsolatedElement[]) {
  for (const { ariaHidden, element, inert } of isolated) {
    element.inert = inert;
    if (ariaHidden === null) element.removeAttribute("aria-hidden");
    else element.setAttribute("aria-hidden", ariaHidden);
  }
}
