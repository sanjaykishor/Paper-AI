const fs = require("fs").promises;
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const appFSM = require("./appFSM");

class ExamPaperLoader {
  constructor() {
    this.paperPath = null;
    this.appFSM = appFSM;
    this.evaluationResults = new Map(); // Map to store rollNo -> evaluation result
    this.fileMap = new Map(); // Map to store rollNo -> array of {filename, content}
    this.anthropic = new Anthropic({
      apiKey: "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",
    });
  }

  setPaperPath(paperPath) {
    this.paperPath = paperPath;
  }

  getPaperPath() {
    return this.paperPath;
  }

  async loadAndEvaluatePaper(answerKeyLoader) {
    try {
      const files = await fs.readdir(this.paperPath);

      for (const file of files) {
        if (path.extname(file).toLowerCase() === '.png') {
          const filePath = path.join(this.paperPath, file);
          console.log(`Processing file: ${file}`);
          const paperContent = await fs.readFile(filePath, { encoding: 'base64' });
          
          // First, extract roll number
          const rollNo = await this.extractRollNumber(paperContent, file);
          
          // Store the file content
          if (!this.fileMap.has(rollNo)) {
            this.fileMap.set(rollNo, []);
          }
          this.fileMap.get(rollNo).push({ filename: file, content: paperContent });

          // Then evaluate the paper
          const evaluationResult = await this.evaluateWithClaude(paperContent, answerKeyLoader, file, rollNo);
          
          // Merge or add the evaluation result
          this.mergeOrAddEvaluationResult(evaluationResult);
        }
      }

      console.log("All papers evaluated successfully");
      return Array.from(this.evaluationResults.values());
    } catch (error) {
      console.error("Error loading and evaluating papers:", error);
      this.appFSM.handle("failure");
    }
  }

  async extractRollNumber(paperContent, filename) {
    const prompt = `Please extract and return only the roll number from this exam paper image. The roll number is typically found at the top of the paper. Return only the roll number, without any additional text or explanation.

Exam Paper Image (Filename: ${filename}):
[Exam Paper Image]`;

    const response = await this.anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 50,
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
                data: paperContent
              }
            }
          ],
        },
      ],
    });

    const rollNo = response.content[0].text.trim();
    console.log(`Extracted roll number: ${rollNo} from file: ${filename}`);
    return rollNo;
  }

  async evaluateWithClaude(paperContent, answerKeyLoader, filename, rollNo) {
    try {
      let evaluationComplete = false;
      let currentAnswerKey = answerKeyLoader.getCurrentAnswerKey();
      let evaluationResult = {
        rollNo: rollNo,
        class: "",
        section: "",
        subject: "",
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
                    data: paperContent
                  }
                }
              ],
            },
          ],
        });

        const result = JSON.parse(response.content[0].text);
        this.mergeEvaluationResults(evaluationResult, result);

        if (result.unansweredQuestions.length === 0 || currentAnswerKey.isLastChunk) {
          evaluationComplete = true;
        } else {
          currentAnswerKey = answerKeyLoader.getNextAnswerKeyChunk();
          if (!currentAnswerKey) {
            console.log("No more answer key chunks available. Ending evaluation.");
            evaluationComplete = true;
          }
        }
      }
      answerKeyLoader.resetAnswerKeys();

      return evaluationResult;
    } catch (error) {
      console.error("Error in Claude evaluation:", error);
      throw error;
    }
  }

  generatePrompt(answerKey, filename, currentEvaluation) {
    return `You are an exam evaluator. You have been given a chunk of an answer key text and a student's exam paper image. Your tasks are:

1. Carefully examine the exam paper image and the answer key text chunk.
2. Extract the class, section, and subject from the exam paper if not already provided.
3. Identify the question numbers and their corresponding answers in the exam paper that match this answer key chunk.
4. Compare the student's answers to the answer key chunk.
5. Provide a score for each answered question based on the marks specified in the answer key chunk.
6. Determine if any answers are partial or incomplete.
7. Identify any questions in this chunk that couldn't be answered with the current answer key information.

Answer Key Chunk (Filename: ${answerKey.filename}, Is Last Chunk: ${answerKey.isLastChunk}):
${answerKey.content}

Exam Paper Image (Filename: ${filename}):
[Exam Paper Image]

Current Evaluation State:
${JSON.stringify(currentEvaluation, null, 2)}

Please provide your evaluation in the following JSON format:
{
  "class": "extracted class (if not already provided)",
  "section": "extracted section (if not already provided)",
  "subject": "extracted subject (if not already provided)",
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
  "unansweredQuestions": ["list of question numbers that couldn't be answered with this key chunk"]
}

Ensure your response is only the JSON object, with no additional explanation.`;
  }

  mergeEvaluationResults(currentEvaluation, newEvaluation) {
    if (!currentEvaluation.class && newEvaluation.class) {
      currentEvaluation.class = newEvaluation.class;
    }
    if (!currentEvaluation.section && newEvaluation.section) {
      currentEvaluation.section = newEvaluation.section;
    }
    if (!currentEvaluation.subject && newEvaluation.subject) {
      currentEvaluation.subject = newEvaluation.subject;
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

  mergeOrAddEvaluationResult(evaluationResult) {
    if (this.evaluationResults.has(evaluationResult.rollNo)) {
      // Merge with existing result
      const existing = this.evaluationResults.get(evaluationResult.rollNo);
      this.mergeEvaluationResults(existing, evaluationResult);
    } else {
      // Add new result
      this.evaluationResults.set(evaluationResult.rollNo, evaluationResult);
    }
  }

  getEvaluationResults() {
    return Array.from(this.evaluationResults.values());
  }

  getExamPaperContents(rollNo) {
    const papers = this.fileMap.get(rollNo);
    if (!papers || papers.length === 0) {
      throw new Error(`No files found for roll number: ${rollNo}`);
    }
    return papers;
  }
}

module.exports = new ExamPaperLoader();