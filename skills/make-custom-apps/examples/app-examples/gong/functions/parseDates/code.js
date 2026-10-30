function parseDates(payload, ...fields) {
  let object = Object.assign({}, payload);
  function parse(obj, path, index) {
    prop = obj[path[index]];
    if (obj[path[index]] !== '' && obj[path[index]]) {
      if (path.length - 1 == index) {
        obj[path[index]] = iml.parseDate(prop, 'YYYY-MM-DDTHH:mm:ss.SSSZ');
      } else {
        if (
          Array.isArray(prop) &&
          path[index + 1] === '...' &&
          index + 2 < path.length
        ) {
          prop.forEach(function (item) {
            parse(item, path, index + 2);
          });
        } else parse(prop, path, index + 1);
      }
    }
  }

  if (object && fields && object !== 'undefined' && fields !== 'undefined') {
    fields.forEach(function (field) {
      path = field.split(/\.(?!\.|\])|\[|\]\./);
      if (path.length > 0) parse(object, path, 0);
    });
  }

  return object;
}
