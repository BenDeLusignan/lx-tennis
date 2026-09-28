import { logOut } from "@/auth/actions";
import { Button } from "@/components/button";

/**
 * "Log out", in the header and on /account. A form posting to the logOut
 * Server Action, never a link: a GET that logs you out could be triggered
 * by another site (an <img>, a prefetch). As a plain form it also works
 * before the page's JavaScript has loaded.
 */
export function LogOutButton() {
  return (
    <form action={logOut}>
      <Button type="submit">Log out</Button>
    </form>
  );
}
