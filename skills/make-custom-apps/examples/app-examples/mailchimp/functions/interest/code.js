function interest(interests) {

    if(!interests) return;

    else if (Array.isArray(interests)) {
        interests = iml.toCollection(interests, 'key', 'value');
    }

    else if (Object.keys(interests).length === 0) return;

    let obj = {};

    for (let [key, value] of Object.entries(interests)) {
        if(Array.isArray(value)) {
            value.forEach(i => {
                obj[i] = true;
            });
        }
        else {
            obj[value] = true;
        }
    }

    return obj;
}