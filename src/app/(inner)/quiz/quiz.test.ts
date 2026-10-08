import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { QUIZ_QUESTIONS, QUIZ_RESULT } from "./quiz";

// Ben's words: ask male or female, age range, level of player, type of player
// and how fit they are, then tell everyone the Head Instinct MP.
describe("the Tennis Quiz", () => {
  it("asks Ben's five questions in his order, starting with male or female", () => {
    assert.deepEqual(
      QUIZ_QUESTIONS.map((question) => question.name),
      ["gender", "age", "level", "style", "fitness"],
    );
    assert.deepEqual(
      QUIZ_QUESTIONS[0].options.map((option) => option.label),
      ["Male", "Female"],
    );
  });

  it("tells everyone the Head Instinct MP", () => {
    assert.equal(QUIZ_RESULT, "Head Instinct MP");
  });
});
