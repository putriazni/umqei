import { Router } from "express";
import { getForms, createForm, deleteForm, editForm } from "../controllers/formEdit.controllers";
import { getSelfAuditForms } from "../controllers/form.controllers";
const router = Router();

router.route('/list').get(getForms);
router.route('/creation').post(createForm);
router.route('/deletion').patch(deleteForm);
router.route('/edition').patch(editForm);

router.route('/formList/selfaudit/:ptjAcademic/:groupId/:respectiveGroupId/:yearSession/:mode').get(getSelfAuditForms);



export default router;