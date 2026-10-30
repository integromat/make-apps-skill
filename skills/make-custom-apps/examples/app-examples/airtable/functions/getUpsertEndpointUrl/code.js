function getUpsertEndpointUrl(params, getMethod) {

    let url = "/" + params.base + "/" + iml.encodeURL(params.table);
    let method = 'POST';
    if (params.recordId) {
        url += "/" + params.recordId;
        method = 'PATCH';
    }
    
    if (getMethod) {
        return method;
    }

    return url;
}