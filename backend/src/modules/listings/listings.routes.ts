import { Router } from 'express';
import { ListingsController } from './listings.controller';

export const listingsRouter = Router();

listingsRouter.get('/', ListingsController.getAllListings);
listingsRouter.get('/my', ListingsController.getMyListings);
listingsRouter.post('/:id/stats', ListingsController.recordStat);
listingsRouter.get('/:id', ListingsController.getListingById);
listingsRouter.post('/', ListingsController.createListing);
