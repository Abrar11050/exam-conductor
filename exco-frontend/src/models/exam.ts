export enum ExamDeliveryState {
    // SubmitState: start
    STD_EXAM_NOT_STARTED  = 1, // student: exam window is running, user has not started
    STD_EXAM_STARTED      = 2, // student: exam window is running, user has not finished
    STD_EXAM_SUBMITTED    = 3, // student: exam window is running, user has finished
    STD_EXAM_DONE_EXPIRED = 4, // student: exam window has passed, user has finished
    STD_EXAM_MISSED       = 5, // student: exam window has passed, but user has not started the exam
    STD_EXAM_EARLY        = 6, // student: window hasn't started yet
    STD_EXAM_NOT_FOUND    = 7, // student: exam does not exist

    GEN_EXAM_ERROR        = 8, // general: when something goes wrong
    // SubmitState: end

    TCH_EXAM_EDIT         = 9,  // teacher: owns that exam and can edit
    TCH_EXAM_READONLY     = 10, // teacher: does not own the exam and can only view
    TCH_EXAM_STDVIEW      = 11, // teacher: owns that exam and viewing student submission
}

export enum QuesType {
    RADIO    = 0,
    CHECKBOX = 1
}

// function checkType(value: any, type: string): boolean {
//     if(type === 'array')
//         return Array.isArray(value);
//     else if(value === null)
//         return false;
//     else
//         return typeof value === type;
// }

function isValidID(id: any): boolean {
    return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
}

export class Question {
    public _id:         string | null;
    public text:        string;
    public points:      number;
    public maxAttempts: number;
    public quesType:    QuesType;
    public options:     string[];
    public correct:     number[];

    public constructor(
        _id:         string | null,
        text:        string,
        points:      number,
        maxAttempts: number,
        quesType:    QuesType,
        options:     string[],
        correct:     number[]
    ) {
        this._id         = _id || null;
        this.text        = text;
        this.points      = points;
        this.maxAttempts = maxAttempts;
        this.quesType    = quesType;
        this.options     = options;
        this.correct     = correct;
    }

    public static fromJSON(json: any): Question {
        return new Question(
            '_id'         in json ? json._id         : null,
            'text'        in json ? json.text        : '',
            'points'      in json ? json.points      : 0,
            'maxAttempts' in json ? json.maxAttempts : 0,
            'quesType'    in json ? json.quesType    : QuesType.RADIO,
            'options'     in json ? json.options     : [],
            'correct'     in json ? json.correct     : []
        );
    }
}

export class Answer {
    public question:     string | null;
    public usedAttempts: number;
    public provided:     number[];

    public constructor(
        question:     string | null,
        usedAttempts: number,
        provided:     number[]
    ) {
        this.question     = question;
        this.usedAttempts = usedAttempts;
        this.provided     = provided;
    }

    public static fromJSON(json: any): Answer {
        return new Answer(
            'question'     in json ? json.question     : null,
            'usedAttempts' in json ? json.usedAttempts : 0,
            'provided'     in json ? json.provided     : []
        );
    }
}

export class ExamData {
    examID:      string;
    madeBy:      string;
    title:       string;
    description: string;
    windowStart: Date;
    windowEnd:   Date;
    duration:    number;
    clampTime:   boolean;
    showScores:  boolean;
    hasScripts:  boolean;
    questions:   Question[] | null;
    
    // submission part
    subID:        string   | null;
    subGivenBy:   string   | null;
    subStartTime: Date     | null;
    subFinished:  boolean  | null;
    subAnswers:   Answer[] | null;

    subScores:    number[] | null;
    subTotal:     number   | null;
    subGrand:     number   | null;

    state:        ExamDeliveryState;
    stateText:    string;

    private constructor() {
        this.examID      = '';
        this.madeBy      = '';
        this.title       = '';
        this.description = '';
        this.windowStart = new Date();
        this.windowEnd   = new Date();
        this.duration    = 0;
        this.clampTime   = false;
        this.showScores  = false;
        this.hasScripts  = false;
        this.questions   = null;

        this.subID        = null;
        this.subGivenBy   = null;
        this.subStartTime = null;
        this.subFinished  = null;
        this.subAnswers   = null;

        this.subScores    = null;
        this.subTotal     = null;
        this.subGrand     = null;

        this.state        = ExamDeliveryState.GEN_EXAM_ERROR;
        this.stateText    = ExamDeliveryState[ExamDeliveryState.GEN_EXAM_ERROR];
    }

    public static fromJSON(json: any): ExamData {
        const exam = new ExamData();

        if(!exam || !isValidID(json.examID) || !isValidID(json.madeBy)) {
            return exam;
        } else {
            exam.examID      = json.examID;
            exam.madeBy      = json.madeBy;
            exam.title       = json.title;
            exam.description = json.description;
            exam.windowStart = new Date(json.windowStart);
            exam.windowEnd   = new Date(json.windowEnd);
            exam.duration    = json.duration;
            exam.clampTime   = json.clampTime;
            exam.showScores  = json.showScores;
            exam.hasScripts  = json.hasScripts;
            exam.questions   = ('questions' in json && json.questions !== null)
                             ? json.questions.map((q: any) => Question.fromJSON(q))
                             : null;

            exam.subID        = 'subID'        in json ? json.subID                  : null;
            exam.subGivenBy   = 'subGivenBy'   in json ? json.subGivenBy             : null;
            exam.subStartTime = 'subStartTime' in json ? new Date(json.subStartTime) : null;
            exam.subFinished  = 'subFinished'  in json ? json.subFinished            : null;
            exam.subAnswers   = ('subAnswers' in json && json.subAnswers !== null)
                              ? json.subAnswers.map((a: any) => Answer.fromJSON(a))
                              : null;

            exam.subScores    = 'subScores'    in json ? json.subScores              : null;
            exam.subTotal     = 'subTotal'     in json ? json.subTotal               : 0;
            exam.subGrand     = 'subGrand'     in json ? json.subGrand               : 0;

            exam.state        = json.state;
            exam.stateText    = json.stateText;

            return exam;
        }
    }
}

export interface EDataDynamic {
    title:       string;
    description: string;
    windowStart: Date;
    windowEnd:   Date;
    duration:    number;
    clampTime:   boolean;
    showScores:  boolean;
}

export interface QDataDynamic {
    text:        string;
    points:      number;
    maxAttempts: number;
    quesType:    QuesType;
    options:     string[];
    correct:     number[];
}

type DateStr = string;

export interface ExamMetaDataT {
    examID:      string;
    madeBy:      string;
    title:       string;
    windowStart: DateStr;
    windowEnd:   DateStr;
    duration:    number;
    showScores:  boolean;
}

export interface ExamMetaDataS extends ExamMetaDataT {
    subID:        string;
    subGivenBy:   { _id: string };
    subStartTime: DateStr;
    subFinished:  boolean;
}

export interface SubMetaData {
    _id:       string;
    startTime: DateStr;
    finished:  boolean;
    givenBy:   {
        _id:       string;
        firstName: string;
        lastName:  string;
        email:     string;
    };
}