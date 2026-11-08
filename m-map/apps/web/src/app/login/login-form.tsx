"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const field =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[15px] outline-none transition placeholder:text-ink-500 focus:border-accent/70 focus:bg-white/[0.06] focus:ring-4 focus:ring-accent/15";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Не получилось войти.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Нет связи с сервером.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block text-sm text-ink-300">
        Почта
        <input name="email" type="email" autoComplete="email" required className={field} placeholder="you@example.com" />
      </label>
      <label className="block text-sm text-ink-300">
        Пароль
        <input name="password" type="password" autoComplete="current-password" required minLength={10} className={field} />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-gradient-to-r from-accent to-accent-2 px-4 py-2.5 font-medium text-ink-950 shadow-[0_8px_30px_-8px_rgb(139_124_246/0.7)] transition hover:brightness-110 disabled:opacity-60"
      >
        {busy ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
