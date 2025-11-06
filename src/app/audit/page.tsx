import { prisma } from "@lib/db";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <main className="card">
      <h1 style={{ marginTop: 0 }}>Audit Log</h1>
      <p style={{opacity:.8}}>Latest 100 events</p>

      <div style={{ display:"grid", gridTemplateColumns:"180px 160px 1fr 1fr", gap:8, fontWeight:600, borderBottom:"1px solid #263043", paddingBottom:8 }}>
        <div>Time</div><div>Action</div><div>Org</div><div>Metadata</div>
      </div>

      {rows.map(r => (
        <div key={r.id} style={{ display:"grid", gridTemplateColumns:"180px 160px 1fr 1fr", gap:8, padding:"8px 0", borderBottom:"1px solid #1b2332" }}>
          <div>{new Date(r.createdAt).toLocaleString()}</div>
          <div>{r.action}</div>
          <div>{r.organizationId}</div>
          <div><pre style={{margin:0, whiteSpace:"pre-wrap"}}>{JSON.stringify(r.metadata ?? {}, null, 2)}</pre></div>
        </div>
      ))}
      <p style={{marginTop:12}}><a href="/">Home</a></p>
    </main>
  );
}
