import { Suspense } from "react";
import { logOut } from "@/auth/actions";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import { CurrentPathInput } from "@/components/current-path-input";
import { LoginLink } from "@/components/login-link";
import styles from "./auth-status.module.css";

/**
 * The header's login state: "Log in" for visitors, the reviewer's name and
 * "Log out" once logged in. Used by `SiteHeader` and the landing page hero.
 *
 * It reads the session cookie, so it's the one part of each page rendered
 * per request. The <Suspense> boundary is what keeps everything else in the
 * prerendered static shell (Cache Components / Partial Prerendering). The
 * slot keeps its height (one 44px control) whatever streams in, including
 * nothing on /login, so the page never jumps.
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
  if (!reviewer) return <LoginLink className={styles.button} />;

  return (
    <div className={styles.status}>
      <p className={styles.name}>
        <span className="visually-hidden">Logged in as </span>
        {reviewer.displayName}
      </p>
      <form action={logOut}>
        <CurrentPathInput name="next" />
        <button type="submit" className={styles.button}>
          Log out
        </button>
      </form>
    </div>
  );
}
