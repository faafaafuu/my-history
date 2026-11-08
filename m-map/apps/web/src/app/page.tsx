import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-sm font-semibold tracking-wide">Life Map</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-ink-300">
          <span className="hidden sm:inline">{user.email}</span>
          <LogoutButton />
        </div>
      </header>
      <section className="flex flex-1 items-center justify-center p-4">
        <div className="glass max-w-md p-8 text-center">
          <h1 className="text-xl font-semibold">Карта пока пустая</h1>
          <p className="mt-2 text-sm text-ink-300">Холст с узлами и связями появится на этапе 2.</p>
        </div>
      </section>
    </main>
  );
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="lm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b7cf6" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <path d="M8 22 L16 9 L24 20" fill="none" stroke="url(#lm)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="8" cy="22" r="3.5" fill="#f0526a" />
      <circle cx="16" cy="9" r="4" fill="url(#lm)" />
      <circle cx="24" cy="20" r="3.5" fill="#3ddc97" />
    </svg>
  );
}
