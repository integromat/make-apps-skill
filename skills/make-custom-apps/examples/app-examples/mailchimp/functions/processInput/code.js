function processInput(item) {
  Object.keys(item).map((e) => {
    if (JSON.stringify(item[e]) === "{}") {
      delete item[e];
    }
  });
  if (item.customer) {
    if (item.customer.select) {
      delete item.customer.select;
    }
  }
  if (item.select) {
    delete item.select;
  }
  if (item.skip_merge_validation) {
    delete item.skip_merge_validation;
  }
  return item;
  // function clearEmpties(item) {
  //   for (let key in item) {
  //     if (!item[key] || typeof item[key] !== "object") {
  //       continue;
  //     }
  //     clearEmpties(item[key]);
  //     if (JSON.stringify(item[key]) === "{}") {
  //       delete item[key];
  //     }
  //   }
  //   return item;
  // }
  // return clearEmpties(item);
}
