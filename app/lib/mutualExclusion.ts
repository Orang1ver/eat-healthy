import { MUTUAL_EXCLUSION_GROUPS } from "./tags";

/** 给定已选标签，返回应该被禁用（置灰不可点）的标签集合 */
export function getDisabledTags(selected: string[]): Set<string> {
  const disabled = new Set<string>();
  for (const group of MUTUAL_EXCLUSION_GROUPS) {
    const hit = group.find((t) => selected.includes(t));
    if (hit) {
      for (const t of group) if (t !== hit) disabled.add(t);
    }
  }
  return disabled;
}
