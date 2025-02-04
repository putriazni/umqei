import { RowDataPacket } from "mysql2";

export interface Form {
    formID: number,
    title: string,
    formDefinition: string,
    formType: number,
    formNumber: number,
    formUpdatedDate: string,
    formStatus: number,
    minScale: number,
    maxScale: number,
    weightage: number,
    flag: number,
    nonAcademicWeightage: number
}

export interface SavedForm {
    form: Form,
    prev: FormDetails,
    payload: FormDetails
}

export interface SavedResultForm {
    form: Form,
    prev: ResultFormDetails,
    payload: ResultFormDetails
}

export interface FormDetails extends Form {
    details: {
        criterion: Criterion[],
        totalCriterion: number,
    }
}

export interface Criterion extends RowDataPacket {
    criterionID: number,
    description: string,
    criterionNumber: number,
    criterionStatus: number,
    formID: number,
    subCriterions: SubCriterion[],
    totalSubCriterion: number,
}

export interface SubCriterion extends RowDataPacket {
    subCriterionID: number,
    description: string,
    subCriterionNumber: number,
    subCriterionStatus: number,
    questions: Question[]
}

export interface Question extends RowDataPacket {
    questionID: number,
    description: string,
    questionNumber: number,
    questionStatus: number,
    exampleEvidence: string,
}

export interface ResultFormDetails extends Form {
    details: {
        result: [],
        totalResult: number
    }
}

export interface ResultQuestion extends RowDataPacket {
    resultQuestionID: number,
    title: string, 
    description: string,
    refCode: string,
    resultQuestionNumber: number,
    resultQuestionStatus: number
}