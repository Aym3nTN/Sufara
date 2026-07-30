import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/http.js';
import { validate } from '../middleware/validate.js';
import { optionalAuth } from '../middleware/auth.js';
import { TRAVEL_MODES, WALKING_TOLERANCES } from '../domain/constants.js';
import { buildPlan } from '../services/plannerGateway.js';

export const plannerRouter = Router();
plannerRouter.use(optionalAuth);

const location = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const baseSchema = z.object({
  cityId: z.string().optional(),
  start: location,
  startLabel: z.string().trim().max(120).optional(),
  end: location.optional(),
  availableMinutes: z.number().int().min(15).max(16 * 60),
  // Deliberately no default: an absent travel mode must fall through to the
  // traveller's saved preference, which a schema default would silently shadow.
  travelMode: z.enum(TRAVEL_MODES).optional(),
  interestCategoryIds: z.array(z.string()).max(20).optional(),
  selectedPlaceIds: z.array(z.string()).max(25).optional(),
  maxPlaces: z.number().int().min(1).max(25).optional(),
  walkingTolerance: z.enum(WALKING_TOLERANCES).optional(),
  maxWalkingMeters: z.number().int().min(200).max(20_000).optional(),
  startTime: z.string().datetime().optional(),
});

/** Mode A ("plan for me") and Mode C ("explore everything"). */
plannerRouter.post(
  '/generate',
  validate(baseSchema),
  asyncHandler(async (req, res) => {
    const plan = await buildPlan({ ...req.body, userId: req.auth?.userId });
    res.json({ plan });
  }),
);

/** Mode B: the traveller chose the places, we find the best order. */
plannerRouter.post(
  '/optimize',
  validate(
    baseSchema.extend({
      selectedPlaceIds: z.array(z.string()).min(1).max(25),
      // An explicit list is the whole request: never pad it with extra stops.
      maxPlaces: z.number().int().min(1).max(25).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const plan = await buildPlan({
      ...req.body,
      userId: req.auth?.userId,
      maxPlaces: req.body.maxPlaces ?? req.body.selectedPlaceIds.length,
    });
    res.json({ plan });
  }),
);

/**
 * What-if for the itinerary editor: times the traveller's exact order without
 * reordering or adding anything, so the UI can warn about overruns.
 */
plannerRouter.post(
  '/preview',
  validate(baseSchema.extend({ selectedPlaceIds: z.array(z.string()).min(1).max(25) })),
  asyncHandler(async (req, res) => {
    const plan = await buildPlan({
      ...req.body,
      userId: req.auth?.userId,
      preserveOrder: true,
    });
    res.json({ plan });
  }),
);
