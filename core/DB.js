// ========== db.js - The Only File You Need ==========
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ========== Default Storage Instance (singleton) ==========
let defaultStorage = null;

export function setDefaultStorage(storage) {
  defaultStorage = storage;
}

export function getDefaultStorage() {
  if (!defaultStorage) {
    defaultStorage = new JSONStorage();
  }
  return defaultStorage;
}

// ========== 1. Storage Connection Interface ==========
export class StorageConnection {
  constructor(options = {}) {
    this.name = options.name || 'app';
    this.autoSave = options.autoSave ?? true;
  }

  async save(key, data) { throw new Error('save() must be implemented'); }
  async load(key) { throw new Error('load() must be implemented'); }
  async delete(key) { throw new Error('delete() must be implemented'); }
  async list() { throw new Error('list() must be implemented'); }
}

// ========== 2. JSON Storage (Default) ==========
export class JSONStorage extends StorageConnection {
  constructor(options = {}) {
    super(options);
    this.folder = options.folder || path.join(process.cwd(), 'data');
    this.extension = options.extension || '.json';
    
    fs.mkdir(this.folder, { recursive: true }).catch(() => {});
  }

  _getFilePath(key) {
    return path.join(this.folder, `${key}${this.extension}`);
  }

  _serialize(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (obj instanceof Map) {
      return { __type: 'Map', data: Array.from(obj.entries()) };
    }
    if (obj instanceof Set) {
      return { __type: 'Set', data: Array.from(obj) };
    }
    if (obj instanceof Date) {
      return { __type: 'Date', data: obj.toISOString() };
    }
    if (obj instanceof RegExp) {
      return { __type: 'RegExp', data: obj.toString() };
    }
    if (Array.isArray(obj)) {
      return obj.map(v => this._serialize(v));
    }
    
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this._serialize(value);
    }
    return result;
  }

  _deserialize(obj) {
    if (obj && typeof obj === 'object') {
      if (obj.__type === 'Map') {
        return new Map(obj.data);
      }
      if (obj.__type === 'Set') {
        return new Set(obj.data);
      }
      if (obj.__type === 'Date') {
        return new Date(obj.data);
      }
      if (obj.__type === 'RegExp') {
        const match = obj.data.match(/\/(.*)\/([gimy]*)$/);
        return match ? new RegExp(match[1], match[2]) : new RegExp(obj.data);
      }
      if (Array.isArray(obj)) {
        return obj.map(v => this._deserialize(v));
      }
      
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this._deserialize(value);
      }
      return result;
    }
    return obj;
  }

  async save(key, data) {
    const filePath = this._getFilePath(key);
    const serialized = this._serialize(data);
    await fs.writeFile(filePath, JSON.stringify(serialized, null, 2));
  }

  async load(key) {
    try {
      const filePath = this._getFilePath(key);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      return this._deserialize(data);
    } catch (err) {
      return null;
    }
  }

  async delete(key) {
    try {
      const filePath = this._getFilePath(key);
      await fs.unlink(filePath);
    } catch (err) {}
  }

  async list() {
    try {
      const files = await fs.readdir(this.folder);
      return files
        .filter(f => f.endsWith(this.extension))
        .map(f => f.replace(this.extension, ''));
    } catch (err) {
      return [];
    }
  }
}

// ========== 3. Auto-Loading Cache ==========
const instanceCache = new Map();

// ========== 4. Helper to get full inheritance chain ==========
function getInheritanceChain(obj) {
  const chain = [];
  let proto = obj.constructor;
  
  // Traverse up the prototype chain until we hit DB or Object
  while (proto && proto.name && proto !== DB && proto !== Object) {
    chain.unshift(proto.name);
    proto = Object.getPrototypeOf(proto);
  }
  
  return chain;
}

// ========== 5. The DB Class - Unique Key Required, Storage Optional ==========
export class DB {
  // Unique key is REQUIRED as first parameter
  constructor(uniqueKey, storage = null) {
    if (!uniqueKey) {
      throw new Error('Unique key is required for DB instances');
    }
    
    // Use provided storage or get default
    this._storage = storage || getDefaultStorage();
    this._autoSave = this._storage.autoSave;
    this._uniqueKey = uniqueKey;
    
    // Build the full key with inheritance chain
    this._key = this._buildKey();
    
    // Check cache first
    const cacheKey = this._key;
    if (instanceCache.has(cacheKey)) {
      return instanceCache.get(cacheKey);
    }
    
    // Auto-load existing data
    this._loadPromise = this._storage.load(this._key).then(data => {
      if (data) {
        // Manually assign each property instead of Object.assign
        for (const [key, value] of Object.entries(data)) {
          // Skip internal properties and getters
          if (key === '_storage' || key === '_key' || key === '_autoSave' || 
              key === '_loadPromise' || key === '_uniqueKey' || key === 'inheritanceChain' ||
              key === 'uniqueKey' || key === 'storageKey' || key.startsWith('_')) {
            continue;
          }
          this[key] = value;
        }
      }
      instanceCache.set(cacheKey, this);
      return this;
    });
    
    // Return proxy for auto-save
    return new Proxy(this, {
      get: (target, prop) => {
        // If accessing, ensure load is complete
        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
          return undefined; // Not a thenable
        }
        
        const value = target[prop];
        if (typeof value === 'function' && 
            prop !== 'constructor' && 
            !prop.startsWith('_')) {
          return async (...args) => {
            // Wait for load to complete before method execution
            await target._loadPromise;
            const result = await value.apply(target, args);
            if (target._autoSave) {
              await target._saveNow();
            }
            return result;
          };
        }
        return value;
      },
      
      set: (target, prop, value) => {
        target[prop] = value;
        if (target._autoSave && !prop.startsWith('_')) {
          clearTimeout(target._saveTimeout);
          target._saveTimeout = setTimeout(() => {
            target._saveNow();
          }, 100);
        }
        return true;
      }
    });
  }

  // Build key that includes the entire inheritance chain
  _buildKey() {
    const chain = getInheritanceChain(this);
    // Format: Animal.Mammal.Dog:uniqueKey
    return `${chain.join('.')}:${this._uniqueKey}`;
  }

  async _saveNow() {
    const state = {};
    let current = this;
    
    // Collect all properties from the entire prototype chain
    while (current && current !== Object.prototype) {
      Object.getOwnPropertyNames(current).forEach(prop => {
        // Skip internal properties and getters
        if (prop === '_storage' || prop === '_key' || prop === '_autoSave' || 
            prop === '_saveTimeout' || prop === '_loadPromise' || prop === '_uniqueKey' || 
            prop === 'constructor' || prop.startsWith('_') ||
            prop === 'inheritanceChain' || prop === 'uniqueKey' || prop === 'storageKey') {
          return;
        }
        
        // Only save if it's a data property, not a getter
        const descriptor = Object.getOwnPropertyDescriptor(current, prop);
        if (descriptor && !descriptor.get) {
          state[prop] = current[prop];
        }
      });
      current = Object.getPrototypeOf(current);
    }
    
    await this._storage.save(this._key, state);
  }

  // Get the unique key for this instance
  get uniqueKey() {
    return this._uniqueKey;
  }

  // Get the full inheritance chain
  get inheritanceChain() {
    return getInheritanceChain(this);
  }

  // Get the full storage key
  get storageKey() {
    return this._key;
  }

  // Manual delete if needed
  async delete() {
    clearTimeout(this._saveTimeout);
    await this._storage.delete(this._key);
    instanceCache.delete(this._key);
    return this;
  }

  // Wait for load to complete
  async ready() {
    await this._loadPromise;
    return this;
  }

  // Static method to get all instances of a class (exact match)
  static async getAll(storage = null) {
    const store = storage || getDefaultStorage();
    const keys = await store.list();
    const instances = [];
    const className = this.name;
    
    for (const key of keys) {
      // Split key to get the class chain part
      const [classChain] = key.split(':');
      const classes = classChain.split('.');
      const lastClass = classes[classes.length - 1];
      
      // Only get instances where the last class matches (exact type)
      if (lastClass === className) {
        const uniqueKey = key.split(':')[1];
        const instance = new this(uniqueKey, store);
        await instance.ready();
        instances.push(instance);
      }
    }
    
    return instances;
  }
  
  // Get all instances that match or inherit from this class
  static async getAllIncludingSubclasses(storage = null) {
    const store = storage || getDefaultStorage();
    const keys = await store.list();
    const instances = [];
    const className = this.name;
    
    for (const key of keys) {
      // Split key to get the class chain part
      const [classChain] = key.split(':');
      const classes = classChain.split('.');
      
      // Check if this class appears anywhere in the chain
      if (classes.includes(className)) {
        const uniqueKey = key.split(':')[1];
        const instance = new this(uniqueKey, store);
        await instance.ready();
        instances.push(instance);
      }
    }
    
    return instances;
  }
  
  // Find by unique key (respects full inheritance)
  static async findBy(uniqueKey, storage = null) {
    const store = storage || getDefaultStorage();
    
    // We need to search for any key ending with :uniqueKey
    const keys = await store.list();
    const matchingKey = keys.find(k => k.endsWith(`:${uniqueKey}`));
    
    if (matchingKey) {
      const instance = new this(uniqueKey, store);
      await instance.ready();
      return instance;
    }
    return null;
  }
}

/* 
// ========== 6. YOUR CODE - Any depth of inheritance ==========

// Level 1: Base class extending DB
class Animal extends DB {
  constructor(uniqueKey, name, age) {
    super(uniqueKey);  // Just pass the unique key, storage is optional!
    this.name = name;
    this.age = age;
    this.type = 'animal';
    this.createdAt = new Date();
  }
  
  speak() {
    console.log(`${this.name} makes a sound`);
  }
  
  celebrateBirthday() {
    this.age++;
    // Auto-saves!
  }
}

// Level 2: Extending Animal
class Mammal extends Animal {
  constructor(uniqueKey, name, age, furColor) {
    super(uniqueKey, name, age);  // Pass unique key up
    this.furColor = furColor;
    this.type = 'mammal';
    this.warmBlooded = true;
    this.glands = new Set(['mammary']);
  }
  
  speak() {
    console.log(`${this.name} makes a mammal sound`);
  }
  
  shedFur() {
    console.log(`${this.name} is shedding`);
    // Auto-saves!
  }
}

// Level 3: Extending Mammal
class Dog extends Mammal {
  constructor(uniqueKey, name, age, furColor, breed) {
    super(uniqueKey, name, age, furColor);  // Pass unique key up
    this.breed = breed;
    this.type = 'dog';
    this.tricks = new Set();
    this.barkVolume = 5;
  }
  
  speak() {
    console.log(`${this.name} barks!`);
  }
  
  learnTrick(trick) {
    this.tricks.add(trick);
    // Auto-saves!
  }
  
  setBarkVolume(volume) {
    this.barkVolume = volume;
  }
}

// Level 4: Extending Dog
class GuideDog extends Dog {
  constructor(uniqueKey, name, age, furColor, breed, trainer) {
    super(uniqueKey, name, age, furColor, breed);  // Pass unique key up
    this.trainer = trainer;
    this.type = 'guideDog';
    this.isWorking = false;
    this.skills = new Map([
      ['guiding', 100],
      ['obedience', 100]
    ]);
  }
  
  speak() {
    console.log(`${this.name} gently nudges`);
  }
  
  toggleWorking() {
    this.isWorking = !this.isWorking;
    // Auto-saves!
  }
  
  improveSkill(skill, amount) {
    this.skills.set(skill, (this.skills.get(skill) || 0) + amount);
  }
}

// Another Level 3 class
class Cat extends Mammal {
  constructor(uniqueKey, name, age, furColor, livesLeft = 9) {
    super(uniqueKey, name, age, furColor);
    this.livesLeft = livesLeft;
    this.type = 'cat';
    this.napping = true;
  }
  
  speak() {
    console.log(`${this.name} meows`);
  }
  
  nap() {
    this.napping = true;
  }
  
  wakeUp() {
    this.napping = false;
  }
}

// ========== 7. USAGE EXAMPLES ==========
async function main() {
  // Storage is optional - uses default JSON storage
  // const storage = new JSONStorage({ folder: './animals' });
  // setDefaultStorage(storage); // Optionally set custom default

  console.log('=== Creating animals with inheritance chains ===\n');

  // Create a Dog (Animal <- Mammal <- Dog)
  const rex = new Dog('rex-123', 'Rex', 3, 'brown', 'German Shepherd');
  console.log(`Created ${rex.name} the ${rex.breed}`);
  console.log('Storage key:', rex.storageKey); // "Animal.Mammal.Dog:rex-123"
  console.log('Inheritance:', rex.inheritanceChain.join(' -> ')); // "Animal -> Mammal -> Dog"
  
  // Train some tricks
  rex.learnTrick('sit');
  rex.learnTrick('stay');
  rex.learnTrick('roll over');
  rex.setBarkVolume(8);
  
  // Create a GuideDog (Animal <- Mammal <- Dog <- GuideDog)
  const buddy = new GuideDog('buddy-456', 'Buddy', 5, 'yellow', 'Labrador', 'Sarah');
  console.log(`\nCreated ${buddy.name} the Guide Dog`);
  console.log('Storage key:', buddy.storageKey); // "Animal.Mammal.Dog.GuideDog:buddy-456"
  console.log('Inheritance:', buddy.inheritanceChain.join(' -> ')); // "Animal -> Mammal -> Dog -> GuideDog"
  
  buddy.toggleWorking();
  buddy.improveSkill('guiding', 10);
  
  // Create a Cat (Animal <- Mammal <- Cat)
  const whiskers = new Cat('whiskers-789', 'Whiskers', 2, 'orange');
  console.log(`\nCreated ${whiskers.name} the Cat`);
  console.log('Storage key:', whiskers.storageKey); // "Animal.Mammal.Cat:whiskers-789"
  console.log('Inheritance:', whiskers.inheritanceChain.join(' -> ')); // "Animal -> Mammal -> Cat"
  
  whiskers.nap();
  
  // Wait a moment for auto-saves to complete
  await new Promise(r => setTimeout(r, 200));
  
  console.log('\n=== Finding by unique key (respects inheritance) ===\n');
  
  // Find by unique key - works across inheritance!
  const foundDog = await Dog.findBy('rex-123');
  if (foundDog) {
    console.log(`Found Dog: ${foundDog.name}, breed: ${foundDog.breed}`);
    console.log('Tricks:', [...foundDog.tricks]);
    console.log('Storage key:', foundDog.storageKey);
  }
  
  const foundGuideDog = await GuideDog.findBy('buddy-456');
  if (foundGuideDog) {
    console.log(`\nFound GuideDog: ${foundGuideDog.name}, trainer: ${foundGuideDog.trainer}`);
    console.log('Working:', foundGuideDog.isWorking);
    console.log('Skills:', Object.fromEntries(foundGuideDog.skills));
  }
  
  console.log('\n=== Getting all instances by class (exact match) ===\n');
  
  const allDogs = await Dog.getAll();
  console.log(`All Dogs (exact match): ${allDogs.length}`);
  for (const dog of allDogs) {
    console.log(`- ${dog.name} (${dog.storageKey})`);
  }
  
  const allMammals = await Mammal.getAll();
  console.log(`\nAll Mammals (exact match): ${allMammals.length}`);
  for (const mammal of allMammals) {
    console.log(`- ${mammal.name} (${mammal.constructor.name})`);
  }
  
  console.log('\n=== Getting all instances including subclasses ===\n');
  
  const allDogsAndSubclasses = await Dog.getAllIncludingSubclasses();
  console.log(`All Dogs + subclasses: ${allDogsAndSubclasses.length}`);
  for (const dog of allDogsAndSubclasses) {
    console.log(`- ${dog.name} (${dog.constructor.name})`);
  }
  
  const allMammalsAndSubclasses = await Mammal.getAllIncludingSubclasses();
  console.log(`\nAll Mammals + subclasses: ${allMammalsAndSubclasses.length}`);
  for (const mammal of allMammalsAndSubclasses) {
    console.log(`- ${mammal.name} (${mammal.constructor.name})`);
  }
  
  console.log('\n=== Cache demonstration (same unique key = same instance) ===\n');
  
  const rex2 = new Dog('rex-123', 'Different', 99, 'wrong', 'Wrong Breed');
  console.log('Same instance?', rex === rex2); // true
  console.log('Name still:', rex2.name); // "Rex", not "Different"
  console.log('Age still:', rex2.age); // 3, not 99
  
  console.log('\n=== Auto-save demonstration ===\n');
  
  // Just modify properties - auto-saves!
  rex.celebrateBirthday();
  rex.learnTrick('play dead');
  console.log(`${rex.name} is now ${rex.age} years old`);
  console.log('Tricks:', [...rex.tricks]);
  
  // Wait for auto-save
  await new Promise(r => setTimeout(r, 200));
  
  // Create new instance to verify persistence
  const rexReloaded = new Dog('rex-123');
  await rexReloaded.ready();
  console.log(`\nReloaded ${rexReloaded.name}: age ${rexReloaded.age}, ${rexReloaded.tricks.size} tricks`);
}

// Run it
main().catch(console.error);
*/