export function buildFileTree(files) {
    const root = {};

    files.forEach((file, index) => {
        const parts = file.path.split("/");
        let current = root;

        parts.forEach((part, i) => {
            if (!current[part]) {
                current[part] = {
                    __children: {},
                    __file: i === parts.length - 1 ? file : null,
                    __index: index
                };
            }
            current = current[part].__children;
        });
    });

    return root;
}
