import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import type { City, LatLng, Place, Plan, TravelMode, WalkingTolerance } from '../api/types';

export interface PlanDraft {
  city: City | null;
  availableMinutes: number;
  start: (LatLng & { label: string }) | null;
  interestCategoryIds: string[];
  travelMode: TravelMode;
  walkingTolerance: WalkingTolerance;
  maxPlaces?: number;
}

const DEFAULT_DRAFT: PlanDraft = {
  city: null,
  availableMinutes: 240,
  start: null,
  interestCategoryIds: [],
  travelMode: 'DRIVING',
  walkingTolerance: 'MEDIUM',
};

interface PlanValue {
  draft: PlanDraft;
  setDraft: (patch: Partial<PlanDraft>) => void;
  resetDraft: () => void;

  /** "My Visit" basket — places the traveller picked themselves (Mode B). */
  basket: Place[];
  inBasket: (placeId: string) => boolean;
  addToBasket: (place: Place) => void;
  removeFromBasket: (placeId: string) => void;
  reorderBasket: (from: number, to: number) => void;
  clearBasket: () => void;

  plan: Plan | null;
  planning: boolean;
  planError: string | null;
  /** Mode A / C: let the planner choose the places. */
  generate: () => Promise<Plan | null>;
  /** Mode B: keep the chosen places, optimise their order. */
  optimizeBasket: () => Promise<Plan | null>;
  /** What-if: time an exact order without reordering it. */
  previewOrder: (placeIds: string[]) => Promise<Plan | null>;
  setPlan: (plan: Plan | null) => void;
}

const PlanContext = createContext<PlanValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<PlanDraft>(DEFAULT_DRAFT);
  const [basket, setBasket] = useState<Place[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const setDraft = useCallback((patch: Partial<PlanDraft>) => {
    setDraftState((current) => ({ ...current, ...patch }));
  }, []);

  const resetDraft = useCallback(() => {
    setDraftState(DEFAULT_DRAFT);
    setPlan(null);
    setPlanError(null);
  }, []);

  const addToBasket = useCallback((place: Place) => {
    setBasket((current) =>
      current.some((entry) => entry.id === place.id) ? current : [...current, place],
    );
  }, []);

  const removeFromBasket = useCallback((placeId: string) => {
    setBasket((current) => current.filter((entry) => entry.id !== placeId));
  }, []);

  const reorderBasket = useCallback((from: number, to: number) => {
    setBasket((current) => {
      if (to < 0 || to >= current.length || from === to) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(to, 0, moved);
      return next;
    });
  }, []);

  /**
   * Resolves a usable starting point.
   *
   * (0, 0) is a real place in the Gulf of Guinea, so it must never be used as a
   * "no value" fallback — it produces itineraries thousands of kilometres long.
   * When the traveller has not set a start, fall back to the city they are
   * browsing, and failing that to the city of the places they picked.
   */
  const resolveStart = useCallback((): LatLng & { label: string } => {
    if (draft.start) return draft.start;

    if (draft.city) {
      return {
        latitude: draft.city.latitude,
        longitude: draft.city.longitude,
        label: `Centre of ${draft.city.name}`,
      };
    }

    const anchor = basket[0];
    if (anchor) {
      return {
        latitude: anchor.city.latitude,
        longitude: anchor.city.longitude,
        label: `Centre of ${anchor.city.name}`,
      };
    }

    throw new Error('Choose a city or a starting point before planning a visit.');
  }, [draft.start, draft.city, basket]);

  const baseRequest = useCallback(() => {
    const start = resolveStart();

    return {
      cityId: draft.city?.id ?? basket[0]?.city.id,
      start: { latitude: start.latitude, longitude: start.longitude },
      startLabel: start.label,
      availableMinutes: draft.availableMinutes,
      travelMode: draft.travelMode,
      walkingTolerance: draft.walkingTolerance,
      interestCategoryIds: draft.interestCategoryIds,
      maxPlaces: draft.maxPlaces,
      startTime: new Date().toISOString(),
    };
  }, [draft, basket, resolveStart]);

  const run = useCallback(async (task: () => Promise<{ plan: Plan }>): Promise<Plan | null> => {
    setPlanning(true);
    setPlanError(null);
    try {
      const result = await task();
      setPlan(result.plan);
      return result.plan;
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : 'Could not build your itinerary.');
      return null;
    } finally {
      setPlanning(false);
    }
  }, []);

  const generate = useCallback(
    () => run(() => api.planner.generate(baseRequest())),
    [baseRequest, run],
  );

  const optimizeBasket = useCallback(
    () =>
      run(() =>
        api.planner.optimize({
          ...baseRequest(),
          selectedPlaceIds: basket.map((place) => place.id),
        }),
      ),
    [baseRequest, basket, run],
  );

  const previewOrder = useCallback(
    (placeIds: string[]) =>
      run(() => api.planner.preview({ ...baseRequest(), selectedPlaceIds: placeIds })),
    [baseRequest, run],
  );

  const value = useMemo<PlanValue>(
    () => ({
      draft,
      setDraft,
      resetDraft,
      basket,
      inBasket: (placeId: string) => basket.some((entry) => entry.id === placeId),
      addToBasket,
      removeFromBasket,
      reorderBasket,
      clearBasket: () => setBasket([]),
      plan,
      planning,
      planError,
      generate,
      optimizeBasket,
      previewOrder,
      setPlan,
    }),
    [
      draft,
      setDraft,
      resetDraft,
      basket,
      addToBasket,
      removeFromBasket,
      reorderBasket,
      plan,
      planning,
      planError,
      generate,
      optimizeBasket,
      previewOrder,
    ],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanValue {
  const context = useContext(PlanContext);
  if (!context) throw new Error('usePlan must be used inside PlanProvider');
  return context;
}
