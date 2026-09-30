"use server";

import { redirect } from "next/navigation";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import {
  submitDeleteSetup,
  submitReview,
  submitReviewEdit,
  submitSetupWithReview,
} from "@/reviews/submit";

// Anyone can POST to a Server Action, whatever the page shows, so each one
// checks the session itself: `submit*` sends a visitor to log in before
// reading anything else. Both always end in redirect() (see
// src/auth/actions.ts for why), and the refresh of the racquet page happens
// in the save code in src/data.

export async function createSetupWithReview(formData: FormData): Promise<never> {
  redirect(await submitSetupWithReview(await getCurrentReviewer(), formData));
}

export async function addReview(formData: FormData): Promise<never> {
  redirect(await submitReview(await getCurrentReviewer(), formData));
}

export async function updateReview(formData: FormData): Promise<never> {
  redirect(await submitReviewEdit(await getCurrentReviewer(), formData));
}

export async function deleteSetup(formData: FormData): Promise<never> {
  redirect(await submitDeleteSetup(await getCurrentReviewer(), formData));
}
