import { Router } from "express";
import { 
    getFormDetails, 
    saveFormDetails, 
    saveResultDetails, 
    reviewForm 
} from "../controllers/formDetails.controller";

const router = Router();

router.route('/:formId').get(getFormDetails);
router.route('/enabler/activity').post(saveFormDetails);
router.route('/result/activity').post(saveResultDetails);
router.route(`/:session/${"form="}:formID&${"group="}:respectiveGroupID`).get(reviewForm);

export default router;