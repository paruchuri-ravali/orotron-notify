import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "./api";
import { useScope } from "./scope";

type Query = Record<string, string | number | boolean | undefined | null>;

export function useApi<T>(path: string, query?: Query, enabled = true) {
  return useQuery<T, ApiError>({
    queryKey: [path, query ?? {}],
    queryFn: () => api.get<T>(path, query),
    enabled,
    placeholderData: keepPreviousData,
    retry: (n, e) => e.status !== 0 && e.status < 500 ? false : n < 1,
  });
}

/** Query params for the globally selected project / environment. */
export function useScopeQuery(): Query {
  const { projectId, env } = useScope();
  return { project: projectId, env };
}

export function useAction<TBody = unknown, TRes = unknown>(
  fn: (body: TBody) => Promise<TRes>,
  opts: { invalidate?: string[]; success?: string; onSuccess?: (r: TRes) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation<TRes, ApiError, TBody>({
    mutationFn: fn,
    onSuccess: (r) => {
      for (const prefix of opts.invalidate ?? []) {
        qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith(prefix) });
      }
      if (opts.success) toast.success(opts.success);
      opts.onSuccess?.(r);
    },
    onError: (e) => toast.error(e.message),
  });
}
