import { URL } from "url";
import * as express from "express";
import { Request, Response } from "express";
import * as morgan from "morgan";
import { logInfo } from "./utils";
import { getDatabaseConnection } from "./database";
import { neoApiRouter } from "./routers/neo-api-router";
import { aggregationsRouter } from "./routers/aggregations-router";


const hostname = "localhost";
const port = 3000;
const host = `${hostname}:${port}`;
// TODO HTTPS would rock :)
const origin = new URL(`http://${host}`);
const nasaApiKey = process.env["SPACHE_NASA_API_KEY"] || "DEMO_KEY";


const server = express();

server.use(morgan("[:date[iso]] :method :url :status :response-time ms - :res[content-length]"));

server.get("/", async (_req: Request, res: Response) => {
    const connection = await getDatabaseConnection();
    res.send(`Space Cache | Connected to: ${connection.driver.database}: ${connection.isConnected}`);
});

server.use("/neo/rest/v1", neoApiRouter(origin, nasaApiKey));
server.use("/aggregations", aggregationsRouter(nasaApiKey));

server.listen(port, hostname, async () => {
    logInfo(`Listening at ${host}`);
    logInfo(`Using NASA API KEY "${nasaApiKey}"`);
    const connection = await getDatabaseConnection();
    logInfo(`Connected to ${connection.driver.database}`);
});
