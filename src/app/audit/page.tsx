import Link from "next/link";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function formatMeta(metaJson: string | null) {
  if (!metaJson) {
    return "—";
  }

  try {
    return JSON.stringify(JSON.parse(metaJson), null, 2);
  } catch {
    return metaJson;
  }
}

function actorLabel(actorUserId: string | null, currentUserId: string) {
  if (!actorUserId) {
    return "System / nieznany";
  }

  if (actorUserId === currentUserId) {
    return "Twoje konto";
  }

  return "Inny uzytkownik";
}

export default async function AuditPage() {
  const user = await requireUser();
  const { listAuditEventsVisibleToUser } = await import("@/db/audit");
  const events = listAuditEventsVisibleToUser(user.id);

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="muted">Bezpieczenstwo i operacje</p>
          <h1 style={{ margin: 0 }}>Dziennik audytu</h1>
        </div>
        <Link className="button button-secondary" href="/dashboard">
          Dashboard
        </Link>
      </header>

      <p className="muted card">
        Wpisy widoczne dla Twojego konta obejmuja zdarzenia wygenerowane przez Ciebie oraz zdarzenia
        systemowe (backup, nieudane logowania bez identyfikacji uzytkownika). W meta nie zapisujemy
        kwot ani opisow transakcji.
      </p>

      <section className="card">
        <h2>Ostatnie zdarzenia</h2>
        {events.length === 0 ? (
          <p className="muted">Brak wpisow.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Czas</th>
                  <th>Akcja</th>
                  <th>Aktor</th>
                  <th>Meta</th>
                </tr>
              </thead>
              <tbody>
                {events.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.createdAt).toLocaleString("pl-PL")}</td>
                    <td>
                      <code>{row.action}</code>
                    </td>
                    <td>{actorLabel(row.actorUserId, user.id)}</td>
                    <td>
                      <pre
                        style={{
                          fontSize: 12,
                          margin: 0,
                          maxWidth: 420,
                          overflow: "auto",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {formatMeta(row.metaJson)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
