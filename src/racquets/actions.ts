"use server";

import { redirect } from "next/navigation";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import { submitRacquetAdd, submitRacquetDelete, submitRacquetUpdate } from "@/racquets/submit";

// Anyone can POST to a Server Action, whatever the page shows, so the work
// in `submit.ts` sends a visitor to log in before it touches the database or
// the image store. (An edit or a delete reads the form's slug first, only to
// know where to send the visitor back to.) It always ends in redirect() (see
// src/auth/actions.ts for why), and the refresh of the racquet pages happens
// in the save code in src/data.

export async function addRacquet(formData: FormData): Promise<never> {
  redirect(await submitRacquetAdd(await getCurrentReviewer(), formData));
}

export async function updateRacquet(formData: FormData): Promise<never> {
  redirect(await submitRacquetUpdate(await getCurrentReviewer(), formData));
}

export async function deleteRacquet(formData: FormData): Promise<never> {
  redirect(await submitRacquetDelete(await getCurrentReviewer(), formData));
}
