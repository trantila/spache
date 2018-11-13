import * as express from "express";
import { Request, Response } from "express";


const hostname = "localhost";
const port = 3000;

const app = express();

app.get("/", function(req: Request, res: Response) {
    res.send("Hello, world!");
});

app.listen(port, hostname, () => console.log(`Listening at ${hostname}:${port}`));
