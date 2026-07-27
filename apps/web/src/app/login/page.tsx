import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in — CoBuild",
};

export default function LoginPage() {
  return (
    <main
      className="flex min-h-screen items-center justify-center px-5 py-10"
      style={{
        background:
          "radial-gradient(900px 520px at 50% -10%, rgba(59,227,143,0.16), transparent 70%), var(--color-bg-page)",
      }}
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
