export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\.[a-z]+$/i.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  if (specifier.startsWith("next/") && !specifier.endsWith(".js")) {
    return nextResolve(`${specifier}.js`, context);
  }
  return nextResolve(specifier, context);
}
