function onlyListAfter(bodyArr, listId) {
  if (!Array.isArray(bodyArr) || !listId) return undefined;
  return bodyArr.filter(action => action.data.listAfter.id === listId);
}