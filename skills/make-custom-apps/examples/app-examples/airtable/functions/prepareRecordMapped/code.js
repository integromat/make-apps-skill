function prepareRecordMapped(record) {
    if(!record) return;
    let output = {};
// format input:  "id": "fldxCcfDmlxVpcpuk", "value": "jane" to output: "fldxCcfDmlxVpcpuk": "jane"
    record.forEach(function (field) { 
        if (field.type === "date" ) {
            output[field.id] = iml.formatDate(field.value, 'YYYY-MM-DD');
        } else {
            output[field.id] = field.value;
        }
    });

return output;
}