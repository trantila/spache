import * as express from "express";
import {Request, Response} from "express";
import * as bodyParser from  "body-parser";


console.log("Goin' up!");

const app = express();
app.use(bodyParser.json());


app.get("/", function(req: Request, res: Response) {
    res.send("Hello, world!");
});

app.listen(3000);
