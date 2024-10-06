const fs = require("fs").promises;
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const appFSM = require("./appFSM");

class ExamPaperLoader {
  constructor() {
    this.paperPath = null;
    this.currentEvaluation = null;
    this.appFSM = appFSM;
    this.evaluationResults = [];
    this.anthropic = new Anthropic({
      apiKey: "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",
    });
  }

  setPaperPath(paperPath) {
    this.paperPath = paperPath;
  }

  async loadAndEvaluatePaper(answerKeyLoader) {
    try {
      const files = await fs.readdir(this.paperPath);

      for (const file of files) {
        if (path.extname(file).toLowerCase() === '.png') {
          const filePath = path.join(this.paperPath, file);
          console.log(`Processing file: ${file}`);
          const paperContent = await fs.readFile(filePath, { encoding: 'base64' });
          await this.evaluateWithClaude(paperContent, answerKeyLoader, file);
        }
      }

      console.log("All papers evaluated successfully");
      return this.evaluationResults;
    } catch (error) {
      console.error("Error loading and evaluating papers:", error);
      this.appFSM.handle("failure");
    }
  }

  async evaluateWithClaude(paperContent, answerKeyLoader, filename) {
    try {
      let evaluationComplete = false;
      let currentAnswerKey = answerKeyLoader.getCurrentAnswerKey();
      let evaluationResult = {
        rollNo: "",
        scores: [],
        totalScore: 0,
        maxPossibleScore: 0,
        unansweredQuestions: []
      };

      while (!evaluationComplete && currentAnswerKey) {
        const prompt = this.generatePrompt(currentAnswerKey, filename, evaluationResult);

        const response = await this.anthropic.messages.create({
          model: "claude-3-5-sonnet-20240620",
          max_tokens: 1500,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/png",
                    data: currentAnswerKey.content
                  }
                },
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/png",
                    data: paperContent
                  }
                }
              ],
            },
          ],
        });

        const result = JSON.parse(response.content[0].text);
        this.mergeEvaluationResults(evaluationResult, result);

        if (result.unansweredQuestions.length === 0) {
          evaluationComplete = true;
        } else {
          currentAnswerKey = answerKeyLoader.getNextAnswerKey();
          if (!currentAnswerKey) {
            console.log("No more answer keys available. Ending evaluation.");
            evaluationComplete = true;
          }
        }
      }

      this.evaluationResults.push(evaluationResult);
      answerKeyLoader.resetAnswerKeys();

      return evaluationResult;
    } catch (error) {
      console.error("Error in Claude evaluation:", error);
      throw error;
    }
  }

  generatePrompt(answerKey, filename, currentEvaluation) {
    return `You are an exam evaluator. You have been given an answer key image and a student's exam paper image. Your tasks are:

1. Carefully examine both images.
2. Extract the roll number from the exam paper if not already provided.
3. Identify the question numbers and their corresponding answers in the exam paper.
4. Compare the student's answers to the answer key.
5. Provide a score for each answered question based on the marks specified in the answer key.
6. Determine if any answers are partial or incomplete.
7. Identify any questions that couldn't be answered with this answer key.

Answer Key Image (Filename: ${answerKey.filename}):
[Answer Key Image]

Exam Paper Image (Filename: ${filename}):
[Exam Paper Image]

Current Evaluation State:
${JSON.stringify(currentEvaluation, null, 2)}

Please provide your evaluation in the following JSON format:
{
  "rollNo": "extracted roll number (if not already provided)",
  "scores": [
    {
      "questionNumber": "question number",
      "score": awarded score,
      "maxScore": maximum score for this question from the answer key,
      "isPartial": boolean indicating if this is a partial answer
    }
  ],
  "totalScore": sum of all scores,
  "maxPossibleScore": sum of all max scores for attempted questions,
  "unansweredQuestions": ["list of question numbers that couldn't be answered with this key"]
}

Ensure your response is only the JSON object, with no additional explanation.`;
  }

  mergeEvaluationResults(currentEvaluation, newEvaluation) {
    if (!currentEvaluation.rollNo && newEvaluation.rollNo) {
      currentEvaluation.rollNo = newEvaluation.rollNo;
    }

    newEvaluation.scores.forEach(newScore => {
      const existingScoreIndex = currentEvaluation.scores.findIndex(s => s.questionNumber === newScore.questionNumber);
      if (existingScoreIndex === -1) {
        currentEvaluation.scores.push(newScore);
      } else if (newScore.score > currentEvaluation.scores[existingScoreIndex].score) {
        currentEvaluation.scores[existingScoreIndex] = newScore;
      }
    });

    currentEvaluation.totalScore = currentEvaluation.scores.reduce((sum, score) => sum + score.score, 0);
    currentEvaluation.maxPossibleScore = currentEvaluation.scores.reduce((sum, score) => sum + score.maxScore, 0);
    currentEvaluation.unansweredQuestions = newEvaluation.unansweredQuestions;
  }

  getEvaluationResults() {
    return this.evaluationResults;
  }
}

module.exports = new ExamPaperLoader();