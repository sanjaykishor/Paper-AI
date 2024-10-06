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
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  setPaperPath(paperPath) {
    this.paperPath = paperPath;
  }

  async loadAndEvaluatePaper(answerKeyLoader) {
    try {
      const files = await fs.readdir(this.paperPath);
      for (const file of files) {
        const filePath = path.join(this.paperPath, file);
        const paperContent = await fs.readFile(filePath, "base64");

        console.log(`Evaluating file: ${file}`);
        await this.evaluateWithClaude(paperContent, answerKeyLoader, file);
      }

      // Finalize any ongoing evaluation
      if (this.currentEvaluation) {
        this.evaluationResults.push(this.currentEvaluation);
        this.currentEvaluation = null;
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
      let answerKey = answerKeyLoader.getCurrentAnswerKey();
      let evaluationResult;
      let isEvaluationComplete = false;

      while (!isEvaluationComplete) {
        const prompt = this.generatePrompt(paperContent, answerKey, filename);

        const response = await this.anthropic.messages.create({
          model: "claude-3-5-sonnet-20240620",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        });

        evaluationResult = JSON.parse(response.content[0].text);

        if (evaluationResult.needNextAnswerKey) {
          answerKey = answerKeyLoader.getNextAnswerKey();
          if (!answerKey) {
            console.log("No more answer keys available. Ending evaluation.");
            isEvaluationComplete = true;
          }
        } else {
          isEvaluationComplete = true;
        }
      }

      this.updateEvaluation(evaluationResult);
      answerKeyLoader.resetAnswerKeys();

      return evaluationResult;
    } catch (error) {
      answerKeyLoader.resetAnswerKeys();
      console.error("Error in Claude evaluation:", error);
      throw error;
    }
  }

  generatePrompt(paperContent, answerKey, filename) {
    return `You are an exam evaluator. You have been given an answer key and a student's exam paper. Your tasks are:

1. Extract the roll number from the the exam paper.
2. Identify the question numbers and their corresponding answers in the exam paper and evaluate them based on the answers provided in the answer key for the same question number.
3. Evaluate the student's answers based on the answer key.
4. Provide a score for each answered question based on the marks specified in the answer key.
5. Determine if this paper contains complete answers or if it's a partial submission.
6. If you can't find an answer for a question in the current answer key, indicate that you need the next answer key.

Answer Key:
Filename: ${answerKey.filename}
Content: ${answerKey.content}

Exam Paper (Filename: ${filename}):
${paperContent}

Please provide your response in the following JSON format:
{
  "rollNo": "extracted roll number",
  "isComplete": boolean indicating if this paper contains complete answers or if more pages are expected,
  "scores": [
    {
      "questionNumber": "question number",
      "score": awarded score,
      "maxScore": maximum score for this question,
      "isPartial": boolean indicating if this is a partial answer
    }
  ],
  "totalScore": sum of all scores,
  "maxPossibleScore": sum of all max scores for attempted questions,
  "needNextAnswerKey": boolean indicating if you need the next answer key to complete the evaluation
}

If this paper is a continuation of a previous one (same roll number), include only the new information in the scores array.`;
  }

  updateEvaluation(evaluationResult) {
    if (
      this.currentEvaluation &&
      this.currentEvaluation.rollNo === evaluationResult.rollNo
    ) {
      // Merge with existing evaluation
      this.currentEvaluation.scores.push(...evaluationResult.scores);
      this.currentEvaluation.totalScore += evaluationResult.totalScore;
      this.currentEvaluation.maxPossibleScore +=
        evaluationResult.maxPossibleScore;
      this.currentEvaluation.isComplete = evaluationResult.isComplete;
    } else {
      // Finalize previous evaluation if exists
      if (this.currentEvaluation) {
        this.evaluationResults.push(this.currentEvaluation);
      }
      // Start new evaluation
      this.currentEvaluation = evaluationResult;
    }

    if (evaluationResult.isComplete) {
      this.evaluationResults.push(this.currentEvaluation);
      this.currentEvaluation = null;
    }
  }

  getEvaluationResults() {
    return this.evaluationResults;
  }
}

module.exports = new ExamPaperLoader();
