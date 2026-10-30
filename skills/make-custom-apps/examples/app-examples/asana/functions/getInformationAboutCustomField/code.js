function getInformationAboutCustomField(startObject, customFieldID) {
    for (var i = 0; i < startObject.data.custom_field_settings.length; i++) {
        if (startObject.data.custom_field_settings[i].custom_field.gid == customFieldID) {
            return startObject.data.custom_field_settings[i].custom_field
        }
    }
    return null
}