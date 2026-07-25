import { useDispatch, useSelector, useStore, type TypedUseSelectorHook } from 'react-redux';
import type { AppDispatch, RootState } from './redux';

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

/**
 * Returns the typed Redux store for callers that need getState with dispatch.
 *
 * @returns Redux store bound to this app's RootState.
 */
export function useAppStore(): ReturnType<typeof useStore<RootState>> {
  return useStore<RootState>();
}
