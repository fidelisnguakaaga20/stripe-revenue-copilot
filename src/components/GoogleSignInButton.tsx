"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    google?: any;
  }
}

export default function GoogleSignInButton() {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.warn("NEXT_PUBLIC_GOOGLE_CLIENT_ID missing");
      return;
    }

    // Load Google script once
    const existing = document.querySelector(
      'script[src^="https://accounts.google.com/gsi/client"]'
    );
    if (!existing) {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      document.body.appendChild(s);
      s.onload = init;
    } else {
      init();
    }

    function init() {
      if (!window.google) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (credResp: any) => {
          try {
            const [, payloadB64] = credResp.credential.split(".");
            const payload = JSON.parse(
              atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))
            );

            const email = payload.email as string | undefined;
            const name = payload.name as string | undefined;

            const r = await fetch("/api/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, name }),
            });

            if (r.ok) {
              window.location.href = "/";
            } else {
              const t = await r.text();
              alert(`Sign-in failed: ${t}`);
            }
          } catch (e) {
            console.error(e);
            alert("Sign-in failed.");
          }
        },
      });

      if (divRef.current) {
        window.google.accounts.id.renderButton(divRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
        });
      }
    }
  }, []);

  return <div ref={divRef} />;
}



// "use client";

// import { useEffect, useRef } from "react";

// declare global {
//   interface Window {
//     google?: any;
//   }
// }

// export default function GoogleSignInButton() {
//   const divRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
//     if (!clientId) {
//       console.warn("NEXT_PUBLIC_GOOGLE_CLIENT_ID missing");
//       return;
//     }

//     // Insert Google Identity script once
//     if (!document.querySelector('script[src^="https://accounts.google.com/gsi/client"]')) {
//       const s = document.createElement("script");
//       s.src = "https://accounts.google.com/gsi/client";
//       s.async = true;
//       s.defer = true;
//       document.body.appendChild(s);
//       s.onload = init;
//     } else {
//       init();
//     }

//     function init() {
//       if (!window.google) return;
//       window.google.accounts.id.initialize({
//         client_id: clientId,
//         callback: async (credResp: any) => {
//           try {
//             // Decode payload on client (lightweight) to get email/name
//             const [, payloadB64] = credResp.credential.split(".");
//             const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));

//             const email = payload.email as string | undefined;
//             const name = payload.name as string | undefined;

//             const r = await fetch("/api/auth/google", {
//               method: "POST",
//               headers: { "Content-Type": "application/json" },
//               body: JSON.stringify({ email, name }),
//             });

//             if (r.ok) {
//               // Go home after session cookie is set
//               window.location.href = "/";
//             } else {
//               const t = await r.text();
//               alert(`Sign-in failed: ${t}`);
//             }
//           } catch (e) {
//             console.error(e);
//             alert("Sign-in failed.");
//           }
//         },
//       });

//       if (divRef.current) {
//         window.google.accounts.id.renderButton(divRef.current, {
//           type: "standard",
//           theme: "outline",
//           size: "large",
//           text: "continue_with",
//           shape: "rectangular",
//           logo_alignment: "left",
//         });
//       }
//     }
//   }, []);

//   return <div ref={divRef} />;
// }
