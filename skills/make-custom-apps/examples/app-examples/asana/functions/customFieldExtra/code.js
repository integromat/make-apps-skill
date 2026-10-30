function customFieldExtra(data) {
	if (data.custom_fields instanceof Array && data.custom_fields.length !== 0) {
		var custom_fields_collection = {}
		data.custom_fields.forEach(custom_field => {
			custom_fields_collection[custom_field.gid] = custom_field
		})
		data["custom_fields_collection"] = custom_fields_collection
	}
	
	if (data.custom_field_settings instanceof Array && data.custom_field_settings.length !== 0) {
		var custom_fields_setting_collection = {}
		data.custom_field_settings.forEach(custom_field_setting => {
			custom_fields_setting_collection[custom_field_setting.gid] = custom_field_setting
		})
		data["custom_field_settings_collection"] = custom_fields_setting_collection
	}
	
	return data
}