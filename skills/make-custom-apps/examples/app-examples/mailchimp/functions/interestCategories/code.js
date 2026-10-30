function interestCategories(body) {

    let arr = [];

    body.forEach(item => {
        let obj = {};
        obj.name = item.id;
        obj.label = item.title;
        obj.type = "select";
        obj.options = "rpc://listInterestCategoryOptions?interest_category=" + item.id;

        if(item.type == "checkboxes" || item.type == "hidden") {
            obj.multiple = true;
        }

        arr.push(obj);
    });

    return {
        name: "interests",
        label: "Groups",
        type: "collection",
        spec: arr
    }

}