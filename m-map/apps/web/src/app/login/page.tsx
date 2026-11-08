import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="glass w-full max-w-sm p-7 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Life Map</h1>
        <p className="mt-1 text-sm text-ink-300">Вход в вашу карту</p>
        <LoginForm />
      </div>
    </main>
  );
}
