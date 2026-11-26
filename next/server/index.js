import { createApp } from "./app.js";
const { app } = createApp({ seed: true });
const port = Number(process.env.PORT || 8088);
app.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(`片刻 API / Web: http://127.0.0.1:${port}`),
);
