import { getSessionUser } from "@lib/auth";
import { headers, cookies } from "next/headers";

export const dynamic = "force-dynamic";

function money(n: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format((n ?? 0) / 100);
}
function pct(n: number) {
  const clamped = Math.max(0, Math.min(1, n || 0));
  return `${(clamped * 100).toFixed(1)}%`;
}

async function buildFetchInit(): Promise<{ base: string; init: RequestInit }> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host =
    h.get("x-forwarded-host") ??
    h.get("host") ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "") ??
    "localhost:3000";
  const base = `${proto}://${host}`;

  const c = await cookies();
  const cookieHeader = c.getAll().map((x) => `${x.name}=${x.value}`).join("; ");

  return { base, init: { cache: "no-store", headers: { cookie: cookieHeader } } };
}

export default async function AnalyticsPage() {
  const user = await getSessionUser();
  const org = user?.memberships?.[0]?.organization;

  if (!user) {
    return (
      <main className="card">
        <h1 style={{ marginTop: 0 }}>Analytics</h1>
        <p>Please sign in.</p>
      </main>
    );
  }

  const isPro = org?.plan === "PRO";
  const { base, init } = await buildFetchInit();

  const [summaryRes, agingRes, dunningRes] = await Promise.all([
    fetch(`${base}/api/analytics/summary`, init),
    fetch(`${base}/api/analytics/aging`, init),
    fetch(`${base}/api/analytics/dunning`, init),
  ]);

  const summary = await summaryRes.json();
  const aging = await agingRes.json();
  const dunning = await dunningRes.json();
  const cur = (summary.currency ?? "USD").toUpperCase();

  return (
    <main className="card">
      <h1 style={{ marginTop: 0 }}>Analytics &amp; Insights</h1>

      {!isPro && (
        <div className="card" style={{ marginBottom: 12, padding: 10 }}>
          You are on <b>FREE</b>. KPIs shown are limited. <a href="/pricing">Upgrade to PRO</a>.
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <Kpi title="MRR" value={money(summary.kpis?.MRR ?? 0, cur)} />
        <Kpi title="ARR" value={money(summary.kpis?.ARR ?? 0, cur)} />
        <Kpi title="Active Customers" value={String(summary.kpis?.activeCustomers ?? 0)} />
        <Kpi title="ARPA" value={money(summary.kpis?.ARPA ?? 0, cur)} />
        <Kpi title="Collection Rate" value={pct(summary.kpis?.collectionRate ?? 0)} />
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 12 }}>
        <b>DSO:</b> {Math.round(summary.kpis?.DSO ?? 0)} days
      </div>

      <section>
        <h3>Invoice Aging</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["0–30", "31–60", "61–90", "90+", "n/a"].map((h) => (
                <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "6px 4px" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {["0-30", "31-60", "61-90", "90+", "n/a"].map((k) => (
                <td key={k} style={{ padding: "8px 4px", borderBottom: "1px solid #f1f5f9" }}>
                  <div><b>{aging.rollup?.[k]?.count ?? 0}</b> invoices</div>
                  <div style={{ opacity: 0.8 }}>Outstanding: {money(aging.rollup?.[k]?.outstanding ?? 0, cur)}</div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: 16 }}>
        <h3>Dunning (last 30 days)</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span>Total sends: <b>{dunning.last30d?.total ?? 0}</b></span>
          <span>Upcoming: <b>{dunning.last30d?.upcoming ?? 0}</b></span>
          <span>Overdue: <b>{dunning.last30d?.overdue ?? 0}</b></span>
          <span>Mocked: <b>{dunning.last30d?.mocked ?? 0}</b></span>
        </div>
      </section>
    </main>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="card" style={{ padding: 12, minWidth: 160, flex: "1 1 180px", boxSizing: "border-box" }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 700, whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}



// // Analytics & Insights page — robust server fetch (absolute URL + cookies) and no overflow
// import { getSessionUser } from "@lib/auth";
// import { headers, cookies } from "next/headers";

// export const dynamic = "force-dynamic";

// // helpers
// function money(n: number, currency: string) {
//   return new Intl.NumberFormat(undefined, { style: "currency", currency }).format((n ?? 0) / 100);
// }
// function pct(n: number) {
//   const clamped = Math.max(0, Math.min(1, n || 0));
//   return `${(clamped * 100).toFixed(1)}%`;
// }

// // build absolute base URL for server-side fetch and forward cookies
// async function buildFetchInit(): Promise<{ base: string; init: RequestInit }> {
//   const h = await headers();
//   const proto = h.get("x-forwarded-proto") ?? "http";
//   const host =
//     h.get("x-forwarded-host") ??
//     h.get("host") ??
//     process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "") ??
//     "localhost:3000";
//   const base = `${proto}://${host}`;

//   // forward session cookie explicitly so auth works on server fetch
//   const c = await cookies();
//   const cookieHeader = c
//     .getAll()
//     .map((x) => `${x.name}=${x.value}`)
//     .join("; ");

//   return {
//     base,
//     init: { cache: "no-store", headers: { cookie: cookieHeader } },
//   };
// }

// export default async function AnalyticsPage() {
//   const user = await getSessionUser();
//   if (!user) {
//     return (
//       <main className="card">
//         <h1 style={{ marginTop: 0 }}>Analytics</h1>
//         <p>Please sign in.</p>
//       </main>
//     );
//   }

//   const { base, init } = await buildFetchInit();

//   const [summaryRes, agingRes, dunningRes] = await Promise.all([
//     fetch(`${base}/api/analytics/summary`, init),
//     fetch(`${base}/api/analytics/aging`, init),
//     fetch(`${base}/api/analytics/dunning`, init),
//   ]);

//   const summary = await summaryRes.json();
//   const aging = await agingRes.json();
//   const dunning = await dunningRes.json();
//   const cur = (summary.currency ?? "USD").toUpperCase();

//   return (
//     <main className="card">
//       <h1 style={{ marginTop: 0 }}>Analytics &amp; Insights</h1>

//       {/* KPI row — FLEX with wrap to prevent overflow */}
//       <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
//         <Kpi title="MRR" value={money(summary.kpis?.MRR ?? 0, cur)} />
//         <Kpi title="ARR" value={money(summary.kpis?.ARR ?? 0, cur)} />
//         <Kpi title="Active Customers" value={String(summary.kpis?.activeCustomers ?? 0)} />
//         <Kpi title="ARPA" value={money(summary.kpis?.ARPA ?? 0, cur)} />
//         <Kpi title="Collection Rate" value={pct(summary.kpis?.collectionRate ?? 0)} />
//       </div>

//       {/* DSO */}
//       <div className="card" style={{ marginBottom: 16, padding: 12 }}>
//         <b>DSO:</b> {Math.round(summary.kpis?.DSO ?? 0)} days
//       </div>

//       {/* Aging buckets */}
//       <section>
//         <h3>Invoice Aging</h3>
//         <table style={{ width: "100%", borderCollapse: "collapse" }}>
//           <thead>
//             <tr>
//               {["0–30", "31–60", "61–90", "90+", "n/a"].map((h) => (
//                 <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "6px 4px" }}>
//                   {h}
//                 </th>
//               ))}
//             </tr>
//           </thead>
//           <tbody>
//             <tr>
//               {["0-30", "31-60", "61-90", "90+", "n/a"].map((k) => (
//                 <td key={k} style={{ padding: "8px 4px", borderBottom: "1px solid #f1f5f9" }}>
//                   <div>
//                     <b>{aging.rollup?.[k]?.count ?? 0}</b> invoices
//                   </div>
//                   <div style={{ opacity: 0.8 }}>
//                     Outstanding: {money(aging.rollup?.[k]?.outstanding ?? 0, cur)}
//                   </div>
//                 </td>
//               ))}
//             </tr>
//           </tbody>
//         </table>
//       </section>

//       {/* Dunning last 30 days */}
//       <section style={{ marginTop: 16 }}>
//         <h3>Dunning (last 30 days)</h3>
//         <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
//           <span>Total sends: <b>{dunning.last30d?.total ?? 0}</b></span>
//           <span>Upcoming: <b>{dunning.last30d?.upcoming ?? 0}</b></span>
//           <span>Overdue: <b>{dunning.last30d?.overdue ?? 0}</b></span>
//           <span>Mocked: <b>{dunning.last30d?.mocked ?? 0}</b></span>
//         </div>
//       </section>
//     </main>
//   );
// }

// // KPI card — fixed min width, grows evenly, wraps cleanly
// function Kpi({ title, value }: { title: string; value: string }) {
//   return (
//     <div
//       className="card"
//       style={{
//         padding: 12,
//         minWidth: 160,
//         flex: "1 1 180px",
//         boxSizing: "border-box",
//       }}
//     >
//       <div style={{ fontSize: 12, opacity: 0.8 }}>{title}</div>
//       <div style={{ fontSize: 20, fontWeight: 700, whiteSpace: "nowrap" }}>{value}</div>
//     </div>
//   );
// }
