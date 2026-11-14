/** A catalog may outlive a move between skills/ and quarantine/. The caller still verifies the catalog's SHA-256 before installing. */
export async function fetchHubFile(root: string, area: string, id: string, path: string, fetcher: (url: string) => Promise<Response>): Promise<Response> {
  const first = area === 'quarantine' ? 'quarantine' : 'skills';
  const response = await fetcher(`${root}/${first}/${id}/${path}`);
  if (response.status !== 404) return response;
  return fetcher(`${root}/${first === 'skills' ? 'quarantine' : 'skills'}/${id}/${path}`);
}
