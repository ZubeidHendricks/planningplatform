import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface SearchResult {
  type: 'app' | 'block' | 'dimension' | 'board';
  id: string;
  name: string;
  slug: string;
  appSlug?: string;
  appName?: string;
  icon?: string;
}

interface SearchResponse {
  results: SearchResult[];
}

export const searchKeys = {
  query: (ws: string, q: string) => ['search', ws, q] as const,
};

export function useSearch(
  workspaceSlug: string | undefined,
  query: string,
  limit = 10,
) {
  return useQuery<SearchResult[]>({
    queryKey: searchKeys.query(workspaceSlug ?? '', query),
    queryFn: async () => {
      const res = await api.get<SearchResponse>(
        `/${workspaceSlug}/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      );
      return res.data?.results ?? [];
    },
    enabled: !!workspaceSlug && query.length >= 2,
    staleTime: 30_000,
  });
}
