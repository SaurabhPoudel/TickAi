import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Task, type Today } from "@/lib/api";

export const keys = { me: ["me"], today: ["today"], pantry: ["pantry"], nights: ["nights"] } as const;

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: api.me });
export const useToday = () => useQuery({ queryKey: keys.today, queryFn: api.today, refetchInterval: 5 * 60_000 });
export const usePantry = () => useQuery({ queryKey: keys.pantry, queryFn: api.pantry });
export const useNights = () => useQuery({ queryKey: keys.nights, queryFn: api.nights });

/** Optimistic: the checkmark lands instantly, the server catches up. */
export function useSetStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Task["status"] }) => api.updateTask(id, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: keys.today });
      const prev = qc.getQueryData<Today>(keys.today);
      if (prev) {
        const patch = (list: Task[]) => list.map((t) => (t.id === id ? { ...t, status } : t));
        qc.setQueryData<Today>(keys.today, { ...prev, today: patch(prev.today), tomorrow: patch(prev.tomorrow) });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(keys.today, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.today }),
  });
}

export function useCheckItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, checked }: { id: string; checked: boolean }) => api.checkItem(id, checked),
    onMutate: async ({ id, checked }) => {
      const prev = qc.getQueryData<Today>(keys.today);
      if (prev) {
        const patch = (list: Task[]) => list.map((t) => ({ ...t, items: t.items.map((i) => (i.id === id ? { ...i, checked } : i)) }));
        qc.setQueryData<Today>(keys.today, { ...prev, today: patch(prev.today), tomorrow: patch(prev.tomorrow) });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(keys.today, ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.today });
      qc.invalidateQueries({ queryKey: keys.pantry });
    },
  });
}
