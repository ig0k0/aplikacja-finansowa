import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function getErrorMessage(error?: string) {
  if (error === "missing") {
    return "Podaj login i haslo.";
  }

  if (error === "invalid") {
    return "Niepoprawny login lub haslo.";
  }

  return null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : {};
  const errorMessage = getErrorMessage(params.error);

  return (
    <main className="page" style={{ maxWidth: 520 }}>
      <section className="card">
        <p className="muted">Centrum Finansow Osobistych</p>
        <h1>Zaloguj sie</h1>
        <p className="muted">
          Uzyj lokalnego konta utworzonego komenda seed. Dane kazdego
          uzytkownika sa rozdzielone po stronie serwera.
        </p>

        <form action={loginAction} className="grid" style={{ marginTop: 24 }}>
          <label className="field">
            Login
            <input className="input" name="login" autoComplete="username" />
          </label>
          <label className="field">
            Haslo
            <input
              className="input"
              name="password"
              type="password"
              autoComplete="current-password"
            />
          </label>

          {errorMessage ? <p className="error">{errorMessage}</p> : null}

          <button className="button" type="submit">
            Zaloguj
          </button>
        </form>
      </section>
    </main>
  );
}
