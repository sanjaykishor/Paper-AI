const { ipcMain, BrowserWindow } = require("electron");
const path = require("path");
const https = require('https');
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
        case "updateDatabase":
          await this.updateDatabase();
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
    
    // Transition to update database state
    this.appFSM.handle("complete");
  };

  updateDatabase = async () => {
    const results = examPaperLoader.getEvaluationResults();
    console.log("Updating database with evaluation results", results);

    const url = "https://paper-ai-backend.onrender.com/api/evaluation-results";

    for (let result of results) {
      try {
        // Retrieve the original exam paper contents using the new method
        const paperContents = examPaperLoader.getExamPaperContents(result.rollNo);

        // Prepare the data for each result
        const dataToSend = {
          _id: result.rollNo, // Using rollNo as _id
          rollNo: result.rollNo,
          class: result.class || "Not Specified",
          section: result.section || "Not Specified",
          subject: result.subject,
          totalScore: result.totalScore,
          maxPossibleScore: result.maxPossibleScore,
          // scores: result.scores,
          // marksheets: paperContents.map(pc => ({
          //   filename: pc.filename,
          //   content: pc.content
          // }))
        };

        const data = JSON.stringify(dataToSend);
        console.log("Sending data to database for roll no:", dataToSend);

        const options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
          }
        };

        await new Promise((resolve, reject) => {
          const req = https.request(url, options, (res) => {
            let responseBody = '';

            res.on('data', (chunk) => {
              responseBody += chunk;
            });

            res.on('end', () => {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                console.log("Database update successful for roll no:", result.rollNo);
                this.window.webContents.send("database-update-success", { rollNo: result.rollNo });
                resolve();
              } else {
                console.error("Error updating database for roll no:", result.rollNo, res.statusCode, responseBody);
                this.window.webContents.send("database-update-error", `HTTP error! status: ${res.statusCode} for roll no: ${result.rollNo}`);
                reject(new Error(`HTTP error! status: ${res.statusCode}`));
              }
            });
          });

          req.on('error', (error) => {
            console.error("Error updating database for roll no:", result.rollNo, error);
            this.window.webContents.send("database-update-error", `${error.message} for roll no: ${result.rollNo}`);
            reject(error);
          });

          req.write(data);
          req.end();
        });
      } catch (error) {
        console.error("Error processing result for roll no:", result.rollNo, error);
        this.window.webContents.send("database-update-error", `Error processing result for roll no: ${result.rollNo}`);
      }
    }

    console.log("All results processed");
    this.appFSM.transition("success");
  };
}

module.exports = new Controller();