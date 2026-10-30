function normalizeMergeFieldsOptions(type, options) {
  if (options !== null) {
    switch (type) {
      case "text":
        return { size: options };
      case "address":
        return { default_country: options };
      case "phone":
        return { phone_format: options };
      case "date":
        return { date_format: options };
      case "birthday":
        return { date_format: options };
      case "dropdown":
        return { choices: options.map((e) => e.value) };
      case "radio":
        return { choices: options.map((e) => e.value) };
      default:
        break;
    }
  }
  return;
}
