function removeScheduleObject(params) {
    // the "schedule_dates" collection should be present only if param 'include' contains "task_dates"
    if (!params.include || (params.include && !params.include.includes('task_dates'))) {
        delete params.schedule_dates
    }
    return params;
}