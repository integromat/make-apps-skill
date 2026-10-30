function mergeOutput(body, temp_body) {

    if(!temp_body) return;

    for (let [key, value] of Object.entries(temp_body)) {
        if(key === 'content_type') temp_body[key] = 'html';
    }

    delete body._links;

    body = Object.assign(temp_body, body);

    return body;

}