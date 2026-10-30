function setOptFields(parameters,objectType) {
	switch (objectType) {
		case "Workspace":
			parameters["opt_fields"] = ["this.resource_type","this.name","this.email_domains","this.is_organization"]
			break;
		case "Team":
			parameters["opt_fields"] = ["this.resource_type","this.name","this.description","this.html_description","this.organization","this.organization.name","this.organization.resource_type"]
			break;
		case "User":
			parameters["opt_fields"] = ["this.resource_type","this.name","this.email","this.photo","this.workspaces","this.workspaces.name","this.workspaces.resource_type"]
			break;
		case "Project":
			parameters["opt_fields"] = ["this.resource_type","this.name","this.created_at","this.modified_at","this.archived","this.color","this.default_view","this.due_date","this.due_on","this.html_notes","this.is_template","this.layout","this.notes","this.public","this.section_migration_status","this.start_on","this.members","this.members.name","this.members.resource_type","this.members.email","this.owner","this.owner.name","this.owner.email","this.owner.resource_type","this.followers","this.followers.name","this.followers.email","this.team","this.team.name","this.team.resource_type","this.workspace","this.workspace.name","this.workspace.resource_type","this.current_status","this.current_status.resource_type","this.current_status.author","this.current_status.author.name","this.current_status.author.email","this.current_status.author.resource_type","this.current_status.created_by","this.current_status.created_by.name","this.current_status.created_by.email","this.current_status.created_by.resource_type","this.custom_field_settings","this.custom_field_settings.resource_type","this.custom_field_settings.is_important","this.custom_field_settings.parent","this.custom_field_settings.parent.name","this.custom_field_settings.parent.resource_type","this.custom_field_settings.project","this.custom_field_settings.project.name","this.custom_field_settings.project.resource_type","this.custom_field_settings.custom_field","this.custom_field_settings.custom_field.resource_type","this.custom_field_settings.custom_field.resource_subtype","this.custom_field_settings.custom_field.name","this.custom_field_settings.custom_field.type","this.custom_field_settings.custom_field.text_value","this.custom_field_settings.custom_field.description","this.custom_field_settings.custom_field.precision","this.custom_field_settings.custom_field.format","this.custom_field_settings.custom_field.currency_code","this.custom_field_settings.custom_field.custom_label","this.custom_field_settings.custom_field.custom_label_position","this.custom_field_settings.custom_field.is_global_to_workspace","this.custom_field_settings.custom_field.enum_options","this.custom_field_settings.custom_field.enum_options.name","this.custom_field_settings.custom_field.color","this.custom_field_settings.custom_field.enum_options.enabled","this.custom_field_settings.custom_field.enum_options.resource_type"]
			break;
		case "ProjectStatus":
			parameters["opt_fields"] = ["this.resource_type","this.title","this.text","this.color","this.created_at","this.created_by","this.created_by.name","this.created_by.resource_type"]
			break;
		default:
			return iml.setOptFieldsBis(parameters,objectType);
	}
	return parameters;
}