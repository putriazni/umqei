import { Router } from "express";
import { getAnnouncement,getAnnouncements,createAnnouncement,deleteAnnouncement } from "../controllers/announcement.controllers";
const router = Router();

router.route('/').get( getAnnouncements);
router.route('/:id').get(getAnnouncement);
router.route('/add').post(createAnnouncement);
router.route('/delete').post( deleteAnnouncement);


export default router;