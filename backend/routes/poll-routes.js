import express from 'express';
import {
    createPoll,
    getPoll,
    votePoll,
    getBlogPolls,
    updatePoll,
    deletePoll,
    addPollOption
} from '../controllers/poll-controller.js';

const pollRouter = express.Router();

pollRouter.post('/', createPoll);
pollRouter.get('/:pollId', getPoll);
pollRouter.post('/:pollId/vote', votePoll);
pollRouter.get('/blog/:blogId', getBlogPolls);
pollRouter.put('/:pollId', updatePoll);
pollRouter.delete('/:pollId', deletePoll);
pollRouter.post('/:pollId/options', addPollOption);

export default pollRouter;