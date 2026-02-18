import fs from 'fs/promises'
import { performance } from 'perf_hooks';
import ColorText from '../../../useful/ColorText.js'
import runUntilEnter from '../../../useful/runUntilEnter.js';
import tokenizeText from '../../../useful/tokenizeText.js'

class Dict {

    static loadedDict = null

    static Get = (config = {dict_path : '', force_reload : false}) => {
        return null
    }

    static async Level1(config = {dict_path: '', inlineMode: false, filters: []}) {
        await runUntilEnter(async () => {
            await this.#EnhancedRunLevel1(config);
        });
        process.exit(0);
    }

    static #applyFilters(key, filters = []) {
        // If no filters, include all words
        if (!filters || filters.length === 0) {
            return true;
        }
        
        // Determine filter combination mode (default: 'and')
        const mode = filters.mode || 'and';
        
        // Process each filter safely
        const results = [];
        for (let i = 0; i < filters.length; i++) {
            const filter = filters[i];
            
            try {
                // Skip invalid filters
                if (!filter || typeof filter !== 'object') {
                    results.push(true); // Skip invalid filters
                    continue;
                }
                
                const filterText = filter.text || '';
                const filterType = filter.type || 'ends_with';
                const caseSensitive = filter.caseSensitive || false;
                
                // Handle empty filter text
                if (filterText === '') {
                    results.push(true); // Skip empty filters
                    continue;
                }
                
                // Apply case sensitivity
                const keyToCheck = caseSensitive ? key : key.toLowerCase();
                const filterToCheck = caseSensitive ? filterText : filterText.toLowerCase();
                
                let result;
                switch(filterType) {
                    case 'starts_with':
                        result = keyToCheck.startsWith(filterToCheck);
                        break;
                    case 'ends_with':
                        result = keyToCheck.endsWith(filterToCheck);
                        break;
                    case 'contains':
                        result = keyToCheck.includes(filterToCheck);
                        break;
                    case 'exact':
                        result = keyToCheck === filterToCheck;
                        break;
                    case 'not_starts_with':
                        result = !keyToCheck.startsWith(filterToCheck);
                        break;
                    case 'not_ends_with':
                        result = !keyToCheck.endsWith(filterToCheck);
                        break;
                    case 'not_contains':
                        result = !keyToCheck.includes(filterToCheck);
                        break;
                    case 'not_exact':
                        result = keyToCheck !== filterToCheck;
                        break;
                    case 'min_length':
                        result = key.length >= (parseInt(filterText) || 0);
                        break;
                    case 'max_length':
                        result = key.length <= (parseInt(filterText) || Infinity);
                        break;
                    case 'regex':
                        try {
                            const regex = new RegExp(filterText, caseSensitive ? '' : 'i');
                            result = regex.test(key);
                        } catch (e) {
                            console.log(`Invalid regex pattern: ${filterText}`);
                            result = true; // Skip invalid regex
                        }
                        break;
                    default:
                        result = keyToCheck.endsWith(filterToCheck);
                        break;
                }
                results.push(result);
                
            } catch (error) {
                // If any filter fails, log and skip it
                console.log(`Filter error: ${error.message}`);
                results.push(true);
            }
        }
        
        // Combine results based on mode
        if (mode === 'or') {
            for (let i = 0; i < results.length; i++) {
                if (results[i] === true) {
                    return true;
                }
            }
            return false;
        } else {
            for (let i = 0; i < results.length; i++) {
                if (results[i] !== true) {
                    return false;
                }
            }
            return true;
        }
    }

    static #buildFilterDescription(filters = []) {
        if (!filters || filters.length === 0) {
            return 'all words';
        }
        
        const mode = filters.mode || 'and';
        const descriptions = [];
        
        for (let i = 0; i < filters.length; i++) {
            const filter = filters[i];
            
            if (!filter || typeof filter !== 'object') {
                descriptions.push('invalid filter');
                continue;
            }
            
            const text = filter.text || '';
            const type = filter.type || 'ends_with';
            const caseSensitive = filter.caseSensitive ? ' (case sensitive)' : '';
            
            let description;
            switch(type) {
                case 'starts_with':
                    description = `starts with '${text}'${caseSensitive}`;
                    break;
                case 'ends_with':
                    description = `ends with '${text}'${caseSensitive}`;
                    break;
                case 'contains':
                    description = `contains '${text}'${caseSensitive}`;
                    break;
                case 'exact':
                    description = `exactly '${text}'${caseSensitive}`;
                    break;
                case 'not_starts_with':
                    description = `does not start with '${text}'${caseSensitive}`;
                    break;
                case 'not_ends_with':
                    description = `does not end with '${text}'${caseSensitive}`;
                    break;
                case 'not_contains':
                    description = `does not contain '${text}'${caseSensitive}`;
                    break;
                case 'not_exact':
                    description = `not exactly '${text}'${caseSensitive}`;
                    break;
                case 'min_length':
                    description = `minimum length ${text}`;
                    break;
                case 'max_length':
                    description = `maximum length ${text}`;
                    break;
                case 'regex':
                    description = `regex pattern ${text}`;
                    break;
                default:
                    description = `unknown filter: ${type}`;
                    break;
            }
            
            if (description !== 'invalid filter') {
                descriptions.push(description);
            }
        }
        
        if (descriptions.length === 0) return 'all words';
        
        const joinWord = mode === 'or' ? ' OR ' : ' AND ';
        let result = descriptions[0];
        for (let i = 1; i < descriptions.length; i++) {
            result += joinWord + descriptions[i];
        }
        return result;
    }

    static async #EnhancedRunLevel1(config = {dict_path: '', inlineMode: false, filters: []}) {
        function average(arr) {
            let sum = 0;
            for (let i = 0; i < arr.length; i++) {
                sum += arr[i];
            }
            return sum / arr.length;
        }
        
        try {
            const dict = JSON.parse(await fs.readFile(config.dict_path));
            
            // Ensure filters is an array
            const filters = Array.isArray(config.filters) ? config.filters : 
                          (config.filters ? [config.filters] : []);
            
            // Add mode property if it exists in config
            if (config.filterMode) {
                filters.mode = config.filterMode;
            }
            
            const filteredWords = [];
            const dictKeys = Object.keys(dict);
            
            // Apply filters to dictionary keys
            for (let i = 0; i < dictKeys.length; i++) {
                const key = dictKeys[i];
                try {
                    if (this.#applyFilters(key, filters)) {
                        filteredWords.push({key: key, explain: dict[key]});
                    }
                } catch (error) {
                    // Skip problematic keys
                    console.log(`Skipping key ${key}: ${error.message}`);
                }
            }
            
            // Sort results alphabetically
            filteredWords.sort((a, b) => a.key.localeCompare(b.key));
            
            // Clear line before printing filter info
            console.log('\n' + '='.repeat(60));
            console.log(`FILTERS: ${this.#buildFilterDescription(filters)}`);
            console.log(`RESULTS: Found ${filteredWords.length} matching words out of ${dictKeys.length} total`);
            console.log('='.repeat(60) + '\n');
            
            if (filteredWords.length === 0) {
                console.log('No words match the filters\n');
                return;
            }
            
            const runtimes = [];
            const inlineMode = config.inlineMode || false;
            const dictKeysForLookup = Object.keys(dict);
            
            for (let i = 0; i < filteredWords.length; i++) {
                const v = filteredWords[i];
                
                let start = performance.now();
                const tokenized_explain = tokenizeText(v.explain);
                let matchs = 0;
                
                // Optimized nested loops
                for (let j = 0; j < tokenized_explain.length; j++) {
                    const vd = tokenized_explain[j];
                    
                    for (let k = 0; k < dictKeysForLookup.length; k++) {
                        if (vd === dictKeysForLookup[k]) {
                            matchs++;
                            break; // Found match, no need to continue searching
                        }
                    }
                }
                
                let finish = performance.now();
                runtimes.push(Number((finish - start).toFixed(2)));
                
                const progress = `${i + 1}/${filteredWords.length}`;
                const percentage = `${(matchs/tokenized_explain.length*100).toFixed(2)}%`;
                const time = Number((finish-start).toFixed(2));
                const avgTime = average(runtimes).toFixed(2);
                
                if (inlineMode) {
                    // Multi-line mode - each entry on a new line with colors
                    console.log(`${progress} | time avg : ${avgTime} | ${v.key} : ${percentage} | ${(time > avgTime) ? ColorText.red(time) : ColorText.green(time)} ms`);
                } else {
                    // Overlay mode (default) - updates the same line
                    process.stdout.write(`\r\x1b[K${progress} | time avg : ${avgTime} | ${v.key} : ${percentage} | ${time} ms`);
                }
                
                // Allow event loop to process keypresses
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            
            // Final cleanup for overlay mode
            if (!inlineMode) {
                console.log('');
            }
            
            console.log(`\n✅ Completed processing ${filteredWords.length} items\n`);
            
        } catch (error) {
            console.error('❌ Error processing dictionary:', error.message);
        }
    }
}

// =============================================
// EXAMPLES - UNCOMMENT ONLY ONE AT A TIME
// =============================================

// 1. Words ending with 'ing' AND starting with 're'
// Dict.Level1({ 
//     dict_path: './dictionary.json',
//     filters: [
//         { type: 'ends_with', text: 'ing' },
//         { type: 'starts_with', text: 're' }
//     ],
//     filterMode: 'and'
// });

// 2. Words ending with 'ed' OR containing 'action'
// Dict.Level1({ 
//     dict_path: './dictionary.json',
//     filters: [
//         { type: 'ends_with', text: 'ed' },
//         { type: 'contains', text: 'action' }
//     ],
//     filterMode: 'or'
// });

// 3. Length and pattern filters
// Dict.Level1({ 
//     dict_path: './dictionary.json',
//     filters: [
//         { type: 'min_length', text: '5' },
//         { type: 'max_length', text: '8' },
//         { type: 'contains', text: 'ing' }
//     ]
// });

// 4. Case sensitive filter (Pro with capital P)
// Note: This finds 0 words because 'Pro' with capital P is rare
// Try 'pro' lowercase instead
// Dict.Level1({ 
//     dict_path: './dictionary.json',
//     filters: [
//         { type: 'starts_with', text: 'pro', caseSensitive: false }
//     ]
// });

// 5. Regex pattern (words with double letters)
// Dict.Level1({ 
//     dict_path: './dictionary.json',
//     filters: [
//         { type: 'regex', text: '([a-z])\\1' }
//     ]
// });

// 6. Mixed filters with OR mode

/*
Dict.Level1({ 
    dict_path: './dictionary.json',
    inlineMode: true
});
*/



// 7. Simple ends_with (backward compatibility)
// Dict.Level1({ 
//     dict_path: './dictionary.json',
//     filters: { type: 'ends_with', text: 'ed' }
// });

export default Dict