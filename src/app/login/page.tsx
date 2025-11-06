import GoogleSignInButton from "@/components/GoogleSignInButton";

export default function LoginPage() {
  return (
    <main className="card" style={{ maxWidth: 480 }}>
      <h1 style={{ marginTop: 0 }}>Sign in</h1>
      <p>Use your Google account to continue.</p>
      <GoogleSignInButton />
    </main>
  );
}



// import GoogleSignInButton from "@/components/GoogleSignInButton";

// export default function LoginPage() {
//   return (
//     <main className="card" style={{ maxWidth: 480 }}>
//       <h1 style={{ marginTop: 0 }}>Sign in</h1>
//       <p>Use your Google account to continue.</p>
//       <GoogleSignInButton />
//     </main>
//   );
// }

