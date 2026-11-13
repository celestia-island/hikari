export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith(".scss") || specifier.endsWith(".sass")) {
    return {
      shortCircuit: true,
      url: "data:text/javascript,export default {}",
    };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === "data:text/javascript,export default {}") {
    return {
      shortCircuit: true,
      format: "module",
      source: "export default {};",
    };
  }
  return nextLoad(url, context);
}
