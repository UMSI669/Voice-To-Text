import { configureStore } from "@reduxjs/toolkit";
import openRouterModelsReducer from "./openRouterModelsSlice";
import sttLogsReducer from "./sttLogsSlice";

export const store = configureStore({
  reducer: {
    sttLogs: sttLogsReducer,
    openRouterModels: openRouterModelsReducer,
  },
});
