import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.PORT, () => {
  console.info(`All Hours Cafe API listening on http://localhost:${env.PORT}`);
});
