function normUpdMergeFieldsOpt(obj) {
  if (obj.choices) {
    return { choices: obj.choices.map((e) => e.value) };
  }
  return obj;
}
