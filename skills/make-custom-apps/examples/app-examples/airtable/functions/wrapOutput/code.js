function wrapOutput(output, _for) {
    if (['interface', 'rpc'].includes(_for)) {
        return output;
    }
    return [
        {
            "name": "record",
            "spec": output,
            "type": "collection",
            "label": "Record"
        }
    ]
}