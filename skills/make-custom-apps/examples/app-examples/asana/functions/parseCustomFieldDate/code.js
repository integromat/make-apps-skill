function parseCustomFieldDate(parameters) {
    const date = new RegExp('(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2}).(\\d{3})Z');
    if (parameters.custom_fields) {
        for (var key in parameters.custom_fields) {
            if (date.test(parameters.custom_fields[key])) {
                parameters.custom_fields[key] = iml.formatDate(parameters.custom_fields[key], 'YYYY-MM-DD HH:mm:ss')
            }
        }
    }
    return parameters


    /////////////UNUSED
}