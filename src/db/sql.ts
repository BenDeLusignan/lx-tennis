import { sql, type SQL, type Table } from "drizzle-orm";

/**
 * `"table"."column"`, for a correlated subquery over another table. Drizzle
 * writes bare column names in a single-table query, and inside the subquery
 * a bare "id" would be the subquery table's id, not the outer row's, so
 * every column in it is qualified by hand.
 */
export function qualified(table: Table, column: { name: string }): SQL {
  return sql`${table}.${sql.identifier(column.name)}`;
}
