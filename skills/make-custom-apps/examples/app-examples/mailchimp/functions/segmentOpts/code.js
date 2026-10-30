function segmentOpts(segment) {
    if(!segment) return;

    return {
        saved_segment_id: segment,
        match: 'any'
    };
}