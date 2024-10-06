const { app } = require("electron");
const controller = require("./controllers/controller");

app.whenReady().then(controller.startWindow.bind(this));

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
    console.log("------------")
  if (BrowserWindow.getAllWindows().length === 0) {
    controller.init.bind(this);
  }
});