export enum Table {
    Announcement = 'announcement',
    Attachment = 'attachment',      
    Criterion = 'criterion',
    Evidence = 'evidence',
    Form = 'form',
    FormResponse = 'form_response',
    Period = 'period',
    Question = 'question',
    QuestionResponse = 'question_response',
    ResultEvidence = 'result_evidence',
    ResultQuestion = 'result_question',
    ResultQuestionResponse = 'result_question_response',
    SubCriterion = 'sub_criterion',
    UserGroup = 'usergroup',
    User = 'users',
    Analytics = 'analytics',
    FormPeriodSet = 'form_period_set',
    AuditorPTJComments = 'auditor_ptj_comments',
    Sessions = 'sessions',
    UserGroupSet = 'users_usergroup_set'
}

export enum AccessLayer {
    Controllers = 'controllers',
    Services = 'services',
    Utilities = 'utils'
}

export const GENERAL_QUERIES = {
    SELECT_ALL: 'SELECT * FROM ??',
    SELECT: 'SELECT ? FROM ??',
    UPDATE: 'UPDATE ??',
    INSERT: 'INSERT INTO ?? (??)',
    COUNT_ALL: 'SELECT COUNT(*)',
    DELETE: 'DELETE FROM ??'
}

export const serverError = {
    internalServerError: true 
}

export const MAX_SIZE = 10 * 1024 * 1024;