const fs = require("fs").promises;
const path = require("path");
const appFSM = require("./appFSM");
const pdfParse = require('pdf-parse');

class AnswerKeyLoader {
  constructor() {
    this.keyPath = null;
    this.answerKeys = [];
    this.currentKeyIndex = 0;
    this.currentChunkIndex = 0;
    this.chunkSize = 1000; // Adjust this value as needed
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
        const ext = path.extname(file).toLowerCase();
        if (ext === '.txt' || ext === '.pdf') {
          const filePath = path.join(this.keyPath, file);
          const content = await this.readFile(filePath, ext);
          this.answerKeys.push({ filename: file, content: this.chunkContent(content) });
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

  async readFile(filePath, extension) {
    if (extension === '.txt') {
      return await fs.readFile(filePath, 'utf-8');
    } else if (extension === '.pdf') {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);
      return pdfData.text;
    }
  }

  chunkContent(content) {
    const chunks = [];
    for (let i = 0; i < content.length; i += this.chunkSize) {
      chunks.push(content.slice(i, i + this.chunkSize));
    }
    return chunks;
  }

  getCurrentAnswerKey() {
    const currentKey = this.answerKeys[this.currentKeyIndex];
    if (currentKey) {
      return {
        filename: currentKey.filename,
        content: currentKey.content[this.currentChunkIndex],
        isLastChunk: this.currentChunkIndex === currentKey.content.length - 1
      };
    }
    return null;
  }

  getNextAnswerKeyChunk() {
    const currentKey = this.answerKeys[this.currentKeyIndex];
    if (currentKey && this.currentChunkIndex < currentKey.content.length - 1) {
      this.currentChunkIndex++;
      return this.getCurrentAnswerKey();
    }
    return this.getNextAnswerKey();
  }

  getNextAnswerKey() {
    this.currentKeyIndex++;
    this.currentChunkIndex = 0;
    if (this.currentKeyIndex < this.answerKeys.length) {
      return this.getCurrentAnswerKey();
    }
    return null;
  }

  resetAnswerKeys() {
    this.currentKeyIndex = 0;
    this.currentChunkIndex = 0;
  }
}

module.exports = new AnswerKeyLoader();