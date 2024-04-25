function isNonEmptyFunction(func) {
        const functionString = func.toString().trim();
        // Match the part of the function between the curly braces
        const match = functionString.match(/{([\s\S]*)}/);
        if (match && match[1]) {
            // Check if the content between the braces is not just whitespace
            return match[1].trim() !== '';
        }
        return false;
    }

    export default isNonEmptyFunction