import "server-only";
import { loginPath } from "@/auth/safe-next-path";
import type { Reviewer } from "@/data/reviewers";
import { deleteString, updateString } from "@/data/strings";
import { parseId, parseStringFields } from "@/forms/fields";

/**
 * What the string Server Actions (`src/strings/actions.ts`) do, given the
 * logged-in reviewer (null for a visitor). Each returns the URL to redirect to.
 */

const STRINGS_PATH = "/account/strings";

export async function submitStringUpdate(
  reviewer: Reviewer | null,
  formData: FormData,
): Promise<string> {
  if (!reviewer) return loginPath(STRINGS_PATH);

  const id = parseId(formData.get("id"));
  const fields = parseStringFields(formData.get("brand"), formData.get("name"), formData.get("type"));
  if (id === null || !fields) return `${STRINGS_PATH}?error=invalid`;

  switch (await updateString(id, fields)) {
    case "saved":
      return `${STRINGS_PATH}?saved=${id}`;
    case "string-exists":
      return `${STRINGS_PATH}?error=string-exists`;
    case "not-found":
      return `${STRINGS_PATH}?error=invalid`;
  }
}

export async function submitStringDelete(
  reviewer: Reviewer | null,
  formData: FormData,
): Promise<string> {
  if (!reviewer) return loginPath(STRINGS_PATH);

  const id = parseId(formData.get("id"));
  if (id === null) return `${STRINGS_PATH}?error=invalid`;

  return (await deleteString(id)) === "in-use"
    ? `${STRINGS_PATH}?error=in-use`
    : `${STRINGS_PATH}?deleted=1`;
}
