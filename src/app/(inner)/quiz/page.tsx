import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { Button } from "@/components/button";
import { Panel } from "@/components/panel";
import { SectionTitle } from "@/components/section-title";
import styles from "./page.module.css";
import { QUIZ_QUESTIONS } from "./quiz";

export const metadata: Metadata = {
  title: "Tennis Quiz",
  description: "Five quick questions to find the racquet that suits you.",
};

// The whole page is static: the questions are fixed and it reads nothing from
// the request. It is a plain GET form to /quiz/result, so it works before
// JavaScript loads, needs no Server Action and stores nothing. The answers
// end up in the result's address, but nothing reads them: Ben's call is that
// every combination gets the same racquet.
//
// `required` on every radio group is the only "all five answered" check: the
// browser itself stops a submit with a question skipped, with or without
// JavaScript, so there is no server check to keep in step with it.
export default function QuizPage() {
  return (
    <>
      <BackLink href="/">Home</BackLink>
      <SectionTitle as="h1">Tennis Quiz</SectionTitle>
      <p className={styles.intro}>Five quick questions. One tap each.</p>

      <Panel aria-label="Quiz questions" className={styles.panel}>
        <form action="/quiz/result" method="get" className={styles.form}>
          {QUIZ_QUESTIONS.map((question) => (
            <fieldset key={question.name} className={styles.question}>
              <legend className={styles.legend}>{question.legend}</legend>
              <div className={styles.choices}>
                {question.options.map((option) => (
                  <label key={option.value} className={styles.choice}>
                    <input
                      type="radio"
                      name={question.name}
                      value={option.value}
                      required
                      className={styles.radio}
                    />
                    <span className={styles.choiceLabel}>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <Button type="submit" variant="primary" className={styles.submit}>
            Show my racquet
          </Button>
        </form>
      </Panel>
    </>
  );
}
