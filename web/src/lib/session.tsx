import { useApi } from "./hooks";
import type { Me, Role } from "./types";

import { DEFAULT_MATRIX, type Perm } from "./permissions";
export type { Perm };

export const ROLE_LABEL: Record<Role, string> = { org_admin: "Main admin", project_admin: "Manager", developer: "Developer", client: "Client", viewer: "Viewer" };

export function useCan() {
  const me = useApi<Me>("/internal/me");
  const matrix = useApi<{ matrix: Record<Perm, Role[]> }>("/internal/permissions");
  const role = me.data?.role;
  const m = matrix.data?.matrix ?? DEFAULT_MATRIX;
  // The main admin can never be locked out, whatever the matrix says.
  return (p: Perm) => !!role && (role === "org_admin" || (m[p] ?? []).includes(role));
}
