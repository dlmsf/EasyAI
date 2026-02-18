import fs from 'fs/promises'
import { performance } from 'perf_hooks';
import ColorText from '../../../useful/ColorText.js'
import runUntilEnter from '../../../useful/runUntilEnter.js';
import tokenizeText from '../../../useful/tokenizeText.js'
import path from 'path'

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

    static async Level2(config = {paths: [], inlineMode: false, output_path: './unique_words.json'}) {
        await runUntilEnter(async () => {
            await this.#EnhancedRunLevel2(config);
        });
        process.exit(0);
    }
    
    static async #EnhancedRunLevel2(config = {paths: [], inlineMode: false, output_path: './unique_words.json'}) {
        function average(arr) {
            let sum = 0;
            for (let i = 0; i < arr.length; i++) {
                sum += arr[i];
            }
            return sum / arr.length;
        }
        
        try {
            // Ensure paths is an array
            const paths = Array.isArray(config.paths) ? config.paths : 
                         (config.paths ? [config.paths] : []);
            
            if (paths.length === 0) {
                console.error('❌ No paths provided');
                return;
            }
            
            console.log('\n' + '='.repeat(60));
            console.log(`BUILDING UNIQUE WORD COLLECTION FROM MULTIPLE SOURCES`);
            console.log(`Sources to process: ${paths.length}`);
            for (let p = 0; p < paths.length; p++) {
                console.log(`  ${p+1}. ${paths[p]}`);
            }
            console.log('='.repeat(60) + '\n');
            
            const runtimes = [];
            const inlineMode = config.inlineMode || false;
            
            // Store unique words in a Set for automatic deduplication
            const uniqueWords = new Set();
            
            // Statistics per file
            const fileStats = [];
            let lastUniqueCount = 0;
            
            // Process each path
            for (let fileIndex = 0; fileIndex < paths.length; fileIndex++) {
                const filePath = paths[fileIndex];
                
                let fileContent;
                let fileType;
                let items = [];
                let fileItemCount = 0;
                
                try {
                    // Read file content
                    fileContent = await fs.readFile(filePath, 'utf8');
                    
                    // Determine file type and parse accordingly
                    if (filePath.endsWith('.json')) {
                        fileType = 'json';
                        try {
                            const jsonData = JSON.parse(fileContent);
                            
                            // Extract all text content from JSON structure
                            items = this.#extractTextFromJson(jsonData);
                            fileItemCount = items.length;
                            
                        } catch (jsonError) {
                            console.log(`  ⚠️  Invalid JSON in ${filePath}, treating as plain text`);
                            fileType = 'text';
                            items = [fileContent];
                            fileItemCount = 1;
                        }
                    } else {
                        fileType = 'text';
                        items = [fileContent];
                        fileItemCount = 1;
                    }
                    
                    console.log(`\n📄 Processing ${fileIndex + 1}/${paths.length}: ${path.basename(filePath)} (${fileType})`);
                    console.log(`   Text segments to process: ${fileItemCount.toLocaleString()}`);
                    
                } catch (readError) {
                    console.error(`  ❌ Error reading file ${filePath}: ${readError.message}`);
                    continue;
                }
                
                // Process each text segment
                for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
                    const item = items[itemIndex];
                    
                    let start = performance.now();
                    
                    // Tokenize the text content
                    const tokenized = tokenizeText(item);
                    
                    // Add all tokens to the unique words Set
                    let tokensAdded = 0;
                    const tokenizedLength = tokenized.length;
                    
                    for (let j = 0; j < tokenizedLength; j++) {
                        const token = tokenized[j];
                        
                        // Skip empty tokens
                        if (token && token.length > 0) {
                            // Store original token
                            if (!uniqueWords.has(token)) {
                                uniqueWords.add(token);
                                tokensAdded++;
                            }
                            
                            // Handle compound words with hyphens, slashes, underscores
                            if (token.length > 1 && (token.includes('-') || token.includes('/') || token.includes('\\') || token.includes('_'))) {
                                const subParts = token.split(/[\/\\\-_]+/);
                                const subPartsLength = subParts.length;
                                for (let k = 0; k < subPartsLength; k++) {
                                    const subPart = subParts[k];
                                    if (subPart && subPart.length > 0 && /[a-zA-Z0-9]/.test(subPart) && !uniqueWords.has(subPart)) {
                                        uniqueWords.add(subPart);
                                        tokensAdded++;
                                    }
                                }
                            }
                            
                            // Handle contractions and apostrophes
                            if (token.length > 1 && token.includes("'")) {
                                const apostropheParts = token.split("'");
                                const apostrophePartsLength = apostropheParts.length;
                                for (let k = 0; k < apostrophePartsLength; k++) {
                                    const part = apostropheParts[k];
                                    if (part && part.length > 0 && /[a-zA-Z0-9]/.test(part) && !uniqueWords.has(part)) {
                                        uniqueWords.add(part);
                                        tokensAdded++;
                                    }
                                }
                            }
                        }
                    }
                    
                    let finish = performance.now();
                    runtimes.push(Number((finish - start).toFixed(2)));
                    
                    const currentUniqueCount = uniqueWords.size;
                    const time = Number((finish - start).toFixed(2));
                    const avgTime = average(runtimes).toFixed(2);
                    
                    // Update progress every 10 items to reduce I/O
                    if (itemIndex % 10 === 0 || itemIndex === items.length - 1) {
                        const globalProgress = `${fileIndex + 1}/${paths.length} files, ${(itemIndex + 1).toLocaleString()}/${fileItemCount.toLocaleString()} segments`;
                        
                        // Truncate item preview for display
                        let itemPreview = '';
                        if (typeof item === 'string') {
                            itemPreview = item.length > 40 ? item.substring(0, 40) + '...' : item;
                        } else {
                            itemPreview = 'non-string';
                        }
                        
                        if (inlineMode) {
                            // Multi-line mode
                            console.log(`${globalProgress} | time avg: ${avgTime}ms | Added: ${tokensAdded} | Total: ${currentUniqueCount.toLocaleString()} | ${(time > avgTime) ? ColorText.red(time) : ColorText.green(time)}ms`);
                        } else {
                            // Overlay mode
                            process.stdout.write(`\r\x1b[K${globalProgress} | time avg: ${avgTime}ms | "${itemPreview.replace(/\n/g, ' ')}" | Unique: ${currentUniqueCount.toLocaleString()} | ${time}ms`);
                        }
                    }
                    
                    // Allow event loop to process occasionally
                    if (itemIndex % 100 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 0));
                    }
                }
                
                // Store stats for this file
                fileStats.push({
                    path: filePath,
                    filename: path.basename(filePath),
                    type: fileType,
                    items: fileItemCount,
                    contribution: uniqueWords.size - lastUniqueCount
                });
                lastUniqueCount = uniqueWords.size;
                
                console.log(`\n  ✅ Completed processing ${path.basename(filePath)} - Added ${(uniqueWords.size - lastUniqueCount + fileStats[fileStats.length-1].contribution).toLocaleString()} new unique tokens`);
            }
            
            // Final cleanup for overlay mode
            if (!inlineMode) {
                console.log('');
            }
            
            // Convert Set to Array and sort for consistent output
            console.log('\n⏱️  Sorting unique tokens...');
            const uniqueWordsArray = Array.from(uniqueWords).sort();
            
            console.log('\n' + '='.repeat(60));
            console.log(`✅ COMPLETED: Found ${uniqueWordsArray.length.toLocaleString()} unique words/tokens`);
            console.log('='.repeat(60));
            
            // Show contribution per file
            console.log('\n📊 CONTRIBUTION PER SOURCE:');
            console.log('-'.repeat(70));
            let cumulativeTotal = 0;
            for (let i = 0; i < fileStats.length; i++) {
                const stat = fileStats[i];
                cumulativeTotal += stat.contribution;
                const percentage = ((stat.contribution / uniqueWordsArray.length) * 100).toFixed(2);
                const paddedName = stat.filename.length > 35 ? stat.filename.substring(0, 32) + '...' : stat.filename;
                console.log(`  ${(i+1).toString().padStart(2)}. ${paddedName.padEnd(35)} : ${stat.contribution.toLocaleString().padStart(8)} tokens (${percentage.padStart(6)}%)`);
            }
            console.log('-'.repeat(70));
            console.log(`  TOTAL`.padEnd(39) + `: ${uniqueWordsArray.length.toLocaleString().padStart(8)} tokens (100.00%)`);
            
            // Show token statistics
            console.log('\n🔤 TOKEN STATISTICS:');
            console.log('-'.repeat(70));
            
            // Count tokens by type
            let alphabetic = 0, numeric = 0, punctuation = 0, mixed = 0;
            const sampleSize = Math.min(100000, uniqueWordsArray.length);
            
            for (let i = 0; i < sampleSize; i++) {
                const token = uniqueWordsArray[i];
                if (/^[a-zA-Z]+$/.test(token)) {
                    alphabetic++;
                } else if (/^\d+$/.test(token)) {
                    numeric++;
                } else if (/^[.,!?;:'"()\[\]{}<>@#$%^&*_+=\\|/~`-]+$/.test(token)) {
                    punctuation++;
                } else {
                    mixed++;
                }
            }
            
            // Scale up if we sampled
            if (sampleSize < uniqueWordsArray.length) {
                const ratio = uniqueWordsArray.length / sampleSize;
                alphabetic = Math.round(alphabetic * ratio);
                numeric = Math.round(numeric * ratio);
                punctuation = Math.round(punctuation * ratio);
                mixed = Math.round(mixed * ratio);
                
                // Ensure total matches
                const total = alphabetic + numeric + punctuation + mixed;
                if (total !== uniqueWordsArray.length) {
                    mixed += (uniqueWordsArray.length - total);
                }
            }
            
            console.log(`  Alphabetic words : ${alphabetic.toLocaleString().padStart(10)} (${((alphabetic/uniqueWordsArray.length)*100).toFixed(2)}%)`);
            console.log(`  Numeric tokens   : ${numeric.toLocaleString().padStart(10)} (${((numeric/uniqueWordsArray.length)*100).toFixed(2)}%)`);
            console.log(`  Punctuation      : ${punctuation.toLocaleString().padStart(10)} (${((punctuation/uniqueWordsArray.length)*100).toFixed(2)}%)`);
            console.log(`  Mixed tokens     : ${mixed.toLocaleString().padStart(10)} (${((mixed/uniqueWordsArray.length)*100).toFixed(2)}%)`);
            
            // Show sample of unique words
            console.log('\n📝 SAMPLE UNIQUE TOKENS (first 50):');
            console.log('-'.repeat(70));
            const displaySample = Math.min(50, uniqueWordsArray.length);
            const columns = 4;
            for (let i = 0; i < displaySample; i += columns) {
                let line = '  ';
                for (let j = 0; j < columns && i + j < displaySample; j++) {
                    const token = uniqueWordsArray[i + j];
                    const displayToken = token.length > 18 ? token.substring(0, 15) + '...' : token;
                    line += `"${displayToken}"`.padEnd(20);
                }
                console.log(line);
            }
            
            if (uniqueWordsArray.length > 50) {
                console.log(`  ... and ${(uniqueWordsArray.length - 50).toLocaleString()} more tokens`);
            }
            
            // Save to file
            const outputPath = config.output_path || './unique_words.json';
            
            console.log(`\n💾 Saving to ${outputPath}...`);
            
            // Create enhanced output with metadata
            const enhancedOutput = {
                metadata: {
                    totalUniqueTokens: uniqueWordsArray.length,
                    sources: paths.map(p => ({
                        path: p,
                        filename: path.basename(p)
                    })),
                    fileStats: fileStats,
                    tokenStatistics: {
                        alphabetic,
                        numeric,
                        punctuation,
                        mixed,
                        total: uniqueWordsArray.length
                    },
                    generatedAt: new Date().toISOString(),
                    processingTime: average(runtimes).toFixed(2) + 'ms avg per item',
                    version: '2.0'
                },
                words: uniqueWordsArray
            };
            
            await fs.writeFile(outputPath, JSON.stringify(enhancedOutput, null, 2));
            console.log(`  ✅ Saved to: ${outputPath}`);
            
            // Also save a simple array version
            const simpleOutputPath = outputPath.replace('.json', '.simple.json');
            await fs.writeFile(simpleOutputPath, JSON.stringify(uniqueWordsArray, null, 2));
            console.log(`  ✅ Simple array version saved to: ${simpleOutputPath}`);
            
            // Save a compressed version for very large files
            if (uniqueWordsArray.length > 100000) {
                const compressedOutputPath = outputPath.replace('.json', '.compressed.json');
                const compressed = {
                    total: uniqueWordsArray.length,
                    preview: uniqueWordsArray.slice(0, 1000),
                    stats: enhancedOutput.metadata.tokenStatistics
                };
                await fs.writeFile(compressedOutputPath, JSON.stringify(compressed, null, 2));
                console.log(`  ✅ Compressed preview saved to: ${compressedOutputPath}`);
            }
            
            console.log('\n✨ Processing complete!\n');
            
        } catch (error) {
            console.error('❌ Error processing files:', error.message);
            console.error(error.stack);
        }
    }
    
    // Helper method to extract all text content from JSON structure recursively
    static #extractTextFromJson(data, texts = []) {
        if (data === null || data === undefined) {
            return texts;
        }
        
        if (typeof data === 'string') {
            // If it's a string, add it directly
            texts.push(data);
        } else if (Array.isArray(data)) {
            // If it's an array, process each element
            for (let i = 0; i < data.length; i++) {
                this.#extractTextFromJson(data[i], texts);
            }
        } else if (typeof data === 'object') {
            // If it's an object, process all values
            const values = Object.values(data);
            for (let i = 0; i < values.length; i++) {
                this.#extractTextFromJson(values[i], texts);
            }
        }
        // Ignore numbers, booleans, etc. as they're not text
        
        return texts;
    }

    static async Level3(config = {words_path: '', inlineMode: false, output_path: './word_types.json'}) {
        await runUntilEnter(async () => {
            await this.#EnhancedRunLevel3(config);
        });
        process.exit(0);
    }
    
    static #WORD_TYPES = {
        // Core types with patterns and subtypes
        NOUN: { 
            name: 'noun', 
            priority: 1,
            patterns: [
                // Common noun patterns
                { regex: /^(a|an|the) /, type: 'determined_noun' },
                { regex: /^[A-Z][a-z]+(s|es)?$/, type: 'proper_noun_candidate' }, // Capitalized words
                { regex: /(tion|sion|ment|ness|ity|ance|ence|ship|dom|hood|ism|ist|ure|age|ery|ory|ary)$/i, type: 'abstract_noun' },
                { regex: /(er|or|ist|ian)$/i, type: 'agent_noun' }, // Person who does something
                { regex: /(ing)$/i, type: 'gerund' }, // Verbal noun
                { regex: /^[A-Z]\.?[A-Z]\.?$/, type: 'acronym' }, // Acronyms like USA, NASA
                { regex: /^(Mr|Mrs|Ms|Dr|Prof)\.?$/i, type: 'title' },
                { regex: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(day)?$/i, type: 'day' },
                { regex: /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(ember)?$/i, type: 'month' }
            ]
        },
        
        VERB: { 
            name: 'verb', 
            priority: 2,
            patterns: [
                // Verb patterns
                { regex: /(ing)$/i, type: 'present_participle' },
                { regex: /(ed)$/i, type: 'past_tense' },
                { regex: /(en)$/i, type: 'past_participle' },
                { regex: /(ize|ise|ify|ate)$/i, type: 'derived_verb' },
                { regex: /^(to) /i, type: 'infinitive_marker' },
                { regex: /^(can|could|may|might|must|shall|should|will|would)$/i, type: 'modal_verb' },
                { regex: /^(be|am|is|are|was|were|been|being)$/i, type: 'auxiliary_verb' },
                { regex: /^(have|has|had)$/i, type: 'auxiliary_verb' },
                { regex: /^(do|does|did)$/i, type: 'auxiliary_verb' }
            ]
        },
        
        ADJECTIVE: { 
            name: 'adjective', 
            priority: 3,
            patterns: [
                // Adjective patterns
                { regex: /(ous|ious|eous)$/i, type: 'quality_adjective' },
                { regex: /(able|ible)$/i, type: 'capability_adjective' },
                { regex: /(ful|less)$/i, type: 'quantity_adjective' },
                { regex: /(ic|ical)$/i, type: 'relational_adjective' },
                { regex: /(ive|ative)$/i, type: 'tendency_adjective' },
                { regex: /(al|ial)$/i, type: 'relational_adjective' },
                { regex: /(ary)$/i, type: 'relational_adjective' },
                { regex: /(ish)$/i, type: 'diminutive_adjective' },
                { regex: /(y)$/i, type: 'descriptive_adjective' },
                { regex: /^(un|in|im|il|ir|non)/i, type: 'negative_adjective' },
                { regex: /^(pre|post|anti|pro)/i, type: 'positional_adjective' }
            ]
        },
        
        ADVERB: { 
            name: 'adverb', 
            priority: 4,
            patterns: [
                // Adverb patterns
                { regex: /(ly)$/i, type: 'manner_adverb' },
                { regex: /(wards?)$/i, type: 'directional_adverb' },
                { regex: /^(very|quite|rather|somewhat|almost|nearly|just|too|enough)$/i, type: 'degree_adverb' },
                { regex: /^(here|there|everywhere|somewhere|anywhere|nowhere)$/i, type: 'place_adverb' },
                { regex: /^(now|then|today|tomorrow|yesterday|always|never|sometimes)$/i, type: 'time_adverb' },
                { regex: /^(how|when|where|why)$/i, type: 'interrogative_adverb' }
            ]
        },
        
        PRONOUN: { 
            name: 'pronoun', 
            priority: 5,
            patterns: [
                // Pronoun patterns
                { regex: /^(i|me|my|mine|myself)$/i, type: 'first_person' },
                { regex: /^(you|your|yours|yourself|yourselves)$/i, type: 'second_person' },
                { regex: /^(he|him|his|himself|she|her|hers|herself|it|its|itself)$/i, type: 'third_person_singular' },
                { regex: /^(we|us|our|ours|ourselves)$/i, type: 'first_person_plural' },
                { regex: /^(they|them|their|theirs|themselves)$/i, type: 'third_person_plural' },
                { regex: /^(this|that|these|those)$/i, type: 'demonstrative' },
                { regex: /^(who|whom|whose|which|what)$/i, type: 'interrogative' },
                { regex: /^(anybody|anyone|anything|everybody|everyone|everything|somebody|someone|something|nobody|no one|nothing)$/i, type: 'indefinite' },
                { regex: /^(each|either|neither|both|all|few|many|several)$/i, type: 'quantifier' }
            ]
        },
        
        PREPOSITION: { 
            name: 'preposition', 
            priority: 6,
            patterns: [
                // Preposition patterns
                { regex: /^(about|above|across|after|against|along|among|around|at)$/i, type: 'simple_preposition' },
                { regex: /^(before|behind|below|beneath|beside|between|beyond|by)$/i, type: 'simple_preposition' },
                { regex: /^(down|during|except|for|from|in|inside|into|like|near)$/i, type: 'simple_preposition' },
                { regex: /^(of|off|on|onto|out|outside|over|past|since|through)$/i, type: 'simple_preposition' },
                { regex: /^(throughout|to|toward|under|underneath|until|up|upon|with|within|without)$/i, type: 'simple_preposition' },
                { regex: /^(according to|because of|in front of|in spite of|instead of|on account of)$/i, type: 'compound_preposition' }
            ]
        },
        
        CONJUNCTION: { 
            name: 'conjunction', 
            priority: 7,
            patterns: [
                // Conjunction patterns
                { regex: /^(and|or|but|nor|yet|so)$/i, type: 'coordinating' },
                { regex: /^(for|because|since|as)$/i, type: 'subordinating_cause' },
                { regex: /^(although|though|even though|while|whereas)$/i, type: 'subordinating_concession' },
                { regex: /^(if|unless|provided that|as long as)$/i, type: 'subordinating_condition' },
                { regex: /^(so that|in order that)$/i, type: 'subordinating_purpose' },
                { regex: /^(after|before|until|when|whenever|while|as soon as)$/i, type: 'subordinating_time' },
                { regex: /^(both\.\.\.and|either\.\.\.or|neither\.\.\.nor|not only\.\.\.but also)$/i, type: 'correlative' }
            ]
        },
        
        DETERMINER: { 
            name: 'determiner', 
            priority: 8,
            patterns: [
                // Determiner patterns
                { regex: /^(a|an|the)$/i, type: 'article' },
                { regex: /^(this|that|these|those)$/i, type: 'demonstrative' },
                { regex: /^(my|your|his|her|its|our|their)$/i, type: 'possessive' },
                { regex: /^(any|some|no|every|each|either|neither)$/i, type: 'quantifier' },
                { regex: /^(much|many|few|little|several|enough)$/i, type: 'quantifier_amount' },
                { regex: /^(all|both|half|double|twice)$/i, type: 'quantifier_multiplicative' },
                { regex: /^(what|which|whose)$/i, type: 'interrogative' }
            ]
        },
        
        INTERJECTION: { 
            name: 'interjection', 
            priority: 9,
            patterns: [
                // Interjection patterns
                { regex: /^(oh|ah|wow|ouch|oops|hey|hi|hello|goodbye|bye)$/i, type: 'basic_interjection' },
                { regex: /^(hooray|yay|yippee|bravo|hurray)$/i, type: 'joy_interjection' },
                { regex: /^(alas|darn|damn|heck|shoot)$/i, type: 'frustration_interjection' },
                { regex: /^(ew|yuck|ick|ugh)$/i, type: 'disgust_interjection' },
                { regex: /^(hmm|mmm|uh|um|er)$/i, type: 'hesitation_interjection' },
                { regex: /^(psst|shh|ahem)$/i, type: 'attention_interjection' },
                { regex: /^(whew|phew|puff)$/i, type: 'relief_interjection' },
                { regex: /^(gosh|golly|geez|jeez)$/i, type: 'surprise_interjection' }
            ]
        },
        
        NUMERAL: { 
            name: 'numeral', 
            priority: 10,
            patterns: [
                // Numeral patterns
                { regex: /^\d+$/, type: 'cardinal_number' },
                { regex: /^\d+(st|nd|rd|th)$/, type: 'ordinal_number' },
                { regex: /^\d+(\.\d+)?%$/, type: 'percentage' },
                { regex: /^\d+:\d+$/, type: 'time' },
                { regex: /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/, type: 'date' },
                { regex: /^\d+\.\d+$/, type: 'decimal' },
                { regex: /^\d+\/\d+$/, type: 'fraction' },
                { regex: /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)$/i, type: 'cardinal_word' },
                { regex: /^(thir|four|fif|six|seven|eigh|nine)teen$/i, type: 'cardinal_word_teen' },
                { regex: /^(twen|thir|for|fif|six|seven|eigh|nine)ty$/i, type: 'cardinal_word_tens' },
                { regex: /^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)$/i, type: 'ordinal_word' }
            ]
        },
        
        PUNCTUATION: { 
            name: 'punctuation', 
            priority: 11,
            patterns: [
                // Punctuation patterns
                { regex: /^[.,!?;:]$/, type: 'sentence_punctuation' },
                { regex: /^["']$/, type: 'quotation_mark' },
                { regex: /^[()\[\]{}<>]$/, type: 'bracket' },
                { regex: /^[-–—]$/, type: 'dash' },
                { regex: /^[@#$%^&*_+=\\|/~`]$/, type: 'symbol' },
                { regex: /^\.\.\.$/, type: 'ellipsis' }
            ]
        },
        
        CONTRACTION: { 
            name: 'contraction', 
            priority: 12,
            patterns: [
                // Contraction patterns
                { regex: /'(m|s|re|ve|ll|d)$/i, type: 'verb_contraction' },
                { regex: /n't$/i, type: 'negative_contraction' },
                { regex: /^(can't|won't|shan't|don't|doesn't|didn't|haven't|hasn't|hadn't)$/i, type: 'negative_contraction' },
                { regex: /^(i'm|he's|she's|it's|we're|they're)$/i, type: 'pronoun_verb_contraction' },
                { regex: /^(i've|you've|we've|they've)$/i, type: 'pronoun_have_contraction' },
                { regex: /^(i'll|you'll|he'll|she'll|we'll|they'll)$/i, type: 'pronoun_will_contraction' },
                { regex: /^(i'd|you'd|he'd|she'd|we'd|they'd)$/i, type: 'pronoun_would_contraction' }
            ]
        },
        
        ABBREVIATION: { 
            name: 'abbreviation', 
            priority: 13,
            patterns: [
                // Abbreviation patterns
                { regex: /^[A-Z]\.([A-Z]\.)+$/, type: 'initialism' }, // U.S.A., U.K.
                { regex: /^[A-Z]{2,}$/, type: 'acronym' }, // NASA, NATO
                { regex: /^[a-z]\.$/, type: 'single_letter' }, // a., b., etc.
                { regex: /^(etc|eg|ie|vs|et al)\.?$/i, type: 'latin_abbreviation' },
                { regex: /^(mr|mrs|ms|dr|prof|rev|hon)\.?$/i, type: 'title_abbreviation' },
                { regex: /^(jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\.?$/i, type: 'month_abbreviation' },
                { regex: /^(mon|tue|wed|thu|fri|sat|sun)\.?$/i, type: 'day_abbreviation' },
                { regex: /^(st|ave|blvd|rd|ln|dr|ct|cir|hwy)\.?$/i, type: 'address_abbreviation' }
            ]
        },
        
        PREFIX: { 
            name: 'prefix', 
            priority: 14,
            patterns: [
                // Prefix patterns
                { regex: /^(un|re|in|im|il|ir|dis|mis|non|anti|pre|post|sub|super|inter|intra|ex|extra)$/i, type: 'common_prefix' },
                { regex: /^(semi|micro|macro|mini|maxi|multi|mono|bi|tri|quad)$/i, type: 'quantity_prefix' }
            ]
        },
        
        SUFFIX: { 
            name: 'suffix', 
            priority: 15,
            patterns: [
                // Suffix patterns
                { regex: /(ing|ed|en|er|est|ly|tion|sion|ment|ness|ity|ful|less|able|ible|ive|al|ial|ic|ical|ous|ious)$/i, type: 'common_suffix' }
            ]
        },
        
        // FALLBACK - proprio type for everything else
        LEXEME: { 
            name: 'lexeme', 
            priority: 16,
            patterns: [
                // Lexeme patterns (catch-all for dictionary entries)
                { regex: /^[a-zA-Z]+$/, type: 'simple_lexeme' },
                { regex: /^[a-zA-Z]+[-\'][a-zA-Z]+$/, type: 'compound_lexeme' },
                { regex: /^[a-zA-Z]+ [a-zA-Z]+$/, type: 'phrasal_lexeme' }
            ],
            isFallback: true
        }
    };
    
    static #getWordType(word) {
        if (!word || typeof word !== 'string') {
            return {
                mainType: 'invalid',
                subType: 'empty_or_null',
                priority: 999,
                patterns: []
            };
        }
    
        const trimmedWord = word.trim();
        if (trimmedWord === '') {
            return {
                mainType: 'invalid',
                subType: 'empty_string',
                priority: 999,
                patterns: []
            };
        }
    
        const matchedTypes = [];
    
        // Iterate through all word types by priority
        const sortedTypes = Object.entries(this.#WORD_TYPES)
            .sort(([, a], [, b]) => a.priority - b.priority);
    
        for (const [typeKey, typeConfig] of sortedTypes) {
            for (const pattern of typeConfig.patterns) {
                try {
                    if (pattern.regex.test(trimmedWord)) {
                        matchedTypes.push({
                            mainType: typeConfig.name,
                            subType: pattern.type,
                            priority: typeConfig.priority,
                            matchedPattern: pattern.regex.toString()
                        });
                        
                        // If it's a specific match with high priority, we can break early
                        // but we continue to collect all matches for debugging
                        if (typeConfig.priority <= 3) {
                            break; // Break pattern loop for this type
                        }
                    }
                } catch (error) {
                    // Skip invalid regex patterns
                    console.log(`Regex error for word "${word}": ${error.message}`);
                }
            }
        }
    
        // If no matches found, use fallback lexeme type
        if (matchedTypes.length === 0) {
            // Determine if it contains any alphabetic characters
            if (/[a-zA-Z]/.test(trimmedWord)) {
                return {
                    mainType: 'lexeme',
                    subType: /[^a-zA-Z0-9\s]/.test(trimmedWord) ? 'punctuated_lexeme' : 'simple_lexeme',
                    priority: this.#WORD_TYPES.LEXEME.priority,
                    patterns: ['fallback_lexeme_match']
                };
            } else {
                return {
                    mainType: 'symbol',
                    subType: 'non_alphabetic',
                    priority: 999,
                    patterns: ['fallback_symbol_match']
                };
            }
        }
    
        // Return the match with highest priority (lowest priority number)
        return matchedTypes.sort((a, b) => a.priority - b.priority)[0];
    }
    
    static async #EnhancedRunLevel3(config = {words_path: '', inlineMode: false, output_path: './word_types.json'}) {
        function average(arr) {
            let sum = 0;
            for (let i = 0; i < arr.length; i++) {
                sum += arr[i];
            }
            return sum / arr.length;
        }
        
        try {
            // Read the unique words array
            const wordsData = await fs.readFile(config.words_path, 'utf8');
            const uniqueWords = JSON.parse(wordsData);
            
            // Ensure it's an array
            const wordsArray = Array.isArray(uniqueWords) ? uniqueWords : 
                              (uniqueWords.words || uniqueWords.data || []);
            
            console.log('\n' + '='.repeat(60));
            console.log(`CLASSIFYING WORD TYPES`);
            console.log(`Total words to classify: ${wordsArray.length}`);
            console.log('='.repeat(60) + '\n');
            
            const runtimes = [];
            const inlineMode = config.inlineMode || false;
            
            // Results object
            const wordTypes = {};
            const typeCount = {};
            
            // Process each word
            for (let i = 0; i < wordsArray.length; i++) {
                const word = wordsArray[i];
                
                let start = performance.now();
                
                // Get word type using comprehensive classification
                const typeInfo = this.#getWordType(word);
                wordTypes[word] = typeInfo;
                
                // Count types for statistics
                const mainType = typeInfo.mainType;
                typeCount[mainType] = (typeCount[mainType] || 0) + 1;
                
                let finish = performance.now();
                runtimes.push(Number((finish - start).toFixed(2)));
                
                const progress = `${i + 1}/${wordsArray.length}`;
                const percentage = `${((i + 1) / wordsArray.length * 100).toFixed(2)}%`;
                const time = Number((finish - start).toFixed(2));
                const avgTime = average(runtimes).toFixed(2);
                
                if (inlineMode) {
                    // Multi-line mode with colors
                    console.log(`${progress} (${percentage}) | time avg: ${avgTime} | "${word}" → ${typeInfo.mainType}:${typeInfo.subType} | ${(time > avgTime) ? ColorText.red(time) : ColorText.green(time)} ms`);
                } else {
                    // Overlay mode
                    process.stdout.write(`\r\x1b[K${progress} (${percentage}) | time avg: ${avgTime} | Current: "${word}" → ${typeInfo.mainType}:${typeInfo.subType} | ${time} ms`);
                }
                
                // Allow event loop to process keypresses
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            
            // Final cleanup for overlay mode
            if (!inlineMode) {
                console.log('');
            }
            
            // Sort type statistics
            const sortedTypes = Object.entries(typeCount)
                .sort(([, a], [, b]) => b - a);
            
            console.log('\n' + '='.repeat(60));
            console.log('✅ CLASSIFICATION COMPLETE');
            console.log('='.repeat(60));
            
            // Show type statistics
            console.log('\n📊 TYPE DISTRIBUTION:');
            console.log('-'.repeat(40));
            
            let total = 0;
            for (const [type, count] of sortedTypes) {
                const percentage = ((count / wordsArray.length) * 100).toFixed(2);
                console.log(`  ${type.padEnd(15)} : ${count.toString().padStart(6)} (${percentage}%)`);
                total += count;
            }
            
            console.log('-'.repeat(40));
            console.log(`  TOTAL${' '.repeat(11)} : ${total.toString().padStart(6)} (100.00%)`);
            
            // Show sample classifications
            console.log('\n📝 SAMPLE CLASSIFICATIONS (first 30 words):');
            console.log('-'.repeat(60));
            
            const sampleWords = wordsArray.slice(0, Math.min(30, wordsArray.length));
            for (let i = 0; i < sampleWords.length; i++) {
                const word = sampleWords[i];
                const type = wordTypes[word];
                console.log(`  ${(i+1).toString().padStart(2)}. "${word.padEnd(20)}" → ${type.mainType}:${type.subType}`);
            }
            
            if (wordsArray.length > 30) {
                console.log(`  ... and ${wordsArray.length - 30} more words`);
            }
            
            // Save to file
            const outputPath = config.output_path || './word_types.json';
            
            // Create enhanced output with metadata
            const enhancedOutput = {
                metadata: {
                    totalWords: wordsArray.length,
                    typeDistribution: typeCount,
                    classifiedAt: new Date().toISOString(),
                    version: '1.0'
                },
                words: wordTypes
            };
            
            await fs.writeFile(outputPath, JSON.stringify(enhancedOutput, null, 2));
            console.log(`\n📁 Word types saved to: ${outputPath}`);
            
            // Also save a simplified version (just word -> type mappings)
            const simpleOutputPath = outputPath.replace('.json', '.simple.json');
            await fs.writeFile(simpleOutputPath, JSON.stringify(wordTypes, null, 2));
            console.log(`📁 Simplified version saved to: ${simpleOutputPath}\n`);
            
        } catch (error) {
            console.error('❌ Error classifying words:', error.message);
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


//Dict.Level2({paths : ['./dictionary.json','./offmodels/largedictionary.json','./english_transcripts.json']})
//Dict.Level3({words_path : 'unique_words.simple.json',inlineMode : true})




// 7. Simple ends_with (backward compatibility)
// Dict.Level1({ 
//     dict_path: './dictionary.json',
//     filters: { type: 'ends_with', text: 'ed' }
// });

export default Dict