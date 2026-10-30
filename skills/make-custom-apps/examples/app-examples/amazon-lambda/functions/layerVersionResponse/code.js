function layerVersionResponse(item) {

    item.CreatedDate = iml.parseDate(item.CreatedDate);

    return item;
}