/** Dummy Nitro server dir so the GitHub Pages build has a JS entry, not HTML. */
export default async function noop(_event: unknown, next: () => unknown) {
  return next();
}
