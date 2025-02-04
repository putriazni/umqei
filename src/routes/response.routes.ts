import { Router } from "express";
import * as response from "../controllers/response.controllers";

const router = Router();

router.route(`/inSessionCheck/:formResponseID`).get(response.checkInSession);
router.route(`/inSessionReset/:formResponseID`).patch(response.resetInSession);
router.route(`/resetTimer/:formResponseID/:reset`).patch(response.resetTimer);

router.route('/enabler/:formId/:groupId/:respectiveGroupId/:yearSession').get(response.getFormResponseDetails);
router.route('/enabler/save').post(response.saveFormResponseDetails);
router.route('/enabler/submit').post(response.submitFormResponseDetails);

router.route('/result/:formId/:groupId/:respectiveGroupId/:yearSession').get(response.getResultResponseDetails);
router.route('/result/save').post(response.saveResultResponseDetails);
router.route('/result/submit').post(response.submitResultResponseDetails);

router.route('/recommendation&comment/:groupID/:formID/:yearSession').get(response.getRecommendationAndComment);
export default router;