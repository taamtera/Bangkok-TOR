// A contractor label describes the provider of a catalog concept. It is not
// evidence that a particular company satisfies a TOR requirement.
export function serializeTag(tag) {
  return tag ? { ...tag, name: tag.text ?? tag.name, contractorLabel: tag.contractorLabel ?? null } : null;
}
