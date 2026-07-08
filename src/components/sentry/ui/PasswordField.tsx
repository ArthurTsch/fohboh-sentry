"use client";

import { useId, useState } from "react";

type PasswordFieldProps = {
  autoComplete?: string;
  className: string;
  name?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  value?: string;
};

export function PasswordField({
  autoComplete = "current-password",
  className,
  name,
  onChange,
  placeholder,
  value,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const buttonId = useId();

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        name={name}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className={`${className} pr-12`}
        placeholder={placeholder}
      />
      <button
        id={buttonId}
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--text)]"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
            <path d="M3 3l18 18" />
            <path d="M10.6 10.7a2 2 0 102.7 2.7" />
            <path d="M9.9 5.1A10.9 10.9 0 0112 5c5.4 0 9.4 4.4 10 5-.3.4-1.7 2.2-4 3.8" />
            <path d="M6.2 6.3C3.8 8 2.3 10 2 10.4c.6.6 4.6 5 10 5 1.5 0 2.9-.3 4.1-.8" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
