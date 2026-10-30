function formFieldOfInterests(interestCategories, body, interests) {

    interests.filter(v => v.id === body.category_id).forEach(item => {

        let obj = {};

        obj.name = item.id;
        obj.label = item.title;

        switch (item.type) {
            case 'checkboxes':
            case 'hidden':
                obj.type = 'array';
                break;
            case 'radio':
            case 'dropdown':
                obj.type = 'text';
                break;
            default:
                obj.type = 'any';
                break;
        }

        obj.metadata = {
            values: []
        };

        body.interests.forEach(i => {

            let obj1 = {
                name: i.name,
                id: i.id
            };
            obj.metadata.values.push(obj1);

        });
        interestCategories.push(obj);

    });

    return interestCategories;

}