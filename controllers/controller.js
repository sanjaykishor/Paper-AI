const { ipcMain, BrowserWindow } = require("electron");
const path = require("path");
const AppFSM = require("../helpers/appFSM");
const answerKeyLoader = require("../helpers/answerKeyLoader");
const examPaperLoader = require("../helpers/examPaperLoader");
const studentInfo = require("../models/studentInfo");

class Controller {
  constructor() {
    this.appFSM = AppFSM;
    this.window = null;
    this.registerListeners();
    this.init();
  }

  registerListeners = () => {
    console.log("registerListeners");
    ipcMain.on("search-student", this.parseCommand);
    ipcMain.on("search-class-exam", this.parseCommand);
    ipcMain.on("start-evaluation", this.parseCommand);
  };

  parseCommand = (event, data) => {
    console.log("parseCommand", data);
    switch (data.channel) {
      case "search-student":
        console.log("search-student", data.data.studentId);
        break;
      case "search-class-exam":
        console.log("search-class-exam", data.data);
        break;
      case "start-evaluation":
        console.log("start-evaluation", data.data);
        answerKeyLoader.setKeyPath(data.data.keyPath);
        examPaperLoader.setPaperPath(data.data.paperPath);
        this.appFSM.transition("loadAnswerKey");
        break;
      default:
        break;
    }
  };

  startWindow = () => {
    console.log("startWindow");
    this.initialiseWindow();
  };

  initialiseWindow = () => {
    this.window = new BrowserWindow({
      width: 1400,
      height: 1200,
      webPreferences: {
        nodeIntegration: true,
        preload: path.join(__dirname, "../preload.js"),
      },
    });
    this.window.loadFile("./views/home/index.html");
    this.window.webContents.openDevTools();
  };

  init = () => {
    this.appFSM.on("transition", async (transition) => {
      console.log(transition);
      switch (transition.toState) {
        case "loadAnswerKey":
          await answerKeyLoader.loadAnswerKeys();
          break;
        case "evaluateExamPapers":
          await this.evaluateExamPapers();
          break;
        case "displayResults":
          this.displayResults();
          break;
        default:
          break;
      }
    });
  };

  evaluateExamPapers = async () => {
    console.log("Evaluating exam papers");
    const results = await examPaperLoader.loadAndEvaluatePaper(answerKeyLoader);
    this.appFSM.transition("displayResults");
    return results;
  };

  displayResults = () => {
    const results = examPaperLoader.getEvaluationResults();
    console.log("Evaluation Results:");
    results.forEach((result) => {
      console.log(
        `Roll No: ${result.rollNo}, Class: ${result.class}, Section: ${result.section}, Subject: ${result.subject}, Total Score: ${result.totalScore}/${result.maxPossibleScore}`
      );
    });
    // Send the results to the renderer process to display in the UI
    this.window.webContents.send("evaluation-results", results);
  };
}

module.exports = new Controller();