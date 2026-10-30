function getMergeFieldsParams(item) {
  const newArr = item.map((e) => {
    if (["dropdown"].includes(e.type)) {
      return {
        name: e.tag,
        label: e.name,
        required: e.required,
        type: "select",
        options: e.options.choices
          ? e.options.choices.map((i) => {
              return {
                value: i,
                label: i,
              };
            })
          : null,
      };
    }
    if (["radio"].includes(e.type)) {
      return {
        name: e.tag,
        label: e.name,
        required: e.required,
        type: "select",
        options: e.options.choices
          ? e.options.choices.map((i) => {
              return {
                value: i,
                label: i,
              };
            })
          : null,
      };
    }
    if (["date"].includes(e.type)) {
      return {
        name: e.tag,
        label: e.name,
        required: e.required,
        type: "date",
      };
    }
    if (["birthday"].includes(e.type)) {
      return {
        name: e.tag,
        label: e.name,
        required: e.required,
        type: "text",
        help: "A string in the format MM/DD",
      };
    }
    if (["text"].includes(e.type)) {
      return {
        name: e.tag,
        label: e.name,
        required: e.required,
        type: "text",
      };
    }
    if (["number"].includes(e.type)) {
      return {
        name: e.tag,
        label: e.name,
        required: e.required,
        type: "number",
      };
    }
    if (["zip"].includes(e.type)) {
      return {
        name: e.tag,
        label: e.name,
        required: e.required,
        type: "text",
      };
    }
    if (["phone"].includes(e.type)) {
      return {
        name: e.tag,
        label: e.name,
        required: e.required,
        type: "text",
      };
    }
    if (["url"].includes(e.type)) {
      return {
        name: e.tag,
        label: e.name,
        required: e.required,
        type: "url",
      };
    }
    if (["imageurl"].includes(e.type)) {
      return {
        name: e.tag,
        label: e.name,
        required: e.required,
        type: "url",
      };
    }
    if (["address"].includes(e.type)) {
      if (e.required === false) {
        return {
          name: `change${e.tag}`,
          label: `Change ${e.name}`,
          type: "boolean",
          nested: [
            {
              name: e.tag,
              label: e.name,
              required: e.required,
              type: "collection",
              spec: [
                {
                  name: "addr1",
                  label: "Address 1",
                  type: "text",
                  required: true,
                },
                {
                  name: "city",
                  label: "City",
                  type: "text",
                  required: true,
                },
                {
                  name: "state",
                  label: "State",
                  type: "text",
                  required: true,
                },
                {
                  name: "zip",
                  label: "ZIP",
                  type: "text",
                  required: true,
                },
                {
                  name: "addr2",
                  label: "Address 2",
                  type: "text",
                },
                {
                  name: "country",
                  label: "Country",
                  type: "text",
                },
              ],
            },
          ],
        };
      } else {
        return {
          name: e.tag,
          label: e.name,
          required: e.required,
          type: "collection",
          spec: [
            {
              name: "addr1",
              label: "Address 1",
              type: "text",
              required: true,
            },
            {
              name: "city",
              label: "City",
              type: "text",
              required: true,
            },
            {
              name: "state",
              label: "State",
              type: "text",
              required: true,
            },
            {
              name: "zip",
              label: "ZIP",
              type: "text",
              required: true,
            },
            {
              name: "addr2",
              label: "Address 2",
              type: "text",
            },
            {
              name: "country",
              label: "Country",
              type: "text",
            },
          ],
        };
      }
    }
  });
  return {
    name: "merge_fields",
    label: "Merge Fields",
    type: "collection",
    spec: newArr.sort((a, b) => (a.required > b.required ? 1 : -1)),
  };
}
