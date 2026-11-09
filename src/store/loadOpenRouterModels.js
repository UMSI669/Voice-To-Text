import {
  modelsFailed,
  modelsLoaded,
  modelsLoading,
} from "./openRouterModelsSlice";
import { fetchOpenRouterModels } from "../services/stt/fetchOpenRouterModels";
import {
  isOpenRouterConfigured,
  openRouterConfig,
} from "../services/stt/openRouterConfig";

const CACHE_TTL_MS = 60 * 60 * 1000;

export function loadOpenRouterModels({ force = false } = {}) {
  return async (dispatch, getState) => {
    if (!isOpenRouterConfigured()) return;

    const cache = getState().openRouterModels;
    const sourceUrl = openRouterConfig.modelsUrl;

    if (cache.status === "loading") return;

    const cacheIsFresh =
      cache.fetchedAt !== null &&
      cache.sourceUrl === sourceUrl &&
      Date.now() - cache.fetchedAt < CACHE_TTL_MS;

    if (!force && cacheIsFresh) return;

    dispatch(modelsLoading());

    try {
      const items = await fetchOpenRouterModels();
      dispatch(modelsLoaded({ items, fetchedAt: Date.now(), sourceUrl }));
    } catch (error) {
      dispatch(
        modelsFailed(
          error instanceof Error
            ? error.message
            : "Could not load OpenRouter models.",
        ),
      );
    }
  };
}
