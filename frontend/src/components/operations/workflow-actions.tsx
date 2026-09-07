"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { apiClient } from "@/lib/api-client";
import { Button, type ButtonProps } from "@/components/ui/button";

export interface WorkflowAction {
  label: string;
  action: string;
  variant?: ButtonProps["variant"];
  confirm?: string;
  body?: unknown;
}

export function WorkflowActions({ endpoint, id, actions }: { endpoint: string; id: string; actions: WorkflowAction[] }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (action: WorkflowAction) => (await apiClient.post(`${endpoint}/${id}/${action.action}`, action.body ?? {})).data,
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      queryClient.invalidateQueries({ queryKey: [`${endpoint}/${id}`] });
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Action failed") : "Action failed";
      setError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.action}
            variant={action.variant ?? "default"}
            disabled={mutation.isPending}
            onClick={() => {
              if (action.confirm && !window.confirm(action.confirm)) return;
              mutation.mutate(action);
            }}
          >
            {action.label}
          </Button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
