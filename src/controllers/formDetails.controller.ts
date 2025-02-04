import { Request, Response } from 'express';
import { Criterion, Question, ResultQuestion, SavedForm, SavedResultForm, SubCriterion } from '../interface/Form';
import { Evidence, FormResponse, QuestionResponse, ResultEvidence, ResultQuestionResponse } from '../interface/FormReview';
import { AccessLayer, Table, serverError } from '../constants/global';
import { NewData, NewResult } from '../constants/dataType';
import { FormService } from '../services/formService';
import { FormContentService } from '../services/formContentService';
import { FormReviewService } from '../services/formReviewService';
import { PeriodService } from '../services/periodService';
import { logHelper } from '../middleware/logger';


export async function getFormDetails(req: Request, res: Response) {
    const formId = Number(req.params.formId);

    try {
        const formType = await FormService.getFormInfo(formId);

        if (formType.formType === 0) {
            const formInfo = await FormService.getFormInfo(formId);

            const criterions = await FormContentService.getCriterions(formId);

            const criterionIDs = criterions.map((criterion: Criterion) => criterion.criterionID);

            const subCriterionPromises = criterionIDs.map((criterionID: number) =>
                FormContentService.getSubCriterions(criterionID)
            );
            const subCriterionResults = await Promise.all(subCriterionPromises);

            const subCriterions = subCriterionResults.flatMap((result) => result);

            const subCriterionIDs = subCriterions
                .filter((subCriterion: SubCriterion) => subCriterion && subCriterion.subCriterionID !== undefined)
                .map((subCriterion: SubCriterion) => subCriterion.subCriterionID);

            const questionPromises = subCriterionIDs.map((subCriterionID: number) =>
                FormContentService.getQuestion(subCriterionID)
            );
            const questionResults = await Promise.all(questionPromises);

            const questions = questionResults.flatMap((result: any) => result);

            if (!formInfo) {
                return res.status(404).json({ message: 'Form not found' });
            }

            const totalCreatedCriterion = await FormContentService.countAllCriterion(formId);

            const totalCreatedSubCriterionPromises = criterions.map(async (criterion: Criterion) => {
                return FormContentService.countAllSubCriterion(criterion.criterionID);
            });

            const totalCreatedSubCriterion = await Promise.all(totalCreatedSubCriterionPromises);

            const form = {
                formID: formInfo.formID,
                title: formInfo.title,
                formDefinition: formInfo.formDefinition,
                formType: formInfo.formType,
                formNumber: formInfo.formNumber,
                formStatus: formInfo.formStatus,
                formUpdatedDate: formInfo.formUpdatedDate,
                minScale: formInfo.minScale,
                maxScale: formInfo.maxScale,
                weightage: formInfo.weightage
            }

            const details = {
                criterion: criterions.map((criterion: Criterion, index: number) => ({
                    criterionID: criterion.criterionID,
                    description: criterion.description,
                    criterionNumber: criterion.criterionNumber,
                    criterionStatus: criterion.criterionStatus,
                    subCriterions: subCriterions
                        .filter((subCriterion: SubCriterion) => subCriterion.criterionID === criterion.criterionID)
                        .map((subCriterion: SubCriterion) => ({
                            subCriterionID: subCriterion.subCriterionID,
                            description: subCriterion.description,
                            subCriterionNumber: subCriterion.subCriterionNumber,
                            subCriterionStatus: subCriterion.subCriterionStatus,
                            questions: questions
                                .filter((question: Question) => question.subCriterionID === subCriterion.subCriterionID)
                                .map(({ subCriterionID, ...rest }) => rest),
                        })),
                    totalSubCriterion: subCriterions
                        .filter((subCriterion: SubCriterion) => subCriterion.criterionID === criterion.criterionID && subCriterion.subCriterionStatus === 1)
                        .length,
                    totalCreatedSubCriterion: totalCreatedSubCriterion[index],
                })),
                totalCriterion: criterions.length,
                totalCreatedCriterion: totalCreatedCriterion,
            };

            const formDetails = {
                form,
                details
            }

            res.status(200).json(formDetails);
            logHelper(`GET ${req.originalUrl}`, 'getFormDetails', AccessLayer.Controllers);

        } else if (formType.formType === 1) {
            const formInfo = await FormService.getFormInfo(formId);

            const results = await FormContentService.getResultQuestion(formId);

            const amount = await FormContentService.countAllResultQuestion(formId);

            const form = {
                formID: formInfo.formID,
                title: formInfo.title,
                formDefinition: formInfo.formDefinition,
                formType: formInfo.formType,
                formNumber: formInfo.formNumber,
                formStatus: formInfo.formStatus,
                formUpdatedDate: formInfo.formUpdatedDate,
                minScale: formInfo.minScale,
                maxScale: formInfo.maxScale,
                weightage: formInfo.weightage
            }

            const resultQuestions = results.map((result: ResultQuestion) => {
                const { questionID, ...resultData } = result;
                return resultData;
            });

            const totalResult = resultQuestions.length;

            const formDetails = {
                form: form,
                details: {
                    result: resultQuestions,
                    totalResult: totalResult,
                    totalCreatedResult: amount
                }
            };

            res.status(200).json(formDetails);
            logHelper(`GET ${req.originalUrl}`, 'getFormDetails', AccessLayer.Controllers);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json(serverError);
        logHelper(`GET ${req.originalUrl}`, 'getFormDetails', AccessLayer.Controllers, error);
    }
}

export async function saveFormDetails(req: Request, res: Response) {
    const formToBeSaved: SavedForm = req.body;

    try {
        const formKey = formToBeSaved.form.formID;
        const formExist = await FormService.getFormInfo(formKey);

        if (!formExist) {
            return res.status(404).json(
                { message: 'Invalid form' }
            );
        }

        const prevCriterions: Criterion[] = formToBeSaved.prev.details.criterion;
        const payloadCriterions: Criterion[] = formToBeSaved.payload.details.criterion;

        const totalPrevCriterion = formToBeSaved.prev.details.totalCriterion;
        const totalPayloadCriterion = formToBeSaved.payload.details.totalCriterion;


        // Check for missing criterion
        const missingCriterions: Criterion[] = prevCriterions.filter(
            (prevCriterion) =>
                !payloadCriterions.some(
                    (payloadCriterion) => payloadCriterion.criterionID === prevCriterion.criterionID
                )
        );

        await Promise.all(
            missingCriterions.map(async (missingCriterion: Criterion) => {
                await FormContentService.deactivate(Table.Criterion, missingCriterion.criterionID);
                const subCriterions = await FormContentService.getSubCriterions(missingCriterion.criterionID);
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

        let totalNewSubCriterions = 0;
        let newQuestions: NewData[] = [];

        let listOfPayloadSubCriterions: SubCriterion[] = [];
        let payloadSubCriterions: SubCriterion[][];
        let prevSubCriterions: SubCriterion[][];
        let listOfPrevSubCriterions: SubCriterion[] = [];

        if (totalPayloadCriterion !== totalPrevCriterion) {
            // Update existing data
            payloadCriterions.forEach(async (payloadCriterion: Criterion) => {
                const {
                    criterionID,
                    description,
                    criterionNumber,
                } = payloadCriterion;

                const prevCriterion = prevCriterions.find(
                    (prevCriterion) => prevCriterion.criterionID === criterionID && prevCriterion.criterionNumber === criterionNumber
                );

                if (prevCriterion && prevCriterion.description !== description) {
                    await FormContentService.updateCriterion(payloadCriterion.criterionID, payloadCriterion.description);
                }
            })

            payloadSubCriterions = [];
            payloadCriterions.forEach(async (payloadCriterion: Criterion) => {
                payloadSubCriterions.push(payloadCriterion.subCriterions);
            })

            prevSubCriterions = [];
            prevCriterions.forEach(async (prevCriterion: Criterion) => {
                prevSubCriterions.push(prevCriterion.subCriterions);
            })

            listOfPayloadSubCriterions = payloadSubCriterions.flatMap((subCriterionsArray) => subCriterionsArray);
            listOfPrevSubCriterions = prevSubCriterions.flatMap((subCriterionsArray) => subCriterionsArray);

            // Check for missing subcriterions
            const missingSubCriterions: SubCriterion[] = listOfPrevSubCriterions.filter(
                (prevSubCriterion) =>
                    !listOfPayloadSubCriterions.some(
                        (payloadSubCriterion) => payloadSubCriterion.subCriterionID === prevSubCriterion.subCriterionID && payloadSubCriterion.subCriterionNumber === prevSubCriterion.subCriterionNumber
                    )
            );

            await Promise.all(
                missingSubCriterions.map(async (subCriterion: SubCriterion) => {
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

            // Update existing subcriterion and question
            listOfPayloadSubCriterions.forEach(async (payloadSubCriterion) => {
                const prevSubCriterion = listOfPrevSubCriterions.find(
                    (prevSubCriterion) => prevSubCriterion.subCriterionID === payloadSubCriterion.subCriterionID
                );

                if (prevSubCriterion && prevSubCriterion.description !== payloadSubCriterion.description) {
                    await FormContentService.updateSubCriterion(payloadSubCriterion.subCriterionID, payloadSubCriterion.description);
                }

                const listOfQuestion: Question[] = payloadSubCriterion.questions;
                if (listOfQuestion.length > 0 && listOfQuestion.length === 3) {
                    listOfQuestion.forEach(async (payloadQuestion: Question) => {
                        const prevQuestion = prevSubCriterion?.questions.find(
                            (prevQuestion) => prevQuestion.questionID === payloadQuestion.questionID
                        );

                        if (prevQuestion && prevQuestion.description !== payloadQuestion.description) {
                            await FormContentService.updateQuestion(payloadQuestion.questionID, payloadQuestion.description, payloadQuestion.exampleEvidence);
                        }
                    })
                }
            });

            // Create new criterion
            for (const payloadCriterion of payloadCriterions) {
                const {
                    criterionID,
                    description,
                    criterionNumber,
                    criterionStatus,
                } = payloadCriterion;

                const payloadSubCriterions = [...[payloadCriterion.subCriterions]];

                if (criterionID.toString().length > 10 && description !== "") {
                    const newCriterion: NewData = [
                        description, criterionNumber, criterionStatus, formKey
                    ];
                    // Create new criterion
                    const insertedCriterionId = await FormContentService.createCriterion(newCriterion);

                    const listOfSubCriterions = payloadSubCriterions.flatMap((subCriterionsArray) => subCriterionsArray);
                    if (listOfSubCriterions.length !== 0) {
                        for (const payloadSubCriterion of listOfSubCriterions) {
                            const payloadQuestions = payloadSubCriterion.questions;

                            if (payloadSubCriterion.subCriterionID.toLocaleString().length > 10 && payloadSubCriterion.description !== undefined) {
                                const newSubCriterion: NewData = [
                                    payloadSubCriterion.description,
                                    payloadSubCriterion.subCriterionNumber,
                                    payloadSubCriterion.subCriterionStatus,
                                    insertedCriterionId
                                ]
                                // Create new subCriterion
                                const insertedSubCriterionId = await FormContentService.createSubCriterion(newSubCriterion);
                                totalNewSubCriterions++;

                                const listOfQuestion = payloadQuestions;
                                if (listOfQuestion.length > 0 && listOfQuestion.length === 3) {
                                    for (const payloadQuestion of listOfQuestion) {
                                        if (payloadQuestion.questionID.toLocaleString().length > 10 && payloadQuestion.description !== undefined) {
                                            const newQuestion: NewData = [
                                                payloadQuestion.description,
                                                payloadQuestion.questionNumber,
                                                payloadQuestion.questionStatus,
                                                insertedSubCriterionId,
                                                payloadQuestion.exampleEvidence
                                            ];
                                            newQuestions.push(newQuestion);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Create new subcriterion and question in existing criterion
            if (prevCriterions.length !== 0) {
                for (const payloadSubCriterion of listOfPayloadSubCriterions) {
                    const listOfQuestion: Question[] = payloadSubCriterion.questions;

                    if (payloadSubCriterion.subCriterionID.toString().length > 10 && payloadSubCriterion.description !== undefined) {
                        // Get CriterionId
                        let insertedCriterionId: number | undefined;
                        const foundCriterion: Criterion | undefined = payloadCriterions.find((payloadCriterion: Criterion) =>
                            payloadCriterion.subCriterions.some((subCriterion: SubCriterion) =>
                                subCriterion.subCriterionID === payloadSubCriterion.subCriterionID
                            )
                        );

                        if (foundCriterion) {
                            if (foundCriterion.criterionID.toString().length < 10 && foundCriterion.description !== undefined) {
                                insertedCriterionId = foundCriterion.criterionID;
                            } else {
                                insertedCriterionId = 0;
                            }
                        }

                        if (insertedCriterionId !== 0) {
                            const newSubCriterion: NewData = [
                                payloadSubCriterion.description,
                                payloadSubCriterion.subCriterionNumber,
                                payloadSubCriterion.subCriterionStatus,
                                insertedCriterionId!
                            ]
                            // Create new subCriterion
                            const insertedSubCriterionId = await FormContentService.createSubCriterion(newSubCriterion);
                            totalNewSubCriterions++;

                            if (listOfQuestion.length > 0 && listOfQuestion.length === 3) {
                                for (const payloadQuestion of listOfQuestion) {
                                    if (payloadQuestion.questionID.toLocaleString().length > 10 && payloadQuestion.description !== undefined) {
                                        const newQuestion: NewData = [
                                            payloadQuestion.description,
                                            payloadQuestion.questionNumber,
                                            payloadQuestion.questionStatus,
                                            insertedSubCriterionId,
                                            payloadQuestion.exampleEvidence,
                                        ];

                                        newQuestions.push(newQuestion);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (newQuestions.length !== 0 && newQuestions.length === (totalNewSubCriterions * 3)) {
                await FormContentService.createQuestion(newQuestions);
            }
        } else {
            // Update existing data
            payloadCriterions.forEach(async (payloadCriterion: Criterion) => {
                const {
                    criterionID,
                    description,
                    criterionNumber,
                    criterionStatus,
                } = payloadCriterion;

                const prevCriterion = prevCriterions.find(
                    (prevCriterion) => prevCriterion.criterionID === criterionID && prevCriterion.criterionNumber === criterionNumber
                );

                if (prevCriterion && prevCriterion.description !== description) {
                    await FormContentService.updateCriterion(payloadCriterion.criterionID, payloadCriterion.description);
                }

                if (criterionID.toString().length > 10 && description !== "") {
                    const newCriterion: NewData = [
                        description, criterionNumber, criterionStatus, formKey
                    ];

                    await FormContentService.createCriterion(newCriterion);
                }
            })

            payloadSubCriterions = [];
            payloadCriterions.forEach(async (payloadCriterion: Criterion) => {
                payloadSubCriterions.push(payloadCriterion.subCriterions);
            })

            prevSubCriterions = [];
            prevCriterions.forEach(async (prevCriterion: Criterion) => {
                prevSubCriterions.push(prevCriterion.subCriterions)
            })

            listOfPayloadSubCriterions = payloadSubCriterions.flatMap((subCriterionsArray) => subCriterionsArray);
            listOfPrevSubCriterions = prevSubCriterions.flatMap((subCriterionsArray) => subCriterionsArray);

            // Check for missing subcriterions
            const missingSubCriterions: SubCriterion[] = listOfPrevSubCriterions.filter(
                (prevSubCriterion) =>
                    !listOfPayloadSubCriterions.some(
                        (payloadSubCriterion) => payloadSubCriterion.subCriterionID === prevSubCriterion.subCriterionID && payloadSubCriterion.subCriterionNumber === prevSubCriterion.subCriterionNumber
                    )
            );

            await Promise.all(
                missingSubCriterions.map(async (subCriterion: SubCriterion) => {
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

            // Update existing subcriterion and question
            listOfPayloadSubCriterions.forEach(async (payloadSubCriterion) => {
                const prevSubCriterion = listOfPrevSubCriterions.find(
                    (prevSubCriterion) => prevSubCriterion.subCriterionID === payloadSubCriterion.subCriterionID
                );

                if (prevSubCriterion && prevSubCriterion.description !== payloadSubCriterion.description) {
                    await FormContentService.updateSubCriterion(payloadSubCriterion.subCriterionID, payloadSubCriterion.description);
                }

                const listOfQuestion: Question[] = payloadSubCriterion.questions;
                if (listOfQuestion.length > 0 && listOfQuestion.length === 3) {
                    listOfQuestion.forEach(async (payloadQuestion: Question) => {
                        const prevQuestion = prevSubCriterion?.questions.find(
                            (prevQuestion) => prevQuestion.questionID === payloadQuestion.questionID
                        );

                        if (prevQuestion && (prevQuestion.description !== payloadQuestion.description || prevQuestion.exampleEvidence !== payloadQuestion.exampleEvidence)) {
                            await FormContentService.updateQuestion(payloadQuestion.questionID, payloadQuestion.description, payloadQuestion.exampleEvidence);
                        }
                    })
                }
            });

            // Create new subcriterion and question in existing criterion
            for (const payloadSubCriterion of listOfPayloadSubCriterions) {
                const listOfQuestion: Question[] = payloadSubCriterion.questions;

                if (payloadSubCriterion.subCriterionID.toString().length > 10 && payloadSubCriterion.description !== undefined) {
                    // Get CriterionId
                    let insertedCriterionId: number | undefined;
                    const foundCriterion: Criterion | undefined = payloadCriterions.find((payloadCriterion: Criterion) =>
                        payloadCriterion.subCriterions.some((subCriterion: SubCriterion) =>
                            subCriterion.subCriterionID === payloadSubCriterion.subCriterionID
                        )
                    );

                    if (foundCriterion) {
                        if (foundCriterion.criterionID.toString().length > 10 && foundCriterion.description !== undefined) {
                            const newCriterion: NewData = [
                                foundCriterion.description, foundCriterion.criterionNumber, foundCriterion.criterionStatus, formKey
                            ];

                            const newId = await FormContentService.createCriterion(newCriterion);
                            insertedCriterionId = newId
                        } else {
                            insertedCriterionId = foundCriterion.criterionID;
                        }
                    }

                    const newSubCriterion: NewData = [
                        payloadSubCriterion.description,
                        payloadSubCriterion.subCriterionNumber,
                        payloadSubCriterion.subCriterionStatus,
                        insertedCriterionId!
                    ]
                    // Create new subCriterion
                    const insertedSubCriterionId = await FormContentService.createSubCriterion(newSubCriterion);
                    totalNewSubCriterions++;

                    if (listOfQuestion.length > 0 && listOfQuestion.length === 3) {
                        for (const payloadQuestion of listOfQuestion) {
                            if (payloadQuestion.questionID.toLocaleString().length > 10 && payloadQuestion.description !== undefined) {
                                const newQuestion: NewData = [
                                    payloadQuestion.description,
                                    payloadQuestion.questionNumber,
                                    payloadQuestion.questionStatus,
                                    insertedSubCriterionId,
                                    payloadQuestion.exampleEvidence,
                                ];

                                newQuestions.push(newQuestion);
                            }
                        }
                    }
                }
            }
            if (newQuestions.length !== 0 && newQuestions.length === (totalNewSubCriterions * 3)) {
                await FormContentService.createQuestion(newQuestions);
            }
        }

        res.json(
            {
                form: formToBeSaved.form,
                payload: formToBeSaved.payload
            }
        )
        logHelper(`POST ${req.originalUrl}`, 'saveFormDetails', AccessLayer.Controllers);
    } catch (error) {
        console.error(error);
        res.status(500).send(serverError);
        logHelper(`POST ${req.originalUrl}`, 'saveFormDetails', AccessLayer.Controllers, error);
    }
}

export async function saveResultDetails(req: Request, res: Response) {
    const formToBeSaved: SavedResultForm = req.body;
    try {
        const formKey = formToBeSaved.form.formID;
        const formExist = await FormService.getFormInfo(formKey);

        if (!formExist) {
            return res.status(404).json(
                { message: 'Invalid form' }
            );
        }

        const prevResultQuestion: ResultQuestion[] = formToBeSaved.prev.details.result;
        const payloadResultQuestion: ResultQuestion[] = formToBeSaved.payload.details.result;

        if (formToBeSaved.prev.details.totalResult > formToBeSaved.payload.details.totalResult) {
            const missingResults: ResultQuestion[] = prevResultQuestion.filter(
                (prevResult) =>
                    !payloadResultQuestion.some(
                        (payloadResult) => payloadResult.resultQuestionID === prevResult.resultQuestionID
                    )
            );

            await Promise.all(
                missingResults.map(async (missingResult: ResultQuestion) => {
                    await FormContentService.deactivate(Table.ResultQuestion, missingResult.resultQuestionID);
                })
            );

        } else if (formToBeSaved.prev.details.totalResult < formToBeSaved.payload.details.totalResult) {
            let values: NewResult[] = [];

            payloadResultQuestion.forEach(async (payloadResult: ResultQuestion) => {
                const {
                    resultQuestionID,
                    title,
                    description,
                    refCode,
                    resultQuestionNumber,
                    resultQuestionStatus
                } = payloadResult;

                if (resultQuestionID.toString().length > 10 && title !== "" && description !== "" && refCode !== "") {
                    const newResult: NewResult = [
                        title, description, refCode, resultQuestionNumber, resultQuestionStatus, formKey
                    ];

                    values.push(newResult);
                }
            })

            if (values.length > 0) {
                await FormContentService.createResult(values);
            }

        } else if (formToBeSaved.prev.details.totalResult == formToBeSaved.payload.details.totalResult) {
            const missingResults: ResultQuestion[] = prevResultQuestion.filter(
                (prevResult) =>
                    !payloadResultQuestion.some(
                        (payloadResult) => payloadResult.resultQuestionID === prevResult.resultQuestionID
                    )
            );

            await Promise.all(
                missingResults.map(async (missingResult: ResultQuestion) => {
                    await FormContentService.deactivate(Table.ResultQuestion, missingResult.resultQuestionID);
                })
            );

            let values: NewResult[] = [];

            payloadResultQuestion.forEach(async (payloadResult: ResultQuestion) => {
                if (payloadResult.resultQuestionID.toString().length > 10) {
                    const {
                        title,
                        description,
                        refCode,
                        resultQuestionNumber,
                        resultQuestionStatus
                    } = payloadResult;

                    if (title !== "" && description !== "" && refCode !== "") {
                        const newResult: NewResult = [
                            title, description, refCode, resultQuestionNumber, resultQuestionStatus, formKey
                        ];
                        values.push(newResult);
                    }
                }
            })

            if (values.length > 0) {
                await FormContentService.createResult(values);
            }
        }

        payloadResultQuestion.forEach(async (payloadResult: ResultQuestion) => {
            const prevResult = prevResultQuestion.find(
                prevResult => prevResult.resultQuestionID === payloadResult.resultQuestionID && prevResult.resultQuestionNumber === payloadResult.resultQuestionNumber
            );

            if (prevResult) {
                if (prevResult.title !== payloadResult.title ||
                    prevResult.description !== payloadResult.description ||
                    prevResult.refCode !== payloadResult.refCode) {
                    await FormContentService.updateResultQuestion(payloadResult.resultQuestionID, payloadResult.title, payloadResult.description, payloadResult.refCode);
                }
            }
        });

        res.status(200).json(
            {
                form: formToBeSaved.form,
                payload: formToBeSaved.payload
            }
        )
        logHelper(`POST ${req.originalUrl}`, 'saveResultDetails', AccessLayer.Controllers);
    } catch (error) {
        console.error(error);
        res.status(500).send(serverError);
        logHelper(`POST ${req.originalUrl}`, 'saveResultDetails', AccessLayer.Controllers, error);
    }
}

export async function reviewForm(req: Request, res: Response) {
    const formID = Number(req.params.formID);
    const respectiveGroupID = Number(req.params.respectiveGroupID);
    const session = req.params.session;

    try {
        let filteredFormResponses = [];
        const formType = await FormReviewService.getFormType(formID);

        const formResponses = await FormReviewService.getSubmittedFormResponse(formID, respectiveGroupID);
        const timeline = await PeriodService.getSession(session);

        if (Array.isArray(formResponses)) {
            filteredFormResponses = formResponses.filter((response: FormResponse) => {
                return response.createdDate >= timeline.selfAuditStartDate && response.createdDate <= timeline.auditEndDate;
            });
        }

        if (formType) {
            if (formType.formType === 0) {
                const questionResponses = await FormReviewService.getQuestionResponse(
                    Array.isArray(filteredFormResponses) ? filteredFormResponses.map((response: FormResponse) => response.formResponseID) : []
                );

                const evidenceData = await FormReviewService.getQuestionEvidenceData(
                    Array.isArray(questionResponses) ? questionResponses.map((response: QuestionResponse) => response.questionResponseID) : []
                );

                const responseWithQuestions = Array.isArray(formResponses)
                    ? formResponses.map((response: FormResponse) => {
                        const relatedQuestionResponses = Array.isArray(questionResponses)
                            ? questionResponses.filter(
                                (questionResponse: QuestionResponse) => questionResponse.formResponseID === response.formResponseID
                            )
                            : [];

                        const responseWithEvidence = relatedQuestionResponses.map((questionResponse: QuestionResponse) => {
                            const relatedEvidence = Array.isArray(evidenceData)
                                ? evidenceData.filter(
                                    (evidence: Evidence) => evidence.questionResponseID === questionResponse.questionResponseID
                                )
                                : [];

                            return {
                                ...questionResponse,
                                evidences: relatedEvidence
                            };
                        });

                        const totalScale = responseWithEvidence.reduce((total: number, questionResponse: QuestionResponse) => {
                            if (questionResponse.scale > 0) {
                                return total + questionResponse.scale;
                            }
                            return total;
                        }, 0);

                        return {
                            ...response,
                            questionResponses: responseWithEvidence,
                            totalScale: totalScale,
                        };
                    })
                    : [];

                const review = Array.isArray(filteredFormResponses) && filteredFormResponses.length === 2;

                const jsonResponse = review
                    ? {
                        ptj: responseWithQuestions.find(
                            (response: FormResponse) => response.groupID === response.respectiveGroupID
                        ),
                        auditor: responseWithQuestions.find(
                            (response: FormResponse) => response.groupID !== response.respectiveGroupID
                        ),
                        review: review
                    }
                    : {
                        review: review
                    };

                res.json(jsonResponse);
            } else if (formType.formType === 1) {
                const resultQuestionResponses = await FormReviewService.getResultQuestionResponse(
                    Array.isArray(filteredFormResponses) ? filteredFormResponses.map((response: FormResponse) => response.formResponseID) : []
                )

                const evidenceData = await FormReviewService.getResultEvidenceData(
                    Array.isArray(resultQuestionResponses) ? resultQuestionResponses.map((response: ResultQuestionResponse) => response.resultQuestionResponseID) : []
                )
                const responseWithQuestions = Array.isArray(formResponses)
                    ? formResponses.map((response: FormResponse) => {
                        const relatedResultQuestionResponses = Array.isArray(resultQuestionResponses)
                            ? resultQuestionResponses.filter(
                                (questionResponse: ResultQuestionResponse) => questionResponse.formResponseID === response.formResponseID
                            )
                            : [];

                        const responseWithEvidence = relatedResultQuestionResponses.map((questionResponse: ResultQuestionResponse) => {
                            const evidenceArray = Array.isArray(evidenceData) ? evidenceData : [];

                            const relatedEvidence = evidenceArray.filter(
                                (evidence: ResultEvidence) => evidence.resultQuestionResponseID === questionResponse.resultQuestionResponseID
                            );

                            return {
                                ...questionResponse,
                                evidences: relatedEvidence
                            };
                        });

                        const totalScale = responseWithEvidence.reduce((total: number, questionResponse: ResultQuestionResponse) => {
                            if (questionResponse.scale > 0) {
                                return total + questionResponse.scale;
                            }
                            return total;
                        }, 0);

                        return {
                            ...response,
                            questionResponses: responseWithEvidence,
                            totalScale: totalScale,
                        };
                    })
                    : [];

                const review = Array.isArray(filteredFormResponses) && filteredFormResponses.length === 2;

                const jsonResponse = review
                    ? {
                        ptj: responseWithQuestions.find(
                            (response: FormResponse) => response.groupID === response.respectiveGroupID
                        ),
                        auditor: responseWithQuestions.find(
                            (response: FormResponse) => response.groupID !== response.respectiveGroupID
                        ),
                        review: review,
                    }
                    : {
                        review: review,
                    };

                res.json(jsonResponse);
            }
        } else {
            res.json({});
        }
        logHelper(`GET ${req.originalUrl}`, 'reviewForm', AccessLayer.Controllers);
    } catch (error) {
        console.error('Error retrieving form response:', error);
        res.status(500).send(serverError);
        logHelper(`GET ${req.originalUrl}`, 'reviewForm', AccessLayer.Controllers, error);
    }
}