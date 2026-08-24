export type ApiJsonResult<T> = {
  ok: boolean;
  payload: T;
  status: number;
};

export async function requestApiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<ApiJsonResult<T>> {
  const response = await fetch(input, init);
  return {
    ok: response.ok,
    payload: await response.json() as T,
    status: response.status,
  };
}

export async function readApiJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (!response.ok) return null;
  return await response.json() as T;
}
