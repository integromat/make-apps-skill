function setOptFieldsTris(parameters,objectType) {
	switch (objectType) {
		case "Attachment":
			parameters["opt_fields"] = ["this.resource_type","this.created_at","this.name","this.host","this.download_url","this.permanent_url","this.view_url","this.parent","this.parent.resource_type","this.parent.name"]
			break;		
		case "Story":
			parameters["opt_fields"] = ["this.resource_type","this.type","this.resource_subtype","this.created_at","this.previews","this.source","this.text","this.html_text","this.is_edited","this.is_pinned","this.hearted","this.num_hearts","this.liked","this.num_likes","this.story","this.old_name","this.new_name","this.old_dates","this.new_dates","this.old_resource_subtype","this.new_resource_subtype","this.old_number_value","this.new_number_value","this.old_text_value","this.new_text_value","this.assignee","this.assignee.name","this.assignee.resource_type","this.created_by","this.created_by.name","this.created_by.resource_type","this.follower","this.follower.name","this.follower.resource_type","this.target","this.target.resource_type","this.target.name","this.hearts","this.hearts.user","this.hearts.user.resource_type","this.hearts.user.name","this.likes","this.likes.user","this.likes.user.name","this.likes.user.resource_type","this.old_section","this.old_section.name","this.old_section.resource_type","this.new_section","this.new_section.name","this.new_section.resource_type","this.task","this.task.name","this.task.resource_type","this.project","this.project.name","this.project.resource_type","this.tag","this.tag.name","this.tag.resource_type","this.old_enum_value","this.old_enum_value.name","this.old_enum_value.resource_type","this.old_enum_value.color","this.old_enum_value.enabled","this.new_enum_value","this.new_enum_value.name","this.new_enum_value.resource_type","this.new_enum_value.color","this.new_enum_value.enabled","this.duplicated_from","this.duplicated_from.name","this.duplicated_from.resource_type","this.duplicate_of","this.duplicate_of.name","this.dependency","this.dependency.name","this.dependency.resource_type","this.custom_field","this.custom_field.name","this.custom_field.type","this.custom_field.resource_type","this.custom_field.resource_subtype","this.custom_field.enabled","this.custom_field.text_value","this.custom_field.enum_options","this.custom_field.enum_options.name","this.custom_field.enum_options.resource_type","this.custom_field.enum_value","this.custom_field.enum_value.name","this.custom_field.enum_value.resource_type"]
			break;
		case "ProjectSection":
			parameters["opt_fields"] = ["this.resource_type","this.name","this.created_at","this.projects","this.projects.name","this.projects.resource_type"]
			break;
		case "ProjectCustomField":
			parameters["opt_fields"] = ["this.resource_type","this.is_important","this.parent","this.parent.name","this.parent.resource_type","this.project","this.project.name","this.project.resource_type","this.custom_field.resource_type","this.custom_field.resource_subtype","this.custom_field.name","this.custom_field.type","this.custom_field.description","this.custom_field.precision","this.custom_field.format","this.custom_field.currency_code","this.custom_field.custom_label","this.custom_field.custom_label_position","this.custom_field.is_global_to_workspace","this.custom_field.enum_options","this.custom_field.enum_options.name","this.custom_field.enum_options.color","this.custom_field.enum_options.enabled","this.custom_field.enum_options.resource_type"]
			break;
		case "TaskCount":
			parameters["opt_fields"] = ["this.num_tasks","this.num_incomplete_tasks","this.num_completed_tasks","this.num_milestones","this.num_incomplete_milestones","this.num_completed_milestones"]
			break;
		case "Goals":
			parameters["opt_fields"] = ["this.gid","this.resource_type","this.due_on","this.html_notes","this.is_workspace_level","this.liked","this.name","this.notes","this.start_on","this.status","this.current_status_update","this.followers","this.likes","this.metric","this.num_likes","this.owner","this.team","this.time_period","this.workspace"]
			break;
		default:
			return parameters
	}
	return parameters;
}