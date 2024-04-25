function renameProperty(obj, oldProp, newProp) {
    // Check if the object is valid and the old property exists in the object
    if (obj && oldProp in obj) {
        // Rename the property
        obj[newProp] = obj[oldProp];
        delete obj[oldProp];
    }
    // Return the modified object or the original object if no changes were made
    return obj;
}

export default renameProperty