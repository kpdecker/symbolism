export * from "./config";
export * from "./logger";

export * from "./error";

export * from "./typescript";

export function removeDuplicates<T>(
  list: T[],
  comparator: (a: T, b: T) => boolean
): T[] {
  return list.filter(
    (items: T, itemIndex) =>
      list.findIndex(
        (needle, needleI) => itemIndex < needleI && comparator(items, needle)
      ) < 0
  );
}

export function bitwiseFlagSet(
  flags: number | undefined,
  flag: number
): boolean {
  if (flags === undefined) {
    return false;
  }

  return (flags & flag) === flag;
}
