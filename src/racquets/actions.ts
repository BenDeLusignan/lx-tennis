"use server";

import { redirect } from "next/navigation";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import { submitAddRacquet } from "@/racquets/submit";

// Anyone can POST to a Server Action, whatever the page shows, so the work
// in `submitAddRacquet` sends a visitor to log in before reading anything
// else. It always ends in redirect() (see src/auth/actions.ts for why), and
// the refresh of the racquet lists happens in the save code in src/data.

export async function addRacquet(formData: FormData): Promise<never> {
  redirect(await submitAddRacquet(await getCurrentReviewer(), formData));
}
