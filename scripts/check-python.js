const { runPython } = require("./python-bin");

runPython(["-m", "compileall", "backend/app"]);
