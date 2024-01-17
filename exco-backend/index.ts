import { config } from "dotenv";

config();

import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import { DBCon } from "./utils/db";
import { ExpressExtender } from "./express-extend/extend";

import { UserService, deocodeJWT } from "./controllers/user";
import { ExamService } from "./controllers/questions";
import { AnswerService } from "./controllers/answers";
import { WorkerService } from "./controllers/threading";
import { dbConfig } from "./utils/constants";

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use('/grades', express.static('./generated/'));

ExpressExtender
.init(deocodeJWT)
.registerClass(UserService)
.registerClass(ExamService)
.registerClass(AnswerService)
.registerClass(WorkerService)
.applyToExpress(app)
.clearRegistrations();


if(process.env.COMBINED && (process.env.COMBINED === 'true' || process.env.COMBINED === 'TRUE')) {
    const REACT_BUILD_FOLDER = path.join(__dirname, '../build');
    app.use(express.static(REACT_BUILD_FOLDER));
    app.use((_, res, __) => {
        res.sendFile(path.join(REACT_BUILD_FOLDER, 'index.html'));
    });
}

DBCon.initDatabse(
    dbConfig.url,
    dbConfig.dbName,
    dbConfig.collectionNames
);

DBCon
    .connect()
    .then(() => {
        const listener = app.listen(
            process.env.PORT || 3000,
            () => {
                const address = listener.address();
                console.log('[ADDRESS]', address);
                if(address !== null && typeof address === 'object' && address.port !== undefined) {
                    console.log(`Listening on port ${address.port}`);
                }
            }
        );
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });