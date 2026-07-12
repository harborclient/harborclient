import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Environment } from '#/shared/types';
import { loadActiveEnvironmentId } from '#/renderer/src/store/persistence';

export interface EnvironmentsState {
  environments: Environment[];
  activeEnvironmentId: number | null;
}

const initialState: EnvironmentsState = {
  environments: [],
  activeEnvironmentId: loadActiveEnvironmentId()
};

const environmentsSlice = createSlice({
  name: 'environments',
  initialState,
  reducers: {
    /**
     * Replaces the environments list from a refresh.
     */
    setEnvironments(state, action: PayloadAction<Environment[]>) {
      state.environments = action.payload;
    },
    /**
     * Sets the active environment selection.
     */
    setActiveEnvironmentId(state, action: PayloadAction<number | null>) {
      state.activeEnvironmentId = action.payload;
    },
    /**
     * Optimistically reorders environments to match drag-and-drop before IPC persistence.
     */
    reorderEnvironmentsLocal(state, action: PayloadAction<{ orderedEnvironmentIds: number[] }>) {
      const { orderedEnvironmentIds } = action.payload;
      if (orderedEnvironmentIds.length !== state.environments.length) {
        return;
      }

      const environmentsById = new Map(
        state.environments.map((environment) => [environment.id, environment])
      );
      const reordered = orderedEnvironmentIds.map((id) => environmentsById.get(id));
      if (reordered.some((environment) => environment == null)) {
        return;
      }

      state.environments = reordered as Environment[];
    }
  }
});

export const { setEnvironments, setActiveEnvironmentId, reorderEnvironmentsLocal } =
  environmentsSlice.actions;
export default environmentsSlice.reducer;
