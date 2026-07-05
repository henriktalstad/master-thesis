import { IconSortAscending, IconSortDescending } from "@tabler/icons-react";

export type TableSortDirection = "asc" | "desc";

type TableSortIconProps<T extends string> = {
  field: T;
  sortField: T;
  sortDirection: TableSortDirection;
  /** f.eks. ml-1 size-3 eller ml-1 size-4 */
  iconClassName?: string;
};

export function TableSortIcon<T extends string>({
  field,
  sortField,
  sortDirection,
  iconClassName = "ml-1 size-3",
}: TableSortIconProps<T>) {
  if (sortField !== field) return null;
  return sortDirection === "asc" ? (
    <IconSortAscending className={iconClassName} />
  ) : (
    <IconSortDescending className={iconClassName} />
  );
}
