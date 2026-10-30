function mergeField(obj) {

    if(!obj) return;

    else if (Array.isArray(obj)) {
        return iml.toCollection(obj, 'key', 'value');
    }

    for (let [key, value] of Object.entries(obj)){
        if(typeof value === 'object' && !(value instanceof Date)) {
            if(Object.keys(value).length === 0) {
                delete obj[key];
            }
        }
    }

    if(Object.keys(obj).length === 0 && obj.constructor === Object) {
        return;
    }

    return obj;

}