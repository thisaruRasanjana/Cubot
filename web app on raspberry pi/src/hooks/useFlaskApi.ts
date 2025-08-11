import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api';

interface UseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface UseMutationResult<T> {
  mutate: (...args: any[]) => Promise<T>;
  loading: boolean;
  error: string | null;
}

export function useQuery<T>(queryFn: () => Promise<T>): UseQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await queryFn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [queryFn]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useMutation<T>(mutationFn: (...args: any[]) => Promise<T>): UseMutationResult<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = async (...args: any[]): Promise<T> => {
    try {
      setLoading(true);
      setError(null);
      const result = await mutationFn(...args);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading, error };
}

// Specific hooks for your API
export function useSystemStatus() {
  return useQuery(() => apiClient.getSystemStatus());
}

export function useActiveSolvingSession() {
  return useQuery(() => apiClient.getActiveSolvingSession());
}

export function useCFOPSteps() {
  return useQuery(() => apiClient.getCFOPSteps());
}

export function useLearningProgress() {
  return useQuery(() => apiClient.getLearningProgress());
}

export function useFlaskMutation<T>(mutationFn: (...args: any[]) => Promise<T>) {
  return useMutation(mutationFn);
}
