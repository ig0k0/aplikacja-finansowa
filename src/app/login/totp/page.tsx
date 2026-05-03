import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { completeTotpLoginAction } from "./actions";

export const dynamic = "force-dynamic";

type TotpLoginPageProps = {
  searchParams?: Promise<{
    pending?: string;
    error?: string;
  }>;
};

function errorMessage(code?: string) {
  if (code === "missing") {
    return "Podaj kod z aplikacji uwierzytelniajacej.";
  }

  if (code === "expired") {
    return "Sesja weryfikacji wygasla. Zaloguj sie ponownie haslem.";
  }

  if (code === "invalid") {
    return "Niepoprawny kod. Sprobuj ponownie.";
  }

  return null;
}

export default async function TotpLoginPage({ searchParams }: TotpLoginPageProps) {
  const loggedIn = await getCurrentUser();

  if (loggedIn) {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : {};
  const pendingId = params.pending?.trim() ?? "";
  const err = errorMessage(params.error);

  if (params.error === "expired" && !pendingId) {
    return (
      <main className="page" style={{ maxWidth: 520 }}>
        <section className="card">
          <p className="muted">Centrum Finansow Osobistych</p>
          <h1>Weryfikacja wygasla</h1>
          <p className="error">Sesja weryfikacji wygasla. Zaloguj sie ponownie haslem.</p>
          <p style={{ marginTop: 24 }}>
            <Link className="button" href="/login">
              Przejdz do logowania
            </Link>
          </p>
        </section>
      </main>
    );
  }

  if (!pendingId) {
    redirect("/login");
  }

  return (
    <main className="page" style={{ maxWidth: 520 }}>
      <section className="card">
        <p className="muted">Centrum Finansow Osobistych</p>
        <h1>Kod uwierzytelniania</h1>
        <p className="muted">
          Wpisz 6-cyfrowy kod z aplikacji TOTP (Google Authenticator, Bitwarden itp.).
        </p>

        <form action={completeTotpLoginAction} className="grid" style={{ marginTop: 24 }}>
          <input name="pendingId" type="hidden" value={pendingId} />
          <label className="field">
            Kod
            <input
              className="input"
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={8}
              placeholder="123456"
              autoFocus
            />
          </label>

          {err ? <p className="error">{err}</p> : null}

          <button className="button" type="submit">
            Kontynuuj
          </button>
        </form>

        <p className="muted" style={{ marginTop: 24, marginBottom: 0 }}>
          <Link href="/login">Wroc do logowania haslem</Link>
        </p>
      </section>
    </main>
  );
}
