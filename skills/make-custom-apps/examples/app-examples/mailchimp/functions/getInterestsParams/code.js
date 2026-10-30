function getInterestsParams(item) {
  if (item) {
    return item.map((e) => {
      return {
        name: e.id,
        label: e.name,
        type: "boolean",
      };
    });
  }
  return item;
}
