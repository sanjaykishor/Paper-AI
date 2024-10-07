const machina = require("machina");

class AppFSM extends machina.Fsm {
  constructor() {
    super({
      namespace: "app",
      initialState: "uninitialized",
      states: {
        uninitialized: {
          _onEnter: function () {
            console.log("uninitialized");
          },
        },
        loadAnswerKey: {
          _onEnter: function () {
            console.log("Loading answer key");
          },
        },
        evaluateExamPapers: {
          _onEnter: function () {
            console.log("Evaluating exam papers");
          },
        },
        displayResults: {
          _onEnter: function () {
            console.log("Displaying evaluation results");
          },
          complete: function () {
            this.transition("updateDatabase");
          },
        },
        updateDatabase: {
          _onEnter: function () {
            console.log("Updating database with evaluation results");
          },
        },
        failure: {
          _onEnter: function () {
            console.log("An error occurred");
          },
        },
      },
    });
  }

  transition(state) {
    setImmediate(() => {
      super.transition(state);
    });
  }

  handle(state, args) {
    setImmediate(() => {
      super.handle(state, args);
    });
  }
}

module.exports = new AppFSM();
