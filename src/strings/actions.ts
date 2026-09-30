"use server";

import { redirect } from "next/navigation";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import { submitStringDelete, submitStringUpdate } from "@/strings/submit";

// Checked on the server and ending in redirect(), as src/reviews/actions.ts.

export async function updateString(formData: FormData): Promise<never> {
  redirect(await submitStringUpdate(await getCurrentReviewer(), formData));
}

export async function deleteString(formData: FormData): Promise<never> {
  redirect(await submitStringDelete(await getCurrentReviewer(), formData));
}
