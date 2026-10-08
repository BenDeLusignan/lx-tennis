// The Tennis Quiz's questions. Ben's call is that whatever the answers are, the
// result is the same racquet (see "The Tennis Quiz" in docs/vision.md), so
// there is nothing to score: the answers are only asked for, never read.

/** The one result, whatever the answers. Not in the racquet line-up, so it has no page, specs or photo. */
export const QUIZ_RESULT = "Head Instinct MP";

interface QuizOption {
  /** The radio's value, so what ends up in the result's address (`?age=18-34`). */
  value: string;
  /** What the person taps. */
  label: string;
}

interface QuizQuestion {
  /** The radio group's name. */
  name: string;
  /** The fieldset's legend. */
  legend: string;
  options: readonly QuizOption[];
}

// Ben named the five questions and their order, and male/female. The option
// lists after that are the team's call (kept to 2-4 each so every question
// fits on a phone screen without scrolling inside it).
export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    name: "gender",
    legend: "Are you male or female?",
    options: [
      { value: "male", label: "Male" },
      { value: "female", label: "Female" },
    ],
  },
  {
    name: "age",
    legend: "What's your age range?",
    options: [
      { value: "under-18", label: "Under 18" },
      { value: "18-34", label: "18\u201334" },
      { value: "35-49", label: "35\u201349" },
      { value: "50-plus", label: "50+" },
    ],
  },
  {
    name: "level",
    legend: "What's your level of play?",
    options: [
      { value: "beginner", label: "Beginner" },
      { value: "intermediate", label: "Intermediate" },
      { value: "advanced", label: "Advanced" },
    ],
  },
  {
    name: "style",
    legend: "What type of player are you?",
    options: [
      { value: "baseliner", label: "Baseliner" },
      { value: "all-court", label: "All-court" },
      { value: "serve-and-volley", label: "Serve and volley" },
      { value: "counterpuncher", label: "Counterpuncher" },
    ],
  },
  {
    name: "fitness",
    legend: "How fit are you?",
    options: [
      { value: "not-very-fit", label: "Not very fit" },
      { value: "fairly-fit", label: "Fairly fit" },
      { value: "very-fit", label: "Very fit" },
    ],
  },
];
