export interface FormResponse {
    formResponseID: number;
    formID: number;
    groupID: number;
    submitted: boolean;
    inSession: boolean;
    respectiveGroupID: number;
    createdDate: string;
    lastUpdatedDate: string;
    reflection: string,
    action: string,
}

export interface QuestionResponse {
    questionResponseID: number;
    scale: number;
    remark: string;
    formResponseID: number;
    questionID: number;
}

export interface ResultQuestionResponse {
    resultQuestionResponseID: number;
    scale: number;
    remark: string;
    formResponseID: number;
    resultQuestionID: number;
}

interface File {
    filename: string;
    filepath: string;
}

export interface Evidence extends File {
    evidenceID: number;
    questionResponseID: number;
}

export interface ResultEvidence extends File {
    resultEvidenceID: number;
    resultQuestionResponseID: number;
}