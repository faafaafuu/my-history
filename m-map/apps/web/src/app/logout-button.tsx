"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded-full px-3 py-1.5 text-ink-300 transition hover:bg-white/5 hover:text-ink-100"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/login");
      }}
    >
      Выйти
    </button>
  );
}
