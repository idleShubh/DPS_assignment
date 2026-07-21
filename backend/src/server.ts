import { loadConfig } from "./config.js";
import app from "./index.js";

const config = loadConfig();

app.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});
