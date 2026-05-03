import Link from "next/link";
import QRCode from "qrcode";
import {
  cancelTotpEnrollmentAction,
  confirmTotpEnrollmentAction,
  disableTotpAction,
  startTotpEnrollmentAction,
} from "./actions";
import { buildTotpKeyUri } from "@/lib/totp-app";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type SecurityPageProps = {
  searchParams?: Promise<{
    error?: string;
    saved?: string;
    disabled?: string;
  }>;
};

export default async function SecuritySettingsPage({ searchParams }: SecurityPageProps) {
  const user = await requireUser();
  const params = searchParams ? await searchParams : {};

  let qrDataUrl: string | null = null;

  if (user.totpPendingSecret && !user.totpEnabled) {
    const uri = buildTotpKeyUri(user.login, user.totpPendingSecret);
    qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  }

  const errorText = (() => {
    switch (params.error) {
      case "already":
        return "Dwuetapowe logowanie jest juz wlaczone.";
      case "missing_code":
        return "Podaj kod z aplikacji.";
      case "no_pending":
        return "Brak aktywnej konfiguracji — uruchom ponownie.";
      case "bad_token":
        return "Niepoprawny kod TOTP.";
      case "disable_missing":
        return "Uzupelnij haslo i kod TOTP.";
      case "no_totp":
        return "2FA nie jest wlaczone.";
      case "bad_password":
        return "Niepoprawne haslo.";
      case "bad_totp":
        return "Niepoprawny kod TOTP przy wylaczaniu.";
      default:
        return null;
    }
  })();

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="muted">Ustawienia konta</p>
          <h1 style={{ margin: 0 }}>Bezpieczenstwo</h1>
        </div>
        <Link className="button button-secondary" href="/dashboard">
          Dashboard
        </Link>
      </header>

      {params.saved ? (
        <p className="card" style={{ borderColor: "#86efac", marginBottom: 24 }}>
          Dwuetapowe logowanie zostalo wlaczone. Od nastepnego logowania potrzebny bedzie kod TOTP.
        </p>
      ) : null}

      {params.disabled ? (
        <p className="card" style={{ borderColor: "#93c5fd", marginBottom: 24 }}>
          Dwuetapowe logowanie zostalo wylaczone.
        </p>
      ) : null}

      {errorText ? <p className="card error">{errorText}</p> : null}

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Logowanie dwuetapowe (TOTP)</h2>
        <p className="muted">
          Po wlaczeniu, po poprawnym hasle aplikacja poprosi o kod z aplikacji uwierzytelniajacej (RFC 6238). Nie ma kodow
          zapasowych w MVP — zachowaj dostep do aplikacji z kodami albo wylacz 2FA z tego panelu, majac haslo i aktywne TOTP.
        </p>

        {user.totpEnabled ? (
          <>
            <p>
              <strong>Status: wlaczone</strong>
            </p>
            <form action={disableTotpAction} className="grid" style={{ marginTop: 16, maxWidth: 400 }}>
              <label className="field">
                Aktualne haslo
                <input className="input" name="password" type="password" autoComplete="current-password" required />
              </label>
              <label className="field">
                Kod TOTP (wylaczenie)
                <input className="input" inputMode="numeric" maxLength={8} name="token" placeholder="123456" required />
              </label>
              <button className="button button-secondary" type="submit">
                Wylacz 2FA
              </button>
            </form>
          </>
        ) : user.totpPendingSecret ? (
          <>
            <p>Zeskanuj kod QR w aplikacji (issuer: CFO), potem wpisz kod, aby potwierdzic.</p>
            {qrDataUrl ? (
              <p style={{ marginBottom: 16 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="QR kod TOTP" height={220} src={qrDataUrl} width={220} />
              </p>
            ) : null}
            <form action={confirmTotpEnrollmentAction} className="form-grid" style={{ marginBottom: 16 }}>
              <label className="field">
                Kod z aplikacji
                <input className="input" inputMode="numeric" maxLength={8} name="code" placeholder="123456" required />
              </label>
              <button className="button" type="submit">
                Potwierdz i wlacz 2FA
              </button>
            </form>
            <form action={cancelTotpEnrollmentAction}>
              <button className="button button-secondary" type="submit">
                Anuluj konfiguracje
              </button>
            </form>
          </>
        ) : (
          <>
            <p>
              <strong>Status: wylaczone</strong>
            </p>
            <form action={startTotpEnrollmentAction}>
              <button className="button" type="submit">
                Skonfiguruj 2FA
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
