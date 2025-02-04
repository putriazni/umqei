import { RowDataPacket } from "mysql2";
import { FileFormat } from "./File";

export interface FormResponse extends RowDataPacket {
    formResponseID: number,
    formID: number,
    groupID: number,
    submitted: boolean,
    inSession: boolean,
    respectiveGroupID: number,
    reflection_recommendation: string | null,
    action_comment: string | null,
    createdDate: string,
    lastUpdatedDate: string,
    rejected: boolean,
    respectiveAuditGroupID:number,
    auditCompleted: boolean
}

export interface FormResponseDetails extends FormResponse, RowDataPacket {
    details: {
        criterion: ResponseCriterion[];
    },
    formIDsToRemove?: number[];
}

export interface ResultResponseDetails extends FormResponse, RowDataPacket {
    details: {
        result: ResultQuestionResponse[],
    }
}

export interface ResponseCriterion extends RowDataPacket {
    criterionID: number;
    subCriterion: ResponseSubCriterion[];
}

export interface ResponseSubCriterion extends RowDataPacket {
    subCriterionID: number;
    questionResponse: QuestionResponse[];
}

export interface QuestionResponse extends RowDataPacket {
    questionResponseID: number,
    questionID: number,
    scale: number,
    evidenceFiles: FileFormat[] | undefined,
    remark: string,
    changesMade: boolean
}

export interface QuestionResponseDB extends RowDataPacket {
    questionResponseID: number,
    formResponseID: number,
    questionID: number,
    scale: number,
    remark: string,
}

export interface SavedResponse extends RowDataPacket {
    formResponse: FormResponse,
    responseDetails: FormResponseDetails,
    fileIDsToRemove?: number[],
    rejected?: boolean,
    ptjFormResponseID?: number,
    yearSession: string
}

export interface SavedResultResponse extends RowDataPacket {
    formResponse: FormResponse,
    responseDetails: ResultResponseDetails,
    fileIDsToRemove?: number[],
    rejected?: boolean,
    ptjFormResponseID?: number,
    yearSession:string
}

export interface ResultQuestionResponse {
    resultQuestionResponseID: number,
    resultQuestionID: number,
    scale: number,
    evidences: FileFormat[] | undefined,
    remark: string,
    changesMade: boolean
}

export interface ResultEvidence {
    resultEvidenceID: number;
    evidence: CustomBuffer;
    filename: string;
    resultQuestionResponseID: number;
}

export interface CustomBuffer {
    type: 'Buffer';
    data: number[];
}

export interface AuditorRecommendationAndComment {
    auditorGroupID: number;
    ptjGroupID: number
    recommendation: string;
    comment: string;
    yearSession: string;
};