function webhookResponse(obj) {

    let result = {};

    if (obj.data && obj.data.merges) delete obj.data.merges;

    result.webhook_type = obj.type;

    result = Object.assign(result, obj.data);

    return result;

}