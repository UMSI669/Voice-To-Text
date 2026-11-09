import { createSlice } from "@reduxjs/toolkit";

const openRouterModelsSlice = createSlice({
  name: "openRouterModels",
  initialState: {
    items: [],
    selectedModelId: "",
    status: "idle",
    error: null,
    fetchedAt: null,
    sourceUrl: null,
  },
  reducers: {
    modelsLoading(state) {
      state.status = "loading";
      state.error = null;
    },
    modelsLoaded(state, action) {
      const { items, fetchedAt, sourceUrl } = action.payload;
      state.items = items;
      state.status = "succeeded";
      state.error = null;
      state.fetchedAt = fetchedAt;
      state.sourceUrl = sourceUrl;

      const selectionStillExists = items.some(
        (model) => model.id === state.selectedModelId,
      );

      if (!selectionStillExists) {
        const preferred = items.find(
          (model) => model.id === "qwen/qwen3-asr-0.6b",
        );
        state.selectedModelId = preferred?.id || items[0]?.id || "";
      }
    },
    modelsFailed(state, action) {
      state.status = "failed";
      state.error = action.payload;
    },
    modelSelected(state, action) {
      state.selectedModelId = action.payload;
    },
  },
});

export const {
  modelsLoading,
  modelsLoaded,
  modelsFailed,
  modelSelected,
} = openRouterModelsSlice.actions;
export default openRouterModelsSlice.reducer;
