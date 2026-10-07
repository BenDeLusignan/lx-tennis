import { Suspense } from "react";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import { AccountLink } from "@/components/account-link";
import { LoginLink } from "@/components/login-link";
import { LogOutButton } from "@/components/log-out-button";
import { SessionMarker } from "@/components/session-gate";
import styles from "./auth-status.module.css";

/**
 * The header's login state: "Log in" for visitors; once logged in, the
 * reviewer's name (a link to /account) and "Log out". Used by `SiteHeader`
 * and the landing page hero.
 *
 * It reads the session cookie, so it's the one part of each page rendered
 * per request. The <Suspense> boundary is what keeps everything else in the
 * prerendered static shell (Cache Components / Partial Prerendering). The
 * slot keeps its height (one 44px control) whatever streams in, including
 * nothing on /login, so the page never jumps. It also renders the
 * `SessionMarker` that lets a logged-in reviewer's page be shown in one piece
 * with these parts (see session-gate.tsx).
 */
export function AuthStatus() {
  return (
    <div className={styles.slot}>
      <Suspense fallback={null}>
        <AuthStatusContent />
      </Suspense>
    </div>
  );
}

async function AuthStatusContent() {
  const reviewer = await getCurrentReviewer();
  if (!reviewer) {
    return (
      <>
        <LoginLink />
        <SessionMarker member={false} />
      </>
    );
  }

  return (
    <div className={styles.status}>
      <AccountLink displayName={reviewer.displayName} className={styles.name} />
      <LogOutButton />
      <SessionMarker member />
    </div>
  );
}
