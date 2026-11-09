import { createSlice } from "@reduxjs/toolkit";

const sttLogsSlice = createSlice({
  name: "sttLogs",
  initialState: { entries: [] },
  reducers: {
    sttResponseReceived(state, action) {
      state.entries.unshift(action.payload);
    },
    logsCleared(state) {
      state.entries = [];
    },
  },
});

export const { sttResponseReceived, logsCleared } = sttLogsSlice.actions;
export default sttLogsSlice.reducer;
