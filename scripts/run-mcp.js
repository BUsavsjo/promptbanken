const { runPython } = require("./python-bin");

runPython(["-m", "backend.app.mcp_server"]);
