import { Job } from "node-schedule";

export type NewData = [
    description: string,
    numbering: number,
    status: number,
    id: number,
    exampleEvidence?: string,
];

export type NewResult = [
    title: string,
    description: string,
    refCode: string,
    numbering: number,
    status: number,
    id: number
];

export type NewFormResponse = [
    groupID: number,
    submitted: boolean,
    inSession: boolean,
    formID: number,
    respectiveGroupID: number,
    reflection_recommendation: string | null,
    action_comment: string | null
];

export type NewQuestionResponse = [
    scale: number,
    remark: string,
    formResponseID: number,
    questionID: number
]

export type ScheduledJobType = Job;

export type FormPeriodSetType = [number, string];

export type UserAndUserGroupSetType = [
    userID: number,
    groupID: number,
    head: boolean
]