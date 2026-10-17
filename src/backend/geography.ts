/** Read compatibility during the additive schema rollout. Never suppress other errors. */
export async function geographicRead<T>(query: (includeId: boolean) => PromiseLike<{ data: unknown; error: unknown }>): Promise<{data: T[] | null; error: unknown}> {
  const result = await query(true);
  const error = result.error as { code?: string; message?: string } | null;
  const resolved = (error?.code === "42703" || error?.code === "PGRST204") && error.message?.includes("geoname_id") ? await query(false) : result;
  return {data: resolved.data as T[] | null, error: resolved.error};
}
