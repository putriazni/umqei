import { Request, Response } from 'express';
import { Criterion, Form, Question, ResultQuestion, SubCriterion } from "../interface/Form";
import { AccessLayer, Table } from '../constants/global';
import { FormService } from '../services/formService';
import { FormContentService } from '../services/formContentService';
import { serverError } from '../constants/global';
import { logHelper } from '../middleware/logger';
import { isNumberExceed, isNumberValid, isStatusValid, isStringValid } from '../utils/utils.function';

export async function getForms(req: Request, res: Response) {
    try {
        let enablerWeightage = 0;
        let resultWeightage = 0;
        let resultNonAcademicWeightage = 0;

        const forms = await FormService.getActiveForms();
        if (Array.isArray(forms)) {
            forms.forEach((form) => {
                if (form.formType === 0) {
                    enablerWeightage += form.weightage || 0;
                } else if (form.formType === 1) {
                    resultWeightage += form.weightage || 0;
                    resultNonAcademicWeightage += form.nonAcademicWeightage || 0;
                }
            });
        }

        res.status(200).json(
            {
                forms,
                weightages: {
                    enablerWeightage: enablerWeightage,
                    resultWeightage: resultWeightage,
                    resultNonAcademicWeightage: resultNonAcademicWeightage
                }
            }
        );
        logHelper(`GET ${req.originalUrl}`, 'getForms', AccessLayer.Controllers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching forms' });
        logHelper(`GET ${req.originalUrl}`, 'getForms', AccessLayer.Controllers, error);
    }
}

export async function createForm(req: Request, res: Response) {
    const requestBody: Form = req.body;
    try {
        if (
            !isStringValid(requestBody.title) || !isStringValid(requestBody.formDefinition) ||
            !isStatusValid(requestBody.formType) || !isNumberValid(requestBody.formNumber) ||
            !isStatusValid(requestBody.formStatus) || !isNumberExceed(requestBody.minScale, 0, requestBody.maxScale) ||
            !isNumberExceed(requestBody.maxScale, requestBody.minScale, 10) || !isNumberValid(requestBody.weightage) ||
            !isStatusValid(requestBody.flag) || !isNumberValid(requestBody.nonAcademicWeightage)
        ) {
            logHelper(`POST ${req.originalUrl}`, 'createForm', AccessLayer.Controllers);
            return res.status(400).json(
                { message: "Invalid request" }
            )
        }

        const values = [
            [
                requestBody.title, requestBody.formDefinition,
                requestBody.formType, requestBody.formNumber,
                requestBody.formStatus, requestBody.minScale,
                requestBody.maxScale, requestBody.weightage,
                requestBody.flag, requestBody.nonAcademicWeightage
            ]
        ];
        const insertId = await FormService.createNewForm(values);

        if (insertId) {
            const formInfo = await FormService.getFormInfo(insertId);
            res.status(200).json(
                {
                    ...formInfo,
                    formType: formInfo.formType === 0 ? "Enabler" : "Result",
                }
            );
            logHelper(`POST ${req.originalUrl}`, 'createForm', AccessLayer.Controllers);
        }
    } catch (error) {
        console.error(error);
        res.status(500).send(serverError);
        logHelper(`POST ${req.originalUrl}`, 'createForm', AccessLayer.Controllers, error);
    }
}

export async function deleteForm(req: Request, res: Response) {
    const id = Number(req.query.formID);

    try {
        const formToBeChecked = await FormService.getFormInfo(id);

        if (!formToBeChecked) {
            logHelper(`PATCH ${req.originalUrl}`, 'deleteForm', AccessLayer.Controllers);
            return res.status(404).json(
                { message: 'Invalid form' }
            );
        }

        if (formToBeChecked.formType === 0) {
            const criterions = await FormContentService.getCriterions(id);
            if (criterions !== undefined) {
                await Promise.all(
                    criterions.map(async (criterion: Criterion) => {
                        await FormContentService.deactivate(Table.Criterion, criterion.criterionID);
                        const subCriterions = await FormContentService.getSubCriterions(criterion.criterionID);
                        if (subCriterions !== undefined) {
                            await Promise.all(
                                subCriterions.map(async (subCriterion: SubCriterion) => {
                                    await FormContentService.deactivate(Table.SubCriterion, subCriterion.subCriterionID);
                                    const questions = await FormContentService.getQuestion(subCriterion.subCriterionID);
                                    if (questions !== undefined) {
                                        await Promise.all(
                                            questions.map(async (question: Question) => {
                                                await FormContentService.deactivate(Table.Question, question.questionID);
                                            })
                                        );
                                    }
                                })
                            );
                        }
                    })
                );
            }
        } else if (formToBeChecked.formType === 1) {
            const resultQuestions = await FormContentService.getResultQuestion(id);
            await Promise.all(
                resultQuestions.map(async (resultQuestion: ResultQuestion) => {
                    await FormContentService.deactivate(Table.ResultQuestion, resultQuestion.resultQuestionID);
                })
            );
        }

        const result = await FormService.deactivateForm(id);

        if (result) {
            res.status(200).json(
                {
                    ...formToBeChecked,
                    formType: formToBeChecked.formType === 0 ? "Enabler" : "Result",
                }
            );
            logHelper(`PATCH ${req.originalUrl}`, 'deleteForm', AccessLayer.Controllers);
        }
    } catch (error) {
        console.error(error);
        res.status(500).send(serverError);
        logHelper(`PATCH ${req.originalUrl}`, 'deleteForm', AccessLayer.Controllers, error);
    }
}

export async function editForm(req: Request, res: Response) {
    const requestBody: Form = req.body;
    const id = Number(req.query.formID);

    try {
        if (
            !isStringValid(requestBody.title) || !isStringValid(requestBody.formDefinition) ||
            !isNumberExceed(requestBody.minScale, 0, requestBody.maxScale) || !isNumberExceed(requestBody.maxScale, requestBody.minScale, 10) ||
            !isStatusValid(requestBody.flag) || !isNumberValid(requestBody.weightage) || !isNumberValid(requestBody.nonAcademicWeightage)
        ) {
            logHelper(`PATCH ${req.originalUrl}`, 'editForm', AccessLayer.Controllers);
            return res.status(400).json(
                { message: "Invalid request" }
            )
        }
        const existingForm = await FormService.getFormInfo(id);

        if (!existingForm) {
            logHelper(`PATCH ${req.originalUrl}`, 'editForm', AccessLayer.Controllers);
            return res.status(404).json(
                { message: 'Invalid form' }
            );
        }

        const updatedForm: Form = {
            ...existingForm,
            title: requestBody.title,
            formDefinition: requestBody.formDefinition,
            minScale: requestBody.minScale,
            maxScale: requestBody.maxScale,
            weightage: requestBody.weightage,
            flag: requestBody.flag,
            nonAcademicWeightage: requestBody.nonAcademicWeightage
        };

        const values = [
            updatedForm.title, updatedForm.formDefinition, updatedForm.minScale,
            updatedForm.maxScale, updatedForm.weightage, updatedForm.flag,
            updatedForm.nonAcademicWeightage
        ]

        const result = await FormService.updateForm(id, values);

        if (result) {
            const formInfo = await FormService.getFormInfo(id);
            res.status(200).json(
                {
                    ...formInfo,
                    formType: formInfo.formType === 0 ? "Enabler" : "Result",
                }
            );
            logHelper(`PATCH ${req.originalUrl}`, 'editForm', AccessLayer.Controllers);
        }
    } catch (error) {
        console.error(error);
        res.status(500).send(serverError);
        logHelper(`PATCH ${req.originalUrl}`, 'editForm', AccessLayer.Controllers);
    }
}