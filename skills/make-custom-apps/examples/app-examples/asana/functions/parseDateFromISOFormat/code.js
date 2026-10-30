function parseDateFromISOFormat(object, ...fields) {
    fields.forEach((field) => {
        const path = field.split(/\.|\[\]/);
        parse(object, path);
    });
    function parse(obj, path, index = 0) {
        const property = obj[path[index]];
        if (!property) {
            return;
        }
        if (path.length - 1 === index) {
            obj[path[index]] = iml.parseDate(property);
        } else {
            if (Array.isArray(property)) {
                index++;
                property.forEach((item) => {
                    parse(item, path, index);
                });
            } else {
                parse(property, path, ++index);
            }
        }
    }
    return object;
}
