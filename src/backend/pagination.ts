import { normaliseBackendError } from "./errors";

const PAGE_SIZE = 500;

type PageResult<Row> = { data: Row[] | null; error: unknown };

/** Read every row in a stable order; callers must include a unique tie-breaker. */
export async function fetchAllPages<Row>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<Row>>,
  fallback: string
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw normaliseBackendError(error, fallback);
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}
