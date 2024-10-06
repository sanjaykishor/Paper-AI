const fs = require("fs").promises;
const path = require("path");
const appFSM = require("./appFSM");

class AnswerKeyLoader {
  constructor() {
    this.keyPath = null;
    this.answerKeys = [];
    this.currentKeyIndex = 0;
    this.appFSM = appFSM;
  }

  setKeyPath(path) {
    this.keyPath = path;
  }

  async loadAnswerKeys() {
    try {
      const files = await fs.readdir(this.keyPath);
      this.answerKeys = [];

      for (const file of files) {
        if (path.extname(file).toLowerCase() === '.png') {
          const filePath = path.join(this.keyPath, file);
          const content = await fs.readFile(filePath, { encoding: 'base64' });
          this.answerKeys.push({ filename: file, content: content });
        }
      }

      if (this.answerKeys.length === 0) {
        throw new Error("No valid answer key files found in the directory");
      }

      console.log(`${this.answerKeys.length} answer key files loaded successfully`);
      this.appFSM.transition("evaluateExamPapers");
    } catch (err) {
      console.error("Error reading answer key files:", err);
      this.appFSM.transition("failure");
    }
  }

  getCurrentAnswerKey() {
    return this.answerKeys[this.currentKeyIndex];
  }

  getNextAnswerKey() {
    this.currentKeyIndex++;
    if (this.currentKeyIndex < this.answerKeys.length) {
      return this.answerKeys[this.currentKeyIndex];
    }
    return null;
  }

  resetAnswerKeys() {
    this.currentKeyIndex = 0;
  }
}

module.exports = new AnswerKeyLoader();