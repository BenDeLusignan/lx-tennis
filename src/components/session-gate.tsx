import { SESSION_SECONDS } from "@/auth/session";
import { SESSION_HINT_COOKIE } from "@/auth/session-hint";

/**
 * Makes a logged-in reviewer's page appear in one piece: the page content,
 * the header's name and Log out, and the reviewer-only buttons together.
 *
 * Why it's needed. Every page is a prerendered shell, and the reviewer-only
 * parts stream in behind <Suspense>. React then holds each streamed part back
 * until 300ms after the first paint (its own flicker guard, hard-coded in
 * react-dom's streaming runtime, no setting), however fast the server was. So
 * on a hard load a reviewer sees the page, then about a third of a second
 * later the name and buttons pop in. Visitors have the same wait for "Log in",
 * but they get the content at once, which matters more to them.
 *
 * What it does. The script below runs in <head>. When the `lx_member` hint
 * cookie says a reviewer was logged in here, it sets `data-await-session` on
 * <html>, and `layout.module.css` keeps the page invisible (in place, so
 * nothing moves) while it is set. `SessionMarker`, rendered with the header's
 * login state, is the last thing to arrive: once the script sees the marker
 * outside React's hidden staging area (so the other streamed parts have been
 * revealed in the same batch), it lifts the gate before the browser paints.
 * Everything appears in the same frame.
 *
 * It only ever delays content for someone who has the hint, and never for
 * long: a 2.5s timeout lifts the gate if the marker doesn't arrive (a slow or
 * cold server), and the parts then pop in as they did before. Without
 * JavaScript the script doesn't run and the page is simply there.
 *
 * The marker also keeps the hint honest (set when the session is real, cleared
 * when it isn't), so a session that ended elsewhere stops delaying pages after
 * one more load. Nothing here is a security check: the hint and the marker
 * only decide when the page is shown, and `getCurrentReviewer()` stays the one
 * boundary.
 */
const GATE_ATTRIBUTE = "data-await-session";
const MARKER_ATTRIBUTE = "data-session";
const GIVE_UP_MS = 2500;

// Plain ES5 on purpose: it runs before anything else on every page.
const SCRIPT = `(function () {
  var root = document.documentElement;
  var hint = ${JSON.stringify(SESSION_HINT_COOKIE)};
  var hasHint = new RegExp("(?:^|; )" + hint + "=1(?:;|$)").test(document.cookie);
  var secure = location.protocol === "https:" ? "; secure" : "";
  if (hasHint) root.setAttribute(${JSON.stringify(GATE_ATTRIBUTE)}, "");
  var release = function () { root.removeAttribute(${JSON.stringify(GATE_ATTRIBUTE)}); };
  var timer = setTimeout(function () { observer.disconnect(); release(); }, ${GIVE_UP_MS});
  var observer = new MutationObserver(function () {
    var marker = document.querySelector("[${MARKER_ATTRIBUTE}]");
    // Still inside React's hidden staging area: streamed in, not revealed yet.
    if (!marker || (marker.parentElement && marker.parentElement.closest("[hidden]"))) return;
    observer.disconnect();
    clearTimeout(timer);
    document.cookie = marker.getAttribute("${MARKER_ATTRIBUTE}") === "member"
      ? hint + "=1; path=/; max-age=${SESSION_SECONDS}; samesite=lax" + secure
      : hint + "=; path=/; max-age=0; samesite=lax" + secure;
    release();
  });
  observer.observe(root, { childList: true, subtree: true });
})();`;

/** In the root layout's <head>. */
export function SessionGateScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}

/** Rendered with the login state, so it arrives with the reviewer-only parts and tells the script they're in. */
export function SessionMarker({ member }: { member: boolean }) {
  return <span hidden {...{ [MARKER_ATTRIBUTE]: member ? "member" : "visitor" }} />;
}
