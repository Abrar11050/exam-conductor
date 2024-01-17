import { ExamEntity, ProcessedEntity, GradingHandler } from "./grader";
import fs from 'fs';

const CSS = `div,table{font-family:arial,sans-serif}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;text-align:left;padding:8px}tr:nth-child(2n){background-color:#ddd}`;

function millisToHHMMSS(millis: number) {
    var hours = Math.floor(millis / 3600000); // 1 Hour = 36000 Milliseconds
    var minutes = Math.floor((millis % 3600000) / 60000); // 1 Minutes = 60000 Milliseconds
    var seconds = Math.floor(((millis % 360000) % 60000) / 1000); // 1 Second = 1000 Milliseconds
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
export class HTMLWriter implements GradingHandler {
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

    private makeTag(tag: string, children: string[], attrs: {[key: string]: string} = {}): string {
        tag = tag.toLowerCase();
        const attrPart = Object.keys(attrs).map(key => `${key}="${attrs[key]}"`).join(' ');
        return `<${tag}${attrPart ? ' ' + attrPart : ''}>${children.join('')}</${tag}>`;
    }

    private makeTagSelfClosing(tag: string, attrs: {[key: string]: string} = {}): string {
        const attrPart = Object.keys(attrs).map(key => `${key}="${attrs[key]}"`).join(' ');
        return `<${tag.toLowerCase()}${attrPart ? ' ' + attrPart : ''}/>`;
    }

    private startTag(tag: string, attrs: {[key: string]: string} = {}): string {
        const attrPart = Object.keys(attrs).map(key => `${key}="${attrs[key]}"`).join(' ');
        return `<${tag.toLowerCase()}${attrPart ? ' ' + attrPart : ''}>`;
    }

    private endTag(tag: string): string {
        return `</${tag.toLowerCase()}>`;
    }

    public onInitiate(exam: ExamEntity): void {
        const metadata = this.makeTag('div', [
            this.makeTag('p', [this.makeTag('b', ['Name: ']), exam.title]),
            this.makeTag('p', [this.makeTag('b', ['Start Time: ']), exam.windowStart instanceof Date ? exam.windowStart.toLocaleString('en-GB') : '']),
            this.makeTag('p', [this.makeTag('b', ['End Time: ']), exam.windowEnd instanceof Date ? exam.windowEnd.toLocaleString('en-GB') : '']),
            this.makeTag('p', [this.makeTag('b', ['Duration: ']), typeof exam.duration === 'number' ? millisToHHMMSS(exam.duration) : ''])
        ]);

        const style = this.makeTag('style', [CSS], {type: 'text/css'});

        const tableStart = this.startTag('table');
        const headerRow = this.makeTag('tr', [
            this.makeTag('th', ['Serial']),
            this.makeTag('th', ['Name']),
            this.makeTag('th', ['Email']),
            ...exam.questions.map((q, i) => this.makeTag('th', [`Q${i + 1} (${q.points})`])),
            this.makeTag('th', [`Total (${exam.questions.reduce((acc, q) => acc + q.points, 0)})`])
        ]);

        fs.writeSync(this.fd, `${style}${metadata}${tableStart}${headerRow}`);
    }

    public onBatchDone(_: ExamEntity, procs: ProcessedEntity[]): void {
        for(const proc of procs) {
            const qPart = proc.scores.map(score => this.makeTag('td', [score.toString()]));
            const name  = this.makeTag('td', [proc.stdName || '']);
            const email = this.makeTag('td', [proc.stdEmail || '']);
            const row = this.makeTag('tr', [
                this.makeTag('td', [`${++this.count}`]), 
                name,
                email,
                ...qPart,
                this.makeTag('td', [proc.total.toString()])
            ]);
            fs.writeSync(this.fd, row);
        }
    }

    public onComplete(_: ExamEntity): void {
        fs.writeSync(this.fd, this.endTag('table'));
        fs.closeSync(this.fd);
    }

    public getPath(): string {
        return this.path;
    }

    public getCount(): number {
        return this.count;
    }
}