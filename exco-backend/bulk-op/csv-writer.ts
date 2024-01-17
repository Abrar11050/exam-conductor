import { ExamEntity, ProcessedEntity, GradingHandler } from "./grader";
import fs from 'fs';

export class CSVWriter implements GradingHandler {
    private path: string;
    private fd: number;
    private count: number = 0;

    public constructor(path: string) {
        this.path = path;
        this.fd = fs.openSync(path, 'w');
    }

    public onFailure(msg: string): void {
        console.log(`\x1b[31m${msg}\x1b[0m`);
    }

    public onInitiate(exam: ExamEntity): void {
        const qHeaderPart = exam.questions.map((q, i) => `Q${i + 1} (${q.points})`).join(',');
        const total = exam.questions.reduce((acc, q) => acc + q.points, 0);
        fs.writeSync(this.fd, `Serial,Name,Email,${qHeaderPart},Total (${total})\n`);
    }

    public onBatchDone(_: ExamEntity, procs: ProcessedEntity[]): void {
        for(const proc of procs) {
            const qPart = proc.scores.join(',');
            const name  = JSON.stringify(proc.stdName);
            const email = JSON.stringify(proc.stdEmail);
            fs.writeSync(this.fd, `${++this.count},${name},${email},${qPart},${proc.total}\n`);
        }
    }

    public onComplete(_: ExamEntity): void {
        fs.closeSync(this.fd);
    }

    public getPath(): string {
        return this.path;
    }

    public getCount(): number {
        return this.count;
    }
}