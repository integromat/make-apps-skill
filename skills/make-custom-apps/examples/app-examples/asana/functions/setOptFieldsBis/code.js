function setOptFieldsBis(parameters,objectType) {
	switch (objectType) {
		case "Task":
			parameters["opt_fields"] = ["this.resource_type","this.resource_subtype","this.assignee_status","this.completed","this.completed_at","this.created_at","this.due_at","this.due_on","this.hearted","this.liked","this.modified_at","this.name","this.notes","this.html_notes","this.num_hearts","this.num_likes","this.start_on","this.start_at","this.assignee","this.assignee.name","this.permalink_url","this.assignee.resource_type","this.external.gid","this.external.data","this.followers","this.followers.name","this.followers.resource_type","this.hearts","this.hearts.user","this.hearts.user.name","this.hearts.resource_type","this.likes","this.likes.user","this.likes.user.name","this.likes.user.resource_type","this.memberships","this.memberships.project","this.memberships.project.name","this.memberships.project.resource_type","this.memberships.section","this.memberships.section.name","this.memberships.section.resource_type","this.parent","this.parent.name","this.parent.resource_type","this.projects","this.projects.name","this.projects.resource_type","this.tags","this.tags.name","this.tags.resource_type","this.workspace","this.workspace.name","this.workspace.resource_type","this.custom_fields","this.custom_fields.resource_type","this.custom_fields.resource_subtype","this.custom_fields.name","this.custom_fields.type","this.custom_fields.enabled","this.custom_fields.text_value","this.custom_fields.description","this.custom_fields.precision","this.custom_fields.format","this.custom_fields.currency_code","this.custom_fields.custom_label","this.custom_fields.custom_label_position","this.custom_fields.is_global_to_workspace","this.custom_fields.has_notifications_enabled","this.custom_fields.number_value","this.custom_fields.enum_options","this.custom_fields.enum_options.name","this.custom_fields.enum_options.color","this.custom_fields.enum_options.enabled","this.custom_fields.enum_options.resource_type","this.custom_fields.enum_value","this.custom_fields.enum_value.name","this.custom_fields.enum_value.resource_type","this.custom_fields.enum_value.color","this.custom_fields.enum_value.enabled","this.custom_fields.multi_enum_values","this.custom_fields.date_value","this.custom_fields.created_by","this.custom_fields.display_value","this.custom_fields.people_value","this.custom_fields.created_by.name","this.custom_fields.people_value.name","this.custom_fields.created_by.resource_type","this.custom_fields.people_value.resource_type"]
			break;
		case "Tag":
			parameters["opt_fields"] = ["this.resource_type","this.name","this.created_at","this.notes","this.color","this.followers","this.followers.name","this.followers.resource_type","this.workspace","this.workspace.name","this.workspace.resource_type"]
			break;
		case "Webhook":
			parameters["opt_fields"] = ["this.resource_type","this.active","this.target","this.created_at","this.last_failure_at","this.last_failure_content","this.last_success_at","this.resource","this.resource.name","this.resource.resource_type"]
			break;
		case "WorkspaceCustomField":
			parameters["opt_fields"] = ["this.resource_type","this.resource_subtype","this.name","this.type","this.description","this.precision","this.format","this.currency_code","this.custom_label","this.custom_label_position","this.is_global_to_workspace","this.has_notifications_enabled","this.enum_options","this.enum_options.name","this.enum_options.resource_type","this.enum_options.color","this.enum_options.enabled"]
			break;
		case "Portfolios":
			parameters["opt_fields"] = ["this.gid","this.resource_type","this.color","this.name","this.created_at","this.created_by","this.current_status_update","this.custom_field_settings","this.due_on","this.members","this.owner","this.permalink_url","this.public","this.start_on","this.workspace"]
			break;
		default:
			return iml.setOptFieldsTris(parameters,objectType);
	}
	return parameters;
}