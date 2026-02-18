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
        const results = filters.map(filter => {
            try {
                // Skip invalid filters
                if (!filter || typeof filter !== 'object') {
                    return true; // Skip invalid filters
                }
                
                const filterText = filter.text || '';
                const filterType = filter.type || 'ends_with';
                const caseSensitive = filter.caseSensitive || false;
                
                // Handle empty filter text
                if (filterText === '') {
                    return true; // Skip empty filters
                }
                
                // Apply case sensitivity
                const keyToCheck = caseSensitive ? key : key.toLowerCase();
                const filterToCheck = caseSensitive ? filterText : filterText.toLowerCase();
                
                switch(filterType) {
                    case 'starts_with':
                        return keyToCheck.startsWith(filterToCheck);
                    case 'ends_with':
                        return keyToCheck.endsWith(filterToCheck);
                    case 'contains':
                        return keyToCheck.includes(filterToCheck);
                    case 'exact':
                        return keyToCheck === filterToCheck;
                    case 'not_starts_with':
                        return !keyToCheck.startsWith(filterToCheck);
                    case 'not_ends_with':
                        return !keyToCheck.endsWith(filterToCheck);
                    case 'not_contains':
                        return !keyToCheck.includes(filterToCheck);
                    case 'not_exact':
                        return keyToCheck !== filterToCheck;
                    case 'min_length':
                        return key.length >= (parseInt(filterText) || 0);
                    case 'max_length':
                        return key.length <= (parseInt(filterText) || Infinity);
                    case 'regex':
                        try {
                            const regex = new RegExp(filterText, caseSensitive ? '' : 'i');
                            return regex.test(key);
                        } catch (e) {
                            console.log(`Invalid regex pattern: ${filterText}`);
                            return true; // Skip invalid regex
                        }
                    default:
                        return keyToCheck.endsWith(filterToCheck);
                }
            } catch (error) {
                // If any filter fails, log and skip it
                console.log(`Filter error: ${error.message}`);
                return true;
            }
        });
        
        // Combine results based on mode
        if (mode === 'or') {
            return results.some(result => result === true);
        } else {
            return results.every(result => result === true);
        }
    }

    static #buildFilterDescription(filters = []) {
        if (!filters || filters.length === 0) {
            return 'all words';
        }
        
        const mode = filters.mode || 'and';
        const descriptions = filters.map(filter => {
            if (!filter || typeof filter !== 'object') return 'invalid filter';
            
            const text = filter.text || '';
            const type = filter.type || 'ends_with';
            const caseSensitive = filter.caseSensitive ? ' (case sensitive)' : '';
            
            const typeMap = {
                'starts_with': `starts with '${text}'${caseSensitive}`,
                'ends_with': `ends with '${text}'${caseSensitive}`,
                'contains': `contains '${text}'${caseSensitive}`,
                'exact': `exactly '${text}'${caseSensitive}`,
                'not_starts_with': `does not start with '${text}'${caseSensitive}`,
                'not_ends_with': `does not end with '${text}'${caseSensitive}`,
                'not_contains': `does not contain '${text}'${caseSensitive}`,
                'not_exact': `not exactly '${text}'${caseSensitive}`,
                'min_length': `minimum length ${text}`,
                'max_length': `maximum length ${text}`,
                'regex': `regex pattern ${text}`
            };
            
            return typeMap[type] || `unknown filter: ${type}`;
        }).filter(desc => desc !== 'invalid filter');
        
        if (descriptions.length === 0) return 'all words';
        
        const joinWord = mode === 'or' ? ' OR ' : ' AND ';
        return descriptions.join(joinWord);
    }

    static async #EnhancedRunLevel1(config = {dict_path: '', inlineMode: false, filters: []}) {
        function average(arr) {
            return arr.reduce((sum, num) => sum + num, 0) / arr.length;
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
            
            let filteredWords = [];
            
            // Apply filters to dictionary keys
            Object.keys(dict).forEach((key) => {
                try {
                    if (this.#applyFilters(key, filters)) {
                        filteredWords.push({key: key, explain: dict[key]});
                    }
                } catch (error) {
                    // Skip problematic keys
                    console.log(`Skipping key ${key}: ${error.message}`);
                }
            });
            
            // Sort results alphabetically
            filteredWords.sort((a, b) => a.key.localeCompare(b.key));
            
            // Clear line before printing filter info
            console.log('\n' + '='.repeat(60));
            console.log(`FILTERS: ${this.#buildFilterDescription(filters)}`);
            console.log(`RESULTS: Found ${filteredWords.length} matching words out of ${Object.keys(dict).length} total`);
            console.log('='.repeat(60) + '\n');
            
            if (filteredWords.length === 0) {
                console.log('No words match the filters\n');
                return;
            }
            
            let runtimes = [];
            const inlineMode = config.inlineMode || false;
            
            for (const [i, v] of filteredWords.entries()) {
                let start = performance.now();
                let tokenized_explain = tokenizeText(v.explain);
                let matchs = 0;
                
                tokenized_explain.forEach((vd) => {
                    Object.keys(dict).forEach((vdict) => {
                        if (vd == vdict) {
                            matchs++;
                        }
                    });
                });
                
                let finish = performance.now();
                runtimes.push(Number((finish - start).toFixed(2)));
                
                const progress = `${i + 1}/${filteredWords.length}`;
                const percentage = `${(matchs/tokenized_explain.length*100).toFixed(2)}%`;
                const time = Number((finish-start).toFixed(2));
                const avgTime = average(runtimes).toFixed(2);
                
                if (inlineMode) {
                    // Multi-line mode - each entry on a new line with colors
                    console.log(`${progress} | ${v.key} : ${percentage} | ${(time > avgTime) ? ColorText.red(time) : ColorText.green(time)} ms | time avg : ${avgTime}`);
                } else {
                    // Overlay mode (default) - updates the same line
                    process.stdout.write(`\r\x1b[K${progress} | ${v.key} : ${percentage} | ${time} ms | time avg : ${avgTime}`);
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