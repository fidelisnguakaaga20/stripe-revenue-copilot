export default function HomePage() {
  return (
    <main className="card">
      <h1 style={{ marginTop: 0 }}>Stripe Revenue Copilot</h1>
      <p>Stage 0 scaffold is running.</p>
      <ul>
        <li>Health: <a href="/api/health">/api/health</a></li>
        <li>Stripe webhook placeholder: <code>/api/webhooks/stripe</code></li>
      </ul>
    </main>
  );
}
