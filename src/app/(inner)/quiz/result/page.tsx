import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { Button } from "@/components/button";
import { Panel } from "@/components/panel";
import { SectionTitle } from "@/components/section-title";
import { QUIZ_RESULT } from "../quiz";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Your racquet",
  description: "The racquet the Tennis Quiz picked for you.",
};

// Fully static, and it reads nothing: the quiz form sends its answers here as a
// GET query, but every combination gets the same racquet (Ben's call), so the
// query is ignored. That keeps the result in the prerendered HTML, which shows
// with or without JavaScript (a streamed result would sit hidden until React's
// script revealed it). The cost: anyone who types /quiz/result sees it, which
// is harmless, and the quiz form's own `required` checks are the only "all five
// answered" check.
//
// The Head Instinct MP isn't in the racquet line-up, so it has no page, photo,
// specs or scores (Product rules 9 to 12): the result only names it.
export default function QuizResultPage() {
  return (
    <>
      <BackLink href="/quiz">Tennis Quiz</BackLink>
      <SectionTitle as="h1">Tennis Quiz</SectionTitle>

      <Panel aria-labelledby="quiz-result" className={styles.panel}>
        <p className={styles.lead}>The racquet for you is:</p>
        <SectionTitle as="h2" id="quiz-result" className={styles.racquet}>
          {QUIZ_RESULT}
        </SectionTitle>
        <div className={styles.actions}>
          <Button href="/quiz" variant="secondary">
            Take the quiz again
          </Button>
          <Button href="/" variant="secondary">
            Back to home
          </Button>
        </div>
      </Panel>
    </>
  );
}
